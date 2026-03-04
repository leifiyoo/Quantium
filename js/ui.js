/**
 * UIManager – handles all panel updates, dialogs, menus and UI interactions
 */

class UIManager {
  constructor(app) {
    this.app = app;
    this.rulersVisible = true;
    this.gridVisible = false;
    this.guidesVisible = false;
    this.gridSpacing = 20;
    this._panelsHidden = false;
    this._contextMenu = null;
  }

  init() {
    this._bindMenuBar();
    this._bindToolbar();
    this._bindColorSwatch();
    this._bindLayerPanel();
    this._bindOptionsBar();
    this._bindHistoryPanelHeader();
    this.refreshLayers();
    this.refreshHistory();
    this.updateZoomDisplay();
    this._bindFileDropZone();
    this._bindColorPicker();
    this._startMarqueeAnimation();
  }

  // ─── Toolbar binding ──────────────────────────────────────────────────────

  _bindToolbar() {
    document.querySelectorAll('[data-tool]').forEach(el => {
      el.addEventListener('click', () => {
        const tool = el.dataset.tool;
        this.app.activateTool(tool);
      });
    });
  }

  updateActiveTool(name) {
    document.querySelectorAll('[data-tool]').forEach(el => {
      el.classList.toggle('active', el.dataset.tool === name);
    });
    this._updateOptionsBar(name);
  }

  // ─── Options bar ──────────────────────────────────────────────────────────

  _bindOptionsBar() {
    const sizeInput = document.getElementById('brush-size');
    if (sizeInput) {
      sizeInput.addEventListener('input', () => {
        this.app.brushOptions.size = parseInt(sizeInput.value) || 20;
      });
    }
    const opacityInput = document.getElementById('brush-opacity');
    if (opacityInput) {
      opacityInput.addEventListener('input', () => {
        this.app.brushOptions.opacity = parseFloat(opacityInput.value) / 100;
      });
    }
    const hardnessInput = document.getElementById('brush-hardness');
    if (hardnessInput) {
      hardnessInput.addEventListener('input', () => {
        this.app.brushOptions.softness = 100 - parseInt(hardnessInput.value);
      });
    }
    const flowInput = document.getElementById('brush-flow');
    if (flowInput) {
      flowInput.addEventListener('input', () => {
        this.app.brushOptions.flow = parseFloat(flowInput.value) / 100;
      });
    }
  }

  _updateOptionsBar(toolName) {
    const bar = document.getElementById('options-bar-content');
    if (!bar) return;
    const brushTools = ['brush','pencil','eraser','blur-brush','sharpen-brush','smudge','dodge','burn','sponge','healing-brush','clone-stamp'];
    const shapeTools = ['shape-rect','shape-rounded-rect','shape-ellipse','shape-triangle','shape-polygon','shape-star','shape-line'];
    const selectTools = ['rect-select','ellipse-select','lasso','polygon-lasso','magic-wand'];

    if (brushTools.includes(toolName)) {
      bar.innerHTML = `
        <label>Size: <input type="number" id="brush-size" value="${this.app.brushOptions.size}" min="1" max="2500" style="width:50px"></label>
        <label>Opacity: <input type="range" id="brush-opacity" value="${Math.round(this.app.brushOptions.opacity*100)}" min="1" max="100" style="width:80px"> <span id="opacity-val">${Math.round(this.app.brushOptions.opacity*100)}%</span></label>
        <label>Hardness: <input type="range" id="brush-hardness" value="${100-this.app.brushOptions.softness}" min="0" max="100" style="width:80px"></label>
        <label>Flow: <input type="range" id="brush-flow" value="100" min="1" max="100" style="width:80px"></label>
        <label>Mode: <select id="brush-blend-mode">${BLEND_MODES.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></label>
      `;
      this._bindOptionsBar();
      const opRange = document.getElementById('brush-opacity');
      const opVal = document.getElementById('opacity-val');
      if(opRange&&opVal) opRange.addEventListener('input',()=>opVal.textContent=opRange.value+'%');
    } else if (shapeTools.includes(toolName)) {
      bar.innerHTML = `
        <label><input type="radio" name="shape-mode" value="shape" checked> Shape</label>
        <label><input type="radio" name="shape-mode" value="path"> Path</label>
        <label><input type="radio" name="shape-mode" value="pixels"> Pixels</label>
        <label>Fill: <input type="color" id="shape-fill-color" value="${this.app.shapeOptions.fillColor||this.app.fgColor}"></label>
        <label>Stroke: <input type="color" id="shape-stroke-color" value="${this.app.shapeOptions.strokeColor||this.app.fgColor}"></label>
        <label>W: <input type="checkbox" id="shape-stroke" ${this.app.shapeOptions.stroke?'checked':''}> Stroke</label>
        <label>Size: <input type="number" id="stroke-width" value="${this.app.shapeOptions.strokeWidth||2}" min="0" max="100" style="width:50px">px</label>
        ${toolName==='shape-polygon'||toolName==='shape-star'?`<label>Sides: <input type="number" id="polygon-sides" value="${this.app.shapeOptions.sides||5}" min="3" max="50" style="width:40px"></label>`:''}
        ${toolName==='shape-rounded-rect'?`<label>Radius: <input type="number" id="corner-radius" value="${this.app.shapeOptions.cornerRadius||10}" min="0" max="200" style="width:50px"></label>`:''}
      `;
      document.getElementById('shape-fill-color')&&document.getElementById('shape-fill-color').addEventListener('input',e=>this.app.shapeOptions.fillColor=e.target.value);
      document.getElementById('shape-stroke-color')&&document.getElementById('shape-stroke-color').addEventListener('input',e=>this.app.shapeOptions.strokeColor=e.target.value);
      document.getElementById('shape-stroke')&&document.getElementById('shape-stroke').addEventListener('change',e=>this.app.shapeOptions.stroke=e.target.checked);
      document.getElementById('stroke-width')&&document.getElementById('stroke-width').addEventListener('input',e=>this.app.shapeOptions.strokeWidth=parseInt(e.target.value));
      document.getElementById('polygon-sides')&&document.getElementById('polygon-sides').addEventListener('input',e=>this.app.shapeOptions.sides=parseInt(e.target.value));
      document.getElementById('corner-radius')&&document.getElementById('corner-radius').addEventListener('input',e=>this.app.shapeOptions.cornerRadius=parseInt(e.target.value));
    } else if (selectTools.includes(toolName)) {
      const modes = ['new','add','subtract','intersect'];
      bar.innerHTML = `
        ${modes.map((m,i)=>`<button class="select-mode-btn ${i===0?'active':''}" data-mode="${m}" title="${m}">${m==='new'?'⬜':m==='add'?'⊕':m==='subtract'?'⊖':'⊗'}</button>`).join('')}
        ${toolName==='magic-wand'?`<label>Tolerance: <input type="number" id="wand-tolerance" value="${this.app.selectOptions.tolerance}" min="0" max="255" style="width:50px"></label><label><input type="checkbox" id="wand-contiguous" ${this.app.selectOptions.contiguous?'checked':''}> Contiguous</label><label><input type="checkbox" id="wand-sample-all"> Sample All Layers</label>`:''}
        ${toolName==='lasso'||toolName==='polygon-lasso'?`<label>Feather: <input type="number" id="select-feather" value="0" min="0" max="100" style="width:50px">px</label>`:''}
        <label><input type="checkbox" id="select-anti-alias" checked> Anti-alias</label>
      `;
      document.getElementById('wand-tolerance')&&document.getElementById('wand-tolerance').addEventListener('input',e=>this.app.selectOptions.tolerance=parseInt(e.target.value));
      document.getElementById('wand-contiguous')&&document.getElementById('wand-contiguous').addEventListener('change',e=>this.app.selectOptions.contiguous=e.target.checked);
    } else if (toolName==='text') {
      bar.innerHTML = `
        <label>Font: <select id="text-font">
          ${['Arial','Helvetica','Times New Roman','Courier New','Georgia','Verdana','Impact','Comic Sans MS','Trebuchet MS','Palatino'].map(f=>`<option value="${f}">${f}</option>`).join('')}
        </select></label>
        <label>Size: <input type="number" id="text-size" value="${this.app.textOptions.size}" min="1" max="1000" style="width:60px">px</label>
        <button id="text-bold" class="${this.app.textOptions.bold?'active':''}" title="Bold (Ctrl+B)"><b>B</b></button>
        <button id="text-italic" class="${this.app.textOptions.italic?'active':''}" title="Italic (Ctrl+I)"><i>I</i></button>
        <button id="text-underline" title="Underline"><u>U</u></button>
        <label>Align: 
          <button data-align="left" class="active">⬛️◀</button>
          <button data-align="center">⬛️▶◀</button>
          <button data-align="right">⬛️▶</button>
        </label>
        <input type="color" id="text-color" value="${this.app.fgColor}" title="Text Color">
      `;
      document.getElementById('text-font')&&document.getElementById('text-font').addEventListener('change',e=>this.app.textOptions.font=e.target.value);
      document.getElementById('text-size')&&document.getElementById('text-size').addEventListener('input',e=>this.app.textOptions.size=parseInt(e.target.value));
      document.getElementById('text-bold')&&document.getElementById('text-bold').addEventListener('click',e=>{this.app.textOptions.bold=!this.app.textOptions.bold;e.target.classList.toggle('active');});
      document.getElementById('text-italic')&&document.getElementById('text-italic').addEventListener('click',e=>{this.app.textOptions.italic=!this.app.textOptions.italic;e.target.classList.toggle('active');});
      document.getElementById('text-color')&&document.getElementById('text-color').addEventListener('input',e=>this.app.setFgColor(e.target.value));
    } else if (toolName==='crop') {
      bar.innerHTML = `
        <label>W: <input type="number" id="crop-w" placeholder="auto" style="width:60px"> px</label>
        <label>H: <input type="number" id="crop-h" placeholder="auto" style="width:60px"> px</label>
        <label>Resolution: <input type="number" id="crop-res" value="72" style="width:50px"> PPI</label>
        <label><input type="checkbox" id="crop-delete-outside" checked> Delete Outside</label>
        <button onclick="app.activateTool('rect-select')">✕ Cancel</button>
      `;
    } else if (toolName==='zoom') {
      bar.innerHTML = `
        <button onclick="app.setZoom(app.scale*2)">🔍+</button>
        <button onclick="app.setZoom(app.scale/2)">🔍-</button>
        <button onclick="app.fitToScreen()">Fit Screen</button>
        <button onclick="app.setZoom(1)">100%</button>
        <button onclick="app.setZoom(2)">200%</button>
        <label><input type="checkbox" id="zoom-resize" checked> Resize Window to Fit</label>
      `;
    } else if (toolName==='gradient') {
      bar.innerHTML = `
        <span style="font-size:11px;margin-right:4px">Type:</span>
        <button data-gtype="linear" class="active" onclick="app.gradientOptions.type='linear';this.parentElement.querySelectorAll('[data-gtype]').forEach(b=>b.classList.remove('active'));this.classList.add('active')">⬛→</button>
        <button data-gtype="radial" onclick="app.gradientOptions.type='radial';this.parentElement.querySelectorAll('[data-gtype]').forEach(b=>b.classList.remove('active'));this.classList.add('active')">◎</button>
        <label style="margin-left:8px"><input type="checkbox" id="grad-transparent" onchange="app.gradientOptions.transparent=this.checked"> Transparent</label>
        <label style="margin-left:8px">Mode: <select onchange="app.gradientOptions.mode=this.value">${['normal','multiply','screen','overlay'].map(m=>`<option value="${m}">${m}</option>`).join('')}</select></label>
        <label style="margin-left:8px">Opacity: <input type="range" min="1" max="100" value="100" oninput="app.brushOptions.opacity=this.value/100" style="width:80px"></label>
      `;
    } else if (toolName==='fill') {
      bar.innerHTML = `
        <label>Mode: <select id="fill-blend">${BLEND_MODES.slice(0,5).map(m=>`<option value="${m}">${m}</option>`).join('')}</select></label>
        <label>Opacity: <input type="range" min="1" max="100" value="100" style="width:80px"> <span>100%</span></label>
        <label>Tolerance: <input type="number" id="fill-tolerance" value="${this.app.fillOptions.tolerance}" min="0" max="255" style="width:50px"></label>
        <label><input type="checkbox" id="fill-contiguous" ${this.app.fillOptions.contiguous?'checked':''}> Contiguous</label>
        <label><input type="checkbox" id="fill-anti-alias" checked> Anti-alias</label>
        <label><input type="checkbox" id="fill-sample-all"> All Layers</label>
      `;
      document.getElementById('fill-tolerance')&&document.getElementById('fill-tolerance').addEventListener('input',e=>this.app.fillOptions.tolerance=parseInt(e.target.value));
      document.getElementById('fill-contiguous')&&document.getElementById('fill-contiguous').addEventListener('change',e=>this.app.fillOptions.contiguous=e.target.checked);
    } else if (toolName==='move') {
      bar.innerHTML = `
        <label><input type="checkbox" id="move-auto-select"> Auto-Select</label>
        <select id="move-auto-select-target"><option>Layer</option><option>Group</option></select>
        <label style="margin-left:8px"><input type="checkbox" id="move-show-transform" checked> Show Transform Controls</label>
      `;
    } else {
      bar.innerHTML = '';
    }
  }

