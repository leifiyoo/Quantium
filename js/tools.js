/**
 * Tools – all canvas drawing / editing tool implementations
 */

// ─── Base Tool ───────────────────────────────────────────────────────────────

class Tool {
  constructor(app) { this.app = app; this.name = 'tool'; this.cursor = 'crosshair'; }
  onMouseDown(e, pt) {}
  onMouseMove(e, pt) {}
  onMouseUp(e, pt) {}
  onKeyDown(e) {}
  onKeyUp(e) {}
  onDblClick(e, pt) {}
  activate() { this.app.canvas.style.cursor = this.cursor; }
  deactivate() {}
  getCursor() { return this.cursor; }
}

// ─── Move Tool ───────────────────────────────────────────────────────────────

class MoveTool extends Tool {
  constructor(app) { super(app); this.name='move'; this.cursor='move'; this._start=null; this._origData=null; }
  onMouseDown(e,pt) {
    this._start=pt;
    const layer=this.app.layers.activeLayer;
    if(!layer||layer.locked) return;
    this._origData=layer.ctx.getImageData(0,0,layer.canvas.width,layer.canvas.height);
  }
  onMouseMove(e,pt) {
    if(!this._start||!this._origData) return;
    const layer=this.app.layers.activeLayer;
    if(!layer||layer.locked) return;
    const dx=Math.round(pt.x-this._start.x), dy=Math.round(pt.y-this._start.y);
    layer.ctx.clearRect(0,0,layer.canvas.width,layer.canvas.height);
    layer.ctx.putImageData(this._origData,dx,dy);
    this.app.render();
  }
  onMouseUp(e,pt) {
    if(this._start) this.app.history.snapshot('Move Layer',this.app.layers);
    this._start=null; this._origData=null;
  }
}

// ─── Brush Tool ──────────────────────────────────────────────────────────────

