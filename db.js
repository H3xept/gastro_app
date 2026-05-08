// Tiny IndexedDB wrapper for entries.
// One store, "entries". Each row: { id, type, time (ISO string), data, notes, createdAt }.
// "type" is one of: food | bloating | bm | sleep
const DB = (() => {
  const NAME = "gut-tracker";
  const VERSION = 1;
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains("entries")) {
          const store = db.createObjectStore("entries", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("time", "time");
          store.createIndex("type", "type");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(mode) {
    return open().then((db) => db.transaction("entries", mode).objectStore("entries"));
  }

  function put(entry) {
    return tx("readwrite").then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.put(entry);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  }

  function remove(id) {
    return tx("readwrite").then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        }),
    );
  }

  function get(id) {
    return tx("readonly").then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  }

  function all() {
    return tx("readonly").then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.index("time").getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        }),
    );
  }

  function clearAll() {
    return tx("readwrite").then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        }),
    );
  }

  return { put, remove, get, all, clearAll };
})();