  updateBrushSizeDisplay() {
    const si = document.getElementById('brush-size');
    if (si) si.value = this.app.brushOptions.size;
    const oi = document.getElementById('brush-opacity');
    if (oi) oi.value = Math.round(this.app.brushOptions.opacity * 100);
  }

  // ─── Menu bar ─────────────────────────────────────────────────────────────

  _bindMenuBar() {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        // Close all other menus
        document.querySelectorAll('.menu-item.open').forEach(el => { if (el !== item) { el.classList.remove('open'); } });
        item.classList.toggle('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
    });

    // File
    this._bindMenuItem('menu-new', () => this.showNewDocDialog());
    this._bindMenuItem('menu-open', () => this.openFile());
    this._bindMenuItem('menu-open-recent', () => {});
    this._bindMenuItem('menu-save', () => this.saveFile());
    this._bindMenuItem('menu-save-as', () => this.saveFileAs());
    this._bindMenuItem('menu-export-png', () => this.exportFlattened('png'));
    this._bindMenuItem('menu-export-jpg', () => this.exportFlattened('jpg'));
    this._bindMenuItem('menu-export-webp', () => this.exportFlattened('webp'));
    this._bindMenuItem('menu-revert', () => {});
    this._bindMenuItem('menu-print', () => window.print());

    // Edit
    this._bindMenuItem('menu-undo', () => this.app.undo());
    this._bindMenuItem('menu-redo', () => this.app.redo());
    this._bindMenuItem('menu-cut', () => this.app.cut());
    this._bindMenuItem('menu-copy', () => this.app.copy());
    this._bindMenuItem('menu-paste', () => this.app.paste());
    this._bindMenuItem('menu-paste-place', () => this.app.pasteInPlace());
    this._bindMenuItem('menu-fill', () => this.showFillDialog());
    this._bindMenuItem('menu-stroke', () => this.showStrokeDialog());
    this._bindMenuItem('menu-free-transform', () => this.app.activateTool('transform'));
    this._bindMenuItem('menu-rotate-180', () => this.app.rotateCanvas(180));
    this._bindMenuItem('menu-rotate-90cw', () => this.app.rotateCanvas(90));
    this._bindMenuItem('menu-rotate-90ccw', () => this.app.rotateCanvas(-90));
    this._bindMenuItem('menu-rotate-arbitrary', () => this.showRotateDialog());
    this._bindMenuItem('menu-flip-h', () => this.app.flipCanvas('h'));
    this._bindMenuItem('menu-flip-v', () => this.app.flipCanvas('v'));
    this._bindMenuItem('menu-preferences', () => this.showPreferencesDialog());

    // Image
    this._bindMenuItem('menu-image-size', () => this.showImageSizeDialog());
    this._bindMenuItem('menu-canvas-size', () => this.showCanvasSizeDialog());
    this._bindMenuItem('menu-image-rotation', () => {});
    this._bindMenuItem('menu-crop', () => this.app.activateTool('crop'));
    this._bindMenuItem('menu-trim', () => this.trimImage());
    this._bindMenuItem('menu-reveal-all', () => {});
    this._bindMenuItem('menu-mode-rgb', () => {});
    this._bindMenuItem('menu-mode-cmyk', () => {});
    this._bindMenuItem('menu-mode-grayscale', () => this.app.applyAdjustment('desaturate'));
    this._bindMenuItem('menu-mode-bitmap', () => this.app.applyAdjustment('threshold'));
    this._bindMenuItem('menu-mode-lab', () => {});
    this._bindMenuItem('menu-mode-indexed', () => {});
    this._bindMenuItem('menu-mode-8bit', () => {});
    this._bindMenuItem('menu-mode-16bit', () => {});
    this._bindMenuItem('menu-mode-32bit', () => {});
    this._bindMenuItem('menu-auto-tone', () => this.app.applyAdjustment('autoTone'));
    this._bindMenuItem('menu-auto-contrast', () => this.app.applyAdjustment('autoContrast'));
    this._bindMenuItem('menu-auto-color', () => this.app.applyAdjustment('autoTone'));

    // Adjustments
    const adjustItems = [
      ['menu-adj-brightness', 'brightnessContrast'],
      ['menu-adj-levels', 'levels'],
      ['menu-adj-curves', 'curves'],
      ['menu-adj-exposure', 'exposure'],
      ['menu-adj-vibrance', 'vibrance'],
      ['menu-adj-hue-sat', 'hueSaturation'],
      ['menu-adj-color-balance', 'colorBalance'],
      ['menu-adj-bw', 'blackAndWhite'],
      ['menu-adj-photo-filter', 'photoFilter'],
      ['menu-adj-channel-mixer', 'channelMixer'],
      ['menu-adj-gradient-map', 'gradientMap'],
      ['menu-adj-selective-color', 'selectiveColor'],
      ['menu-adj-shadows-highlights', 'shadowsHighlights'],
      ['menu-adj-invert', 'invert'],
      ['menu-adj-posterize', 'posterize'],
      ['menu-adj-threshold', 'threshold'],
      ['menu-adj-equalize', 'equalize'],
      ['menu-adj-desaturate', 'desaturate'],
    ];
    adjustItems.forEach(([id, name]) => this._bindMenuItem(id, () => this.showAdjustmentDialog(name)));

