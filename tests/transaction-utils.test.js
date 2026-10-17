import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsvTransactions, validateStoredTransactions, combineWithoutDuplicates,
  isIsoDate, readCsvRecords} from '../transaction-utils.js';

const header='date,amount,type,category,description,channel,status';
const row='2026-10-12,150000,income,مبيعات,تحصيل يومي,cash,completed';

test('quoted commas, escaped quotes, BOM, CRLF and multiline descriptions',()=>{
  const input='\uFEFF'+header+'\r\n2026-10-12,12500,income,مبيعات,"مبيعات, ""مميزة""\r\nفرع بغداد",cash,completed\r\n';
  const rows=parseCsvTransactions(input,'case');
  assert.equal(rows.length,1);
  assert.equal(rows[0].description,'مبيعات, "مميزة"\nفرع بغداد');
  assert.equal(rows[0].amount,12500);
});

test('header order is not fixed but columns must be complete and unique',()=>{
  const input='amount,date,description,status,category,type,channel\n1500,2026-10-13,وصف,scheduled,مبيعات,expense,bank\n';
  assert.equal(parseCsvTransactions(input)[0].type,'expense');
  assert.throws(()=>parseCsvTransactions(header+',date\n'+row+',2026-10-11'),/عناوين/);
});

test('bad date, missing column, negative or scientific money, invalid state are rejected',()=>{
  assert.equal(isIsoDate('2024-02-29'),true);
  assert.equal(isIsoDate('2026-02-29'),false);
  for(const csv of [
    header+'\n2026-02-29,100,income,A,details,cash,completed',
    header+'\n2026-10-12,100,income,A,details,cash',
    header+'\n2026-10-12,-100,income,A,details,cash,completed',
    header+'\n2026-10-12,1e3,income,A,details,cash,completed',
    header+'\n2026-10-12,100,income,A,details,cash,invalid',
    header+'\n2026-10-12,100,income,A,details,cash,completed\nbad\n',
  ]) assert.throws(()=>parseCsvTransactions(csv),Error);
});

test('unclosed quotes and malformed post-quote content are rejected',()=>{
  assert.throws(()=>readCsvRecords(header+'\n2026-10-12,100,income,A,"no close,cash,completed'),/غير مغلقة/);
  assert.throws(()=>readCsvRecords(header+'\n2026-10-12,100,income,A,"quoted"garbage,cash,completed'),/غير متوقع/);
});

test('CSV and stored JSON reject record overflow and duplicate identifiers',()=>{
  assert.throws(()=>readCsvRecords('x'.repeat(2000001)),/أكبر/);
  const x=parseCsvTransactions(header+'\n'+row,'x')[0];
  assert.throws(()=>validateStoredTransactions([x,x]),/مكرر/);
  assert.throws(()=>validateStoredTransactions({a:x}),/ليست قائمة/);
});

test('duplicate re-import does not double cash amounts and first real CSV need not mix with demo',()=>{
  const incoming=parseCsvTransactions(header+'\n'+row,'first');
  const replay=parseCsvTransactions(header+'\n'+row,'second');
  const result=combineWithoutDuplicates(incoming,replay);
  assert.equal(result.added,0);
  assert.equal(result.skipped,1);
  assert.equal(result.transactions.length,1);
});

test('untrusted descriptions are kept as data, never executed by parsing',()=>{
  const payload='<img src=x onerror=alert(1)>';
  const x=parseCsvTransactions(header+'\n2026-10-13,123456,expense,A,"'+payload+'",bank,scheduled')[0];
  assert.equal(x.description,payload);
});