class BrushTool extends Tool {
  constructor(app) { super(app); this.name='brush'; this.cursor='crosshair'; this._drawing=false; this._last=null; }
  onMouseDown(e,pt) {
    const layer=this.app.layers.activeLayer;
    if(!layer||layer.locked) return;
    this._drawing=true;
    this._last=pt;
    this._paintDot(layer,pt);
    this.app.render();
  }
  onMouseMove(e,pt) {
    if(!this._drawing) return;
    const layer=this.app.layers.activeLayer;
    if(!layer||layer.locked) return;
    this._paintLine(layer,this._last,pt);
    this._last=pt;
    this.app.render();
  }
  onMouseUp(e,pt) {
    if(this._drawing) this.app.history.snapshot('Brush Stroke',this.app.layers);
    this._drawing=false; this._last=null;
  }
  _paintDot(layer, pt) {
    const ctx=layer.ctx;
    const opts=this.app.brushOptions;
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=opts.opacity||1;
    if(opts.softness>0) {
      const grad=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,opts.size/2);
      const col=this.app.fgColor;
      grad.addColorStop(0,col);
      grad.addColorStop(opts.softness/100,col);
      grad.addColorStop(1,hexToRgba(col,0));
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(pt.x,pt.y,opts.size/2,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle=this.app.fgColor;
      ctx.beginPath(); ctx.arc(pt.x,pt.y,opts.size/2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  _paintLine(layer, from, to) {
    const dist=Math.sqrt((to.x-from.x)**2+(to.y-from.y)**2);
    const spacing=Math.max(1,this.app.brushOptions.size*0.2);
    const steps=Math.ceil(dist/spacing);
    for(let i=0;i<=steps;i++){
      const t=steps>0?i/steps:0;
      this._paintDot(layer,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});
    }
  }
}

// ─── Pencil Tool ─────────────────────────────────────────────────────────────

class PencilTool extends BrushTool {
  constructor(app) { super(app); this.name='pencil'; }
  _paintDot(layer, pt) {
    const ctx=layer.ctx;
    const opts=this.app.brushOptions;
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=1;
    ctx.fillStyle=this.app.fgColor;
    ctx.fillRect(pt.x-1,pt.y-1,opts.size,opts.size);
    ctx.restore();
  }
}

// ─── Eraser Tool ─────────────────────────────────────────────────────────────

class EraserTool extends BrushTool {
  constructor(app) { super(app); this.name='eraser'; this.cursor='cell'; }
  _paintDot(layer, pt) {
    const ctx=layer.ctx;
    const opts=this.app.brushOptions;
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.globalAlpha=opts.opacity||1;
    if(opts.softness>0){
      const grad=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,opts.size/2);
      grad.addColorStop(0,'rgba(0,0,0,1)');
      grad.addColorStop(opts.softness/100,'rgba(0,0,0,1)');
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;
      ctx.beginPath();ctx.arc(pt.x,pt.y,opts.size/2,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle='rgba(0,0,0,1)';
      ctx.beginPath();ctx.arc(pt.x,pt.y,opts.size/2,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  onMouseUp(e,pt){if(this._drawing)this.app.history.snapshot('Erase',this.app.layers);this._drawing=false;this._last=null;}
}

// ─── Fill (Paint Bucket) Tool ────────────────────────────────────────────────

class FillTool extends Tool {
  constructor(app) { super(app); this.name='fill'; this.cursor='crosshair'; }
  onMouseDown(e,pt) {
    const layer=this.app.layers.activeLayer;
    if(!layer||layer.locked) return;
    const x=Math.round(pt.x),y=Math.round(pt.y);
    const w=layer.canvas.width,h=layer.canvas.height;
    if(x<0||x>=w||y<0||y>=h) return;
    const imageData=layer.ctx.getImageData(0,0,w,h);
    const tolerance=this.app.fillOptions.tolerance||32;
    const contiguous=this.app.fillOptions.contiguous!==false;
    const fillColor=hexToRgbA(this.app.fgColor);
    floodFill(imageData,x,y,fillColor,tolerance,contiguous);
    layer.ctx.putImageData(imageData,0,0);
    this.app.history.snapshot('Fill',this.app.layers);
    this.app.render();
  }
}

// ─── Eyedropper ──────────────────────────────────────────────────────────────

class EyedropperTool extends Tool {
  constructor(app) { super(app); this.name='eyedropper'; this.cursor='crosshair'; }
  onMouseDown(e,pt) {
    const layer=this.app.layers.activeLayer;
    if(!layer) return;
    const x=Math.round(pt.x),y=Math.round(pt.y);
    const w=layer.canvas.width,h=layer.canvas.height;
    if(x<0||x>=w||y<0||y>=h) return;
    const imageData=layer.ctx.getImageData(x,y,1,1).data;
    const hex=rgbToHex(imageData[0],imageData[1],imageData[2]);
    if(e.altKey) this.app.setBgColor(hex);
    else this.app.setFgColor(hex);
  }
}

// ─── Crop Tool ───────────────────────────────────────────────────────────────

class CropTool extends Tool {
  constructor(app) { super(app); this.name='crop'; this.cursor='crosshair'; this._start=null; this._end=null; this._active=false; }
  onMouseDown(e,pt) { this._start=pt; this._end=pt; this._active=true; }
  onMouseMove(e,pt) { if(this._active){this._end=pt; this.app.render(); this._drawOverlay();} }
  onMouseUp(e,pt) {
    this._end=pt;
    if(this._active) this._applyCrop();
    this._active=false;
  }
  _drawOverlay() {
    const oc=this.app.overlayCtx;
    if(!oc) return;
    const {x:ox,y:oy}=this.app.canvasOffset;
    const s=this.app.scale;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const x1=Math.min(this._start.x,this._end.x)*s+ox;
    const y1=Math.min(this._start.y,this._end.y)*s+oy;
    const x2=Math.max(this._start.x,this._end.x)*s+ox;
    const y2=Math.max(this._start.y,this._end.y)*s+oy;
    oc.fillStyle='rgba(0,0,0,0.5)';
    oc.fillRect(0,0,oc.canvas.width,oc.canvas.height);
    oc.clearRect(x1,y1,x2-x1,y2-y1);
    oc.strokeStyle='#fff';oc.lineWidth=1;oc.strokeRect(x1,y1,x2-x1,y2-y1);
    // Rule of thirds
    const w=x2-x1,h=y2-y1;
    oc.strokeStyle='rgba(255,255,255,0.3)';oc.lineWidth=0.5;
    for(let i=1;i<3;i++){
      oc.beginPath();oc.moveTo(x1+w*i/3,y1);oc.lineTo(x1+w*i/3,y2);oc.stroke();
      oc.beginPath();oc.moveTo(x1,y1+h*i/3);oc.lineTo(x2,y1+h*i/3);oc.stroke();
    }
  }
  _applyCrop() {
    const s=this.app.scale;
    const x=Math.round(Math.min(this._start.x,this._end.x));
    const y=Math.round(Math.min(this._start.y,this._end.y));
    const w=Math.round(Math.abs(this._end.x-this._start.x));
    const h=Math.round(Math.abs(this._end.y-this._start.y));
    if(w<1||h<1){if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);return;}
    this.app.layers.layers.forEach(layer=>{
      const tmp=document.createElement('canvas');
      tmp.width=w;tmp.height=h;
      const tctx=tmp.getContext('2d');
      tctx.drawImage(layer.canvas,-x,-y);
      layer.canvas.width=w;layer.canvas.height=h;
      layer.ctx.drawImage(tmp,0,0);
    });
    this.app.layers.width=w;this.app.layers.height=h;
    this.app.history.snapshot('Crop',this.app.layers);
    if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);
    this.app.render();
  }
  deactivate(){if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);}
}

// ─── Selection Tools ─────────────────────────────────────────────────────────

class RectSelectTool extends Tool {
  constructor(app) { super(app); this.name='rect-select'; this.cursor='crosshair'; this._start=null; }
  onMouseDown(e,pt){this._start=pt;}
  onMouseMove(e,pt){
    if(!this._start) return;
    this._drawMarquee(this._start,pt);
  }
  onMouseUp(e,pt){
    if(!this._start) return;
    const x=Math.round(Math.min(this._start.x,pt.x)),y=Math.round(Math.min(this._start.y,pt.y));
    const w=Math.round(Math.abs(pt.x-this._start.x)),h=Math.round(Math.abs(pt.y-this._start.y));
    if(e.shiftKey) this.app.selection.add({type:'rect',x,y,w,h});
    else if(e.altKey) this.app.selection.subtract({type:'rect',x,y,w,h});
    else this.app.selection.set({type:'rect',x,y,w,h});
    this._start=null;
    this.app.renderOverlay();
  }
  _drawMarquee(a,b){
    const oc=this.app.overlayCtx;
    if(!oc) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    const x1=Math.min(a.x,b.x)*s+ox,y1=Math.min(a.y,b.y)*s+oy;
    const x2=Math.max(a.x,b.x)*s+ox,y2=Math.max(a.y,b.y)*s+oy;
    oc.strokeStyle='rgba(255,255,255,0.9)';oc.lineWidth=1;
    oc.setLineDash([4,4]);oc.strokeRect(x1,y1,x2-x1,y2-y1);
    oc.strokeStyle='rgba(0,0,0,0.9)';oc.setLineDash([4,4]);oc.lineDashOffset=4;
    oc.strokeRect(x1,y1,x2-x1,y2-y1);
    oc.setLineDash([]);oc.lineDashOffset=0;
  }
}

class EllipseSelectTool extends RectSelectTool {
  constructor(app) { super(app); this.name='ellipse-select'; }
  onMouseUp(e,pt){
    if(!this._start) return;
    const x=Math.round(Math.min(this._start.x,pt.x)),y=Math.round(Math.min(this._start.y,pt.y));
    const w=Math.round(Math.abs(pt.x-this._start.x)),h=Math.round(Math.abs(pt.y-this._start.y));
    if(e.shiftKey) this.app.selection.add({type:'ellipse',x,y,w,h});
    else if(e.altKey) this.app.selection.subtract({type:'ellipse',x,y,w,h});
    else this.app.selection.set({type:'ellipse',x,y,w,h});
    this._start=null;
    this.app.renderOverlay();
  }
}

class LassoTool extends Tool {
  constructor(app) { super(app); this.name='lasso'; this.cursor='crosshair'; this._points=[]; this._drawing=false; }
  onMouseDown(e,pt){this._drawing=true;this._points=[pt];}
  onMouseMove(e,pt){if(this._drawing){this._points.push(pt);this._drawLasso();}}
  onMouseUp(e,pt){
    if(!this._drawing) return;
    this._drawing=false;
    if(e.shiftKey) this.app.selection.add({type:'polygon',points:[...this._points]});
    else if(e.altKey) this.app.selection.subtract({type:'polygon',points:[...this._points]});
    else this.app.selection.set({type:'polygon',points:[...this._points]});
    this._points=[];
    this.app.renderOverlay();
  }
  _drawLasso(){
    const oc=this.app.overlayCtx;if(!oc) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    oc.beginPath();
    this._points.forEach((p,i)=>{
      if(i===0) oc.moveTo(p.x*s+ox,p.y*s+oy);
      else oc.lineTo(p.x*s+ox,p.y*s+oy);
    });
    oc.strokeStyle='rgba(255,255,255,0.9)';oc.lineWidth=1;oc.setLineDash([4,4]);oc.stroke();
    oc.setLineDash([]);
  }
}

class PolygonLassoTool extends Tool {
  constructor(app) { super(app); this.name='polygon-lasso'; this.cursor='crosshair'; this._points=[]; }
  onMouseDown(e,pt){ this._points.push(pt); this._drawPoly(); }
  onDblClick(e,pt){
    if(e.shiftKey) this.app.selection.add({type:'polygon',points:[...this._points]});
    else if(e.altKey) this.app.selection.subtract({type:'polygon',points:[...this._points]});
    else this.app.selection.set({type:'polygon',points:[...this._points]});
    this._points=[];
    this.app.renderOverlay();
  }
  _drawPoly(){
    const oc=this.app.overlayCtx;if(!oc||this._points.length<1) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    oc.beginPath();
    this._points.forEach((p,i)=>{
      if(i===0) oc.moveTo(p.x*s+ox,p.y*s+oy);
      else oc.lineTo(p.x*s+ox,p.y*s+oy);
    });
    oc.strokeStyle='rgba(255,255,255,0.9)';oc.lineWidth=1;oc.setLineDash([4,4]);oc.stroke();
    oc.setLineDash([]);
  }
}

class MagicWandTool extends Tool {
  constructor(app) { super(app); this.name='magic-wand'; this.cursor='crosshair'; }
  onMouseDown(e,pt){
    const layer=this.app.layers.activeLayer;if(!layer) return;
    const x=Math.round(pt.x),y=Math.round(pt.y);
    const w=layer.canvas.width,h=layer.canvas.height;
    if(x<0||x>=w||y<0||y>=h) return;
    const imageData=layer.ctx.getImageData(0,0,w,h);
    const tolerance=this.app.selectOptions.tolerance||32;
    const contiguous=this.app.selectOptions.contiguous!==false;
    const mask=magicWandMask(imageData,x,y,tolerance,contiguous);
    const points=maskToPolygon(mask,w,h);
    if(e.shiftKey) this.app.selection.add({type:'mask',mask,w,h});
    else if(e.altKey) this.app.selection.subtract({type:'mask',mask,w,h});
    else this.app.selection.set({type:'mask',mask,w,h});
    this.app.renderOverlay();
  }
}

// ─── Gradient Tool ───────────────────────────────────────────────────────────

class GradientTool extends Tool {
  constructor(app) { super(app); this.name='gradient'; this.cursor='crosshair'; this._start=null; }
  onMouseDown(e,pt){ this._start=pt; }
  onMouseUp(e,pt){
    if(!this._start) return;
    const layer=this.app.layers.activeLayer;if(!layer||layer.locked) return;
    const ctx=layer.ctx;
    const opts=this.app.gradientOptions;
    const x1=this._start.x,y1=this._start.y,x2=pt.x,y2=pt.y;
    let grad;
    if(opts.type==='radial'){
      const r=Math.sqrt((x2-x1)**2+(y2-y1)**2);
      grad=ctx.createRadialGradient(x1,y1,0,x1,y1,r);
    } else {
      grad=ctx.createLinearGradient(x1,y1,x2,y2);
    }
    grad.addColorStop(0,this.app.fgColor);
    grad.addColorStop(1,opts.transparent?hexToRgba(this.app.fgColor,0):this.app.bgColor);
    ctx.save();
    if(opts.mode==='foreground-to-bg') {
      ctx.globalCompositeOperation='source-over';
    }
    ctx.fillStyle=grad;
    if(this.app.selection.active){
      this.app.selection.clipContext(ctx);
    }
    ctx.fillRect(0,0,layer.canvas.width,layer.canvas.height);
    ctx.restore();
    this.app.history.snapshot('Gradient',this.app.layers);
    this.app.render();
    this._start=null;
  }
}

// ─── Clone Stamp ─────────────────────────────────────────────────────────────

class CloneStampTool extends BrushTool {
  constructor(app) { super(app); this.name='clone-stamp'; this.cursor='crosshair'; this._source=null; this._sourceLayer=null; this._offset=null; }
  onMouseDown(e,pt){
    if(e.altKey){
      this._source=pt;
      this._sourceLayer=this.app.layers.activeLayer;
      this._offset=null;
      return;
    }
    if(!this._source) return;
    this._drawing=true;
    if(!this._offset) this._offset={x:pt.x-this._source.x,y:pt.y-this._source.y};
    this._last=pt;
    this._stampAt(pt);
    this.app.render();
  }
  onMouseMove(e,pt){
    if(!this._drawing||!this._offset) return;
    this._stampAt(pt);
    this._last=pt;
    this.app.render();
  }
  onMouseUp(e,pt){if(this._drawing)this.app.history.snapshot('Clone Stamp',this.app.layers);this._drawing=false;}
  _stampAt(pt){
    const srcLayer=this._sourceLayer||this.app.layers.activeLayer;
    const dstLayer=this.app.layers.activeLayer;
    if(!srcLayer||!dstLayer) return;
    const sx=Math.round(pt.x-this._offset.x),sy=Math.round(pt.y-this._offset.y);
    const size=this.app.brushOptions.size;
    const half=size/2;
    const imageData=srcLayer.ctx.getImageData(Math.max(0,sx-half),Math.max(0,sy-half),size,size);
    dstLayer.ctx.save();
    dstLayer.ctx.globalAlpha=this.app.brushOptions.opacity||1;
    dstLayer.ctx.putImageData(imageData,pt.x-half,pt.y-half);
    dstLayer.ctx.restore();
  }
}

// ─── Healing Brush ───────────────────────────────────────────────────────────

class HealingBrushTool extends BrushTool {
  constructor(app) { super(app); this.name='healing-brush'; this.cursor='crosshair'; this._source=null; }
  onMouseDown(e,pt){
    if(e.altKey){ this._source=pt; return; }
    super.onMouseDown(e,pt);
  }
  _paintDot(layer,pt){
    if(!this._source){super._paintDot(layer,pt);return;}
    const size=this.app.brushOptions.size, half=Math.round(size/2);
    const sx=Math.round(this._source.x),sy=Math.round(this._source.y);
    const dx=Math.round(pt.x),dy=Math.round(pt.y);
    const src=layer.ctx.getImageData(Math.max(0,sx-half),Math.max(0,sy-half),size,size);
    const dst=layer.ctx.getImageData(Math.max(0,dx-half),Math.max(0,dy-half),size,size);
    // Blend: destination texture, source luminance
    const sd=src.data,dd=dst.data;
    for(let i=0;i<sd.length;i+=4){
      const srcL=(sd[i]*0.299+sd[i+1]*0.587+sd[i+2]*0.114)/255;
      const dstL=(dd[i]*0.299+dd[i+1]*0.587+dd[i+2]*0.114)/255;
      const ratio=dstL>0?srcL/dstL:1;
      dd[i]=_toolClamp(dd[i]*ratio);dd[i+1]=_toolClamp(dd[i+1]*ratio);dd[i+2]=_toolClamp(dd[i+2]*ratio);
    }
    layer.ctx.putImageData(dst,Math.max(0,dx-half),Math.max(0,dy-half));
  }
  onMouseUp(e,pt){if(this._drawing)this.app.history.snapshot('Healing Brush',this.app.layers);this._drawing=false;this._last=null;}
}

// ─── Smudge / Blur / Sharpen on Canvas ───────────────────────────────────────

class SmudgeTool extends BrushTool {
  constructor(app) { super(app); this.name='smudge'; this.cursor='crosshair'; this._lastImageData=null; }
  onMouseDown(e,pt){
    const layer=this.app.layers.activeLayer;if(!layer||layer.locked) return;
    this._drawing=true;this._last=pt;
    this._lastImageData=layer.ctx.getImageData(0,0,layer.canvas.width,layer.canvas.height);
  }
  _paintDot(layer,pt){
    if(!this._lastImageData) return;
    const size=this.app.brushOptions.size, half=Math.round(size/2);
    const x=Math.round(pt.x),y=Math.round(pt.y);
    const x2=Math.round(this._last?this._last.x:pt.x), y2=Math.round(this._last?this._last.y:pt.y);
    const src=this._lastImageData;
    const region=layer.ctx.getImageData(Math.max(0,x-half),Math.max(0,y-half),size,size);
    const srcRegion=new ImageData(new Uint8ClampedArray(src.data),src.width,src.height);
    // Mix current and previous
    const rd=region.data;
    for(let i=0;i<rd.length;i+=4){
      const strength=this.app.brushOptions.strength||0.7;
      const px=Math.max(0,x-half+((i/4)%size));
      const py=Math.max(0,y-half+Math.floor((i/4)/size));
      const si=(py*src.width+px)*4;
      if(si>=0&&si<src.data.length-3){
        rd[i]=_toolClamp(rd[i]*(1-strength)+src.data[si]*strength);
        rd[i+1]=_toolClamp(rd[i+1]*(1-strength)+src.data[si+1]*strength);
        rd[i+2]=_toolClamp(rd[i+2]*(1-strength)+src.data[si+2]*strength);
      }
    }
    layer.ctx.putImageData(region,Math.max(0,x-half),Math.max(0,y-half));
  }
  onMouseUp(e,pt){if(this._drawing)this.app.history.snapshot('Smudge',this.app.layers);this._drawing=false;this._last=null;this._lastImageData=null;}
}

class BlurBrushTool extends BrushTool {
  constructor(app){super(app);this.name='blur-brush';this.cursor='crosshair';}
  _paintDot(layer,pt){
    const size=this.app.brushOptions.size,half=Math.round(size/2);
    const x=Math.max(0,Math.round(pt.x-half)),y=Math.max(0,Math.round(pt.y-half));
    const w=Math.min(size,layer.canvas.width-x),h=Math.min(size,layer.canvas.height-y);
    if(w<=0||h<=0) return;
    const imageData=layer.ctx.getImageData(x,y,w,h);
    Filters.gaussianBlur(imageData,2);
    layer.ctx.putImageData(imageData,x,y);
  }
  onMouseUp(e,pt){if(this._drawing)this.app.history.snapshot('Blur',this.app.layers);this._drawing=false;this._last=null;}
}

class SharpenBrushTool extends BrushTool {
  constructor(app){super(app);this.name='sharpen-brush';this.cursor='crosshair';}
  _paintDot(layer,pt){
    const size=this.app.brushOptions.size,half=Math.round(size/2);
    const x=Math.max(0,Math.round(pt.x-half)),y=Math.max(0,Math.round(pt.y-half));
    const w=Math.min(size,layer.canvas.width-x),h=Math.min(size,layer.canvas.height-y);
    if(w<=0||h<=0) return;
    const imageData=layer.ctx.getImageData(x,y,w,h);
    Filters.sharpen(imageData,2);
    layer.ctx.putImageData(imageData,x,y);
  }
  onMouseUp(e,pt){if(this._drawing)this.app.history.snapshot('Sharpen',this.app.layers);this._drawing=false;this._last=null;}
}

// ─── Dodge / Burn / Sponge ───────────────────────────────────────────────────

class DodgeBurnTool extends BrushTool {
  constructor(app,mode='dodge'){super(app);this.name=mode;this.cursor='crosshair';this.mode=mode;}
  _paintDot(layer,pt){
    const size=this.app.brushOptions.size,half=Math.round(size/2);
    const x=Math.max(0,Math.round(pt.x-half)),y=Math.max(0,Math.round(pt.y-half));
    const w=Math.min(size,layer.canvas.width-x),h=Math.min(size,layer.canvas.height-y);
    if(w<=0||h<=0) return;
    const imageData=layer.ctx.getImageData(x,y,w,h);
    const d=imageData.data;
    const strength=(this.app.brushOptions.strength||0.2)*0.3;
    for(let i=0;i<d.length;i+=4){
      for(let c=0;c<3;c++){
        if(this.mode==='dodge') d[i+c]=_toolClamp(d[i+c]*(1+strength));
        else if(this.mode==='burn') d[i+c]=_toolClamp(d[i+c]*(1-strength));
        else { // sponge - desaturate
          const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
          d[i+c]=_toolClamp(d[i+c]*(1-strength)+gray*strength);
        }
      }
    }
    layer.ctx.putImageData(imageData,x,y);
  }
  onMouseUp(e,pt){const n=this.mode==='dodge'?'Dodge':this.mode==='burn'?'Burn':'Sponge';if(this._drawing)this.app.history.snapshot(n,this.app.layers);this._drawing=false;this._last=null;}
}

// ─── Shape Tools ─────────────────────────────────────────────────────────────

class ShapeTool extends Tool {
  constructor(app,shape='rect'){super(app);this.name=`shape-${shape}`;this.cursor='crosshair';this.shape=shape;this._start=null;}
  onMouseDown(e,pt){this._start=pt;}
  onMouseMove(e,pt){if(this._start){this._preview(this._start,pt);}}
  onMouseUp(e,pt){
    if(!this._start) return;
    const layer=this.app.layers.activeLayer;if(!layer||layer.locked){this._start=null;return;}
    const ctx=layer.ctx;
    const x=Math.min(this._start.x,pt.x),y=Math.min(this._start.y,pt.y);
    const w=Math.abs(pt.x-this._start.x),h=Math.abs(pt.y-this._start.y);
    const shOpts=this.app.shapeOptions;
    ctx.save();
    if(shOpts.fill){ctx.fillStyle=shOpts.fillColor||this.app.fgColor;}
    if(shOpts.stroke){ctx.strokeStyle=shOpts.strokeColor||this.app.fgColor;ctx.lineWidth=shOpts.strokeWidth||1;}
    this._drawShape(ctx,x,y,w,h,e);
    ctx.restore();
    this.app.history.snapshot(`Draw ${this.shape}`,this.app.layers);
    if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);
    this.app.render();
    this._start=null;
  }
  _drawShape(ctx,x,y,w,h,e){
    const shOpts=this.app.shapeOptions;
    const constrain=e&&e.shiftKey;
    if(constrain){const s=Math.min(w,h);w=s;h=s;}
    ctx.beginPath();
    switch(this.shape){
      case 'rect': ctx.rect(x,y,w,h);break;
      case 'ellipse': ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);break;
      case 'line':ctx.moveTo(x,y);ctx.lineTo(x+w,y+h);break;
      case 'triangle':ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();break;
      case 'rounded-rect':ctx.roundRect(x,y,w,h,shOpts.cornerRadius||10);break;
      case 'polygon': drawPolygonShape(ctx,x+w/2,y+h/2,Math.min(w,h)/2,shOpts.sides||5);break;
      case 'star': drawStarShape(ctx,x+w/2,y+h/2,Math.min(w,h)/2,Math.min(w,h)/4,shOpts.sides||5);break;
      case 'custom-shape': if(shOpts.path){const p=new Path2D(shOpts.path);ctx.scale(w/100,h/100);ctx.translate(x,y);ctx.stroke(p);ctx.scale(100/w,100/h);}break;
    }
    if(shOpts.fill) ctx.fill();
    if(shOpts.stroke) ctx.stroke();
  }
  _preview(a,b){
    const oc=this.app.overlayCtx;if(!oc) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    oc.save();
    oc.translate(ox,oy);oc.scale(s,s);
    oc.strokeStyle=this.app.fgColor;oc.lineWidth=1/s;
    oc.setLineDash([4/s,4/s]);
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
    const w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
    this._drawShape(oc,x,y,w,h,null);
    oc.setLineDash([]);oc.restore();
  }
  deactivate(){if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);}
}