    // Filters
    const filterItems = [
      ['menu-filter-last', () => this.app.repeatLastFilter()],
      ['menu-filter-gaussian', () => this.showFilterDialog('gaussianBlur', [{label:'Radius',key:'radius',min:0.1,max:250,value:2,step:0.1}])],
      ['menu-filter-box-blur', () => this.showFilterDialog('boxBlur', [{label:'Radius',key:'radius',min:1,max:100,value:3}])],
      ['menu-filter-motion-blur', () => this.showFilterDialog('motionBlur', [{label:'Angle',key:'angle',min:0,max:360,value:0},{label:'Distance',key:'distance',min:1,max:999,value:10}])],
      ['menu-filter-radial-blur', () => this.showFilterDialog('radialBlur', [{label:'Amount',key:'amount',min:1,max:100,value:5}])],
      ['menu-filter-sharpen', () => this.showFilterDialog('sharpen', [{label:'Amount',key:'amount',min:1,max:10,value:1,step:0.1}])],
      ['menu-filter-unsharp', () => this.showFilterDialog('unsharpMask', [{label:'Radius',key:'radius',min:0.1,max:250,value:2,step:0.1},{label:'Amount',key:'amount',min:0.1,max:5,value:1.5,step:0.1},{label:'Threshold',key:'threshold',min:0,max:255,value:0}])],
      ['menu-filter-noise', () => this.showFilterDialog('addNoise', [{label:'Amount',key:'amount',min:1,max:400,value:25}])],
      ['menu-filter-median', () => this.showFilterDialog('median', [{label:'Radius',key:'radius',min:1,max:20,value:1}])],
      ['menu-filter-despeckle', () => { this.app.applyFilter('despeckle'); }],
      ['menu-filter-ripple', () => this.showFilterDialog('ripple', [{label:'Amplitude',key:'amplitude',min:1,max:100,value:10},{label:'Wavelength',key:'wavelength',min:1,max:200,value:30}])],
      ['menu-filter-twirl', () => this.showFilterDialog('twirl', [{label:'Angle',key:'angle',min:-360,max:360,value:90}])],
      ['menu-filter-pinch', () => this.showFilterDialog('pinch', [{label:'Amount',key:'amount',min:-1,max:1,value:0.5,step:0.01}])],
      ['menu-filter-spherize', () => this.showFilterDialog('spherize', [{label:'Amount',key:'amount',min:-100,max:100,value:50}])],
      ['menu-filter-polar', () => this.app.applyFilter('polarCoordinates',{toPolar:true})],
      ['menu-filter-zigzag', () => this.showFilterDialog('zigzag', [{label:'Amount',key:'amount',min:1,max:100,value:10},{label:'Ridges',key:'ridges',min:1,max:20,value:5}])],
      ['menu-filter-find-edges', () => this.app.applyFilter('findEdges')],
      ['menu-filter-emboss', () => this.showFilterDialog('emboss', [{label:'Strength',key:'strength',min:0.1,max:5,value:1,step:0.1}])],
      ['menu-filter-solarize', () => this.showFilterDialog('solarize', [{label:'Threshold',key:'threshold',min:0,max:255,value:128}])],
      ['menu-filter-invert', () => this.app.applyFilter('invert')],
      ['menu-filter-diffuse-glow', () => this.showFilterDialog('diffuseGlow', [{label:'Amount',key:'amount',min:1,max:20,value:5}])],
      ['menu-filter-glowing-edges', () => this.app.applyFilter('glowingEdges')],
      ['menu-filter-pixelate', () => this.showFilterDialog('pixelate', [{label:'Size',key:'size',min:2,max:100,value:10}])],
      ['menu-filter-crystallize', () => this.showFilterDialog('crystallize', [{label:'Cell Size',key:'size',min:2,max:300,value:15}])],
      ['menu-filter-halftone', () => this.showFilterDialog('colorHalftone', [{label:'Dot Radius',key:'dotRadius',min:2,max:30,value:4}])],
      ['menu-filter-clouds', () => this.app.applyFilter('clouds')],
      ['menu-filter-diff-clouds', () => this.app.applyFilter('differenceClouds')],
      ['menu-filter-lens-flare', () => this.showFilterDialog('lensFlare', [{label:'X',key:'x',min:0,max:4000,value:null},{label:'Y',key:'y',min:0,max:4000,value:null},{label:'Brightness',key:'brightness',min:10,max:300,value:100}])],
      ['menu-filter-high-pass', () => this.showFilterDialog('highPass', [{label:'Radius',key:'radius',min:0.1,max:250,value:3,step:0.1}])],
      ['menu-filter-desaturate', () => this.app.applyFilter('desaturate')],
      ['menu-filter-sepia', () => this.showFilterDialog('sepia', [{label:'Amount',key:'amount',min:0,max:100,value:100}])],
    ];
    filterItems.forEach(([id, fn]) => this._bindMenuItem(id, fn));

    // Select
    this._bindMenuItem('menu-select-all', () => { this.app.selection.selectAll(this.app.layers.width,this.app.layers.height); this.app.renderOverlay(); });
    this._bindMenuItem('menu-deselect', () => { this.app.selection.deselect(); this.app.renderOverlay(); });
    this._bindMenuItem('menu-reselect', () => { this.app.selection.reselect(); this.app.renderOverlay(); });
    this._bindMenuItem('menu-invert-sel', () => { this.app.selection.invert(this.app.layers.width,this.app.layers.height); this.app.renderOverlay(); });
    this._bindMenuItem('menu-select-color-range', () => this.showColorRangeDialog());
    this._bindMenuItem('menu-feather', () => this.showFeatherDialog());
    this._bindMenuItem('menu-modify-border', () => {});
    this._bindMenuItem('menu-modify-smooth', () => {});
    this._bindMenuItem('menu-modify-expand', () => {});
    this._bindMenuItem('menu-modify-contract', () => {});
    this._bindMenuItem('menu-grow', () => {});
    this._bindMenuItem('menu-similar', () => {});
    this._bindMenuItem('menu-transform-sel', () => {});

    // Layer
    this._bindMenuItem('menu-layer-new', () => { this.app.layers.addLayer(); this.refreshLayers(); this.app.render(); });
    this._bindMenuItem('menu-layer-new-bg', () => { this.app.layers.addLayerAt(0,{name:'Background'}); this.refreshLayers(); this.app.render(); });
    this._bindMenuItem('menu-layer-duplicate', () => { this.app.layers.duplicateLayer(this.app.layers.activeLayerId); this.app.history.snapshot('Duplicate Layer',this.app.layers); this.refreshLayers(); this.app.render(); });
    this._bindMenuItem('menu-layer-delete', () => { this.app.layers.removeLayer(this.app.layers.activeLayerId); this.app.history.snapshot('Delete Layer',this.app.layers); this.refreshLayers(); this.app.render(); });
    this._bindMenuItem('menu-layer-flatten', () => { this.app.layers.mergeAll(); this.app.history.snapshot('Flatten',this.app.layers); this.refreshLayers(); this.app.render(); });
    this._bindMenuItem('menu-layer-merge-down', () => { this.app.layers.mergeDown(this.app.layers.activeLayerId); this.app.history.snapshot('Merge Down',this.app.layers); this.refreshLayers(); this.app.render(); });
    this._bindMenuItem('menu-layer-merge-visible', () => { this.app.layers.mergeAll(); this.app.history.snapshot('Merge Visible',this.app.layers); this.refreshLayers(); this.app.render(); });
    this._bindMenuItem('menu-layer-mask-all', () => { const l=this.app.layers.activeLayer;if(l){l.enableMask();this.app.history.snapshot('Add Mask',this.app.layers);this.refreshLayers();}});
    this._bindMenuItem('menu-layer-properties', () => this.showLayerPropertiesDialog());
    this._bindMenuItem('menu-layer-style', () => this.showLayerStyleDialog());

    // View
    this._bindMenuItem('menu-zoom-in', () => this.app.setZoom(this.app.scale*1.25));
    this._bindMenuItem('menu-zoom-out', () => this.app.setZoom(this.app.scale/1.25));
    this._bindMenuItem('menu-zoom-fit', () => this.app.fitToScreen());
    this._bindMenuItem('menu-zoom-100', () => this.app.setZoom(1));
    this._bindMenuItem('menu-zoom-200', () => this.app.setZoom(2));
    this._bindMenuItem('menu-zoom-50', () => this.app.setZoom(0.5));
    this._bindMenuItem('menu-zoom-25', () => this.app.setZoom(0.25));
    this._bindMenuItem('menu-toggle-rulers', () => this.toggleRulers());
    this._bindMenuItem('menu-toggle-grid', () => this.toggleGrid());
    this._bindMenuItem('menu-toggle-guides', () => this.toggleGuides());
    this._bindMenuItem('menu-toggle-extras', () => this.toggleExtras());
    this._bindMenuItem('menu-toggle-panels', () => this.togglePanels());
    this._bindMenuItem('menu-fullscreen', () => this.app.toggleFullscreen());

    // Window
    this._bindMenuItem('menu-win-history', () => this.togglePanel('history-panel'));
    this._bindMenuItem('menu-win-layers', () => this.togglePanel('layers-panel'));
    this._bindMenuItem('menu-win-properties', () => this.togglePanel('properties-panel'));
    this._bindMenuItem('menu-win-info', () => this.togglePanel('info-panel'));
    this._bindMenuItem('menu-win-navigator', () => this.togglePanel('navigator-panel'));
    this._bindMenuItem('menu-win-channels', () => this.togglePanel('channels-panel'));
    this._bindMenuItem('menu-win-paths', () => this.togglePanel('paths-panel'));
    this._bindMenuItem('menu-win-actions', () => this.togglePanel('actions-panel'));
    this._bindMenuItem('menu-win-swatches', () => this.togglePanel('swatches-panel'));
    this._bindMenuItem('menu-win-brushes', () => this.togglePanel('brushes-panel'));
    this._bindMenuItem('menu-win-character', () => this.togglePanel('character-panel'));
    this._bindMenuItem('menu-win-paragraph', () => this.togglePanel('paragraph-panel'));

