// Persistencia local real en IndexedDB. Cada colección es un object store con clave `id`.
// Para usar un backend (Supabase/PostgreSQL) basta con implementar esta misma interfaz (ver docs/BACKEND.md).
export const COLLECTIONS = ['accounts', 'categories', 'transactions', 'pendings', 'debts', 'budgets', 'goals', 'recurrings', 'meta'];
const NAME = 'nexora', VERSION = 1;
let db = null;

export const supported = () => typeof indexedDB !== 'undefined';
export function open() {
  return new Promise((res, rej) => {
    if (!supported()) return rej(new Error('IndexedDB no disponible en este navegador.'));
    const rq = indexedDB.open(NAME, VERSION);
    rq.onupgradeneeded = () => { for (const c of COLLECTIONS) if (!rq.result.objectStoreNames.contains(c)) rq.result.createObjectStore(c, { keyPath: 'id' }); };
    rq.onsuccess = () => { db = rq.result; db.onversionchange = () => db.close(); res(db); };
    rq.onerror = () => rej(rq.error);
    rq.onblocked = () => rej(new Error('La base de datos está bloqueada por otra pestaña de NEXORA.'));
  });
}
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Transacción cancelada')); });
export async function loadAll() {
  const out = {};
  const tx = db.transaction(COLLECTIONS, 'readonly');
  await Promise.all(COLLECTIONS.map((c) => new Promise((res, rej) => { const r = tx.objectStore(c).getAll(); r.onsuccess = () => { out[c] = r.result; res(); }; r.onerror = () => rej(r.error); })));
  return out;
}
// Aplica un lote de cambios de forma atómica: o se guardan todos o ninguno.
export async function apply(changes) {
  if (!changes.length) return;
  const tx = db.transaction([...new Set(changes.map((c) => c[1]))], 'readwrite');
  for (const [op, coll, v] of changes) { const s = tx.objectStore(coll); if (op === 'put') s.put(JSON.parse(JSON.stringify(v))); else s.delete(v); }
  await done(tx);
}
export async function replaceAll(data) {
  const tx = db.transaction(COLLECTIONS, 'readwrite');
  for (const c of COLLECTIONS) { const s = tx.objectStore(c); s.clear(); for (const v of data[c] || []) s.put(JSON.parse(JSON.stringify(v))); }
  await done(tx);
}