// ─── Text Tool ───────────────────────────────────────────────────────────────

class TextTool extends Tool {
  constructor(app){super(app);this.name='text';this.cursor='text';}
  onMouseDown(e,pt){
    // Place text input
    const input=document.getElementById('text-input-overlay');
    if(input) { input.style.display='none'; }
    this._showTextInput(pt);
  }
  _showTextInput(pt){
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    const screenX=pt.x*s+ox,screenY=pt.y*s+oy;
    let input=document.getElementById('text-input-overlay');
    if(!input){
      input=document.createElement('div');
      input.id='text-input-overlay';
      input.contentEditable=true;
      input.style.cssText='position:absolute;min-width:2px;min-height:1em;outline:1px dashed #fff;background:transparent;color:transparent;caret-color:'+this.app.fgColor+';z-index:100;';
      this.app.canvasContainer.appendChild(input);
    }
    const opts=this.app.textOptions;
    input.style.left=screenX+'px';
    input.style.top=screenY+'px';
    input.style.fontSize=(opts.size*s)+'px';
    input.style.fontFamily=opts.font||'sans-serif';
    input.style.fontWeight=opts.bold?'bold':'normal';
    input.style.fontStyle=opts.italic?'italic':'normal';
    input.style.color=this.app.fgColor;
    input.style.display='block';
    input.innerText='';
    input.focus();
    const commit=()=>{
      const text=input.innerText.trim();
      if(text){
        const layer=this.app.layers.activeLayer;
        if(layer&&!layer.locked){
          layer.ctx.save();
          layer.ctx.font=`${opts.italic?'italic ':''} ${opts.bold?'bold ':''} ${opts.size||24}px ${opts.font||'sans-serif'}`;
          layer.ctx.fillStyle=this.app.fgColor;
          layer.ctx.textBaseline='top';
          if(opts.align) layer.ctx.textAlign=opts.align;
          text.split('\n').forEach((line,i)=>layer.ctx.fillText(line,pt.x,pt.y+i*(opts.size||24)*1.2));
          layer.ctx.restore();
          this.app.history.snapshot('Text',this.app.layers);
          this.app.render();
        }
      }
      input.style.display='none';
    };
    input.onkeydown=(ev)=>{if(ev.key==='Escape')input.style.display='none';};
    input.onblur=commit;
  }
}