    // Help
    this._bindMenuItem('menu-help-shortcuts', () => this.showShortcutsDialog());
    this._bindMenuItem('menu-help-about', () => this.showAboutDialog());
  }

  _bindMenuItem(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', (e) => { e.stopPropagation(); fn(); document.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open')); });
  }

  // ─── File operations ──────────────────────────────────────────────────────

  openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.psd';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this.app.openImage(file);
    };
    input.click();
  }

  saveFile() {
    // Save as JSON (custom format)
    const data = {
      width: this.app.layers.width,
      height: this.app.layers.height,
      layers: this.app.layers.layers.map(l => ({
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        dataURL: l.toDataURL(),
      })),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'project.qnt'; a.click();
    URL.revokeObjectURL(url);
  }

  saveFileAs() { this.saveFile(); }

  exportFlattened(format = 'png') {
    const flat = this.app.layers.flatten();
    const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    const quality = format === 'jpg' ? 0.92 : 1;
    const a = document.createElement('a');
    a.href = flat.toDataURL(mime, quality);
    a.download = `export.${format}`;
    a.click();
  }

  closeDocument() {
    if (confirm('Close document? Unsaved changes will be lost.')) {
      this.app.newDocument(800, 600);
    }
  }

  print() { window.print(); }

  _bindFileDropZone() {
    const canvas = this.app.canvasContainer;
    canvas.addEventListener('dragover', e => { e.preventDefault(); canvas.classList.add('drag-over'); });
    canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
    canvas.addEventListener('drop', e => {
      e.preventDefault();
      canvas.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this.app.openImage(file);
    });
  }

  // ─── Color swatch & picker ────────────────────────────────────────────────

  _bindColorSwatch() {
    const fg = document.getElementById('fg-color-swatch');
    const bg = document.getElementById('bg-color-swatch');
    const swap = document.getElementById('swap-colors');
    const reset = document.getElementById('reset-colors');
    if (fg) { fg.style.background = this.app.fgColor; fg.addEventListener('click', () => this.showColorPickerDialog('fg')); }
    if (bg) { bg.style.background = this.app.bgColor; bg.addEventListener('click', () => this.showColorPickerDialog('bg')); }
    if (swap) swap.addEventListener('click', () => this.app.swapColors());
    if (reset) reset.addEventListener('click', () => this.app.resetColors());
  }

  _bindColorPicker() {
    // Bind the mini color wheel/picker in the Color panel
    const picker = document.getElementById('color-picker-native');
    if (picker) {
      picker.addEventListener('input', e => {
        this.app.setFgColor(e.target.value);
      });
    }
  }

  showColorPickerDialog(target) {
    const current = target === 'fg' ? this.app.fgColor : this.app.bgColor;
    const dialog = this._createDialog(`${target === 'fg' ? 'Foreground' : 'Background'} Color`, `
      <div style="display:flex;gap:16px;align-items:flex-start">
        <canvas id="color-wheel-canvas" width="200" height="200" style="border-radius:50%;cursor:crosshair"></canvas>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div id="color-preview" style="width:80px;height:80px;background:${current};border:1px solid #555;border-radius:4px"></div>
          <label>H: <input type="range" id="cp-h" min="0" max="360" value="0" style="width:150px"></label>
          <label>S: <input type="range" id="cp-s" min="0" max="100" value="100" style="width:150px"></label>
          <label>L: <input type="range" id="cp-l" min="0" max="100" value="50" style="width:150px"></label>
          <label>R: <input type="number" id="cp-r" min="0" max="255" value="255" style="width:60px"></label>
          <label>G: <input type="number" id="cp-g" min="0" max="255" value="0" style="width:60px"></label>
          <label>B: <input type="number" id="cp-b" min="0" max="255" value="0" style="width:60px"></label>
          <label>Hex: #<input type="text" id="cp-hex" value="${current.replace('#','')}" style="width:80px" maxlength="6"></label>
          <input type="color" id="cp-native" value="${current}" style="width:100%">
        </div>
      </div>
    `, [
      { label: 'OK', primary: true, action: () => {
        const hex = '#' + document.getElementById('cp-hex').value;
        if (target === 'fg') this.app.setFgColor(hex);
        else this.app.setBgColor(hex);
      }},
      { label: 'Cancel' }
    ]);
    this._drawColorWheel(document.getElementById('color-wheel-canvas'), current);
    // Native picker sync
    const native = document.getElementById('cp-native');
    if (native) {
      native.addEventListener('input', e => {
        document.getElementById('cp-hex').value = e.target.value.replace('#','');
        document.getElementById('color-preview').style.background = e.target.value;
      });
    }
  }

  _drawColorWheel(canvas, current) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width/2, cy = canvas.height/2, r = Math.min(cx,cy)-2;
    for (let angle = 0; angle < 360; angle++) {
      const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      grad.addColorStop(0,`hsl(${angle},0%,100%)`);
      grad.addColorStop(1,`hsl(${angle},100%,50%)`);
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,(angle-1)*Math.PI/180,(angle+1)*Math.PI/180);
      ctx.closePath();
      ctx.fillStyle=grad;
      ctx.fill();
    }
  }

  // ─── Layers panel ─────────────────────────────────────────────────────────

  _bindLayerPanel() {
    const addBtn = document.getElementById('layer-add');
    const delBtn = document.getElementById('layer-delete');
    const dupBtn = document.getElementById('layer-duplicate');
    const groupBtn = document.getElementById('layer-group');
    const mergeBtn = document.getElementById('layer-merge-down');
    if (addBtn) addBtn.addEventListener('click', () => { this.app.layers.addLayer(); this.app.history.snapshot('New Layer',this.app.layers); this.app.render(); });
    if (delBtn) delBtn.addEventListener('click', () => { this.app.layers.removeLayer(this.app.layers.activeLayerId); this.app.history.snapshot('Delete Layer',this.app.layers); this.app.render(); });
    if (dupBtn) dupBtn.addEventListener('click', () => { this.app.layers.duplicateLayer(this.app.layers.activeLayerId); this.app.history.snapshot('Duplicate Layer',this.app.layers); this.app.render(); });
    if (mergeBtn) mergeBtn.addEventListener('click', () => { this.app.layers.mergeDown(this.app.layers.activeLayerId); this.app.history.snapshot('Merge Down',this.app.layers); this.app.render(); });

    const blendSelect = document.getElementById('layer-blend-mode');
    if (blendSelect) {
      BLEND_MODES.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; blendSelect.appendChild(opt); });
      blendSelect.addEventListener('change', () => {
        const layer = this.app.layers.activeLayer;
        if (layer) { layer.blendMode = blendSelect.value; this.app.history.snapshot('Blend Mode',this.app.layers); this.app.render(); }
      });
    }

    const opacityInput = document.getElementById('layer-opacity');
    if (opacityInput) {
      opacityInput.addEventListener('input', () => {
        const layer = this.app.layers.activeLayer;
        if (layer) { layer.opacity = parseInt(opacityInput.value) / 100; this.app.render(); }
      });
      opacityInput.addEventListener('change', () => this.app.history.snapshot('Opacity',this.app.layers));
    }
  }

  refreshLayers() {
    const list = document.getElementById('layers-list');
    if (!list) return;
    list.innerHTML = '';
    const layers = [...this.app.layers.layers].reverse();
    layers.forEach(layer => {
      const item = document.createElement('div');
      item.className = 'layer-item' + (layer.id === this.app.layers.activeLayerId ? ' active' : '');
      item.dataset.id = layer.id;

      // Thumbnail
      const thumb = document.createElement('canvas');
      thumb.width = 32; thumb.height = 24;
      thumb.className = 'layer-thumb';
      const tctx = thumb.getContext('2d');
      drawCheckerboard(tctx, 0, 0, 32, 24);
      tctx.drawImage(layer.canvas, 0, 0, 32, 24);

      // Visibility toggle
      const visBtn = document.createElement('button');
      visBtn.className = 'layer-vis-btn' + (layer.visible ? '' : ' hidden');
      visBtn.innerHTML = layer.visible ? '👁' : '👁‍🗨';
      visBtn.title = 'Toggle Visibility';
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        this.app.render();
        this.refreshLayers();
      });

      // Lock button
      const lockBtn = document.createElement('button');
      lockBtn.className = 'layer-lock-btn';
      lockBtn.innerHTML = layer.locked ? '🔒' : '🔓';
      lockBtn.title = 'Lock/Unlock';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.locked = !layer.locked;
        this.refreshLayers();
      });

      // Name
      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;
      name.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.value = layer.name;
        input.style.cssText = 'width:100%;background:#333;color:#fff;border:1px solid #555;padding:1px 4px;font-size:11px;';
        name.replaceWith(input);
        input.focus(); input.select();
        const commit = () => { layer.name = input.value || layer.name; this.refreshLayers(); };
        input.onblur = commit;
        input.onkeydown = (ev) => { if (ev.key === 'Enter') commit(); if (ev.key === 'Escape') this.refreshLayers(); };
      });

      item.appendChild(visBtn);
      item.appendChild(lockBtn);
      item.appendChild(thumb);
      item.appendChild(name);

      item.addEventListener('click', () => {
        this.app.layers.setActive(layer.id);
        this.refreshLayers();
      });

      // Right-click context menu on layer
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.app.layers.setActive(layer.id);
        this.showLayerContextMenu(e.clientX, e.clientY, layer);
      });

      list.appendChild(item);
    });

    // Update blend mode and opacity controls
    const active = this.app.layers.activeLayer;
    const blendSelect = document.getElementById('layer-blend-mode');
    if (blendSelect && active) blendSelect.value = active.blendMode;
    const opInput = document.getElementById('layer-opacity');
    if (opInput && active) opInput.value = Math.round(active.opacity * 100);
  }

  showLayerContextMenu(x, y, layer) {
    this.showContextMenuAt(x, y, [
      { label: 'Duplicate Layer', action: () => { this.app.layers.duplicateLayer(layer.id); this.app.history.snapshot('Duplicate Layer',this.app.layers); this.refreshLayers(); this.app.render(); }},
      { label: 'Delete Layer', action: () => { this.app.layers.removeLayer(layer.id); this.app.history.snapshot('Delete Layer',this.app.layers); this.refreshLayers(); this.app.render(); }},
      { label: 'Merge Down', action: () => { this.app.layers.mergeDown(layer.id); this.app.history.snapshot('Merge Down',this.app.layers); this.refreshLayers(); this.app.render(); }},
      { label: 'Flatten Image', action: () => { this.app.layers.mergeAll(); this.app.history.snapshot('Flatten',this.app.layers); this.refreshLayers(); this.app.render(); }},
      { label: '---' },
      { label: layer.visible ? 'Hide Layer' : 'Show Layer', action: () => { layer.visible = !layer.visible; this.app.render(); this.refreshLayers(); }},
      { label: layer.locked ? 'Unlock Layer' : 'Lock Layer', action: () => { layer.locked = !layer.locked; this.refreshLayers(); }},
      { label: '---' },
      { label: 'Layer Properties…', action: () => this.showLayerPropertiesDialog(layer) },
      { label: 'Layer Style…', action: () => this.showLayerStyleDialog(layer) },
    ]);
  }

  groupLayers() { /* TODO: group selected layers */ }

  _bindHistoryPanelHeader() {
    // History panel is purely driven by refreshHistory(); nothing extra to bind here.
  }

  // ─── History panel ────────────────────────────────────────────────────────

  refreshHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    const labels = this.app.history.getLabels();
    labels.forEach((entry, i) => {
      const item = document.createElement('div');
      item.className = 'history-item' + (entry.current ? ' current' : '');
      item.textContent = entry.label;
      item.addEventListener('click', () => {
        // Jump to state
        while (this.app.history.index > i) this.app.history.undo(this.app.layers);
        while (this.app.history.index < i) this.app.history.redo(this.app.layers);
        this.app.render();
        this.refreshLayers();
        this.refreshHistory();
      });
      list.appendChild(item);
    });
    list.scrollTop = list.scrollHeight;
  }

  // ─── Status bar ───────────────────────────────────────────────────────────

  updateCoords(x, y) {
    const coordEl = document.getElementById('coord-display');
    if (coordEl) coordEl.textContent = `${Math.round(x)}, ${Math.round(y)} px`;
    // Update color under cursor
    const layer = this.app.layers.activeLayer;
    if (layer) {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi >= 0 && xi < layer.canvas.width && yi >= 0 && yi < layer.canvas.height) {
        const d = layer.ctx.getImageData(xi, yi, 1, 1).data;
        const infoEl = document.getElementById('pixel-info');
        if (infoEl) infoEl.textContent = `R:${d[0]} G:${d[1]} B:${d[2]} A:${d[3]}`;
      }
    }
  }

  updateZoomDisplay() {
    const el = document.getElementById('zoom-display');
    if (el) el.textContent = `${Math.round(this.app.scale * 100)}%`;
    const slider = document.getElementById('zoom-slider');
    if (slider) slider.value = Math.round(this.app.scale * 100);
  }

  drawRulers() {
    const oc = this.app.overlayCtx;
    const { x: ox, y: oy } = this.app.canvasOffset;
    const s = this.app.scale;
    const W = oc.canvas.width, H = oc.canvas.height;
    const rulerH = 20;

    oc.save();
    // Horizontal ruler
    oc.fillStyle = '#2a2a2a';
    oc.fillRect(rulerH, 0, W, rulerH);
    oc.fillStyle = '#1a1a1a';
    oc.fillRect(0, 0, rulerH, rulerH);
    oc.fillRect(0, rulerH, rulerH, H);

    oc.strokeStyle = '#555';
    oc.fillStyle = '#888';
    oc.font = '9px sans-serif';
    oc.textAlign = 'center';
    oc.lineWidth = 0.5;

    const step = _rulerStep(s);
    for (let px = Math.floor((-ox/s)/step)*step; px * s + ox < W; px += step) {
      const screenX = px * s + ox;
      if (screenX < rulerH) continue;
      oc.beginPath(); oc.moveTo(screenX, 0); oc.lineTo(screenX, rulerH); oc.stroke();
      oc.fillText(px, screenX, 10);
    }
    // Vertical ruler
    oc.textAlign = 'right';
    for (let py = Math.floor((-oy/s)/step)*step; py * s + oy < H; py += step) {
      const screenY = py * s + oy;
      if (screenY < rulerH) continue;
      oc.beginPath(); oc.moveTo(0, screenY); oc.lineTo(rulerH, screenY); oc.stroke();
      oc.save(); oc.translate(4, screenY); oc.rotate(-Math.PI/2); oc.fillText(py, 0, 0); oc.restore();
    }
    oc.restore();
  }

  // ─── Dialogs ──────────────────────────────────────────────────────────────

  showNewDocDialog() {
    const presets = [
      { name: 'Web (1280×720)', w: 1280, h: 720 },
      { name: 'HD (1920×1080)', w: 1920, h: 1080 },
      { name: '4K (3840×2160)', w: 3840, h: 2160 },
      { name: 'A4 Print (2480×3508)', w: 2480, h: 3508 },
      { name: 'Square (1000×1000)', w: 1000, h: 1000 },
      { name: 'Small (800×600)', w: 800, h: 600 },
      { name: 'Twitter Banner (1500×500)', w: 1500, h: 500 },
      { name: 'Instagram (1080×1080)', w: 1080, h: 1080 },
    ];
    this._createDialog('New Document', `
      <div style="display:flex;gap:16px">
        <div style="flex:1">
          <label style="display:block;margin-bottom:8px">Preset:
            <select id="nd-preset" style="width:100%;margin-top:4px">
              ${presets.map(p=>`<option value="${p.w},${p.h}">${p.name}</option>`).join('')}
              <option value="custom">Custom</option>
            </select>
          </label>
          <label style="display:block;margin-bottom:8px">Width: <input type="number" id="nd-width" value="800" min="1" max="32000" style="width:80px"> px</label>
          <label style="display:block;margin-bottom:8px">Height: <input type="number" id="nd-height" value="600" min="1" max="32000" style="width:80px"> px</label>
          <label style="display:block;margin-bottom:8px">Resolution: <input type="number" id="nd-res" value="72" min="1" max="2400" style="width:60px"> PPI</label>
          <label style="display:block;margin-bottom:8px">Color Mode:
            <select id="nd-mode">
              <option>RGB Color</option><option>CMYK Color</option><option>Grayscale</option><option>Bitmap</option><option>Lab Color</option>
            </select>
          </label>
          <label style="display:block;margin-bottom:8px">Background:
            <select id="nd-bg">
              <option value="white">White</option><option value="black">Black</option><option value="transparent">Transparent</option><option value="fg">Foreground Color</option><option value="bg">Background Color</option>
            </select>
          </label>
        </div>
        <div style="flex:0 0 150px;display:flex;align-items:center;justify-content:center">
          <div id="nd-preview" style="background:#fff;border:1px solid #555;max-width:150px;max-height:120px;aspect-ratio:800/600;width:100%"></div>
        </div>
      </div>
    `, [
      { label: 'Create', primary: true, action: () => {
        const w = parseInt(document.getElementById('nd-width').value) || 800;
        const h = parseInt(document.getElementById('nd-height').value) || 600;
        const bg = document.getElementById('nd-bg').value;
        const bgColor = bg === 'white' ? '#ffffff' : bg === 'black' ? '#000000' : bg === 'fg' ? this.app.fgColor : bg === 'bg' ? this.app.bgColor : 'transparent';
        this.app.newDocument(w, h, bgColor);
      }},
      { label: 'Cancel' }
    ]);
    const presetSel = document.getElementById('nd-preset');
    if (presetSel) {
      presetSel.addEventListener('change', () => {
        const val = presetSel.value;
        if (val !== 'custom') {
          const [w,h] = val.split(',').map(Number);
          document.getElementById('nd-width').value = w;
          document.getElementById('nd-height').value = h;
        }
      });
    }
  }

  showImageSizeDialog() {
    const lm = this.app.layers;
    this._createDialog('Image Size', `
      <div>
        <label style="display:block;margin-bottom:8px">Width: <input type="number" id="is-width" value="${lm.width}" min="1" max="32000" style="width:80px"> px</label>
        <label style="display:block;margin-bottom:8px">Height: <input type="number" id="is-height" value="${lm.height}" min="1" max="32000" style="width:80px"> px</label>
        <label style="display:block;margin-bottom:8px">Resolution: <input type="number" id="is-res" value="72" style="width:60px"> PPI</label>
        <label style="display:block;margin-bottom:8px"><input type="checkbox" id="is-constrain" checked> Constrain Proportions</label>
        <label style="display:block;margin-bottom:8px"><input type="checkbox" id="is-resample" checked> Resample Image</label>
        <label style="display:block;margin-bottom:8px">Resample Method:
          <select id="is-method"><option>Bicubic Sharper</option><option>Bicubic Smoother</option><option>Bicubic</option><option>Bilinear</option><option>Nearest Neighbor</option></select>
        </label>
      </div>
    `, [
      { label: 'OK', primary: true, action: () => {
        const w = parseInt(document.getElementById('is-width').value);
        const h = parseInt(document.getElementById('is-height').value);
        const resample = document.getElementById('is-resample').checked;
        this.app.resizeImage(w, h, resample);
      }},
      { label: 'Cancel' }
    ]);
    const wInput = document.getElementById('is-width');
    const hInput = document.getElementById('is-height');
    const constrain = document.getElementById('is-constrain');
    const ratio = lm.width / lm.height;
    if (wInput) wInput.addEventListener('input', () => { if (constrain && constrain.checked) hInput.value = Math.round(parseInt(wInput.value)/ratio); });
    if (hInput) hInput.addEventListener('input', () => { if (constrain && constrain.checked) wInput.value = Math.round(parseInt(hInput.value)*ratio); });
  }

  showCanvasSizeDialog() {
    const lm = this.app.layers;
    this._createDialog('Canvas Size', `
      <div>
        <p>Current Size: ${lm.width} × ${lm.height} px</p>
        <label style="display:block;margin-bottom:8px">New Width: <input type="number" id="cs-width" value="${lm.width}" min="1" max="32000" style="width:80px"> px</label>
        <label style="display:block;margin-bottom:8px">New Height: <input type="number" id="cs-height" value="${lm.height}" min="1" max="32000" style="width:80px"> px</label>
        <label style="display:block;margin-bottom:8px">Anchor:
          <div style="display:grid;grid-template-columns:repeat(3,30px);gap:2px;margin-top:4px">
            ${['nw','n','ne','w','center','e','sw','s','se'].map(a=>`<button data-anchor="${a}" class="anchor-btn ${a==='center'?'active':''}" style="height:30px;width:30px;font-size:10px">·</button>`).join('')}
          </div>
        </label>
        <label style="display:block;margin-bottom:8px">Canvas Extension Color:
          <input type="color" id="cs-bg" value="#ffffff">
        </label>
      </div>
    `, [
      { label: 'OK', primary: true, action: () => {
        const w = parseInt(document.getElementById('cs-width').value);
        const h = parseInt(document.getElementById('cs-height').value);
        const activeAnchor = document.querySelector('.anchor-btn.active');
        const anchor = activeAnchor ? activeAnchor.dataset.anchor : 'center';
        this.app.canvasSize(w, h, anchor);
      }},
      { label: 'Cancel' }
    ]);
    document.querySelectorAll('.anchor-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.anchor-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  showRotateDialog() {
    this._createDialog('Rotate Canvas', `
      <div>
        <label>Angle: <input type="number" id="rot-angle" value="0" min="-360" max="360" step="0.1" style="width:80px"> degrees</label>
        <div style="margin-top:8px">
          <label><input type="radio" name="rot-dir" value="cw" checked> Clockwise</label>
          <label style="margin-left:12px"><input type="radio" name="rot-dir" value="ccw"> Counterclockwise</label>
        </div>
      </div>
    `, [
      { label: 'OK', primary: true, action: () => {
        const angle = parseFloat(document.getElementById('rot-angle').value);
        const dir = document.querySelector('input[name="rot-dir"]:checked').value;
        this.app.rotateCanvas(dir === 'ccw' ? -angle : angle);
      }},
      { label: 'Cancel' }
    ]);
  }

  showAdjustmentDialog(name) {
    const configs = {
      brightnessContrast: {
        title: 'Brightness/Contrast',
        fields: [{label:'Brightness',key:'brightness',min:-150,max:150,value:0},{label:'Contrast',key:'contrast',min:-150,max:150,value:0}],
        fn: (params) => this.app.applyAdjustment('brightnessContrast', params),
      },
      levels: {
        title: 'Levels',
        fields: [{label:'Black',key:'inBlack',min:0,max:253,value:0},{label:'Midtones (Gamma)',key:'gamma',min:0.1,max:9.99,value:1,step:0.01},{label:'White',key:'inWhite',min:2,max:255,value:255},{label:'Output Black',key:'outBlack',min:0,max:255,value:0},{label:'Output White',key:'outWhite',min:0,max:255,value:255}],
        fn: (params) => this.app.applyAdjustment('levels', params),
      },
      curves: {
        title: 'Curves',
        fields: [{label:'Midpoint X',key:'mx',min:0,max:255,value:128},{label:'Midpoint Y',key:'my',min:0,max:255,value:128}],
        fn: (params) => {
          const pts = [[0,0],[params.mx,params.my],[255,255]];
          this.app.applyAdjustment('curves', { points: pts, channel: 'rgb' });
        },
      },
      exposure: {
        title: 'Exposure',
        fields: [{label:'Exposure (EV)',key:'ev',min:-20,max:20,value:0,step:0.01},{label:'Offset',key:'offset',min:-0.5,max:0.5,value:0,step:0.001},{label:'Gamma',key:'gamma',min:0.01,max:9.99,value:1,step:0.01}],
        fn: (params) => this.app.applyAdjustment('exposure', params),
      },
      vibrance: {
        title: 'Vibrance',
        fields: [{label:'Vibrance',key:'vibrance',min:-100,max:100,value:0},{label:'Saturation',key:'saturation',min:-100,max:100,value:0}],
        fn: (params) => this.app.applyAdjustment('vibrance', params),
      },
      hueSaturation: {
        title: 'Hue/Saturation',
        fields: [{label:'Hue',key:'hue',min:-180,max:180,value:0},{label:'Saturation',key:'saturation',min:-100,max:100,value:0},{label:'Lightness',key:'lightness',min:-100,max:100,value:0}],
        fn: (params) => this.app.applyAdjustment('hueSaturation', params),
      },
      colorBalance: {
        title: 'Color Balance',
        fields: [{label:'Shadows Red-Cyan',key:'sr',min:-100,max:100,value:0},{label:'Shadows Green-Magenta',key:'sg',min:-100,max:100,value:0},{label:'Shadows Blue-Yellow',key:'sb',min:-100,max:100,value:0},{label:'Midtones Red',key:'mr',min:-100,max:100,value:0},{label:'Midtones Green',key:'mg',min:-100,max:100,value:0},{label:'Midtones Blue',key:'mb',min:-100,max:100,value:0}],
        fn: (params) => this.app.applyAdjustment('colorBalance', { shadows:[params.sr,params.sg,params.sb], midtones:[params.mr,params.mg,params.mb], highlights:[0,0,0] }),
      },
      blackAndWhite: {
        title: 'Black & White',
        fields: [{label:'Reds',key:'reds',min:-200,max:300,value:40},{label:'Yellows',key:'yellows',min:-200,max:300,value:60},{label:'Greens',key:'greens',min:-200,max:300,value:40},{label:'Cyans',key:'cyans',min:-200,max:300,value:60},{label:'Blues',key:'blues',min:-200,max:300,value:20},{label:'Magentas',key:'magentas',min:-200,max:300,value:80}],
        fn: (params) => this.app.applyAdjustment('blackAndWhite', params),
      },
      shadowsHighlights: {
        title: 'Shadows/Highlights',
        fields: [{label:'Shadows',key:'shadows',min:0,max:100,value:35},{label:'Highlights',key:'highlights',min:0,max:100,value:0}],
        fn: (params) => this.app.applyAdjustment('shadowsHighlights', params),
      },
      invert: { title:'Invert', fields:[], fn:()=>this.app.applyAdjustment('invert') },
      posterize: {
        title:'Posterize',
        fields:[{label:'Levels',key:'levels',min:2,max:255,value:4}],
        fn:(params)=>this.app.applyAdjustment('posterize',params),
      },
      threshold: {
        title:'Threshold',
        fields:[{label:'Level',key:'level',min:1,max:255,value:128}],
        fn:(params)=>this.app.applyAdjustment('threshold',params),
      },
      equalize: { title:'Equalize', fields:[], fn:()=>this.app.applyAdjustment('equalize') },
      desaturate: { title:'Desaturate', fields:[], fn:()=>this.app.applyAdjustment('desaturate') },
      photoFilter: {
        title:'Photo Filter',
        fields:[{label:'Density',key:'density',min:1,max:100,value:25}],
        extra:`<label>Filter Color: <input type="color" id="pf-color" value="#ffa500"></label>`,
        fn:(params)=>{
          const col=document.getElementById('pf-color');
          const rgb=col?hexToRgbArr(col.value):[250,165,0];
          this.app.applyAdjustment('photoFilter',{color:rgb,density:params.density});
        },
      },
      channelMixer: {
        title:'Channel Mixer',
        fields:[{label:'Source R (%)',key:'sourceR',min:-200,max:200,value:100},{label:'Source G (%)',key:'sourceG',min:-200,max:200,value:0},{label:'Source B (%)',key:'sourceB',min:-200,max:200,value:0},{label:'Constant',key:'constant',min:-200,max:200,value:0}],
        extra:`<label>Output Channel: <select id="cm-channel"><option value="r">Red</option><option value="g">Green</option><option value="b">Blue</option></select></label>`,
        fn:(params)=>{
          const ch=document.getElementById('cm-channel');
          this.app.applyAdjustment('channelMixer',{outputChannel:ch?ch.value:'r',...params});
        },
      },
    };

    const cfg = configs[name];
    if (!cfg) {
      // Just apply with defaults
      this.app.applyAdjustment(name);
      return;
    }

    if (cfg.fields.length === 0) { cfg.fn({}); return; }

    this._createDialog(cfg.title, `
      <div>
        ${cfg.extra||''}
        ${cfg.fields.map(f=>`
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:180px;flex-shrink:0">${f.label}:</span>
            <input type="range" id="adj-${f.key}" min="${f.min}" max="${f.max}" step="${f.step||1}" value="${f.value}" style="flex:1">
            <input type="number" id="adj-${f.key}-num" value="${f.value}" min="${f.min}" max="${f.max}" step="${f.step||1}" style="width:60px">
          </label>
        `).join('')}
        <div id="adj-preview-info" style="margin-top:8px;font-size:11px;color:#aaa">Adjust sliders to set values, then click OK to apply.</div>
      </div>
    `, [
      { label: 'OK', primary: true, action: () => {
        const params = {};
        cfg.fields.forEach(f => { params[f.key] = parseFloat(document.getElementById(`adj-${f.key}`).value); });
        cfg.fn(params);
      }},
      { label: 'Cancel' }
    ]);

    // Sync sliders and number inputs
    cfg.fields.forEach(f => {
      const range = document.getElementById(`adj-${f.key}`);
      const num = document.getElementById(`adj-${f.key}-num`);
      if (range && num) {
        range.addEventListener('input', () => { num.value = range.value; });
        num.addEventListener('input', () => { range.value = num.value; });
      }
    });
  }

  showFilterDialog(filterName, fields) {
    const realFields = fields.map(f => ({ ...f, value: f.value === null ? Math.round(this.app.layers.width / 2) : f.value }));
    this._createDialog(_filterLabel(filterName), `
      <div>
        ${realFields.map(f=>`
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:100px;flex-shrink:0">${f.label}:</span>
            <input type="range" id="flt-${f.key}" min="${f.min}" max="${f.max}" step="${f.step||1}" value="${f.value}" style="flex:1">
            <input type="number" id="flt-${f.key}-num" value="${f.value}" min="${f.min}" max="${f.max}" step="${f.step||1}" style="width:70px">
          </label>
        `).join('')}
      </div>
    `, [
      { label: 'OK', primary: true, action: () => {
        const params = {};
        realFields.forEach(f => { params[f.key] = parseFloat(document.getElementById(`flt-${f.key}`).value); });
        this.app.applyFilter(filterName, params);
      }},
      { label: 'Cancel' }
    ]);
    realFields.forEach(f => {
      const range = document.getElementById(`flt-${f.key}`);
      const num = document.getElementById(`flt-${f.key}-num`);
      if (range && num) {
        range.addEventListener('input', () => num.value = range.value);
        num.addEventListener('input', () => range.value = num.value);
      }
    });
  }

  showFillDialog() {
    this._createDialog('Fill', `
      <label style="display:block;margin-bottom:8px">Contents:
        <select id="fill-contents">
          <option value="fg">Foreground Color</option>
          <option value="bg">Background Color</option>
          <option value="color">Color…</option>
          <option value="pattern">Pattern</option>
          <option value="history">History</option>
          <option value="black">Black</option>
          <option value="white">White</option>
          <option value="gray">50% Gray</option>
        </select>
      </label>
      <label style="display:block;margin-bottom:8px">Custom Color: <input type="color" id="fill-custom-color" value="#ff0000"></label>
      <label style="display:block;margin-bottom:8px">Blending Mode:
        <select id="fill-blend-mode">${BLEND_MODES.map(m=>`<option>${m}</option>`).join('')}</select>
      </label>
      <label style="display:block;margin-bottom:8px">Opacity: <input type="range" id="fill-opacity" min="1" max="100" value="100"> <span>100%</span></label>
      <label style="display:block;margin-bottom:8px"><input type="checkbox" id="fill-preserve-trans"> Preserve Transparency</label>
    `, [
      { label: 'OK', primary: true, action: () => {
        const layer = this.app.layers.activeLayer; if (!layer || layer.locked) return;
        const contents = document.getElementById('fill-contents').value;
        const opacity = parseInt(document.getElementById('fill-opacity').value) / 100;
        let color;
        if (contents === 'fg') color = this.app.fgColor;
        else if (contents === 'bg') color = this.app.bgColor;
        else if (contents === 'color') color = document.getElementById('fill-custom-color').value;
        else if (contents === 'black') color = '#000';
        else if (contents === 'white') color = '#fff';
        else if (contents === 'gray') color = '#808080';
        else color = this.app.fgColor;
        layer.ctx.save();
        layer.ctx.globalAlpha = opacity;
        layer.ctx.fillStyle = color;
        if (this.app.selection.active) this.app.selection.clipContext(layer.ctx);
        layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.restore();
        this.app.history.snapshot('Fill', this.app.layers);
        this.app.render();
      }},
      { label: 'Cancel' }
    ]);
  }

  showStrokeDialog() {
    this._createDialog('Stroke', `
      <label style="display:block;margin-bottom:8px">Width: <input type="number" id="stroke-width" value="2" min="1" max="2000" style="width:60px"> px</label>
      <label style="display:block;margin-bottom:8px">Color: <input type="color" id="stroke-color" value="${this.app.fgColor}"></label>
      <label style="display:block;margin-bottom:8px">Location:
        <select id="stroke-location">
          <option value="inside">Inside</option><option value="center" selected>Center</option><option value="outside">Outside</option>
        </select>
      </label>
      <label style="display:block;margin-bottom:8px">Blend Mode: <select id="stroke-blend">${BLEND_MODES.slice(0,5).map(m=>`<option>${m}</option>`).join('')}</select></label>
      <label style="display:block;margin-bottom:8px">Opacity: <input type="range" id="stroke-opacity" min="1" max="100" value="100"> 100%</label>
    `, [
      { label: 'OK', primary: true, action: () => {
        const layer = this.app.layers.activeLayer; if (!layer || layer.locked) return;
        const w = parseInt(document.getElementById('stroke-width').value);
        const color = document.getElementById('stroke-color').value;
        const opacity = parseInt(document.getElementById('stroke-opacity').value) / 100;
        layer.ctx.save();
        layer.ctx.globalAlpha = opacity;
        layer.ctx.strokeStyle = color;
        layer.ctx.lineWidth = w;
        if (this.app.selection.active) this.app.selection.clipContext(layer.ctx);
        layer.ctx.beginPath();
        const sel = this.app.selection._current;
        if (sel) {
          if (sel.type === 'rect') layer.ctx.rect(sel.x, sel.y, sel.w, sel.h);
          else if (sel.type === 'ellipse') layer.ctx.ellipse(sel.x+sel.w/2, sel.y+sel.h/2, sel.w/2, sel.h/2, 0, 0, Math.PI*2);
        } else {
          layer.ctx.rect(0, 0, layer.canvas.width, layer.canvas.height);
        }
        layer.ctx.stroke();
        layer.ctx.restore();
        this.app.history.snapshot('Stroke', this.app.layers);
        this.app.render();
      }},
      { label: 'Cancel' }
    ]);
  }

  showLayerPropertiesDialog(layer) {
    const l = layer || this.app.layers.activeLayer;
    if (!l) return;
    this._createDialog('Layer Properties', `
      <label style="display:block;margin-bottom:8px">Name: <input type="text" id="lp-name" value="${l.name}" style="width:200px"></label>
      <label style="display:block;margin-bottom:8px">Color:
        <select id="lp-color"><option>None</option><option>Red</option><option>Orange</option><option>Yellow</option><option>Green</option><option>Blue</option><option>Violet</option><option>Gray</option></select>
      </label>
      <label style="display:block;margin-bottom:8px"><input type="checkbox" id="lp-use-clip" ${l._clippingGroup?'checked':''}> Use Previous Layer to Create Clipping Mask</label>
    `, [
      { label: 'OK', primary: true, action: () => {
        l.name = document.getElementById('lp-name').value || l.name;
        l._clippingGroup = document.getElementById('lp-use-clip').checked;
        this.refreshLayers();
      }},
      { label: 'Cancel' }
    ]);
  }

  showLayerStyleDialog(layer) {
    const l = layer || this.app.layers.activeLayer;
    if (!l) return;
    const styles = ['Drop Shadow','Inner Shadow','Outer Glow','Inner Glow','Bevel & Emboss','Satin','Color Overlay','Gradient Overlay','Pattern Overlay','Stroke'];
    this._createDialog('Layer Style', `
      <div style="display:flex;gap:16px;min-height:350px">
        <div style="width:160px;border-right:1px solid #555;padding-right:8px">
          <div style="margin-bottom:8px;font-weight:bold">Styles</div>
          ${styles.map(s=>`<label style="display:flex;align-items:center;gap:6px;margin-bottom:4px;cursor:pointer"><input type="checkbox" class="ls-check" data-style="${s}"> ${s}</label>`).join('')}
        </div>
        <div id="ls-params" style="flex:1;padding-left:8px">
          <p style="color:#888;font-size:12px">Select a style to configure its options.</p>
          <div id="ls-drop-shadow" class="ls-panel" style="display:none">
            <label>Opacity: <input type="range" min="0" max="100" value="75"> <span>75%</span></label>
            <label>Angle: <input type="number" value="120" min="-360" max="360" style="width:60px"> degrees</label>
            <label>Distance: <input type="range" min="0" max="300" value="5"> <span>5px</span></label>
            <label>Spread: <input type="range" min="0" max="100" value="0"> <span>0%</span></label>
            <label>Size: <input type="range" min="0" max="300" value="5"> <span>5px</span></label>
            <label>Color: <input type="color" value="#000000"></label>
          </div>
        </div>
      </div>
    `, [
      { label: 'OK', primary: true, action: () => {
        const checks = document.querySelectorAll('.ls-check:checked');
        l._effects = {};
        checks.forEach(c => { l._effects[c.dataset.style] = true; });
        // Apply drop shadow as canvas filter (CSS)
        if (l._effects['Drop Shadow']) {
          l.canvas.style.filter = 'drop-shadow(2px 4px 6px rgba(0,0,0,0.5))';
        }
        this.app.render();
      }},
      { label: 'Cancel' }
    ]);
    document.querySelectorAll('.ls-check').forEach(cb => {
      cb.addEventListener('change', () => {
        document.querySelectorAll('.ls-panel').forEach(p => p.style.display = 'none');
        const panelId = 'ls-' + cb.dataset.style.toLowerCase().replace(/[\s&]+/g,'-');
        const panel = document.getElementById(panelId);
        if (panel) panel.style.display = cb.checked ? 'block' : 'none';
      });
    });
  }

  showColorRangeDialog() {
    this._createDialog('Color Range', `
      <label style="display:block;margin-bottom:8px">Select:
        <select id="cr-select">
          <option>Sampled Colors</option><option>Reds</option><option>Yellows</option><option>Greens</option><option>Cyans</option><option>Blues</option><option>Magentas</option><option>Highlights</option><option>Midtones</option><option>Shadows</option>
        </select>
      </label>
      <label style="display:block;margin-bottom:8px">Fuzziness: <input type="range" id="cr-fuzz" min="0" max="200" value="40"> <span>40</span></label>
      <label style="display:block;margin-bottom:8px"><input type="checkbox" id="cr-inverted"> Invert</label>
    `, [
      { label: 'OK', primary: true, action: () => { /* TODO */ }},
      { label: 'Cancel' }
    ]);
  }

  showFeatherDialog() {
    this._createDialog('Feather Selection', `
      <label>Feather Radius: <input type="number" id="feather-radius" value="5" min="0" max="1000"> px</label>
    `, [
      { label: 'OK', primary: true, action: () => { /* TODO: apply feather */ }},
      { label: 'Cancel' }
    ]);
  }

  showPreferencesDialog() {
    this._createDialog('Preferences', `
      <div style="display:flex;gap:16px;min-height:300px">
        <div style="width:140px;border-right:1px solid #555;padding-right:8px">
          ${['General','Interface','File Handling','Performance','Cursors','Transparency & Gamut','Units & Rulers','Guides & Grid','Plug-ins','Type'].map(s=>`<div class="pref-cat" style="padding:4px 8px;cursor:pointer;border-radius:3px;margin-bottom:2px">${s}</div>`).join('')}
        </div>
        <div style="flex:1;padding-left:8px">
          <h3 style="margin:0 0 12px;font-size:13px">General</h3>
          <label style="display:block;margin-bottom:8px">Color Picker: <select><option>Adobe</option><option>OS Default</option></select></label>
          <label style="display:block;margin-bottom:8px">HUD Color Picker: <select><option>Hue Strip</option><option>Hue Wheel - Small</option><option>Hue Wheel - Medium</option></select></label>
          <label style="display:block;margin-bottom:8px">Image Interpolation: <select><option>Bicubic Automatic</option><option>Nearest Neighbor</option><option>Bilinear</option></select></label>
          <label style="display:block;margin-bottom:8px"><input type="checkbox" checked> Auto-Update Open Documents</label>
          <label style="display:block;margin-bottom:8px"><input type="checkbox" checked> Resize Image During Place</label>
          <label style="display:block;margin-bottom:8px">History States: <input type="number" value="50" min="1" max="1000" style="width:60px"></label>
          <h3 style="margin:12px 0;font-size:13px">Interface</h3>
          <label style="display:block;margin-bottom:8px">Color Theme:
            <div style="display:flex;gap:8px;margin-top:4px">
              ${['#1a1a1a','#2a2a2a','#3c3c3c','#5a5a5a'].map((c,i)=>`<div style="width:24px;height:24px;background:${c};border:2px solid ${i===1?'#0078d4':'transparent'};cursor:pointer;border-radius:2px" title="${['Darkest','Dark','Medium','Light'][i]}"></div>`).join('')}
            </div>
          </label>
          <h3 style="margin:12px 0;font-size:13px">Units & Rulers</h3>
          <label style="display:block;margin-bottom:8px">Rulers: <select><option>Pixels</option><option>Inches</option><option>Centimeters</option><option>Millimeters</option><option>Points</option><option>Picas</option><option>Percent</option></select></label>
          <label style="display:block;margin-bottom:8px">Type: <select><option>Pixels</option><option>Points</option><option>Millimeters</option></select></label>
        </div>
      </div>
    `, [{ label: 'OK', primary: true, action: () => {} }, { label: 'Cancel' }]);
  }

  showShortcutsDialog() {
    const shortcuts = [
      ['Tool Selection',''],
      ['Move','V'],['Marquee (Rect/Ellipse)','M'],['Lasso / Polygon Lasso','L'],['Magic Wand','W'],
      ['Crop','C'],['Eyedropper','I'],['Healing Brush / Clone Stamp','J / S'],['Brush / Pencil','B / N'],
      ['Eraser','E'],['Paint Bucket / Gradient','G'],['Blur Brush','R'],['Dodge / Burn / Sponge','O'],
      ['Pen','P'],['Text','T'],['Shape','U'],['Hand','H'],['Zoom','Z'],
      ['',''],
      ['File',''],
      ['New','Ctrl+N'],['Open','Ctrl+O'],['Save','Ctrl+S'],['Save As','Ctrl+Shift+S'],
      ['Export Flattened','Ctrl+Shift+E'],['Print','Ctrl+P'],
      ['',''],
      ['Edit',''],
      ['Undo','Ctrl+Z'],['Redo','Ctrl+Shift+Z or Ctrl+Y'],['Cut','Ctrl+X'],['Copy','Ctrl+C'],
      ['Paste','Ctrl+V'],['Paste in Place','Ctrl+Shift+V'],['Fill','Shift+F5'],
      ['Free Transform','Ctrl+T'],['Select All','Ctrl+A'],['Deselect','Ctrl+D'],
      ['Reselect','Ctrl+Shift+D'],['Invert Selection','Ctrl+Shift+I'],
      ['Delete / Clear','Delete'],
      ['',''],
      ['Image',''],
      ['Levels','Ctrl+L'],['Curves','Ctrl+M'],['Hue/Saturation','Ctrl+U'],
      ['Color Balance','Ctrl+B'],['Brightness/Contrast','Ctrl+B'],
      ['Auto Levels','Ctrl+Shift+L'],['Auto Color','Ctrl+Shift+B'],
      ['Invert','Ctrl+I'],['Desaturate','Ctrl+Shift+U'],
      ['',''],
      ['View',''],
      ['Zoom In','Ctrl++'],['Zoom Out','Ctrl+-'],['Fit Screen','Ctrl+0'],
      ['Actual Pixels','Ctrl+Alt+0'],['Fullscreen','F'],
      ['Toggle Rulers','Ctrl+R'],['Toggle Grid','Ctrl+\''],['Toggle Guides','Ctrl+;'],
      ['',''],
      ['Layer',''],
      ['New Layer','Ctrl+Shift+N'],['Layer via Copy','Ctrl+J'],['Merge Down','Ctrl+E'],
      ['Flatten','Ctrl+Shift+E'],['Group Layers','Ctrl+G'],
      ['Select Layer Above','Alt+]'],['Select Layer Below','Alt+['],
      ['',''],
      ['Brush',''],
      ['Decrease Size','['],['Increase Size',']'],['Decrease Hardness','{'],['Increase Hardness','}'],
      ['Opacity 10%-90%','1-9'],['Opacity 100%','0'],
      ['Swap Colors','X'],['Reset Colors','D'],
      ['Repeat Last Filter','Ctrl+F'],
    ];
    this._createDialog('Keyboard Shortcuts', `
      <div style="max-height:500px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          ${shortcuts.map(([action,key])=>key===''&&action===''?'<tr><td colspan="2" style="height:8px"></td></tr>':key===''?`<tr><td colspan="2" style="font-weight:bold;color:#aaa;padding:6px 4px 2px;border-bottom:1px solid #444">${action}</td></tr>`:`<tr style="border-bottom:1px solid #333"><td style="padding:3px 8px;font-size:12px">${action}</td><td style="padding:3px 8px;font-size:12px;color:#9cf;font-family:monospace;white-space:nowrap">${key}</td></tr>`).join('')}
        </table>
      </div>
    `, [{ label: 'Close' }]);
  }

  showAboutDialog() {
    this._createDialog('About Quantium', `
      <div style="text-align:center;padding:20px">
        <div style="font-size:32px;margin-bottom:8px">🎨</div>
        <h2 style="margin:0 0 4px">Quantium Photo Editor</h2>
        <p style="color:#aaa;margin:0 0 16px">Version 1.0.0</p>
        <p style="max-width:360px;margin:0 auto 16px;line-height:1.5;color:#ccc">
          A full-featured web-based image editor with all the tools, filters, adjustments and keyboard shortcuts you'd expect from a professional application.
        </p>
        <p style="color:#666;font-size:11px">© 2026 LEIFIYO — Quantium Public License</p>
      </div>
    `, [{ label: 'OK', primary: true, action: () => {} }]);
  }

  // ─── Context menu ─────────────────────────────────────────────────────────

  showContextMenu(x, y) {
    this.showContextMenuAt(x, y, [
      { label: 'Undo', action: () => this.app.undo() },
      { label: 'Redo', action: () => this.app.redo() },
      { label: '---' },
      { label: 'Cut', action: () => this.app.cut() },
      { label: 'Copy', action: () => this.app.copy() },
      { label: 'Paste', action: () => this.app.paste() },
      { label: '---' },
      { label: 'Select All', action: () => { this.app.selection.selectAll(this.app.layers.width,this.app.layers.height); this.app.renderOverlay(); } },
      { label: 'Deselect', action: () => { this.app.selection.deselect(); this.app.renderOverlay(); } },
      { label: '---' },
      { label: 'Free Transform', action: () => this.app.activateTool('transform') },
      { label: 'Layer Properties…', action: () => this.showLayerPropertiesDialog() },
    ]);
  }

  showContextMenuAt(x, y, items) {
    this._removeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:9999`;
    items.forEach(item => {
      if (item.label === '---') {
        const sep = document.createElement('div');
        sep.className = 'context-menu-sep';
        menu.appendChild(sep);
      } else {
        const el = document.createElement('div');
        el.className = 'context-menu-item';
        el.textContent = item.label;
        el.addEventListener('click', () => { item.action && item.action(); this._removeContextMenu(); });
        menu.appendChild(el);
      }
    });
    document.body.appendChild(menu);
    this._contextMenu = menu;
    // Adjust if off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
    setTimeout(() => document.addEventListener('click', this._removeContextMenu.bind(this), { once: true }), 0);
  }

  _removeContextMenu() {
    if (this._contextMenu) { this._contextMenu.remove(); this._contextMenu = null; }
  }

  // ─── Panel helpers ────────────────────────────────────────────────────────

  togglePanel(id) {
    const panel = document.getElementById(id);
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  }

  togglePanels() {
    this._panelsHidden = !this._panelsHidden;
    document.querySelectorAll('.panel, .toolbar, .options-bar').forEach(el => {
      el.style.visibility = this._panelsHidden ? 'hidden' : '';
    });
  }

  toggleRulers() {
    this.rulersVisible = !this.rulersVisible;
    this.app.renderOverlay();
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    this.app.renderOverlay();
  }

  toggleGuides() {
    this.guidesVisible = !this.guidesVisible;
  }

  toggleExtras() {
    this.gridVisible = !this.gridVisible;
    this.guidesVisible = !this.guidesVisible;
    this.app.renderOverlay();
  }

  trimImage() {
    // Auto-trim transparent borders
    const layer = this.app.layers.activeLayer;
    if (!layer) return;
    const w = layer.canvas.width, h = layer.canvas.height;
    const data = layer.ctx.getImageData(0, 0, w, h).data;
    let top = 0, bottom = h - 1, left = 0, right = w - 1;
    outer: for (top = 0; top < h; top++) for (let x = 0; x < w; x++) if (data[(top*w+x)*4+3] > 0) break outer;
    outer: for (bottom = h-1; bottom >= top; bottom--) for (let x = 0; x < w; x++) if (data[(bottom*w+x)*4+3] > 0) break outer;
    outer: for (left = 0; left < w; left++) for (let y = top; y <= bottom; y++) if (data[(y*w+left)*4+3] > 0) break outer;
    outer: for (right = w-1; right >= left; right--) for (let y = top; y <= bottom; y++) if (data[(y*w+right)*4+3] > 0) break outer;
    if (top <= bottom && left <= right) {
      const nw = right-left+1, nh = bottom-top+1;
      this.app.layers.layers.forEach(l => {
        const tmp = document.createElement('canvas'); tmp.width=nw; tmp.height=nh;
        tmp.getContext('2d').drawImage(l.canvas,-left,-top);
        l.canvas.width=nw; l.canvas.height=nh;
        l.ctx.drawImage(tmp,0,0);
      });
      this.app.layers.width=nw; this.app.layers.height=nh;
      this.app.history.snapshot('Trim',this.app.layers);
      this.app.render();
    }
  }

  // ─── Dialog factory ───────────────────────────────────────────────────────

  _createDialog(title, html, buttons) {
    // Remove existing
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.style.cssText = 'background:#2c2c2c;border:1px solid #555;border-radius:6px;min-width:340px;max-width:700px;max-height:90vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,0.7)';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #444;cursor:move';
    header.innerHTML = `<span style="font-weight:bold;font-size:13px">${title}</span><button class="dialog-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;padding:0 4px">✕</button>`;

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px;font-size:12px;color:#ddd';
    body.innerHTML = html;

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid #444';

    (buttons || [{ label: 'OK', primary: true, action: () => {} }]).forEach(btn => {
      const b = document.createElement('button');
      b.textContent = btn.label;
      b.className = btn.primary ? 'btn-primary' : 'btn-secondary';
      b.style.cssText = `padding:6px 16px;font-size:12px;border-radius:3px;cursor:pointer;border:1px solid ${btn.primary?'#0078d4':'#555'};background:${btn.primary?'#0078d4':'#3a3a3a'};color:#fff`;
      b.addEventListener('click', () => {
        if (btn.action) btn.action();
        overlay.remove();
      });
      footer.appendChild(b);
    });

    header.querySelector('.dialog-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Drag support
    let dragging = false, dx = 0, dy = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('dialog-close')) return;
      dragging = true;
      const rect = dialog.getBoundingClientRect();
      dx = e.clientX - rect.left; dy = e.clientY - rect.top;
      dialog.style.margin = '0'; dialog.style.position = 'fixed';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      dialog.style.left = (e.clientX - dx) + 'px';
      dialog.style.top = (e.clientY - dy) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    return dialog;
  }

  // ─── Marquee animation ────────────────────────────────────────────────────

  _startMarqueeAnimation() {
    const tick = () => {
      if (this.app.selection.active) this.app.renderOverlay();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _filterLabel(name) {
  const map = {
    gaussianBlur:'Gaussian Blur',boxBlur:'Box Blur',motionBlur:'Motion Blur',radialBlur:'Radial Blur',
    sharpen:'Sharpen',unsharpMask:'Unsharp Mask',addNoise:'Add Noise',median:'Median',
    ripple:'Ripple',twirl:'Twirl',pinch:'Pinch',spherize:'Spherize',polarCoordinates:'Polar Coordinates',zigzag:'ZigZag',
    findEdges:'Find Edges',emboss:'Emboss',solarize:'Solarize',invert:'Invert',diffuseGlow:'Diffuse Glow',glowingEdges:'Glowing Edges',
    pixelate:'Pixelate',crystallize:'Crystallize',colorHalftone:'Color Halftone',
    clouds:'Clouds',differenceClouds:'Difference Clouds',lensFlare:'Lens Flare',
    highPass:'High Pass',desaturate:'Desaturate',sepia:'Sepia',
  };
  return map[name] || name;
}

function _rulerStep(scale) {
  const raw = 100 / scale;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  if (frac < 2) return pow;
  if (frac < 5) return pow * 2;
  return pow * 5;
}

function hexToRgbArr(hex) {
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}
