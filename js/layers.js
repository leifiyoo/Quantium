/**
 * Layer system
 */

const BLEND_MODES = [
  'normal','dissolve',
  'darken','multiply','color-burn','linear-burn','darker-color',
  'lighten','screen','color-dodge','linear-dodge','lighter-color',
  'overlay','soft-light','hard-light','vivid-light','linear-light','pin-light','hard-mix',
  'difference','exclusion','subtract','divide',
  'hue','saturation','color','luminosity',
];

let _layerIdCounter = 0;

class Layer {
  constructor({ name, width, height, blendMode = 'normal', opacity = 1, visible = true, locked = false } = {}) {
    this.id = ++_layerIdCounter;
    this.name = name || `Layer ${this.id}`;
    this.visible = visible;
    this.locked = locked;
    this.opacity = opacity;        // 0–1
    this.blendMode = blendMode;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width || 800;
    this.canvas.height = height || 600;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this._maskCanvas = null;       // optional pixel mask
    this._maskCtx = null;
    this._clippingGroup = false;   // clip to layer below
    this._linkedToTransform = true;
    this._effects = {};            // drop shadow, etc. (metadata)
  }

  resize(w, h) {
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(this.canvas, 0, 0);
    this.canvas.width = w; this.canvas.height = h;
    this.ctx.drawImage(tmp, 0, 0);
  }

  clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  duplicate() {
    const clone = new Layer({
      name: this.name + ' copy',
      width: this.canvas.width,
      height: this.canvas.height,
      blendMode: this.blendMode,
      opacity: this.opacity,
      visible: this.visible,
      locked: this.locked,
    });
    clone.ctx.drawImage(this.canvas, 0, 0);
    return clone;
  }

  enableMask() {
    if (!this._maskCanvas) {
      this._maskCanvas = document.createElement('canvas');
      this._maskCanvas.width = this.canvas.width;
      this._maskCanvas.height = this.canvas.height;
      this._maskCtx = this._maskCanvas.getContext('2d', { willReadFrequently: true });
      // Fill mask with white (fully visible)
      this._maskCtx.fillStyle = '#fff';
      this._maskCtx.fillRect(0, 0, this._maskCanvas.width, this._maskCanvas.height);
    }
  }

  toDataURL() { return this.canvas.toDataURL(); }
}

class LayerManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = [];           // bottom → top
    this.activeLayerId = null;
    this._listeners = [];
  }

  get activeLayer() {
    return this.layers.find(l => l.id === this.activeLayerId) || null;
  }

  addLayer(opts = {}) {
    const layer = new Layer({ width: this.width, height: this.height, ...opts });
    this.layers.push(layer);
    this.activeLayerId = layer.id;
    this._emit('add', layer);
    return layer;
  }

  addLayerAt(index, opts = {}) {
    const layer = new Layer({ width: this.width, height: this.height, ...opts });
    this.layers.splice(index, 0, layer);
    this.activeLayerId = layer.id;
    this._emit('add', layer);
    return layer;
  }

  removeLayer(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1 || this.layers.length === 1) return;
    this.layers.splice(idx, 1);
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers[Math.min(idx, this.layers.length - 1)].id;
    }
    this._emit('remove');
  }

  duplicateLayer(id) {
    const src = this.layers.find(l => l.id === id);
    if (!src) return;
    const idx = this.layers.indexOf(src);
    const clone = src.duplicate();
    this.layers.splice(idx + 1, 0, clone);
    this.activeLayerId = clone.id;
    this._emit('duplicate');
    return clone;
  }

  mergeDown(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx <= 0) return;
    const top = this.layers[idx];
    const bot = this.layers[idx - 1];
    bot.ctx.save();
    bot.ctx.globalAlpha = top.opacity;
    bot.ctx.globalCompositeOperation = blendModeToComposite(top.blendMode);
    bot.ctx.drawImage(top.canvas, 0, 0);
    bot.ctx.restore();
    this.layers.splice(idx, 1);
    this.activeLayerId = bot.id;
    this._emit('merge');
  }

  mergeAll() {
    if (this.layers.length <= 1) return;
    const flat = this.flatten();
    const newLayer = new Layer({ name: 'Merged', width: this.width, height: this.height });
    newLayer.ctx.drawImage(flat, 0, 0);
    this.layers = [newLayer];
    this.activeLayerId = newLayer.id;
    this._emit('mergeAll');
  }

  moveLayer(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const [layer] = this.layers.splice(fromIdx, 1);
    this.layers.splice(toIdx, 0, layer);
    this._emit('move');
  }

  setActive(id) {
    this.activeLayerId = id;
    this._emit('active');
  }

  flatten() {
    const out = document.createElement('canvas');
    out.width = this.width; out.height = this.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.width, this.height);
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = blendModeToComposite(layer.blendMode);
      if (layer._maskCanvas) {
        const tmp = document.createElement('canvas');
        tmp.width = this.width; tmp.height = this.height;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(layer.canvas, 0, 0);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(layer._maskCanvas, 0, 0);
        ctx.drawImage(tmp, 0, 0);
      } else {
        ctx.drawImage(layer.canvas, 0, 0);
      }
      ctx.restore();
    }
    return out;
  }

  compositeToCanvas(outputCtx, viewportX, viewportY, scale) {
    outputCtx.clearRect(0, 0, outputCtx.canvas.width, outputCtx.canvas.height);
    // Checkerboard background
    drawCheckerboard(outputCtx, viewportX, viewportY, this.width * scale, this.height * scale);
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      outputCtx.save();
      outputCtx.globalAlpha = layer.opacity;
      outputCtx.globalCompositeOperation = blendModeToComposite(layer.blendMode);
      if (layer._maskCanvas) {
        const tmp = document.createElement('canvas');
        tmp.width = this.width * scale; tmp.height = this.height * scale;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(layer.canvas, 0, 0, this.width * scale, this.height * scale);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(layer._maskCanvas, 0, 0, this.width * scale, this.height * scale);
        outputCtx.drawImage(tmp, viewportX, viewportY);
      } else {
        outputCtx.drawImage(layer.canvas, viewportX, viewportY, this.width * scale, this.height * scale);
      }
      outputCtx.restore();
    }
  }

  restoreFromHistory(state) {
    // Rebuild layers array from snapshot
    const oldLayers = [...this.layers];
    this.layers = state.layers.map(snap => {
      // Reuse existing layer object if id matches
      let layer = oldLayers.find(l => l.id === snap.id);
      if (!layer) {
        layer = new Layer({ width: this.width, height: this.height });
        layer.id = snap.id;
      }
      layer.name = snap.name;
      layer.visible = snap.visible;
      layer.locked = snap.locked;
      layer.opacity = snap.opacity;
      layer.blendMode = snap.blendMode;
      if (snap.imageData) {
        layer.canvas.width = snap.imageData.width;
        layer.canvas.height = snap.imageData.height;
        layer.ctx.putImageData(snap.imageData, 0, 0);
      }
      return layer;
    });
    this.activeLayerId = state.activeLayerId;
    this._emit('restore');
  }

  onChange(fn) { this._listeners.push(fn); }
  _emit(type, data) { this._listeners.forEach(fn => fn(type, data)); }
}

function blendModeToComposite(mode) {
  const map = {
    normal: 'source-over',
    dissolve: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    darken: 'darken',
    lighten: 'lighten',
    'color-dodge': 'color-dodge',
    'color-burn': 'color-burn',
    'hard-light': 'hard-light',
    'soft-light': 'soft-light',
    difference: 'difference',
    exclusion: 'exclusion',
    hue: 'hue',
    saturation: 'saturation',
    color: 'color',
    luminosity: 'luminosity',
  };
  return map[mode] || 'source-over';
}

function drawCheckerboard(ctx, x, y, w, h) {
  const size = 10;
  ctx.save();
  ctx.fillStyle = '#aaa';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  for (let row = 0; row * size < h; row++) {
    for (let col = 0; col * size < w; col++) {
      if ((row + col) % 2 === 0) {
        ctx.fillRect(x + col * size, y + row * size, size, size);
      }
    }
  }
  ctx.restore();
}
