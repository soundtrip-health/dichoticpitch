const listeners = new Map();

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
  },

  off(event, fn) {
    const fns = listeners.get(event);
    if (fns) fns.delete(fn);
  },

  emit(event, data) {
    const fns = listeners.get(event);
    if (fns) fns.forEach(fn => fn(data));
  },
};