// ─── Zoom Tool ───────────────────────────────────────────────────────────────

class ZoomTool extends Tool {
  constructor(app){super(app);this.name='zoom';this.cursor='zoom-in';}
  onMouseDown(e,pt){
    if(e.altKey||e.button===2) this.app.setZoom(this.app.scale/1.5,pt);
    else this.app.setZoom(this.app.scale*1.5,pt);
  }
  activate(){this.app.canvas.style.cursor=this.app.altHeld?'zoom-out':'zoom-in';}
}

// ─── Hand (Pan) Tool ─────────────────────────────────────────────────────────

class HandTool extends Tool {
  constructor(app){super(app);this.name='hand';this.cursor='grab';this._last=null;}
  onMouseDown(e,pt){this._last={x:e.clientX,y:e.clientY};this.app.canvas.style.cursor='grabbing';}
  onMouseMove(e,pt){
    if(!this._last) return;
    const dx=e.clientX-this._last.x,dy=e.clientY-this._last.y;
    this.app.canvasOffset.x+=dx;this.app.canvasOffset.y+=dy;
    this._last={x:e.clientX,y:e.clientY};
    this.app.render();
  }
  onMouseUp(e,pt){this._last=null;this.app.canvas.style.cursor='grab';}
}

// ─── Pen / Path Tool ─────────────────────────────────────────────────────────

