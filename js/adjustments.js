/**
 * Adjustments – all Photoshop-style image adjustment implementations
 * Each function receives an ImageData and parameters, returns the modified ImageData.
 */

const Adjustments = {

  // ─── Basic ───────────────────────────────────────────────────────────────

  brightnessContrast(imageData, brightness=0, contrast=0) {
    const d = imageData.data;
    // brightness: -150..150, contrast: -150..150
    const bFactor = brightness;
    const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i=0;i<d.length;i+=4) {
      for (let c=0;c<3;c++) {
        let v = d[i+c];
        v = cFactor * (v - 128) + 128 + bFactor;
        d[i+c] = _clamp(v);
      }
    }
    return imageData;
  },

  exposure(imageData, ev=0, offset=0, gamma=1) {
    const d = imageData.data;
    const factor = Math.pow(2, ev);
    const gInv = gamma !== 0 ? 1/gamma : 1;
    for (let i=0;i<d.length;i+=4) {
      for (let c=0;c<3;c++) {
        let v = d[i+c]/255;
        v = Math.pow(Math.max(0, v * factor + offset), gInv);
        d[i+c] = _clamp(v*255);
      }
    }
    return imageData;
  },

  vibrance(imageData, vibrance=0, saturation=0) {
    const d = imageData.data;
    const vib = vibrance / 100;
    const sat = saturation / 100;
    for (let i=0;i<d.length;i+=4) {
      const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      const s=(max-min)/(max||1);
      // Vibrance: apply more to less-saturated pixels
      const vAdj = vib*(1-s)*3;
      const sAdj = sat + vAdj;
      const avg=(r+g+b)/3;
      d[i]  = _clamp(((r-avg)*sAdj+avg)*255);
      d[i+1]= _clamp(((g-avg)*sAdj+avg)*255);
      d[i+2]= _clamp(((b-avg)*sAdj+avg)*255);
    }
    return imageData;
  },

  // ─── Levels ──────────────────────────────────────────────────────────────

  levels(imageData, inBlack=0, inWhite=255, gamma=1, outBlack=0, outWhite=255) {
    const d = imageData.data;
    const inRange = inWhite - inBlack;
    const outRange = outWhite - outBlack;
    const lut = new Uint8Array(256);
    for (let i=0;i<256;i++) {
      let v = (i - inBlack) / inRange;
      v = Math.max(0, Math.min(1, v));
      v = Math.pow(v, 1/gamma);
      lut[i] = _clamp(outBlack + v * outRange);
    }
    for (let i=0;i<d.length;i+=4) {
      d[i]=lut[d[i]]; d[i+1]=lut[d[i+1]]; d[i+2]=lut[d[i+2]];
    }
    return imageData;
  },

  // ─── Curves ──────────────────────────────────────────────────────────────

  curves(imageData, points = [[0,0],[255,255]], channel = 'rgb') {
    const d = imageData.data;
    const lut = buildCurveLUT(points);
    for (let i=0;i<d.length;i+=4) {
      switch(channel) {
        case 'rgb': d[i]=lut[d[i]]; d[i+1]=lut[d[i+1]]; d[i+2]=lut[d[i+2]]; break;
        case 'r':   d[i]=lut[d[i]]; break;
        case 'g':   d[i+1]=lut[d[i+1]]; break;
        case 'b':   d[i+2]=lut[d[i+2]]; break;
      }
    }
    return imageData;
  },

  // ─── Hue / Saturation ────────────────────────────────────────────────────

  hueSaturation(imageData, hue=0, saturation=0, lightness=0, colorize=false, colorizeHue=0, colorizeSat=25, colorizeLit=50) {
    const d = imageData.data;
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    for (let i=0;i<d.length;i+=4) {
      let [H,S,L] = rgbToHsl(d[i],d[i+1],d[i+2]);
      if (colorize) {
        H = colorizeHue/360; S = colorizeSat/100; L = colorizeLit/100;
      } else {
        H = (H + h + 1) % 1;
        S = Math.max(0, Math.min(1, S + s));
        L = Math.max(0, Math.min(1, L + l));
      }
      const [r,g,b] = hslToRgb(H,S,L);
      d[i]=r; d[i+1]=g; d[i+2]=b;
    }
    return imageData;
  },

  // ─── Color Balance ───────────────────────────────────────────────────────

  colorBalance(imageData, shadows=[0,0,0], midtones=[0,0,0], highlights=[0,0,0], preserveLum=true) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      let r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
      const lum = 0.299*r+0.587*g+0.114*b;
      // Shadow/Midtone/Highlight weights
      const sw = Math.max(0, 1-lum*2);      // peaks at 0
      const hw = Math.max(0, (lum-0.5)*2);  // peaks at 1
      const mw = 1 - sw - hw;
      r = _clamp01(r + (shadows[0]*sw + midtones[0]*mw + highlights[0]*hw)/100);
      g = _clamp01(g + (shadows[1]*sw + midtones[1]*mw + highlights[1]*hw)/100);
      b = _clamp01(b + (shadows[2]*sw + midtones[2]*mw + highlights[2]*hw)/100);
      if (preserveLum) {
        const newLum = 0.299*r+0.587*g+0.114*b;
        if (newLum > 0) {
          const ratio = lum/newLum;
          r*=ratio; g*=ratio; b*=ratio;
        }
      }
      d[i]=_clamp(r*255); d[i+1]=_clamp(g*255); d[i+2]=_clamp(b*255);
    }
    return imageData;
  },

  // ─── Black & White ───────────────────────────────────────────────────────

  blackAndWhite(imageData, reds=40, yellows=60, greens=40, cyans=60, blues=20, magentas=80, tintColor=null, tintAmount=0) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      let [H,S,L] = rgbToHsl(d[i],d[i+1],d[i+2]);
      let factor = 0.5;
      // Map hue to one of 6 color ranges
      const h360 = H * 360;
      if (h360 < 30 || h360 >= 330) factor = reds/100;
      else if (h360 < 75) factor = yellows/100;
      else if (h360 < 150) factor = greens/100;
      else if (h360 < 195) factor = cyans/100;
      else if (h360 < 255) factor = blues/100;
      else factor = magentas/100;
      const gray = _clamp(L * factor * 255 * 2);
      d[i]=gray; d[i+1]=gray; d[i+2]=gray;
      // Tint
      if (tintColor && tintAmount > 0) {
        const ta = tintAmount/100;
        d[i]=_clamp(d[i]*(1-ta)+tintColor[0]*ta);
        d[i+1]=_clamp(d[i+1]*(1-ta)+tintColor[1]*ta);
        d[i+2]=_clamp(d[i+2]*(1-ta)+tintColor[2]*ta);
      }
    }
    return imageData;
  },

  // ─── Photo Filter ────────────────────────────────────────────────────────

  photoFilter(imageData, color=[250,165,0], density=25, preserveLum=true) {
    const d = imageData.data;
    const dens = density/100;
    for (let i=0;i<d.length;i+=4) {
      const origLum = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
      d[i]=_clamp(d[i]*(1-dens) + color[0]*dens);
      d[i+1]=_clamp(d[i+1]*(1-dens) + color[1]*dens);
      d[i+2]=_clamp(d[i+2]*(1-dens) + color[2]*dens);
      if (preserveLum) {
        const newLum=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
        if (newLum > 0) {
          const ratio=origLum/newLum;
          d[i]=_clamp(d[i]*ratio); d[i+1]=_clamp(d[i+1]*ratio); d[i+2]=_clamp(d[i+2]*ratio);
        }
      }
    }
    return imageData;
  },

  // ─── Channel Mixer ───────────────────────────────────────────────────────

  channelMixer(imageData, outputChannel='r', sourceR=100, sourceG=0, sourceB=0, constant=0, monochrome=false) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      const r=d[i], g=d[i+1], b=d[i+2];
      const newVal = _clamp(r*sourceR/100 + g*sourceG/100 + b*sourceB/100 + constant);
      if (monochrome) {
        d[i]=d[i+1]=d[i+2]=newVal;
      } else {
        if (outputChannel==='r') d[i]=newVal;
        else if (outputChannel==='g') d[i+1]=newVal;
        else if (outputChannel==='b') d[i+2]=newVal;
      }
    }
    return imageData;
  },

  // ─── Gradient Map ────────────────────────────────────────────────────────

  gradientMap(imageData, gradient=[{stop:0,color:[0,0,0]},{stop:1,color:[255,255,255]}]) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      const gray=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2])/255;
      // Find position in gradient
      const color = sampleGradient(gradient, gray);
      d[i]=color[0]; d[i+1]=color[1]; d[i+2]=color[2];
    }
    return imageData;
  },

  // ─── Selective Color ─────────────────────────────────────────────────────

  selectiveColor(imageData, colorRanges) {
    // colorRanges: {reds:{c,m,y,k}, yellows, greens, cyans, blues, magentas, whites, neutrals, blacks}
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
      let [H,S,L] = rgbToHsl(d[i],d[i+1],d[i+2]);
      const h360=H*360;
      let range = null;
      if (L > 0.85) range = colorRanges.whites;
      else if (L < 0.15) range = colorRanges.blacks;
      else if (S < 0.1) range = colorRanges.neutrals;
      else if (h360<30||h360>=330) range=colorRanges.reds;
      else if (h360<75) range=colorRanges.yellows;
      else if (h360<150) range=colorRanges.greens;
      else if (h360<195) range=colorRanges.cyans;
      else if (h360<255) range=colorRanges.blues;
      else range=colorRanges.magentas;
      if (range) {
        const {c=0,m=0,y=0,k=0} = range;
        let cr=1-r,cm=1-g,cy_=1-b;
        const ck=Math.min(cr,cm,cy_);
        if(ck<1){cr=(cr-ck)/(1-ck);cm=(cm-ck)/(1-ck);cy_=(cy_-ck)/(1-ck);}
        cr=_clamp01(cr+c/100); cm=_clamp01(cm+m/100); cy_=_clamp01(cy_+y/100);
        const newK=_clamp01(ck+k/100);
        d[i]=_clamp((1-cr)*(1-newK)*255);
        d[i+1]=_clamp((1-cm)*(1-newK)*255);
        d[i+2]=_clamp((1-cy_)*(1-newK)*255);
      }
    }
    return imageData;
  },

  // ─── Shadow / Highlights ─────────────────────────────────────────────────

  shadowsHighlights(imageData, shadows=0, highlights=0, shadowTone=0, highlightTone=0, radius=30, colorCorrect=0) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      const lum=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2])/255;
      const sFactor = (1-lum)*shadows/100;
      const hFactor = lum*highlights/100;
      for(let c=0;c<3;c++){
        let v=d[i+c]/255;
        v=_clamp01(v + sFactor - hFactor);
        d[i+c]=_clamp(v*255);
      }
    }
    return imageData;
  },

  // ─── Invert ──────────────────────────────────────────────────────────────

  invert(imageData) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2];
    }
    return imageData;
  },

  // ─── Posterize ───────────────────────────────────────────────────────────

  posterize(imageData, levels=4) {
    const d = imageData.data;
    const step = 255 / (levels - 1);
    const lut = new Uint8Array(256);
    for (let i=0;i<256;i++) lut[i] = Math.round(Math.round(i/step)*step);
    for (let i=0;i<d.length;i+=4) {
      d[i]=lut[d[i]]; d[i+1]=lut[d[i+1]]; d[i+2]=lut[d[i+2]];
    }
    return imageData;
  },

  // ─── Threshold ───────────────────────────────────────────────────────────

  threshold(imageData, level=128) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
      const v = gray >= level ? 255 : 0;
      d[i]=d[i+1]=d[i+2]=v;
    }
    return imageData;
  },

  // ─── Equalize ────────────────────────────────────────────────────────────

  equalize(imageData) {
    const d = imageData.data;
    const hist = new Array(256).fill(0);
    const n = imageData.width * imageData.height;
    for (let i=0;i<d.length;i+=4) {
      const gray=Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]);
      hist[gray]++;
    }
    const cdf = new Array(256);
    cdf[0]=hist[0];
    for (let i=1;i<256;i++) cdf[i]=cdf[i-1]+hist[i];
    const cdfMin=cdf.find(v=>v>0)||0;
    const lut = new Uint8Array(256);
    for (let i=0;i<256;i++) lut[i]=Math.round(((cdf[i]-cdfMin)/(n-cdfMin))*255);
    for (let i=0;i<d.length;i+=4) {
      d[i]=lut[d[i]]; d[i+1]=lut[d[i+1]]; d[i+2]=lut[d[i+2]];
    }
    return imageData;
  },

  // ─── Auto Tone / Color / Contrast ────────────────────────────────────────

  autoTone(imageData) {
    const d = imageData.data;
    let minR=255,maxR=0,minG=255,maxG=0,minB=255,maxB=0;
    for(let i=0;i<d.length;i+=4){
      minR=Math.min(minR,d[i]);maxR=Math.max(maxR,d[i]);
      minG=Math.min(minG,d[i+1]);maxG=Math.max(maxG,d[i+1]);
      minB=Math.min(minB,d[i+2]);maxB=Math.max(maxB,d[i+2]);
    }
    for(let i=0;i<d.length;i+=4){
      d[i]=_clamp((d[i]-minR)/(maxR-minR||1)*255);
      d[i+1]=_clamp((d[i+1]-minG)/(maxG-minG||1)*255);
      d[i+2]=_clamp((d[i+2]-minB)/(maxB-minB||1)*255);
    }
    return imageData;
  },

  autoContrast(imageData) {
    const d = imageData.data;
    let min=255,max=0;
    for(let i=0;i<d.length;i+=4){
      const v=(d[i]+d[i+1]+d[i+2])/3;
      min=Math.min(min,v);max=Math.max(max,v);
    }
    for(let i=0;i<d.length;i+=4){
      for(let c=0;c<3;c++) d[i+c]=_clamp((d[i+c]-min)/(max-min||1)*255);
    }
    return imageData;
  },

  // ─── Replace Color ───────────────────────────────────────────────────────

  replaceColor(imageData, fromRgb=[255,0,0], toRgb=[0,0,255], fuzziness=30) {
    const d=imageData.data;
    for(let i=0;i<d.length;i+=4){
      const dr=d[i]-fromRgb[0],dg=d[i+1]-fromRgb[1],db=d[i+2]-fromRgb[2];
      const dist=Math.sqrt(dr*dr+dg*dg+db*db);
      if(dist<=fuzziness){
        const t=1-dist/fuzziness;
        d[i]=_clamp(d[i]*(1-t)+toRgb[0]*t);
        d[i+1]=_clamp(d[i+1]*(1-t)+toRgb[1]*t);
        d[i+2]=_clamp(d[i+2]*(1-t)+toRgb[2]*t);
      }
    }
    return imageData;
  },

  // ─── Desaturate ──────────────────────────────────────────────────────────

  desaturate(imageData) {
    const d=imageData.data;
    for(let i=0;i<d.length;i+=4){
      const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
      d[i]=d[i+1]=d[i+2]=_clamp(g);
    }
    return imageData;
  },
};

