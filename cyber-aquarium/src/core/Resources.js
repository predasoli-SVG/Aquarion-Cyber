/** Explicit ownership avoids double disposal of shared maps and materials. */
export class Resources {
  constructor() { this.items = new Set(); this.callbacks = []; this.disposed = false; }
  own(item) { if (item) { if (this.disposed) item.dispose?.(); else this.items.add(item); } return item; }
  defer(fn) { this.callbacks.push(fn); return fn; }
  ownTree(root) {
    root.traverse(o => {
      if (o.geometry) this.own(o.geometry);
      for (const m of [o.material].flat().filter(Boolean)) {
        for (const value of Object.values(m)) if (value?.isTexture) this.own(value);
        this.own(m);
      }
    });
    return root;
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const fn of this.callbacks.reverse()) fn();
    this.callbacks.length = 0;
    for (const item of this.items) item.dispose?.();
    this.items.clear();
  }
}