class PenTool extends Tool {
  constructor(app){super(app);this.name='pen';this.cursor='crosshair';this._points=[];this._closed=false;}
  onMouseDown(e,pt){
    if(this._points.length>1){
      const first=this._points[0];
      const dist=Math.sqrt((pt.x-first.x)**2+(pt.y-first.y)**2);
      if(dist<10){this._closed=true;this._commitPath();return;}
    }
    this._points.push({...pt,cp1:null,cp2:null});
    this._drawPath();
  }
  onMouseMove(e,pt){
    if(this._points.length>0){
      const last=this._points[this._points.length-1];
      // Update last control point if dragging
      if(e.buttons){
        last.cp2={x:2*last.x-pt.x,y:2*last.y-pt.y};
        last.cp1=pt;
      }
      this._drawPath();
    }
  }
  _drawPath(){
    const oc=this.app.overlayCtx;if(!oc||this._points.length<1) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    oc.save();oc.translate(ox,oy);oc.scale(s,s);
    oc.strokeStyle='#0078d4';oc.lineWidth=1/s;oc.setLineDash([]);
    oc.beginPath();
    this._points.forEach((p,i)=>{
      if(i===0) oc.moveTo(p.x,p.y);
      else {
        const prev=this._points[i-1];
        if(prev.cp1&&p.cp2) oc.bezierCurveTo(prev.cp1.x,prev.cp1.y,p.cp2.x,p.cp2.y,p.x,p.y);
        else oc.lineTo(p.x,p.y);
      }
    });
    oc.stroke();
    // Draw anchor points
    this._points.forEach(p=>{
      oc.fillStyle='#fff';oc.strokeStyle='#0078d4';oc.lineWidth=1/s;
      oc.beginPath();oc.rect(p.x-4/s,p.y-4/s,8/s,8/s);oc.fill();oc.stroke();
    });
    oc.restore();
  }
  _commitPath(){
    const layer=this.app.layers.activeLayer;if(!layer||layer.locked) return;
    const ctx=layer.ctx;
    const shOpts=this.app.shapeOptions;
    ctx.save();
    ctx.strokeStyle=this.app.fgColor;ctx.lineWidth=shOpts.strokeWidth||2;
    ctx.beginPath();
    this._points.forEach((p,i)=>{
      if(i===0) ctx.moveTo(p.x,p.y);
      else {
        const prev=this._points[i-1];
        if(prev.cp1&&p.cp2) ctx.bezierCurveTo(prev.cp1.x,prev.cp1.y,p.cp2.x,p.cp2.y,p.x,p.y);
        else ctx.lineTo(p.x,p.y);
      }
    });
    if(this._closed) ctx.closePath();
    if(shOpts.fill){ctx.fillStyle=shOpts.fillColor||this.app.fgColor;ctx.fill();}
    ctx.stroke();
    ctx.restore();
    this.app.history.snapshot('Pen Path',this.app.layers);
    this.app.render();
    this._points=[];this._closed=false;
    if(this.app.overlayCtx) this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);
  }
  deactivate(){this._points=[];if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);}
}

