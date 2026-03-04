/**
 * Quantium – main application
 */

class Selection {
  constructor() {
    this._current = null;
    this._last = null;
  }
  get active() { return !!this._current; }
  set(sel) { this._last = this._current; this._current = sel; }
  add(sel) { this._current = { type: 'union', a: this._current, b: sel }; }
  subtract(sel) { this._current = { type: 'subtract', a: this._current, b: sel }; }
  deselect() { this._last = this._current; this._current = null; }
  reselect() { this._current = this._last; }
  selectAll(w, h) { this.set({ type: 'rect', x: 0, y: 0, w, h }); }
  invert(w, h) {
    const cur = this._current;
    this._current = { type: 'subtract', a: { type: 'rect', x: 0, y: 0, w, h }, b: cur };
  }
  clipContext(ctx) {
    if (!this._current) return;
    applySelectionClip(ctx, this._current);
  }
}

function applySelectionClip(ctx, sel) {
  if (!sel) return;
  if (sel.type === 'rect') {
    ctx.beginPath(); ctx.rect(sel.x, sel.y, sel.w, sel.h); ctx.clip();
  } else if (sel.type === 'ellipse') {
    ctx.beginPath(); ctx.ellipse(sel.x + sel.w/2, sel.y + sel.h/2, sel.w/2, sel.h/2, 0, 0, Math.PI*2); ctx.clip();
  } else if (sel.type === 'polygon') {
    ctx.beginPath();
    sel.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.clip();
  } else if (sel.type === 'mask') {
    // Mask-based clip is complex; create temp canvas
    // (simplified: skip clip for mask type)
  }
}

class QuantiumApp {
  constructor() {
    // Canvas elements
    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.overlayCanvas = document.getElementById('overlay-canvas');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.canvasContainer = document.getElementById('canvas-container');

    // State
    this.scale = 1;
    this.canvasOffset = { x: 0, y: 0 };
    this.fgColor = '#000000';
    this.bgColor = '#ffffff';
    this.altHeld = false;
    this.shiftHeld = false;
    this.ctrlHeld = false;
    this._clipboard = null;
    this._lastFilter = null;

    // Brush/tool options
    this.brushOptions = { size: 20, opacity: 1, softness: 50, strength: 0.5 };
    this.fillOptions = { tolerance: 32, contiguous: true };
    this.gradientOptions = { type: 'linear', transparent: false, mode: 'foreground-to-bg' };
    this.shapeOptions = { fill: true, stroke: false, strokeWidth: 2, fillColor: null, strokeColor: null, cornerRadius: 10, sides: 5 };
    this.textOptions = { font: 'Arial', size: 24, bold: false, italic: false, align: 'left' };
    this.selectOptions = { tolerance: 32, contiguous: true };

    // Systems
    this.history = new HistoryManager(50);
    this.layers = new LayerManager(800, 600);
    this.selection = new Selection();

    // Tools
    this.tools = {};
    this.currentTool = null;

    // UI
    this.ui = null;

    // Init
    this._initCanvas();
    this._initTools();
    this._initEvents();

    this.ui = new UIManager(this);
    this.keyboard = new KeyboardManager(this);

    // Add default layer
    const bg = this.layers.addLayer({ name: 'Background' });
    bg.ctx.fillStyle = '#ffffff';
    bg.ctx.fillRect(0, 0, bg.canvas.width, bg.canvas.height);

    this.history.snapshot('New Document', this.layers);
    this.history.onChange(() => this.ui && this.ui.refreshHistory());
    this.layers.onChange(() => this.ui && this.ui.refreshLayers());

    this.activateTool('brush');
    this.fitToScreen();
    this.render();

    this.ui.init();
  }

  _initCanvas() {
    const resize = () => {
      const cc = this.canvasContainer;
      this.canvas.width = cc.clientWidth;
      this.canvas.height = cc.clientHeight;
      this.overlayCanvas.width = cc.clientWidth;
      this.overlayCanvas.height = cc.clientHeight;
      this.render();
    };
    new ResizeObserver(resize).observe(this.canvasContainer);
    setTimeout(resize, 0);
  }

