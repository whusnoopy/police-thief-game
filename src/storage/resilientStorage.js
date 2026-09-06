// Retain edits in this page if browser storage is denied/full. Dirty values take
// precedence over disk until a later save successfully flushes every value.
export function createResilientStorage(getStorage, onError = () => {}) {
  const cache = new Map();
  const dirty = new Set();
  const protectedKeys = new Set();
  const failedReads = new Set();

  function flush() {
    try {
      const storage = getStorage();
      for (const key of dirty) {
        if (protectedKeys.has(key) || failedReads.has(key)) {
          throw new Error("原始地图库无法读取，已保留原文；本次修改尚未保存，请导出备份。");
        }
        const value = cache.get(key);
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
        dirty.delete(key);
      }
      onError(null);
      return true;
    } catch (error) {
      onError(error);
      return false;
    }
  }

  return {
    getItem(key) {
      if (dirty.has(key)) return cache.get(key);
      try {
        const value = getStorage().getItem(key);
        cache.set(key, value);
        return value;
      } catch (error) {
        // A failed read must not later overwrite data we never managed to read.
        failedReads.add(key);
        onError(error);
        return cache.get(key) ?? null;
      }
    },
    setItem(key, value) {
      cache.set(key, String(value));
      dirty.add(key);
      if (!flush()) throw new Error("地图尚未保存到浏览器，请导出备份。");
    },
    removeItem(key) {
      cache.set(key, null);
      dirty.add(key);
      if (!flush()) throw new Error("存储更新失败，原始数据已保留。");
    },
    protectItem(key) {
      protectedKeys.add(key);
    },
    recoverReads(merge) {
      try {
        const storage = getStorage();
        for (const key of failedReads) {
          const stored = storage.getItem(key);
          cache.set(key, dirty.has(key) ? merge(key, stored, cache.get(key)) : stored);
          failedReads.delete(key);
        }
        return true;
      } catch (error) {
        onError(error);
        return false;
      }
    },
    flush,
  };
}