// ─── Slice Tool ──────────────────────────────────────────────────────────────

class SliceTool extends RectSelectTool {
  constructor(app){super(app);this.name='slice';this.cursor='crosshair';this._slices=[];}
  onMouseUp(e,pt){
    if(!this._start) return;
    const x=Math.round(Math.min(this._start.x,pt.x)),y=Math.round(Math.min(this._start.y,pt.y));
    const w=Math.round(Math.abs(pt.x-this._start.x)),h=Math.round(Math.abs(pt.y-this._start.y));
    if(w>1&&h>1) this._slices.push({x,y,w,h,id:this._slices.length+1});
    this._start=null;
    this._drawSlices();
  }
  _drawSlices(){
    const oc=this.app.overlayCtx;if(!oc) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    this._slices.forEach(sl=>{
      const x=sl.x*s+ox,y=sl.y*s+oy,w=sl.w*s,h=sl.h*s;
      oc.strokeStyle='#0cf';oc.lineWidth=1;oc.strokeRect(x,y,w,h);
      oc.fillStyle='rgba(0,200,255,0.15)';oc.fillRect(x,y,w,h);
      oc.fillStyle='#0cf';oc.font='10px sans-serif';oc.fillText(`S${sl.id}`,x+3,y+12);
    });
  }
}

