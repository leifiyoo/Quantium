/**
 * Keyboard shortcuts – Photoshop-compatible bindings
 */

class KeyboardManager {
  constructor(app) {
    this.app = app;
    this._bound = this._onKeyDown.bind(this);
    this._boundUp = this._onKeyUp.bind(this);
    document.addEventListener('keydown', this._bound);
    document.addEventListener('keyup', this._boundUp);
  }

  destroy() {
    document.removeEventListener('keydown', this._bound);
    document.removeEventListener('keyup', this._boundUp);
  }

  _onKeyUp(e) {
    this.app.altHeld = e.altKey;
    this.app.shiftHeld = e.shiftKey;
    this.app.ctrlHeld = e.ctrlKey || e.metaKey;
    if (this.app.currentTool && this.app.currentTool.onKeyUp) {
      this.app.currentTool.onKeyUp(e);
    }
  }

  _onKeyDown(e) {
    // Ignore if typing in an input
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.contentEditable === 'true') {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    this.app.altHeld = e.altKey;
    this.app.shiftHeld = e.shiftKey;
    this.app.ctrlHeld = e.ctrlKey || e.metaKey;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    if (this.app.currentTool && this.app.currentTool.onKeyDown) {
      this.app.currentTool.onKeyDown(e);
    }

    // ── File ─────────────────────────────────────────────────────────────
    if (ctrl && !shift && e.key === 'n') { e.preventDefault(); this.app.ui.showNewDocDialog(); return; }
    if (ctrl && !shift && e.key === 'o') { e.preventDefault(); this.app.ui.openFile(); return; }
    if (ctrl && !shift && e.key === 's') { e.preventDefault(); this.app.ui.saveFile(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 's') { e.preventDefault(); this.app.ui.saveFileAs(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'e') { e.preventDefault(); this.app.ui.exportFlattened(); return; }
    if (ctrl && e.key === 'w') { e.preventDefault(); this.app.ui.closeDocument(); return; }
    if (ctrl && e.key === 'p') { e.preventDefault(); this.app.ui.print(); return; }

    // ── Edit ─────────────────────────────────────────────────────────────
    if (ctrl && !shift && e.key === 'z') { e.preventDefault(); this.app.undo(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'z') { e.preventDefault(); this.app.redo(); return; }
    if (ctrl && e.key === 'y') { e.preventDefault(); this.app.redo(); return; }
    if (ctrl && !shift && e.key === 'x') { e.preventDefault(); this.app.cut(); return; }
    if (ctrl && !shift && e.key === 'c') { e.preventDefault(); this.app.copy(); return; }
    if (ctrl && !shift && e.key === 'v') { e.preventDefault(); this.app.paste(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'v') { e.preventDefault(); this.app.pasteInPlace(); return; }
    if (ctrl && !shift && e.key === 'd') { e.preventDefault(); this.app.selection.deselect(); this.app.renderOverlay(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'd') { e.preventDefault(); this.app.selection.reselect(); this.app.renderOverlay(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'i') { e.preventDefault(); this.app.selection.invert(this.app.layers.width,this.app.layers.height); this.app.renderOverlay(); return; }
    if (ctrl && e.key === 'a') { e.preventDefault(); this.app.selection.selectAll(this.app.layers.width,this.app.layers.height); this.app.renderOverlay(); return; }
    if (ctrl && !shift && e.key === 't') { e.preventDefault(); this.app.activateTool('transform'); return; }
    if (ctrl && shift && e.key.toLowerCase() === 't') { e.preventDefault(); this.app.repeatTransform(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.app.deleteSelection(); return; }
    if (ctrl && e.key === 'f') { e.preventDefault(); this.app.repeatLastFilter(); return; }

    // ── Layer ─────────────────────────────────────────────────────────────
    if (ctrl && shift && e.key.toLowerCase() === 'n') { e.preventDefault(); this.app.layers.addLayer(); this.app.ui.refreshLayers(); return; }
    if (ctrl && e.key === 'j') { e.preventDefault(); this.app.copyLayerViaSelection(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'j') { e.preventDefault(); this.app.cutLayerViaSelection(); return; }
    if (ctrl && e.key === 'e') { e.preventDefault(); this.app.layers.mergeDown(this.app.layers.activeLayerId); this.app.history.snapshot('Merge Down',this.app.layers); this.app.ui.refreshLayers(); this.app.render(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'e') { e.preventDefault(); this.app.layers.mergeAll(); this.app.history.snapshot('Merge All',this.app.layers); this.app.ui.refreshLayers(); this.app.render(); return; }
    if (ctrl && alt && e.key === 'e') { e.preventDefault(); this.app.layers.mergeAll(); this.app.ui.refreshLayers(); this.app.render(); return; }
    if (ctrl && e.key === 'g') { e.preventDefault(); this.app.ui.groupLayers(); return; }
    if (alt && e.key === '[') { e.preventDefault(); this.app.selectLayerRelative(-1); return; }
    if (alt && e.key === ']') { e.preventDefault(); this.app.selectLayerRelative(1); return; }

    // ── View ──────────────────────────────────────────────────────────────
    if (ctrl && e.key === '+' || ctrl && e.key === '=') { e.preventDefault(); this.app.setZoom(this.app.scale*1.25); return; }
    if (ctrl && e.key === '-') { e.preventDefault(); this.app.setZoom(this.app.scale/1.25); return; }
    if (ctrl && e.key === '0') { e.preventDefault(); this.app.fitToScreen(); return; }
    if (ctrl && alt && e.key === '0') { e.preventDefault(); this.app.setZoom(1); return; }
    if (!ctrl && !alt && e.key.toLowerCase() === 'f') { e.preventDefault(); this.app.toggleFullscreen(); return; }
    if (ctrl && e.key === 'r') { e.preventDefault(); this.app.ui.toggleRulers(); return; }
    if (ctrl && e.key === "'") { e.preventDefault(); this.app.ui.toggleGrid(); return; }
    if (ctrl && e.key === ';') { e.preventDefault(); this.app.ui.toggleGuides(); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'h') { e.preventDefault(); this.app.ui.toggleExtras(); return; }
    if (e.key === 'Tab') { e.preventDefault(); this.app.ui.togglePanels(); return; }

    // ── Image ─────────────────────────────────────────────────────────────
    if (ctrl && shift && e.key.toLowerCase() === 'l') { e.preventDefault(); this.app.applyAdjustment('autoLevels'); return; }
    if (ctrl && shift && e.key.toLowerCase() === 'u') { e.preventDefault(); this.app.applyAdjustment('desaturate'); return; }
    if (ctrl && e.key === 'i') { e.preventDefault(); this.app.applyAdjustment('invert'); return; }
    if (ctrl && e.key === 'l') { e.preventDefault(); this.app.ui.showAdjustmentDialog('levels'); return; }
    if (ctrl && e.key === 'm') { e.preventDefault(); this.app.ui.showAdjustmentDialog('curves'); return; }
    if (ctrl && e.key === 'b') { e.preventDefault(); this.app.ui.showAdjustmentDialog('brightnessContrast'); return; }
    if (ctrl && e.key === 'u') { e.preventDefault(); this.app.ui.showAdjustmentDialog('hueSaturation'); return; }

    // ── Tools ─────────────────────────────────────────────────────────────
    if (!ctrl && !alt) {
      switch(e.key.toLowerCase()) {
        case 'v': this.app.activateTool('move'); break;
        case 'm': shift ? this.app.activateTool('ellipse-select') : this.app.activateTool('rect-select'); break;
        case 'l': shift ? this.app.activateTool('polygon-lasso') : this.app.activateTool('lasso'); break;
        case 'w': this.app.activateTool('magic-wand'); break;
        case 'c': this.app.activateTool('crop'); break;
        case 'i': this.app.activateTool('eyedropper'); break;
        case 'j': shift ? this.app.activateTool('healing-brush') : this.app.activateTool('healing-brush'); break;
        case 's': shift ? this.app.activateTool('clone-stamp') : this.app.activateTool('clone-stamp'); break;
        case 'b': this.app.activateTool('brush'); break;
        case 'n': this.app.activateTool('pencil'); break;
        case 'e': shift ? this.app.activateTool('eraser') : this.app.activateTool('eraser'); break;
        case 'g': shift ? this.app.activateTool('gradient') : this.app.activateTool('fill'); break;
        case 'a': this.app.activateTool('pen'); break;
        case 'p': this.app.activateTool('pen'); break;
        case 't': this.app.activateTool('text'); break;
        case 'u': this.app.activateTool('shape-rect'); break;
        case 'h': this.app.activateTool('hand'); break;
        case 'z': this.app.activateTool('zoom'); break;
        case 'r': this.app.activateTool('blur-brush'); break;
        case 'o': this.app.activateTool('dodge'); break;
        case 'x': this.app.swapColors(); break;
        case 'd': this.app.resetColors(); break;
        case '[': this.app.adjustBrushSize(-5); break;
        case ']': this.app.adjustBrushSize(5); break;
        case '{': this.app.adjustBrushHardness(-10); break;
        case '}': this.app.adjustBrushHardness(10); break;
        case 'f5': e.preventDefault(); break;
      }
    }

    // Opacity shortcuts (number keys 1-9 = 10%-90%, 0 = 100%)
    if (!ctrl && !alt && !shift && /^[0-9]$/.test(e.key)) {
      const v = e.key === '0' ? 100 : parseInt(e.key) * 10;
      this.app.setBrushOpacity(v/100);
    }
  }
}