  _initTools() {
    const T = (cls, ...args) => new cls(this, ...args);
    this.tools = {
      move: T(MoveTool),
      'rect-select': T(RectSelectTool),
      'ellipse-select': T(EllipseSelectTool),
      lasso: T(LassoTool),
      'polygon-lasso': T(PolygonLassoTool),
      'magic-wand': T(MagicWandTool),
      crop: T(CropTool),
      slice: T(SliceTool),
      eyedropper: T(EyedropperTool),
      'healing-brush': T(HealingBrushTool),
      'clone-stamp': T(CloneStampTool),
      brush: T(BrushTool),
      pencil: T(PencilTool),
      eraser: T(EraserTool),
      fill: T(FillTool),
      gradient: T(GradientTool),
      'blur-brush': T(BlurBrushTool),
      'sharpen-brush': T(SharpenBrushTool),
      smudge: T(SmudgeTool),
      dodge: T(DodgeBurnTool, 'dodge'),
      burn: T(DodgeBurnTool, 'burn'),
      sponge: T(DodgeBurnTool, 'sponge'),
      pen: T(PenTool),
      text: T(TextTool),
      'shape-rect': T(ShapeTool, 'rect'),
      'shape-rounded-rect': T(ShapeTool, 'rounded-rect'),
      'shape-ellipse': T(ShapeTool, 'ellipse'),
      'shape-triangle': T(ShapeTool, 'triangle'),
      'shape-polygon': T(ShapeTool, 'polygon'),
      'shape-star': T(ShapeTool, 'star'),
      'shape-line': T(ShapeTool, 'line'),
      transform: T(TransformTool),
      measure: T(MeasureTool),
      zoom: T(ZoomTool),
      hand: T(HandTool),
    };
  }