// ─── Free Transform Tool ─────────────────────────────────────────────────────

class TransformTool extends Tool {
  constructor(app){super(app);this.name='transform';this.cursor='default';this._start=null;this._origData=null;this._handle=null;}
  activate(){
    this._origData=null;
    const layer=this.app.layers.activeLayer;
    if(layer) this._origData=layer.ctx.getImageData(0,0,layer.canvas.width,layer.canvas.height);
    this._showHandles();
  }
  deactivate(){if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);}
  _showHandles(){
    const oc=this.app.overlayCtx;if(!oc) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const lm=this.app.layers;
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    const w=lm.width*s,h=lm.height*s;
    oc.strokeStyle='#0078d4';oc.lineWidth=1;oc.strokeRect(ox,oy,w,h);
    const handles=this._getHandlePositions(ox,oy,w,h);
    handles.forEach(hp=>{
      oc.fillStyle='#fff';oc.strokeStyle='#0078d4';oc.lineWidth=1;
      oc.beginPath();oc.rect(hp.x-4,hp.y-4,8,8);oc.fill();oc.stroke();
    });
  }
  _getHandlePositions(x,y,w,h){
    return[
      {x,y,name:'nw'},{x:x+w/2,y,name:'n'},{x:x+w,y,name:'ne'},
      {x:x+w,y:y+h/2,name:'e'},{x:x+w,y:y+h,name:'se'},{x:x+w/2,y:y+h,name:'s'},
      {x,y:y+h,name:'sw'},{x,y:y+h/2,name:'w'},
    ];
  }
  onMouseDown(e,pt){this._start=pt;}
  onMouseMove(e,pt){
    if(!this._start||!this._origData) return;
    const layer=this.app.layers.activeLayer;if(!layer||layer.locked) return;
    // Simple scale transform
    const lm=this.app.layers;
    const dx=pt.x-this._start.x,dy=pt.y-this._start.y;
    const scaleX=(lm.width+dx)/lm.width,scaleY=(lm.height+dy)/lm.height;
    const tmp=document.createElement('canvas');tmp.width=lm.width;tmp.height=lm.height;
    const tctx=tmp.getContext('2d');tctx.putImageData(this._origData,0,0);
    layer.ctx.clearRect(0,0,layer.canvas.width,layer.canvas.height);
    layer.ctx.save();layer.ctx.scale(scaleX,scaleY);layer.ctx.drawImage(tmp,0,0);layer.ctx.restore();
    this.app.render();this._showHandles();
  }
  onMouseUp(e,pt){
    if(this._start)this.app.history.snapshot('Free Transform',this.app.layers);
    this._start=null;
  }
}

