/**
 * Filters – all image filter implementations operating on ImageData
 */

const Filters = {

  // ─── Blur ────────────────────────────────────────────────────────────────

  gaussianBlur(imageData, radius = 2) {
    const data = imageData.data;
    const w = imageData.width, h = imageData.height;
    const kernel = makeGaussianKernel(radius);
    const tmp = new Uint8ClampedArray(data.length);
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, wt = 0;
        for (let k = -radius; k <= radius; k++) {
          const xi = Math.min(Math.max(x + k, 0), w - 1);
          const idx = (y * w + xi) * 4;
          const kw = kernel[k + radius];
          r += data[idx] * kw; g += data[idx+1] * kw;
          b += data[idx+2] * kw; a += data[idx+3] * kw;
          wt += kw;
        }
        const oi = (y * w + x) * 4;
        tmp[oi] = r/wt; tmp[oi+1] = g/wt; tmp[oi+2] = b/wt; tmp[oi+3] = a/wt;
      }
    }
    // Vertical pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, wt = 0;
        for (let k = -radius; k <= radius; k++) {
          const yi = Math.min(Math.max(y + k, 0), h - 1);
          const idx = (yi * w + x) * 4;
          const kw = kernel[k + radius];
          r += tmp[idx] * kw; g += tmp[idx+1] * kw;
          b += tmp[idx+2] * kw; a += tmp[idx+3] * kw;
          wt += kw;
        }
        const oi = (y * w + x) * 4;
        data[oi] = r/wt; data[oi+1] = g/wt; data[oi+2] = b/wt; data[oi+3] = a/wt;
      }
    }
    return imageData;
  },

  boxBlur(imageData, radius = 2) {
    const data = imageData.data;
    const w = imageData.width, h = imageData.height;
    const tmp = new Uint8ClampedArray(data.length);
    const size = radius * 2 + 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r=0,g=0,b=0,a=0,n=0;
        for (let k=-radius;k<=radius;k++){
          const xi=Math.min(Math.max(x+k,0),w-1);
          const i=(y*w+xi)*4;
          r+=data[i];g+=data[i+1];b+=data[i+2];a+=data[i+3];n++;
        }
        const oi=(y*w+x)*4;
        tmp[oi]=r/n;tmp[oi+1]=g/n;tmp[oi+2]=b/n;tmp[oi+3]=a/n;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r=0,g=0,b=0,a=0,n=0;
        for (let k=-radius;k<=radius;k++){
          const yi=Math.min(Math.max(y+k,0),h-1);
          const i=(yi*w+x)*4;
          r+=tmp[i];g+=tmp[i+1];b+=tmp[i+2];a+=tmp[i+3];n++;
        }
        const oi=(y*w+x)*4;
        data[oi]=r/n;data[oi+1]=g/n;data[oi+2]=b/n;data[oi+3]=a/n;
      }
    }
    return imageData;
  },

  motionBlur(imageData, angle = 0, distance = 10) {
    const data = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(data.length);
    const rad = angle * Math.PI / 180;
    const dx = Math.cos(rad), dy = Math.sin(rad);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r=0,g=0,b=0,a=0,n=0;
        for (let k = -distance; k <= distance; k++) {
          const xi = Math.round(x + dx * k), yi = Math.round(y + dy * k);
          if (xi<0||xi>=w||yi<0||yi>=h) continue;
          const i=(yi*w+xi)*4;
          r+=data[i];g+=data[i+1];b+=data[i+2];a+=data[i+3];n++;
        }
        const oi=(y*w+x)*4;
        if(n){out[oi]=r/n;out[oi+1]=g/n;out[oi+2]=b/n;out[oi+3]=a/n;}
        else{out[oi]=data[oi];out[oi+1]=data[oi+1];out[oi+2]=data[oi+2];out[oi+3]=data[oi+3];}
      }
    }
    data.set(out);
    return imageData;
  },

  radialBlur(imageData, amount = 5) {
    const data = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(data.length);
    const cx = w/2, cy = h/2;
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        let r=0,g=0,b=0,a=0,n=0;
        for (let k=-amount;k<=amount;k++) {
          const angle = k * 0.01;
          const cos = Math.cos(angle), sin = Math.sin(angle);
          const nx = Math.round(cx + (x-cx)*cos - (y-cy)*sin);
          const ny = Math.round(cy + (x-cx)*sin + (y-cy)*cos);
          if(nx<0||nx>=w||ny<0||ny>=h) continue;
          const i=(ny*w+nx)*4;
          r+=data[i];g+=data[i+1];b+=data[i+2];a+=data[i+3];n++;
        }
        const oi=(y*w+x)*4;
        if(n){out[oi]=r/n;out[oi+1]=g/n;out[oi+2]=b/n;out[oi+3]=a/n;}
        else{out[oi]=data[oi];out[oi+1]=data[oi+1];out[oi+2]=data[oi+2];out[oi+3]=data[oi+3];}
      }
    }
    data.set(out);
    return imageData;
  },

  // ─── Sharpen ─────────────────────────────────────────────────────────────

  sharpen(imageData, amount = 1) {
    const kernel = [0,-1,0,-1,5+(amount-1)*4,-1,0,-1,0];
    return applyConvolution(imageData, kernel, 1, 0);
  },

  unsharpMask(imageData, radius = 2, amount = 1.5, threshold = 0) {
    const w = imageData.width, h = imageData.height;
    const blurred = new ImageData(new Uint8ClampedArray(imageData.data), w, h);
    Filters.gaussianBlur(blurred, radius);
    const d = imageData.data, bl = blurred.data;
    for (let i=0;i<d.length;i+=4) {
      for (let c=0;c<3;c++) {
        const diff = d[i+c] - bl[i+c];
        if (Math.abs(diff) >= threshold) {
          d[i+c] = Math.min(255, Math.max(0, d[i+c] + diff * amount));
        }
      }
    }
    return imageData;
  },

  // ─── Noise ───────────────────────────────────────────────────────────────

  addNoise(imageData, amount = 25, monochromatic = false) {
    const d = imageData.data;
    for (let i=0;i<d.length;i+=4) {
      if (monochromatic) {
        const n = (Math.random()-0.5)*amount*2;
        d[i]=clamp(d[i]+n); d[i+1]=clamp(d[i+1]+n); d[i+2]=clamp(d[i+2]+n);
      } else {
        d[i]=clamp(d[i]+(Math.random()-0.5)*amount*2);
        d[i+1]=clamp(d[i+1]+(Math.random()-0.5)*amount*2);
        d[i+2]=clamp(d[i+2]+(Math.random()-0.5)*amount*2);
      }
    }
    return imageData;
  },

  median(imageData, radius = 1) {
    const d = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(d.length);
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        const rs=[],gs=[],bs=[];
        for (let ky=-radius;ky<=radius;ky++) {
          for (let kx=-radius;kx<=radius;kx++) {
            const xi=Math.min(Math.max(x+kx,0),w-1);
            const yi=Math.min(Math.max(y+ky,0),h-1);
            const i=(yi*w+xi)*4;
            rs.push(d[i]);gs.push(d[i+1]);bs.push(d[i+2]);
          }
        }
        rs.sort((a,b)=>a-b);gs.sort((a,b)=>a-b);bs.sort((a,b)=>a-b);
        const mid=Math.floor(rs.length/2);
        const oi=(y*w+x)*4;
        out[oi]=rs[mid];out[oi+1]=gs[mid];out[oi+2]=bs[mid];out[oi+3]=d[oi+3];
      }
    }
    d.set(out);
    return imageData;
  },

  despeckle(imageData) { return Filters.median(imageData, 1); },

  // ─── Distort ─────────────────────────────────────────────────────────────

  ripple(imageData, amplitude = 10, wavelength = 30) {
    const d = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(d.length);
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        const nx = Math.round(x + amplitude * Math.sin(2*Math.PI*y/wavelength));
        const ny = Math.round(y + amplitude * Math.sin(2*Math.PI*x/wavelength));
        const xi = Math.min(Math.max(nx,0),w-1);
        const yi = Math.min(Math.max(ny,0),h-1);
        const src=(yi*w+xi)*4, dst=(y*w+x)*4;
        out[dst]=d[src];out[dst+1]=d[src+1];out[dst+2]=d[src+2];out[dst+3]=d[src+3];
      }
    }
    d.set(out);
    return imageData;
  },

  twirl(imageData, angle = 90) {
    const d = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(d.length);
    const cx=w/2,cy=h/2,maxR=Math.sqrt(cx*cx+cy*cy);
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        const dx=x-cx,dy=y-cy;
        const r=Math.sqrt(dx*dx+dy*dy);
        const twAngle=angle*(1-r/maxR)*Math.PI/180;
        const a=Math.atan2(dy,dx)+twAngle;
        const nx=Math.round(cx+r*Math.cos(a));
        const ny=Math.round(cy+r*Math.sin(a));
        if(nx<0||nx>=w||ny<0||ny>=h){continue;}
        const src=(ny*w+nx)*4,dst=(y*w+x)*4;
        out[dst]=d[src];out[dst+1]=d[src+1];out[dst+2]=d[src+2];out[dst+3]=d[src+3];
      }
    }
    d.set(out);
    return imageData;
  },

  pinch(imageData, amount = 0.5) {
    const d = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(d.length);
    const cx=w/2,cy=h/2;
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        const dx=(x-cx)/cx,dy=(y-cy)/cy;
        const r=Math.sqrt(dx*dx+dy*dy);
        const rn = r > 0 ? Math.pow(r, 1+amount) : 0;
        const nx=Math.round(cx+rn*dx/r*cx);
        const ny=Math.round(cy+rn*dy/r*cy);
        const xi=Math.min(Math.max(nx,0),w-1),yi=Math.min(Math.max(ny,0),h-1);
        const src=(yi*w+xi)*4,dst=(y*w+x)*4;
        out[dst]=d[src];out[dst+1]=d[src+1];out[dst+2]=d[src+2];out[dst+3]=d[src+3];
      }
    }
    d.set(out);
    return imageData;
  },

  spherize(imageData, amount = 100) {
    const d = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(d.length);
    const cx=w/2,cy=h/2,scale=amount/100;
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        const dx=(x-cx)/(w/2),dy=(y-cy)/(h/2);
        const r2=dx*dx+dy*dy;
        if(r2>=1){const dst=(y*w+x)*4;out[dst]=d[dst];out[dst+1]=d[dst+1];out[dst+2]=d[dst+2];out[dst+3]=d[dst+3];continue;}
        const z=Math.sqrt(1-r2);
        const dxn=dx/(z)*scale + dx*(1-scale);
        const dyn=dy/(z)*scale + dy*(1-scale);
        const nx=Math.round((dxn+1)*(w/2)),ny=Math.round((dyn+1)*(h/2));
        const xi=Math.min(Math.max(nx,0),w-1),yi=Math.min(Math.max(ny,0),h-1);
        const src=(yi*w+xi)*4,dst=(y*w+x)*4;
        out[dst]=d[src];out[dst+1]=d[src+1];out[dst+2]=d[src+2];out[dst+3]=d[src+3];
      }
    }
    d.set(out);
    return imageData;
  },

  polarCoordinates(imageData, toPolar = true) {
    const d = imageData.data;
    const w = imageData.width, h = imageData.height;
    const out = new Uint8ClampedArray(d.length);
    const cx=w/2,cy=h/2;
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        let nx,ny;
        if (toPolar) {
          const r=(y/h)*Math.sqrt(cx*cx+cy*cy);
          const a=(x/w)*2*Math.PI - Math.PI;
          nx=Math.round(cx+r*Math.cos(a));ny=Math.round(cy+r*Math.sin(a));
        } else {
          const dx=x-cx,dy=y-cy;
          const r=Math.sqrt(dx*dx+dy*dy);
          const a=Math.atan2(dy,dx);
          nx=Math.round((a+Math.PI)/(2*Math.PI)*w);
          ny=Math.round(r/Math.sqrt(cx*cx+cy*cy)*h);
        }
        const xi=Math.min(Math.max(nx,0),w-1),yi=Math.min(Math.max(ny,0),h-1);
        const src=(yi*w+xi)*4,dst=(y*w+x)*4;
        out[dst]=d[src];out[dst+1]=d[src+1];out[dst+2]=d[src+2];out[dst+3]=d[src+3];
      }
    }
    d.set(out);
    return imageData;
  },

  zigzag(imageData, amount=10, ridges=5) {
    const d=imageData.data, w=imageData.width, h=imageData.height;
    const out=new Uint8ClampedArray(d.length);
    const cx=w/2,cy=h/2;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const dx=x-cx,dy=y-cy,r=Math.sqrt(dx*dx+dy*dy);
        const a=Math.atan2(dy,dx);
        const disp=amount*Math.sin(ridges*r*Math.PI/Math.sqrt(cx*cx+cy*cy));
        const nx=Math.round(x+disp*Math.cos(a));
        const ny=Math.round(y+disp*Math.sin(a));
        const xi=Math.min(Math.max(nx,0),w-1),yi=Math.min(Math.max(ny,0),h-1);
        const src=(yi*w+xi)*4,dst=(y*w+x)*4;
        out[dst]=d[src];out[dst+1]=d[src+1];out[dst+2]=d[src+2];out[dst+3]=d[src+3];
      }
    }
    d.set(out);
    return imageData;
  },

  // ─── Stylize ─────────────────────────────────────────────────────────────

  findEdges(imageData) {
    const kernel=[0,1,0,1,-4,1,0,1,0];
    return applyConvolution(imageData, kernel, 1, 0);
  },

  emboss(imageData, strength=1) {
    const k=strength;
    const kernel=[-2*k,-k,0,-k,1,k,0,k,2*k];
    const result=applyConvolution(imageData, kernel, 1, 128);
    return result;
  },

  solarize(imageData, threshold=128) {
    const d=imageData.data;
    for(let i=0;i<d.length;i+=4){
      for(let c=0;c<3;c++) if(d[i+c]<threshold) d[i+c]=255-d[i+c];
    }
    return imageData;
  },

  invert(imageData) {
    const d=imageData.data;
    for(let i=0;i<d.length;i+=4){
      d[i]=255-d[i];d[i+1]=255-d[i+1];d[i+2]=255-d[i+2];
    }
    return imageData;
  },

  diffuseGlow(imageData, amount=5) {
    const copy=new ImageData(new Uint8ClampedArray(imageData.data),imageData.width,imageData.height);
    Filters.gaussianBlur(copy,amount);
    const d=imageData.data,c=copy.data;
    for(let i=0;i<d.length;i+=4){
      d[i]=clamp(d[i]*0.7+c[i]*0.3+50);
      d[i+1]=clamp(d[i+1]*0.7+c[i+1]*0.3+50);
      d[i+2]=clamp(d[i+2]*0.7+c[i+2]*0.3+50);
    }
    return imageData;
  },

  glowingEdges(imageData) {
    const edge=new ImageData(new Uint8ClampedArray(imageData.data),imageData.width,imageData.height);
    Filters.findEdges(edge);
    Filters.gaussianBlur(edge,1);
    const d=imageData.data,e=edge.data;
    for(let i=0;i<d.length;i+=4){
      d[i]=e[i];d[i+1]=e[i+1];d[i+2]=e[i+2];
    }
    // Make black background
    for(let i=0;i<d.length;i+=4){
      d[i]=Math.abs(d[i]-128)*2;
      d[i+1]=Math.abs(d[i+1]-128)*2;
      d[i+2]=Math.abs(d[i+2]-128)*2;
    }
    return imageData;
  },

  pixelate(imageData, size=10) {
    const d=imageData.data,w=imageData.width,h=imageData.height;
    for(let y=0;y<h;y+=size){
      for(let x=0;x<w;x+=size){
        let r=0,g=0,b=0,n=0;
        for(let py=0;py<size&&y+py<h;py++){
          for(let px=0;px<size&&x+px<w;px++){
            const i=((y+py)*w+(x+px))*4;
            r+=d[i];g+=d[i+1];b+=d[i+2];n++;
          }
        }
        r/=n;g/=n;b/=n;
        for(let py=0;py<size&&y+py<h;py++){
          for(let px=0;px<size&&x+px<w;px++){
            const i=((y+py)*w+(x+px))*4;
            d[i]=r;d[i+1]=g;d[i+2]=b;
          }
        }
      }
    }
    return imageData;
  },

  crystallize(imageData, size=15) { return Filters.pixelate(imageData, size); },

  colorHalftone(imageData, dotRadius=4) {
    const d=imageData.data,w=imageData.width,h=imageData.height;
    const out=new Uint8ClampedArray(d.length).fill(255);
    for(let y=0;y<h;y+=dotRadius*2){
      for(let x=0;x<w;x+=dotRadius*2){
        const i=(y*w+x)*4;
        const gray=(d[i]+d[i+1]+d[i+2])/3;
        const r=dotRadius*(1-gray/255);
        // draw circle
        for(let py=-dotRadius;py<=dotRadius;py++){
          for(let px=-dotRadius;px<=dotRadius;px++){
            if(px*px+py*py<=r*r){
              const nx=x+px,ny=y+py;
              if(nx>=0&&nx<w&&ny>=0&&ny<h){
                const oi=(ny*w+nx)*4;
                out[oi]=0;out[oi+1]=0;out[oi+2]=0;
              }
            }
          }
        }
      }
    }
    d.set(out);
    return imageData;
  },

  // ─── Render ──────────────────────────────────────────────────────────────

  clouds(imageData, seed=0) {
    const d=imageData.data,w=imageData.width,h=imageData.height;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const v=turbulence(x,y,seed)*255;
        const i=(y*w+x)*4;
        d[i]=v;d[i+1]=v;d[i+2]=v;d[i+3]=255;
      }
    }
    return imageData;
  },

  differenceClouds(imageData, seed=0) {
    const d=imageData.data,w=imageData.width,h=imageData.height;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const v=turbulence(x,y,seed)*255;
        const i=(y*w+x)*4;
        d[i]=Math.abs(d[i]-v);d[i+1]=Math.abs(d[i+1]-v);d[i+2]=Math.abs(d[i+2]-v);
      }
    }
    return imageData;
  },

  lensFlare(imageData, x, y, brightness=100) {
    const d=imageData.data,w=imageData.width,h=imageData.height;
    const maxR=200*(brightness/100);
    for(let py=0;py<h;py++){
      for(let px=0;px<w;px++){
        const dx=px-x,dy=py-y,r=Math.sqrt(dx*dx+dy*dy);
        if(r<maxR){
          const factor=(1-r/maxR)*brightness/100;
          const i=(py*w+px)*4;
          d[i]=clamp(d[i]+255*factor);
          d[i+1]=clamp(d[i+1]+220*factor);
          d[i+2]=clamp(d[i+2]+180*factor);
        }
      }
    }
    return imageData;
  },

  // ─── Other ───────────────────────────────────────────────────────────────

  highPass(imageData, radius=3) {
    const orig=new ImageData(new Uint8ClampedArray(imageData.data),imageData.width,imageData.height);
    Filters.gaussianBlur(imageData, radius);
    const d=imageData.data,o=orig.data;
    for(let i=0;i<d.length;i+=4){
      d[i]=clamp(o[i]-d[i]+128);
      d[i+1]=clamp(o[i+1]-d[i+1]+128);
      d[i+2]=clamp(o[i+2]-d[i+2]+128);
    }
    return imageData;
  },

  desaturate(imageData) {
    const d=imageData.data;
    for(let i=0;i<d.length;i+=4){
      const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
      d[i]=d[i+1]=d[i+2]=g;
    }
    return imageData;
  },

  sepia(imageData, amount=100) {
    const d=imageData.data,a=amount/100;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];
      d[i]=clamp((r*0.393+g*0.769+b*0.189)*a+r*(1-a));
      d[i+1]=clamp((r*0.349+g*0.686+b*0.168)*a+g*(1-a));
      d[i+2]=clamp((r*0.272+g*0.534+b*0.131)*a+b*(1-a));
    }
    return imageData;
  },

  custom(imageData, kernel, divisor=1, offset=0) {
    return applyConvolution(imageData, kernel, divisor, offset);
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v) { return Math.min(255,Math.max(0,Math.round(v))); }

