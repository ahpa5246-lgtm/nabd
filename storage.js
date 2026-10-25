/** Read an existing ledger; storage failures never prevent opening the app. */
export function loadTransactions(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    return Array.isArray(value) ? value : fallback();
  } catch { return fallback(); }
}

/** Return false when the browser cannot persist a change. */
export function saveTransactions(storage, key, items, onError = () => {}) {
  try { storage.setItem(key, JSON.stringify(items)); return true; }
  catch { onError("تعذّر حفظ التغييرات على هذا المتصفح. صدّر نسخة احتياطية قبل إغلاق الصفحة."); return false; }
}