// ─── Ruler / Measure Tool ────────────────────────────────────────────────────

class MeasureTool extends Tool {
  constructor(app){super(app);this.name='measure';this.cursor='crosshair';this._start=null;}
  onMouseDown(e,pt){this._start=pt;}
  onMouseMove(e,pt){
    if(!this._start) return;
    const oc=this.app.overlayCtx;if(!oc) return;
    oc.clearRect(0,0,oc.canvas.width,oc.canvas.height);
    const {x:ox,y:oy}=this.app.canvasOffset;const s=this.app.scale;
    const x1=this._start.x*s+ox,y1=this._start.y*s+oy,x2=pt.x*s+ox,y2=pt.y*s+oy;
    oc.strokeStyle='#ffcc00';oc.lineWidth=1;
    oc.beginPath();oc.moveTo(x1,y1);oc.lineTo(x2,y2);oc.stroke();
    const dx=pt.x-this._start.x,dy=pt.y-this._start.y;
    const dist=Math.sqrt(dx*dx+dy*dy).toFixed(1);
    const angle=(Math.atan2(dy,dx)*180/Math.PI).toFixed(1);
    oc.fillStyle='#ffcc00';oc.font='12px sans-serif';
    oc.fillText(`${dist}px / ${angle}°`,x2+10,y2-10);
  }
  onMouseUp(e,pt){this._start=null;if(this.app.overlayCtx)this.app.overlayCtx.clearRect(0,0,this.app.overlayCtx.canvas.width,this.app.overlayCtx.canvas.height);}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _toolClamp(v){ return Math.min(255,Math.max(0,Math.round(v))); }

function hexToRgba(hex, alpha) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToRgbA(hex) {
  const r=parseInt(hex.slice(1,3),16)||0,g=parseInt(hex.slice(3,5),16)||0,b=parseInt(hex.slice(5,7),16)||0;
  return [r,g,b,255];
}

function rgbToHex(r,g,b){
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function floodFill(imageData, startX, startY, fillColor, tolerance, contiguous) {
  const d=imageData.data,w=imageData.width,h=imageData.height;
  const idx=(x,y)=>(y*w+x)*4;
  const target=[d[idx(startX,startY)],d[idx(startX,startY)+1],d[idx(startX,startY)+2],d[idx(startX,startY)+3]];
  const matches=(i)=>{
    return Math.sqrt(
      (d[i]-target[0])**2+(d[i+1]-target[1])**2+(d[i+2]-target[2])**2+(d[i+3]-target[3])**2
    )<=tolerance;
  };
  const setPixel=(i)=>{d[i]=fillColor[0];d[i+1]=fillColor[1];d[i+2]=fillColor[2];d[i+3]=fillColor[3];};
  if(!contiguous){
    for(let i=0;i<d.length;i+=4) if(matches(i)) setPixel(i);
    return;
  }
  const visited=new Uint8Array(w*h);
  const stack=[[startX,startY]];
  while(stack.length){
    const [x,y]=stack.pop();
    if(x<0||x>=w||y<0||y>=h||visited[y*w+x]) continue;
    const i=idx(x,y);
    if(!matches(i)) continue;
    visited[y*w+x]=1;
    setPixel(i);
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
}

function magicWandMask(imageData,startX,startY,tolerance,contiguous){
  const d=imageData.data,w=imageData.width,h=imageData.height;
  const idx=(x,y)=>(y*w+x)*4;
  const target=[d[idx(startX,startY)],d[idx(startX,startY)+1],d[idx(startX,startY)+2],d[idx(startX,startY)+3]];
  const matches=(i)=>Math.sqrt((d[i]-target[0])**2+(d[i+1]-target[1])**2+(d[i+2]-target[2])**2)<=tolerance;
  const mask=new Uint8Array(w*h);
  if(!contiguous){
    for(let i=0;i<d.length;i+=4) if(matches(i)) mask[i/4]=1;
    return mask;
  }
  const visited=new Uint8Array(w*h);
  const stack=[[startX,startY]];
  while(stack.length){
    const [x,y]=stack.pop();
    if(x<0||x>=w||y<0||y>=h||visited[y*w+x]) continue;
    visited[y*w+x]=1;
    if(!matches(idx(x,y))) continue;
    mask[y*w+x]=1;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  return mask;
}

function maskToPolygon(mask,w,h){
  const points=[];
  for(let y=0;y<h;y+=4) for(let x=0;x<w;x+=4) if(mask[y*w+x]) points.push({x,y});
  return points;
}

function drawPolygonShape(ctx,cx,cy,r,sides){
  ctx.moveTo(cx+r*Math.cos(-Math.PI/2),cy+r*Math.sin(-Math.PI/2));
  for(let i=1;i<=sides;i++){
    const a=-Math.PI/2+2*Math.PI*i/sides;
    ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
  }
  ctx.closePath();
}

function drawStarShape(ctx,cx,cy,outerR,innerR,points){
  const step=Math.PI/points;
  for(let i=0;i<points*2;i++){
    const a=-Math.PI/2+i*step;
    const r=i%2===0?outerR:innerR;
    if(i===0) ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    else ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
  }
  ctx.closePath();
}