// ─── Color helpers ───────────────────────────────────────────────────────────

function _clamp(v) { return Math.min(255, Math.max(0, Math.round(v))); }
function _clamp01(v) { return Math.min(1, Math.max(0, v)); }

function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}
  else{
    const d=max-min;
    s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){
      case r:h=((g-b)/d+(g<b?6:0))/6;break;
      case g:h=((b-r)/d+2)/6;break;
      case b:h=((r-g)/d+4)/6;break;
    }
  }
  return [h,s,l];
}

function hslToRgb(h,s,l){
  let r,g,b;
  if(s===0){r=g=b=l;}
  else{
    const hue2rgb=(p,q,t)=>{
      if(t<0)t+=1;if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q=l<0.5?l*(1+s):l+s-l*s;
    const p=2*l-q;
    r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3);
  }
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}

function buildCurveLUT(points) {
  // Monotone cubic interpolation
  const lut = new Uint8Array(256);
  const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
  for (let i=0;i<256;i++) {
    if (i <= xs[0]) { lut[i]=_clamp(ys[0]); continue; }
    if (i >= xs[xs.length-1]) { lut[i]=_clamp(ys[ys.length-1]); continue; }
    // Find segment
    let seg=0;
    for (let j=0;j<xs.length-1;j++) { if (i>=xs[j] && i<=xs[j+1]){seg=j;break;} }
    const t=(i-xs[seg])/(xs[seg+1]-xs[seg]);
    lut[i]=_clamp(ys[seg]*(1-t)+ys[seg+1]*t);
  }
  return lut;
}

function sampleGradient(gradient, t) {
  for (let i=0;i<gradient.length-1;i++) {
    if (t >= gradient[i].stop && t <= gradient[i+1].stop) {
      const lt = (t-gradient[i].stop)/(gradient[i+1].stop-gradient[i].stop);
      const c1=gradient[i].color,c2=gradient[i+1].color;
      return [
        Math.round(c1[0]*(1-lt)+c2[0]*lt),
        Math.round(c1[1]*(1-lt)+c2[1]*lt),
        Math.round(c1[2]*(1-lt)+c2[2]*lt),
      ];
    }
  }
  return gradient[gradient.length-1].color;
}
