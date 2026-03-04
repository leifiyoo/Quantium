/**
 * History – undo / redo stack
 * Each state stores a snapshot of every layer's pixel data.
 */
class HistoryManager {
  constructor(maxSteps = 50) {
    this.maxSteps = maxSteps;
    this.stack = [];   // [{label, layers:[{id,imageData}]}]
    this.index = -1;   // points to current state
    this._listeners = [];
  }

  /** Call after any destructive operation with a human-readable label */
  snapshot(label, layerManager) {
    // Discard any redo states
    this.stack.splice(this.index + 1);

    const state = {
      label,
      layers: layerManager.layers.map(l => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        imageData: l.canvas ? l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height) : null,
      })),
      activeLayerId: layerManager.activeLayerId,
    };

    this.stack.push(state);
    if (this.stack.length > this.maxSteps) this.stack.shift();
    this.index = this.stack.length - 1;
    this._emit();
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }

  undo(layerManager) {
    if (!this.canUndo()) return;
    this.index--;
    this._restore(this.stack[this.index], layerManager);
    this._emit();
  }

  redo(layerManager) {
    if (!this.canRedo()) return;
    this.index++;
    this._restore(this.stack[this.index], layerManager);
    this._emit();
  }

  _restore(state, layerManager) {
    layerManager.restoreFromHistory(state);
  }

  getLabels() {
    return this.stack.map((s, i) => ({ label: s.label, current: i === this.index }));
  }

  onChange(fn) { this._listeners.push(fn); }
  _emit() { this._listeners.forEach(fn => fn()); }
}
