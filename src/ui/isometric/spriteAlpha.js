const cache = new Map();

export function createAlphaSampler(width, height, pixels) {
  return (u, v) => {
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
    // Exclude soft baked shadows as well as transparent image corners.
    return (
      pixels[(Math.floor(v * height) * width + Math.floor(u * width)) * 4 + 3] >
      127
    );
  };
}

// Four shared source images, sampled once at more than twice their display size.
// No per-frame image reads, and listeners belong to the current board only.
export function getSpriteAlpha(url) {
  if (cache.has(url)) return cache.get(url);
  const listeners = new Set();
  const entry = {
    status: "pending",
    contains: () => false,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  cache.set(url, entry);
  if (typeof Image === "undefined") return entry;
  const source = new Image();
  const finish = (status) => {
    entry.status = status;
    for (const listener of listeners) listener();
  };
  source.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, 128, 128);
      entry.contains = createAlphaSampler(
        128,
        128,
        ctx.getImageData(0, 0, 128, 128).data,
      );
      finish("ready");
    } catch {
      finish("failed");
    }
  };
  source.onerror = () => finish("failed");
  source.src = url;
  return entry;
}
