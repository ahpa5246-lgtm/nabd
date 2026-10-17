// Strict, atomic financial imports. No dependencies or remote processing.
export const CSV_COLUMNS = ['date', 'amount', 'type', 'category', 'description', 'channel', 'status'];
export const MAX_RECORDS = 10000;
export const MAX_CSV_CHARS = 2_000_000;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function fail(message) { throw new Error(message); }

export function validateTransaction(item, row = '?') {
  if (!item || typeof item !== 'object' || Array.isArray(item)) fail('السطر ' + row + ': بيانات الحركة غير صالحة');
  const type = String(item.type ?? '').trim().toLowerCase();
  const status = String(item.status ?? '').trim().toLowerCase();
  const channel = String(item.channel ?? '').trim().toLowerCase();
  const amountText = String(item.amount ?? '').trim();
  const amount = Number(amountText);
  if (!isIsoDate(item.date)) fail('السطر ' + row + ': التاريخ يجب أن يكون YYYY-MM-DD وحقيقيًا');
  if (!/^\d+(?:\.\d+)?$/.test(amountText) || !Number.isSafeInteger(amount) ||
      amount <= 0 || amount > 1_000_000_000_000) {
    fail('السطر ' + row + ': المبلغ يجب أن يكون عدد دنانير صحيحًا موجبًا');
  }
  if (!['income', 'expense'].includes(type)) fail('السطر ' + row + ': النوع income أو expense فقط');
  if (!['completed', 'scheduled'].includes(status)) fail('السطر ' + row + ': الحالة completed أو scheduled فقط');
  if (!['cash', 'zaincash', 'bank', 'other'].includes(channel)) fail('السطر ' + row + ': قناة التحصيل غير معروفة');
  const category = String(item.category ?? '').trim();
  const description = String(item.description ?? '').trim();
  if (!category || category.length > 120 || !description || description.length > 500) {
    fail('السطر ' + row + ': التصنيف والوصف مطلوبان، بحد أقصى 120 و500 حرف');
  }
  return {id: String(item.id ?? '').trim(), date: item.date, amount, type, category,
          description, channel, status};
}

export function validateStoredTransactions(value) {
  if (!Array.isArray(value) || value.length > MAX_RECORDS) fail('النسخة المحفوظة ليست قائمة حركات صالحة');
  const used = new Set();
  return value.map((x, i) => {
    const t = validateTransaction(x, i + 1);
    if (!t.id || t.id.length > 120 || used.has(t.id)) fail('السطر ' + (i + 1) + ': معرّف مفقود أو مكرر');
    used.add(t.id);
    return t;
  });
}

// Quoted commas, escaped quotes, LF/CRLF and embedded newlines.
export function readCsvRecords(text) {
  if (typeof text !== 'string' || text.length > MAX_CSV_CHARS) fail('ملف CSV أكبر من الحد المسموح');
  const input = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  let records = [], cells = [], field = '', quoted = false, closed = false, line = 1, startLine = 1;
  const addRecord = () => {
    if (cells.length === 0 && field.trim() === '') {field = ''; startLine = line; return;}
    cells.push(field); records.push({line: startLine, cells});
    if (records.length > MAX_RECORDS + 1) fail('ملف CSV يحتوي حركات أكثر من الحد المسموح');
    cells = []; field = ''; closed = false; startLine = line;
  };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {field += '"'; i++;}
        else {quoted = false; closed = true;}
      } else {
        if (ch === '\r' && input[i + 1] === '\n') {field += '\n'; i++;}
        else {field += ch;}
        if (ch === '\n' || ch === '\r') line++;
      }
      continue;
    }
    if (ch === '"') {
      if (field !== '' || closed) fail('السطر ' + line + ': تنسيق علامات الاقتباس غير صالح');
      quoted = true; continue;
    }
    if (ch === ',') {cells.push(field); field = ''; closed = false; continue;}
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      line++;
      addRecord(); continue;
    }
    if (closed && ch !== ' ' && ch !== '\t') fail('السطر ' + line + ': نص غير متوقع بعد الاقتباس');
    if (!closed) field += ch;
  }
  if (quoted) fail('السطر ' + startLine + ': علامة اقتباس غير مغلقة');
  addRecord();
  return records;
}

export function parseCsvTransactions(text, prefix = 'csv-' + Date.now()) {
  const records = readCsvRecords(text);
  if (!records.length) fail('ملف CSV فارغ');
  const headers = records[0].cells.map(x => x.trim().toLowerCase());
  if (headers.length !== CSV_COLUMNS.length || new Set(headers).size !== headers.length ||
      !CSV_COLUMNS.every(x => headers.includes(x))) {
    fail('عناوين CSV المطلوبة: ' + CSV_COLUMNS.join(','));
  }
  if (records.length === 1) fail('لا توجد حركات تحت عناوين CSV');
  return records.slice(1).map(({cells, line}, index) => {
    if (cells.length !== headers.length) fail('السطر ' + line + ': عدد الأعمدة غير مطابق');
    const obj = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    return validateTransaction({...obj, id: prefix + '-' + index}, line);
  });
}

export function transactionFingerprint(t) {
  return [t.date, t.amount, t.type, t.category, t.description, t.channel, t.status]
    .map(x => JSON.stringify(x)).join('|');
}

export function combineWithoutDuplicates(existing, incoming) {
  const fingerprints = new Set(existing.map(transactionFingerprint));
  const added = [];
  let skipped = 0;
  for (const row of incoming) {
    const fp = transactionFingerprint(row);
    if (fingerprints.has(fp)) {skipped++; continue;}
    fingerprints.add(fp); added.push(row);
  }
  if (existing.length + added.length > MAX_RECORDS) fail('تجاوزت الحركات الحد الأقصى للتخزين');
  return {transactions: existing.concat(added), added: added.length, skipped};
}