function makeGaussianKernel(radius) {
  const sigma = radius / 2;
  const kernel = [];
  let sum = 0;
  for (let i=-radius;i<=radius;i++) {
    const v=Math.exp(-(i*i)/(2*sigma*sigma));
    kernel.push(v);
    sum+=v;
  }
  return kernel.map(v=>v/sum);
}

function applyConvolution(imageData, kernel, divisor=1, offset=0) {
  const d=imageData.data,w=imageData.width,h=imageData.height;
  const out=new Uint8ClampedArray(d.length);
  const kSize=Math.round(Math.sqrt(kernel.length));
  const half=Math.floor(kSize/2);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0;
      for(let ky=0;ky<kSize;ky++){
        for(let kx=0;kx<kSize;kx++){
          const px=Math.min(Math.max(x+kx-half,0),w-1);
          const py=Math.min(Math.max(y+ky-half,0),h-1);
          const i=(py*w+px)*4;
          const k=kernel[ky*kSize+kx];
          r+=d[i]*k;g+=d[i+1]*k;b+=d[i+2]*k;
        }
      }
      const oi=(y*w+x)*4;
      out[oi]=clamp(r/divisor+offset);
      out[oi+1]=clamp(g/divisor+offset);
      out[oi+2]=clamp(b/divisor+offset);
      out[oi+3]=d[oi+3];
    }
  }
  d.set(out);
  return imageData;
}

// Simple value noise for clouds
function noise2d(x,y,seed=0){
  const n=(x+seed*374761)+y*57+seed*113;
  const m=n^(n>>8);
  return (((m*1103515245+12345)&0x7fffffff)/0x7fffffff);
}
function smoothNoise(x,y,scale=64,seed=0){
  const fx=x/scale,fy=y/scale;
  const ix=Math.floor(fx),iy=Math.floor(fy);
  const dx=fx-ix,dy=fy-iy;
  const s=noise2d(ix,iy,seed),t=noise2d(ix+1,iy,seed);
  const u=noise2d(ix,iy+1,seed),v=noise2d(ix+1,iy+1,seed);
  return s*(1-dx)*(1-dy)+t*dx*(1-dy)+u*(1-dx)*dy+v*dx*dy;
}
function turbulence(x,y,seed=0){
  let v=0,scale=64,amp=1,total=0;
  for(let i=0;i<6;i++){v+=smoothNoise(x,y,scale,seed)*amp;total+=amp;scale/=2;amp/=2;}
  return v/total;
}