  _initEvents() {
    const toCanvasPoint = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left - this.canvasOffset.x) / this.scale;
      const cy = (e.clientY - rect.top - this.canvasOffset.y) / this.scale;
      return { x: cx, y: cy };
    };

    this.overlayCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      if (e.button === 1) return; // handled below (pan)
      // Space+drag = pan override
      if (this._spaceHeld) {
        this._panning = true;
        this._panStart = { x: e.clientX, y: e.clientY };
        return;
      }
      const pt = toCanvasPoint(e);
      this.currentTool && this.currentTool.onMouseDown(e, pt);
    });

    this.overlayCanvas.addEventListener('mousemove', (e) => {
      if (this._panning) {
        const dx = e.clientX - this._panStart.x;
        const dy = e.clientY - this._panStart.y;
        this.canvasOffset.x += dx; this.canvasOffset.y += dy;
        this._panStart = { x: e.clientX, y: e.clientY };
        this.render(); return;
      }
      const pt = toCanvasPoint(e);
      this.currentTool && this.currentTool.onMouseMove(e, pt);
      this.ui && this.ui.updateCoords(pt.x, pt.y);
    });

    this.overlayCanvas.addEventListener('mouseup', (e) => {
      this._panning = false;
      const pt = toCanvasPoint(e);
      this.currentTool && this.currentTool.onMouseUp(e, pt);
    });

    this.overlayCanvas.addEventListener('dblclick', (e) => {
      const pt = toCanvasPoint(e);
      this.currentTool && this.currentTool.onDblClick && this.currentTool.onDblClick(e, pt);
    });

    this.overlayCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = this.canvas.getBoundingClientRect();
        const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const worldX = (pt.x - this.canvasOffset.x) / this.scale;
        const worldY = (pt.y - this.canvasOffset.y) / this.scale;
        this.scale = Math.max(0.05, Math.min(32, this.scale * factor));
        this.canvasOffset.x = pt.x - worldX * this.scale;
        this.canvasOffset.y = pt.y - worldY * this.scale;
        this.render();
        this.ui && this.ui.updateZoomDisplay();
      } else {
        this.canvasOffset.x -= e.deltaX;
        this.canvasOffset.y -= e.deltaY;
        this.render();
      }
    }, { passive: false });

    // Space-bar for temporary hand tool
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this._spaceHeld) {
        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.contentEditable === 'true') return;
        e.preventDefault();
        this._spaceHeld = true;
        this.overlayCanvas.style.cursor = 'grab';
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._spaceHeld = false;
        this._panning = false;
        if (this.currentTool) this.overlayCanvas.style.cursor = this.currentTool.cursor;
      }
    });

    // Context menu
    this.overlayCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.ui && this.ui.showContextMenu(e.clientX, e.clientY);
    });
  }

  // ─── Tool management ───────────────────────────────────────────────────────

  activateTool(name) {
    if (this.currentTool) this.currentTool.deactivate();
    this.currentTool = this.tools[name] || this.tools.brush;
    this.currentTool.activate();
    this.ui && this.ui.updateActiveTool(name);
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  render() {
    this.layers.compositeToCanvas(this.ctx, this.canvasOffset.x, this.canvasOffset.y, this.scale);
    this.renderOverlay();
  }

  renderOverlay() {
    if (!this.overlayCtx) return;
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    // Draw selection marquee
    if (this.selection.active) {
      this._drawSelectionMarquee();
    }
    // Ruler ticks
    if (this.ui && this.ui.rulersVisible) this.ui.drawRulers();
    // Grid
    if (this.ui && this.ui.gridVisible) this._drawGrid();
  }

  _drawSelectionMarquee() {
    const oc = this.overlayCtx;
    const sel = this.selection._current;
    if (!sel) return;
    const { x: ox, y: oy } = this.canvasOffset;
    const s = this.scale;
    oc.save();
    oc.setLineDash([5, 5]);
    const t = Date.now() / 100 % 10;
    oc.lineDashOffset = -t;
    oc.strokeStyle = '#fff';
    oc.lineWidth = 1;
    this._traceSelection(oc, sel, ox, oy, s);
    oc.stroke();
    oc.setLineDash([5, 5]);
    oc.lineDashOffset = -t + 5;
    oc.strokeStyle = '#000';
    oc.lineWidth = 1;
    this._traceSelection(oc, sel, ox, oy, s);
    oc.stroke();
    oc.restore();
    // Animate
    requestAnimationFrame(() => this._drawSelectionMarquee && this.selection.active && this.renderOverlay());
  }

  _traceSelection(ctx, sel, ox, oy, s) {
    if (!sel) return;
    if (sel.type === 'rect') {
      ctx.beginPath();
      ctx.rect(sel.x * s + ox, sel.y * s + oy, sel.w * s, sel.h * s);
    } else if (sel.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse((sel.x + sel.w/2) * s + ox, (sel.y + sel.h/2) * s + oy, sel.w/2 * s, sel.h/2 * s, 0, 0, Math.PI * 2);
    } else if (sel.type === 'polygon') {
      ctx.beginPath();
      sel.points.forEach((p, i) => {
        const px = p.x * s + ox, py = p.y * s + oy;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
  }

  _drawGrid() {
    const oc = this.overlayCtx;
    const spacing = (this.ui.gridSpacing || 20) * this.scale;
    if (spacing < 4) return;
    oc.save();
    oc.strokeStyle = 'rgba(128,128,255,0.3)';
    oc.lineWidth = 0.5;
    const { x: ox, y: oy } = this.canvasOffset;
    const W = oc.canvas.width, H = oc.canvas.height;
    for (let x = ox % spacing; x < W; x += spacing) {
      oc.beginPath(); oc.moveTo(x, 0); oc.lineTo(x, H); oc.stroke();
    }
    for (let y = oy % spacing; y < H; y += spacing) {
      oc.beginPath(); oc.moveTo(0, y); oc.lineTo(W, y); oc.stroke();
    }
    oc.restore();
  }

  // ─── Zoom ─────────────────────────────────────────────────────────────────

  setZoom(newScale, center) {
    const rect = this.canvas.getBoundingClientRect();
    const pt = center || { x: rect.width / 2, y: rect.height / 2 };
    const worldX = (pt.x - this.canvasOffset.x) / this.scale;
    const worldY = (pt.y - this.canvasOffset.y) / this.scale;
    this.scale = Math.max(0.05, Math.min(32, newScale));
    this.canvasOffset.x = pt.x - worldX * this.scale;
    this.canvasOffset.y = pt.y - worldY * this.scale;
    this.render();
    this.ui && this.ui.updateZoomDisplay();
  }

  fitToScreen() {
    const rect = this.canvasContainer.getBoundingClientRect();
    const scaleX = (rect.width - 40) / this.layers.width;
    const scaleY = (rect.height - 40) / this.layers.height;
    const s = Math.min(scaleX, scaleY, 2);
    this.scale = s;
    this.canvasOffset.x = (rect.width - this.layers.width * s) / 2;
    this.canvasOffset.y = (rect.height - this.layers.height * s) / 2;
    this.render();
    this.ui && this.ui.updateZoomDisplay();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }

  // ─── Color ────────────────────────────────────────────────────────────────

  setFgColor(hex) {
    this.fgColor = hex;
    document.getElementById('fg-color-swatch') && (document.getElementById('fg-color-swatch').style.background = hex);
  }

  setBgColor(hex) {
    this.bgColor = hex;
    document.getElementById('bg-color-swatch') && (document.getElementById('bg-color-swatch').style.background = hex);
  }

  swapColors() {
    [this.fgColor, this.bgColor] = [this.bgColor, this.fgColor];
    this.setFgColor(this.fgColor);
    this.setBgColor(this.bgColor);
  }

  resetColors() {
    this.setFgColor('#000000');
    this.setBgColor('#ffffff');
  }

  // ─── Brush helpers ────────────────────────────────────────────────────────

  adjustBrushSize(delta) {
    this.brushOptions.size = Math.max(1, Math.min(2500, this.brushOptions.size + delta));
    this.ui && this.ui.updateBrushSizeDisplay();
  }

  adjustBrushHardness(delta) {
    this.brushOptions.softness = Math.max(0, Math.min(100, this.brushOptions.softness - delta));
    this.ui && this.ui.updateBrushSizeDisplay();
  }

  setBrushOpacity(v) {
    this.brushOptions.opacity = Math.max(0, Math.min(1, v));
    this.ui && this.ui.updateBrushSizeDisplay();
  }

  // ─── Edit operations ──────────────────────────────────────────────────────

  undo() {
    this.history.undo(this.layers);
    this.ui && this.ui.refreshLayers();
    this.render();
  }

  redo() {
    this.history.redo(this.layers);
    this.ui && this.ui.refreshLayers();
    this.render();
  }

  cut() {
    const layer = this.layers.activeLayer;
    if (!layer || layer.locked) return;
    const { x, y, w, h } = this._getSelectionBounds();
    this._clipboard = layer.ctx.getImageData(x, y, w, h);
    layer.ctx.clearRect(x, y, w, h);
    this.history.snapshot('Cut', this.layers);
    this.render();
  }

  copy() {
    const layer = this.layers.activeLayer;
    if (!layer) return;
    const { x, y, w, h } = this._getSelectionBounds();
    this._clipboard = layer.ctx.getImageData(x, y, w, h);
  }

  paste() {
    if (!this._clipboard) return;
    const newLayer = this.layers.addLayer({ name: 'Pasted Layer' });
    newLayer.ctx.putImageData(this._clipboard, 20, 20);
    this.history.snapshot('Paste', this.layers);
    this.ui && this.ui.refreshLayers();
    this.render();
  }

  pasteInPlace() {
    if (!this._clipboard) return;
    const newLayer = this.layers.addLayer({ name: 'Pasted Layer' });
    newLayer.ctx.putImageData(this._clipboard, 0, 0);
    this.history.snapshot('Paste In Place', this.layers);
    this.ui && this.ui.refreshLayers();
    this.render();
  }

  deleteSelection() {
    const layer = this.layers.activeLayer;
    if (!layer || layer.locked) return;
    if (this.selection.active) {
      const { x, y, w, h } = this._getSelectionBounds();
      layer.ctx.save();
      if (this.selection._current) {
        this.selection.clipContext(layer.ctx);
      }
      layer.ctx.clearRect(x, y, w, h);
      layer.ctx.restore();
    } else {
      layer.clear();
    }
    this.history.snapshot('Delete', this.layers);
    this.render();
  }

  _getSelectionBounds() {
    const sel = this.selection._current;
    if (!sel) return { x: 0, y: 0, w: this.layers.width, h: this.layers.height };
    if (sel.type === 'rect' || sel.type === 'ellipse') return { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
    return { x: 0, y: 0, w: this.layers.width, h: this.layers.height };
  }

  copyLayerViaSelection() {
    const src = this.layers.activeLayer;
    if (!src) return;
    const newLayer = src.duplicate();
    newLayer.name = 'Layer via Copy';
    this.layers.layers.push(newLayer);
    this.layers.activeLayerId = newLayer.id;
    this.history.snapshot('Layer via Copy', this.layers);
    this.ui && this.ui.refreshLayers();
    this.render();
  }

  cutLayerViaSelection() {
    const src = this.layers.activeLayer;
    if (!src || src.locked) return;
    const newLayer = src.duplicate();
    newLayer.name = 'Layer via Cut';
    src.clear();
    this.layers.layers.push(newLayer);
    this.layers.activeLayerId = newLayer.id;
    this.history.snapshot('Layer via Cut', this.layers);
    this.ui && this.ui.refreshLayers();
    this.render();
  }

  selectLayerRelative(delta) {
    const idx = this.layers.layers.findIndex(l => l.id === this.layers.activeLayerId);
    const newIdx = Math.max(0, Math.min(this.layers.layers.length - 1, idx + delta));
    this.layers.setActive(this.layers.layers[newIdx].id);
    this.ui && this.ui.refreshLayers();
  }

  repeatTransform() { /* placeholder */ }

  repeatLastFilter() {
    if (this._lastFilter) this._lastFilter();
  }

  // ─── Adjustments ──────────────────────────────────────────────────────────

  applyAdjustment(name, params = {}) {
    const layer = this.layers.activeLayer;
    if (!layer || layer.locked) return;
    const w = layer.canvas.width, h = layer.canvas.height;
    const imageData = layer.ctx.getImageData(0, 0, w, h);
    if (Adjustments[name]) {
      Adjustments[name](imageData, ...Object.values(params));
    }
    layer.ctx.putImageData(imageData, 0, 0);
    this.history.snapshot(name, this.layers);
    this.render();
  }

  applyFilter(name, params = {}) {
    const layer = this.layers.activeLayer;
    if (!layer || layer.locked) return;
    const w = layer.canvas.width, h = layer.canvas.height;
    const imageData = layer.ctx.getImageData(0, 0, w, h);
    if (Filters[name]) {
      Filters[name](imageData, ...Object.values(params));
      this._lastFilter = () => this.applyFilter(name, params);
    }
    layer.ctx.putImageData(imageData, 0, 0);
    this.history.snapshot(name, this.layers);
    this.render();
  }

  // ─── New Document ─────────────────────────────────────────────────────────

  newDocument(width, height, bgColor = '#ffffff') {
    this.layers = new LayerManager(width, height);
    const bg = this.layers.addLayer({ name: 'Background' });
    bg.ctx.fillStyle = bgColor;
    bg.ctx.fillRect(0, 0, width, height);
    this.history = new HistoryManager(50);
    this.history.snapshot('New Document', this.layers);
    this.history.onChange(() => this.ui && this.ui.refreshHistory());
    this.layers.onChange(() => this.ui && this.ui.refreshLayers());
    this.selection.deselect();
    this.fitToScreen();
    this.render();
    this.ui && this.ui.refreshLayers();
    this.ui && this.ui.refreshHistory();
  }

  // ─── Open image ───────────────────────────────────────────────────────────

  openImage(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        this.newDocument(img.width, img.height, 'transparent');
        const layer = this.layers.activeLayer;
        layer.ctx.drawImage(img, 0, 0);
        layer.name = file.name;
        this.history.snapshot('Open Image', this.layers);
        this.render();
        this.ui && this.ui.refreshLayers();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ─── Image resize / canvas size ───────────────────────────────────────────

  resizeImage(newW, newH, resample = true) {
    this.layers.layers.forEach(layer => {
      const tmp = document.createElement('canvas');
      tmp.width = newW; tmp.height = newH;
      const tctx = tmp.getContext('2d');
      if (resample) tctx.drawImage(layer.canvas, 0, 0, newW, newH);
      else tctx.drawImage(layer.canvas, 0, 0);
      layer.canvas.width = newW; layer.canvas.height = newH;
      layer.ctx.drawImage(tmp, 0, 0);
    });
    this.layers.width = newW;
    this.layers.height = newH;
    this.history.snapshot('Resize Image', this.layers);
    this.render();
  }

  canvasSize(newW, newH, anchor = 'center') {
    const offsetX = anchor.includes('right') ? newW - this.layers.width : anchor.includes('center') ? (newW - this.layers.width) / 2 : 0;
    const offsetY = anchor.includes('bottom') ? newH - this.layers.height : anchor.includes('center') ? (newH - this.layers.height) / 2 : 0;
    this.layers.layers.forEach(layer => {
      const tmp = document.createElement('canvas');
      tmp.width = newW; tmp.height = newH;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(layer.canvas, Math.round(offsetX), Math.round(offsetY));
      layer.canvas.width = newW; layer.canvas.height = newH;
      layer.ctx.drawImage(tmp, 0, 0);
    });
    this.layers.width = newW;
    this.layers.height = newH;
    this.history.snapshot('Canvas Size', this.layers);
    this.render();
  }

  // ─── Image rotate / flip ──────────────────────────────────────────────────

  rotateCanvas(degrees) {
    const rad = degrees * Math.PI / 180;
    const w = this.layers.width, h = this.layers.height;
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const newW = Math.round(w * cos + h * sin);
    const newH = Math.round(w * sin + h * cos);
    this.layers.layers.forEach(layer => {
      const tmp = document.createElement('canvas');
      tmp.width = newW; tmp.height = newH;
      const tctx = tmp.getContext('2d');
      tctx.translate(newW / 2, newH / 2);
      tctx.rotate(rad);
      tctx.drawImage(layer.canvas, -w / 2, -h / 2);
      layer.canvas.width = newW; layer.canvas.height = newH;
      layer.ctx.drawImage(tmp, 0, 0);
    });
    this.layers.width = newW; this.layers.height = newH;
    this.history.snapshot(`Rotate ${degrees}°`, this.layers);
    this.render();
  }

  flipCanvas(axis) {
    const w = this.layers.width, h = this.layers.height;
    this.layers.layers.forEach(layer => {
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d');
      tctx.save();
      if (axis === 'h') { tctx.translate(w, 0); tctx.scale(-1, 1); }
      else { tctx.translate(0, h); tctx.scale(1, -1); }
      tctx.drawImage(layer.canvas, 0, 0);
      tctx.restore();
      layer.ctx.clearRect(0, 0, w, h);
      layer.ctx.drawImage(tmp, 0, 0);
    });
    this.history.snapshot(`Flip ${axis === 'h' ? 'Horizontal' : 'Vertical'}`, this.layers);
    this.render();
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.app = new QuantiumApp();
});
