(() => {
'use strict';

/* ============================== Utils ============================== */
const Utils = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  rnd: (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a),
  pad2: v => String(v).padStart(2, '0'),
  fmtInt: v => Math.round(v).toLocaleString('en-US'),
  latLon(lat, lon) {
    const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return [-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
  },
  slerp(a, b, t) {
    let d = Utils.clamp(a[0]*b[0]+a[1]*b[1]+a[2]*b[2], -1, 1);
    const th = Math.acos(d);
    if (th < 1e-4) return a.slice();
    const s = Math.sin(th), ka = Math.sin((1-t)*th)/s, kb = Math.sin(t*th)/s;
    return [a[0]*ka+b[0]*kb, a[1]*ka+b[1]*kb, a[2]*ka+b[2]*kb];
  }
};

const V3 = {
  add: (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub: (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  scale: (a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot: (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross: (a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  len: a=>Math.hypot(a[0],a[1],a[2]),
  norm(a){ const l=Math.hypot(a[0],a[1],a[2])||1e-6; return [a[0]/l,a[1]/l,a[2]/l]; }
};

const M4 = {
  ident: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k];
      o[c*4+r] = s;
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t/asp; o[5] = t; o[10] = (f+n)/(n-f); o[11] = -1; o[14] = 2*f*n/(n-f);
    return o;
  },
  lookAt(e, c, u) {
    const z = V3.norm(V3.sub(e, c)), x = V3.norm(V3.cross(u, z)), y = V3.cross(z, x);
    const o = new Float32Array(16);
    o[0]=x[0]; o[1]=y[0]; o[2]=z[0];
    o[4]=x[1]; o[5]=y[1]; o[6]=z[1];
    o[8]=x[2]; o[9]=y[2]; o[10]=z[2];
    o[12]=-V3.dot(x,e); o[13]=-V3.dot(y,e); o[14]=-V3.dot(z,e); o[15]=1;
    return o;
  },
  invert(m) {
    const a00=m[0],a01=m[1],a02=m[2],a03=m[3],a10=m[4],a11=m[5],a12=m[6],a13=m[7],
          a20=m[8],a21=m[9],a22=m[10],a23=m[11],a30=m[12],a31=m[13],a32=m[14],a33=m[15];
    const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,
          b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,
          b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
    let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
    if (!det) return M4.ident();
    det = 1/det;
    const o = new Float32Array(16);
    o[0]=(a11*b11-a12*b10+a13*b09)*det;  o[1]=(a02*b10-a01*b11-a03*b09)*det;
    o[2]=(a31*b05-a32*b04+a33*b03)*det;  o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det;  o[5]=(a00*b11-a02*b08+a03*b07)*det;
    o[6]=(a32*b02-a30*b05-a33*b01)*det;  o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det;  o[9]=(a01*b08-a00*b10-a03*b06)*det;
    o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
    o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
    return o;
  },
  rotX(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
  rotY(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
  rotZ(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); },
  trans(x,y,z){ const o=M4.ident(); o[12]=x; o[13]=y; o[14]=z; return o; },
  scale(s){ const o=M4.ident(); o[0]=s; o[5]=s; o[10]=s; return o; },
  p4(m, v) {
    const x=v[0],y=v[1],z=v[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];
    return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w, (m[1]*x+m[5]*y+m[9]*z+m[13])/w,
            (m[2]*x+m[6]*y+m[10]*z+m[14])/w, w];
  }
};
const IDENT = M4.ident();

/* ============================== GLSL ============================== */
const NOISE_GLSL = `
float hash13(vec3 p){ p=fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float n000=hash13(i), n100=hash13(i+vec3(1.0,0.0,0.0)), n010=hash13(i+vec3(0.0,1.0,0.0)), n110=hash13(i+vec3(1.0,1.0,0.0));
  float n001=hash13(i+vec3(0.0,0.0,1.0)), n101=hash13(i+vec3(1.0,0.0,1.0)), n011=hash13(i+vec3(0.0,1.0,1.0)), n111=hash13(i+vec3(1.0,1.0,1.0));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y), mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(7.1); a*=0.5; } return s; }
`;

const VS_SPHERE = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel, uView, uProj;
out vec3 vObj; out vec3 vNormal; out vec3 vWorld;
void main(){
  vObj = aPos;
  vNormal = mat3(uModel) * aNormal;
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  gl_Position = uProj * uView * w;
}`;

const FS_CORE = `#version 300 es
precision highp float;
in vec3 vObj; in vec3 vNormal; in vec3 vWorld;
uniform float uTime, uEnergy, uHighlight;
uniform vec3 uCamPos;
out vec4 frag;
${NOISE_GLSL}
void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCamPos - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  vec3 q = normalize(vObj);
  float t = uTime;
  float warp = fbm(q*3.0 + vec3(0.0, t*0.12, 0.0));
  float veins = fbm(q*2.2 + warp*1.4 + vec3(t*0.05, -t*0.08, t*0.04));
  veins = pow(smoothstep(0.30, 0.62, veins), 1.4);
  float pulse = 0.78 + 0.22*sin(t*2.4 + q.y*3.0);
  float wave = sin(q.y*9.0 - t*4.0)*0.5 + 0.5;
  float scan = 0.92 + 0.08*sin(q.y*160.0 + t*6.0);
  vec3 deep = vec3(0.015, 0.06, 0.16);
  vec3 mid = vec3(0.05, 0.45, 0.95);
  vec3 hot = vec3(0.55, 0.95, 1.0);
  float e = clamp(uEnergy, 0.0, 2.0);
  vec3 col = mix(deep, mid, veins*pulse);
  col = mix(col, hot, pow(veins, 3.0)*wave*0.8);
  col *= scan;
  col += mid * fres * (0.9 + 0.6*wave) * e;
  col += vec3(0.9, 0.98, 1.0) * pow(fres, 3.5) * (0.5 + 0.5*e);
  col += hot * uHighlight * 0.8;
  col *= 0.45 + 0.55*e;
  frag = vec4(col, 1.0);
}`;

const FS_SHELL = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vWorld;
uniform vec3 uCamPos, uTint;
uniform float uTime, uEnergy, uHighlight;
out vec4 frag;
void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCamPos - vWorld);
  float fres = pow(1.0 - abs(dot(n, v)), 2.5);
  float pulse = 0.75 + 0.25*sin(uTime*2.4);
  float e = clamp(uEnergy, 0.0, 2.0);
  vec3 col = uTint * (fres*1.6 + 0.08) * pulse * (0.4 + 0.6*e) + uTint * uHighlight * 0.4;
  float a = clamp(fres*1.2*(0.35 + 0.4*e) + uHighlight*0.3, 0.0, 1.0);
  frag = vec4(col, a);
}`;

const VS_RING = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in float aAngle;
layout(location=2) in float aRadius;
uniform mat4 uVP, uModel;
out float vAngle; out float vRadius;
void main(){
  vAngle = aAngle; vRadius = aRadius;
  gl_Position = uVP * uModel * vec4(aPos, 1.0);
}`;

const FS_RING = `#version 300 es
precision highp float;
in float vAngle; in float vRadius;
uniform float uTime, uEnergy, uHighlight, uDash, uFlow;
uniform vec3 uColA, uColB;
out vec4 frag;
void main(){
  float x = fract(vAngle*uDash + uTime*uFlow);
  float seg = smoothstep(0.35, 0.5, abs(x - 0.5)*2.0);
  float edge = smoothstep(0.0, 0.12, vRadius) * smoothstep(1.0, 0.86, vRadius);
  float ring = 0.6 + 0.4*sin(vAngle*6.28318*3.0 - uTime*2.2);
  vec3 col = mix(uColA, uColB, vRadius) * (0.5 + 0.9*uEnergy + uHighlight*1.5);
  float a = (0.10 + seg*0.85) * edge * ring * clamp(uEnergy*0.8 + 0.25, 0.0, 1.5);
  frag = vec4(col, a);
}`;

const VS_LINE = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in float aT;
layout(location=2) in float aPhase;
layout(location=3) in vec3 aColor;
uniform mat4 uVP, uModel;
out float vT; out float vPhase; out vec3 vColor;
void main(){
  vT = aT; vPhase = aPhase; vColor = aColor;
  gl_Position = uVP * uModel * vec4(aPos, 1.0);
}`;

const FS_LINE = `#version 300 es
precision highp float;
in float vT; in float vPhase; in vec3 vColor;
uniform float uTime, uIntensity, uFlow;
out vec4 frag;
void main(){
  float f = fract(vT - uTime*uFlow + vPhase);
  float comet = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.15, 0.5, f));
  float a = (0.12 + comet*1.5) * uIntensity;
  frag = vec4(vColor * (0.6 + comet*2.0) * uIntensity, a);
}`;

const VS_NODE = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
layout(location=2) in float aPhase;
layout(location=3) in float aSize;
uniform mat4 uVP, uView, uModel;
uniform float uTime, uSelPhase, uScale;
out vec3 vColor; out float vTw;
void main(){
  vec4 vp = uView * uModel * vec4(aPos, 1.0);
  gl_Position = uVP * uModel * vec4(aPos, 1.0);
  float sel = 1.0 - step(0.02, abs(aPhase - uSelPhase));
  vTw = 0.6 + 0.4*sin(uTime*(2.0 + aPhase*2.7) + aPhase*40.0) + sel*0.8;
  vColor = mix(aColor, vec3(1.0), sel*0.55);
  gl_PointSize = clamp(aSize*uScale*(1.0 + sel*0.9)/max(0.2, -vp.z), 1.0, 110.0);
}`;

const FS_NODE = `#version 300 es
precision highp float;
in vec3 vColor; in float vTw;
uniform float uAlpha;
out vec4 frag;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float core = smoothstep(0.30, 0.0, r);
  float ring = smoothstep(0.5, 0.34, r) * smoothstep(0.12, 0.30, r);
  float a = (core*1.1 + ring*0.55) * max(0.0, vTw) * uAlpha;
  frag = vec4(vColor * (core*1.7 + ring*0.7), a);
}`;

const VS_PART = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aColor;
layout(location=2) in float aSize;
uniform mat4 uVP, uView;
uniform float uScale;
out vec4 vColor;
void main(){
  vec4 vp = uView * vec4(aPos, 1.0);
  gl_Position = uVP * vec4(aPos, 1.0);
  gl_PointSize = clamp(aSize*uScale/max(0.2, -vp.z), 1.0, 64.0);
  vColor = aColor;
}`;

const FS_PART = `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 frag;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float m = smoothstep(0.5, 0.05, r);
  float hot = smoothstep(0.16, 0.0, r);
  frag = vec4(vColor.rgb*(m + hot*1.6), vColor.a*m);
}`;

const FS_EARTH = `#version 300 es
precision highp float;
in vec3 vObj; in vec3 vNormal; in vec3 vWorld;
uniform vec3 uCamPos, uLightDir;
uniform float uTime, uHover, uHighlight, uEnergy;
out vec4 frag;
${NOISE_GLSL}
float gridLine(float x){ float f = fract(x); float d = min(f, 1.0 - f); return 1.0 - smoothstep(0.0, 0.03, d); }
void main(){
  vec3 d = normalize(vObj);
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCamPos - vWorld);
  float e = fbm(d*2.3 + vec3(4.7, 1.3, 2.9));
  float land = smoothstep(0.46, 0.53, e);
  float depth = smoothstep(0.25, 0.5, e);
  vec3 ocean = mix(vec3(0.008, 0.035, 0.10), vec3(0.02, 0.16, 0.28), depth);
  float ln = fbm(d*5.5 + vec3(9.2, 3.1, 7.7));
  vec3 landc = mix(vec3(0.035, 0.13, 0.07), vec3(0.28, 0.24, 0.12), smoothstep(0.35, 0.75, ln));
  landc = mix(landc, vec3(0.5, 0.48, 0.42), smoothstep(0.68, 0.9, ln));
  float ice = smoothstep(0.72, 0.9, abs(d.y) + (e - 0.5)*0.25);
  vec3 surf = mix(ocean, landc, land);
  surf = mix(surf, vec3(0.75, 0.85, 0.95), ice);
  float ndl = dot(n, uLightDir);
  float day = smoothstep(-0.15, 0.3, ndl);
  vec3 col = surf * (0.06 + 1.25*day);
  float lon = atan(d.z, d.x)/6.28318 + 0.5;
  float lat = asin(clamp(d.y, -1.0, 1.0))/3.14159 + 0.5;
  float g = max(gridLine(lon*24.0), gridLine(lat*12.0)) * (1.0 - ice*0.7);
  col += vec3(0.15, 0.7, 0.95) * g * (0.10 + 0.22*uHover + 0.15*uHighlight);
  vec3 cell = floor(d*16.0);
  float h = hash13(cell);
  vec3 cc = (cell + 0.5)/16.0;
  float dd = length(d - normalize(cc));
  float flick = 0.7 + 0.3*sin(uTime*2.5 + h*50.0);
  float cl = smoothstep(0.42, 0.05, dd) * step(0.83, h) * land * (1.0 - ice) * flick;
  col += vec3(1.0, 0.72, 0.35) * cl * (1.2*(1.0 - day) + 0.15);
  vec3 hv = normalize(uLightDir + v);
  float spec = pow(max(dot(n, hv), 0.0), 90.0) * (1.0 - land) * (1.0 - ice) * day;
  col += vec3(0.5, 0.8, 1.0) * spec * 0.8;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += vec3(0.2, 0.55, 1.0) * fres * (0.35 + 0.5*day + 0.35*uHover + 0.3*uHighlight);
  float shim = 0.5 + 0.5*sin(uTime*1.3 + e*20.0);
  col += vec3(0.1, 0.5, 0.6) * land * shim * 0.05 * uEnergy;
  frag = vec4(col, 1.0);
}`;

const FS_ATMO = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vWorld;
uniform vec3 uCamPos, uLightDir;
uniform float uBoost;
out vec4 frag;
void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCamPos - vWorld);
  float f = pow(1.0 - abs(dot(n, v)), 3.5);
  float sun = 0.5 + 0.5*dot(n, uLightDir);
  vec3 col = mix(vec3(0.1, 0.35, 0.9), vec3(0.4, 0.75, 1.0), sun);
  frag = vec4(col, f*(0.55 + 0.45*sun)*uBoost);
}`;

const VS_SPRITE = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
uniform mat4 uView, uProj;
uniform vec3 uCenter;
uniform float uRadius;
out vec2 vUV;
void main(){
  vec4 vp = uView * vec4(uCenter, 1.0);
  vp.xy += aCorner * uRadius;
  gl_Position = uProj * vp;
  vUV = aCorner;
}`;

const FS_SPRITE = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uColor;
uniform float uIntensity;
out vec4 frag;
void main(){
  float r = length(vUV);
  float a = pow(max(0.0, 1.0 - r), 2.2);
  float core = pow(max(0.0, 1.0 - r), 7.0);
  frag = vec4(uColor*(a*0.7 + core)*uIntensity, a);
}`;

const VS_POST = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){
  vec2 p;
  if (gl_VertexID == 1) p = vec2(3.0, -1.0);
  else if (gl_VertexID == 2) p = vec2(-1.0, 3.0);
  else p = vec2(-1.0, -1.0);
  vUV = p*0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FS_BRIGHT = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uThresh;
out vec4 frag;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(uThresh, uThresh + 0.45, l);
  frag = vec4(c*k, 1.0);
}`;

const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 frag;
void main(){
  vec3 s = texture(uTex, vUV).rgb*0.22702703;
  s += texture(uTex, vUV + uDir*1.38461538).rgb*0.31621622;
  s += texture(uTex, vUV - uDir*1.38461538).rgb*0.31621622;
  s += texture(uTex, vUV + uDir*3.23076923).rgb*0.07027027;
  s += texture(uTex, vUV - uDir*3.23076923).rgb*0.07027027;
  frag = vec4(s, 1.0);
}`;

const FS_COMP = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uGlow, uCA, uScan, uVig, uTime;
uniform vec2 uRes;
out vec4 frag;
void main(){
  vec2 cc = vUV - 0.5;
  float r2 = dot(cc, cc);
  vec2 off = cc*r2*uCA*0.03;
  vec3 col;
  col.r = texture(uScene, vUV + off).r;
  col.g = texture(uScene, vUV).g;
  col.b = texture(uScene, vUV - off).b;
  col += texture(uBloom, vUV).rgb * uGlow;
  float vig = 1.0 - r2*1.1*uVig;
  col *= clamp(vig, 0.0, 1.0);
  float sl = 1.0 - uScan*0.12*(0.5 + 0.5*sin(vUV.y*uRes.y*3.14159));
  col *= sl;
  col += (fract(sin(dot(vUV + fract(uTime), vec2(12.9898, 78.233)))*43758.5453) - 0.5)*0.015;
  frag = vec4(pow(max(col, vec3(0.0)), vec3(0.92)), 1.0);
}`;

/* ============================== StateManager ============================== */
class StateManager {
  constructor() {
    this.settings = { density: 3000, coreEnergy: 1.0, gravity: 1.0, orbitSpeed: 1.0, glow: 1.0, quality: 'HIGH', autoRotate: true, particleMode: 'ORBIT', audio: true };
    this.display = { power: 2847, eff: 94.72, grid: 73.21, flow: 1.82, temp: 428.6, stability: 98.72, shield: 99.1, latency: 12, flux: 7.41 };
    this.targets = { ...this.display };
    this.history = [];
    this.viewOffset = 0;
    this.clock = 0;
    this.selection = null;
    this.hover = null;
    this.alert = false;
    this.alertCause = '';
    this.impulse = 0;
    this.energyVis = 1;
    this._lastTarget = 0; this._lastSample = 0; this._lastLat = 0; this._lastWarn = 0;
    this.regions = [
      ['APAC', .92], ['EURA', .81], ['NOAM', .88], ['SOAM', .66],
      ['MEAF', .74], ['OCEA', .58], ['POLAR', .37], ['ORBIT', .99]
    ];
  }
  update(now, dt) {
    this.clock = now;
    if (now - this._lastTarget > 0.32) {
      this._lastTarget = now;
      const t = this.targets;
      t.power = Utils.clamp(t.power + Utils.rnd(-95, 95), 2100, 3580);
      t.eff = Utils.clamp(t.eff + Utils.rnd(-0.4, 0.4), 91, 99.2);
      t.grid = Utils.clamp(t.grid + Utils.rnd(-2.6, 2.6), 56, 96);
      t.flow = Utils.clamp(t.flow + Utils.rnd(-0.09, 0.09), 1.2, 2.45);
      t.temp = Utils.clamp(t.temp + Utils.rnd(-4.5, 4.5), 404, 456);
      t.stability = Utils.clamp(t.stability + Utils.rnd(-0.18, 0.18), 96.2, 99.6);
      t.shield = Utils.clamp(t.shield + Utils.rnd(-0.25, 0.25), 95.5, 99.9);
      t.flux = Utils.clamp(t.flux + Utils.rnd(-0.4, 0.4), 4.5, 10.5);
    }
    if (now - this._lastLat > 1.0) {
      this._lastLat = now;
      this.display.latency = Math.round(Utils.clamp(this.display.latency + Utils.rnd(-4, 4), 6, 28));
    }
    this.impulse *= Math.exp(-dt * 0.9);
    const k = Math.min(1, dt * 2.0), d = this.display, t = this.targets;
    for (const key of ['power','eff','grid','flow','temp','stability','shield','flux'])
      d[key] += (t[key] - d[key]) * k;
    d.power += this.impulse * 260;
    d.temp += this.impulse * 7;
    d.stability -= this.impulse * 1.6;
    const wasAlert = this.alert;
    this.alert = d.grid > 92 || d.temp > 450.5 ? true : (d.grid < 89.5 && d.temp < 447 ? false : this.alert);
    if (this.alert && !wasAlert) this.alertCause = d.grid > 92 ? 'GRID OVERLOAD — REROUTING ENERGY FLOW' : 'CORE TEMP CRITICAL — COOLANT ENGAGED';
    if (this.history.length === 0 || now - this._lastSample >= 0.25) {
      this._lastSample = now;
      this.history.push({ t: now, power: d.power, eff: d.eff, grid: d.grid, flow: d.flow, temp: d.temp });
      if (this.history.length > 244) this.history.shift();
    }
    const powNorm = Utils.clamp(this.disp('power') / 3400, 0, 1.2);
    this.energyVis = this.settings.coreEnergy * (0.55 + 0.45 * powNorm);
  }
  triggerImpulse() { this.impulse = Math.min(1.6, this.impulse + 1.0); }
  disp(k) {
    if (this.viewOffset <= 0.01) return this.display[k];
    const tt = this.clock - this.viewOffset, h = this.history;
    if (!h.length || h[0][k] === undefined) return this.display[k];
    if (tt <= h[0].t) return h[0][k];
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i-1].t <= tt) {
        const a = h[i-1], b = h[i];
        const f = Utils.clamp((tt - a.t) / Math.max(1e-3, b.t - a.t), 0, 1);
        return a[k] + (b[k] - a[k]) * f;
      }
    }
    return h[h.length-1][k];
  }
  getWindow(k, secs) {
    const endT = this.clock - this.viewOffset, startT = endT - secs, out = [];
    for (let i = this.history.length - 1; i >= 0; i--) {
      const s = this.history[i];
      if (s.t > endT) continue;
      if (s.t < startT) break;
      out.push({ t: s.t, v: s[k] });
    }
    out.reverse();
    return out;
  }
  regionLoads(now) {
    const gn = Utils.clamp(this.disp('grid') / 100, 0, 1);
    return this.regions.map((r, i) => ({
      name: r[0],
      v: Utils.clamp(r[1] * gn * 100 * (0.86 + 0.24 * Math.sin(now * 0.13 + i * 1.7)), 4, 100)
    }));
  }
}

/* ============================== AudioManager ============================== */
class AudioManager {
  #ctx = null; #master = null; #noise = null; muted = false; #lastHover = 0;
  init() {
    if (this.#ctx) { this.#resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.#ctx = new AC();
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = this.muted ? 0 : 0.4;
      this.#master.connect(this.#ctx.destination);
      return true;
    } catch { return false; }
  }
  #resume() { if (this.#ctx && this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {}); }
  setMuted(m) { this.muted = m; if (this.#master) this.#master.gain.value = m ? 0 : 0.4; }
  ok() { return !!this.#ctx && !this.muted && this.#ctx.state === 'running'; }
  #tone(freq, dur, type, vol, slideTo) {
    if (!this.ok()) return;
    const c = this.#ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.#master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  click() { this.#tone(920, 0.07, 'triangle', 0.32, 1420); }
  hover() {
    const n = performance.now();
    if (n - this.#lastHover < 90) return;
    this.#lastHover = n;
    this.#tone(1500, 0.035, 'sine', 0.1);
  }
  boom() {
    if (!this.ok()) return;
    const c = this.#ctx, t = c.currentTime;
    if (!this.#noise) {
      const len = c.sampleRate * 0.7 | 0;
      const b = c.createBuffer(1, len, c.sampleRate);
      const dd = b.getChannelData(0);
      for (let i = 0; i < len; i++) dd[i] = (Math.random()*2 - 1) * Math.pow(1 - i/len, 2);
      this.#noise = b;
    }
    const src = c.createBufferSource(); src.buffer = this.#noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.85, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    src.connect(f); f.connect(g); g.connect(this.#master);
    src.start(t);
    this.#tone(70, 0.5, 'sine', 0.6, 42);
  }
  startup() {
    if (!this.#ctx) return;
    this.#resume();
    this.#tone(160, 0.7, 'sine', 0.28, 640);
    setTimeout(() => this.#tone(480, 0.25, 'triangle', 0.22), 350);
    setTimeout(() => this.#tone(720, 0.3, 'triangle', 0.2), 520);
    setTimeout(() => this.#tone(960, 0.5, 'sine', 0.18), 700);
  }
  warn() { this.#tone(640, 0.15, 'square', 0.14); setTimeout(() => this.#tone(470, 0.19, 'square', 0.14), 180); }
}

/* ============================== ShaderManager / Geo ============================== */
let PID = 1;
class Program {
  constructor(gl, vsSrc, fsSrc) {
    this.id = PID++;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error('Shader compile error: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('Program link error: ' + gl.getProgramInfoLog(p));
    this.p = p;
    this.ul = new Map();
  }
  loc(gl, name) {
    if (!this.ul.has(name)) this.ul.set(name, gl.getUniformLocation(this.p, name));
    return this.ul.get(name);
  }
}

class ShaderManager {
  constructor(gl) { this.gl = gl; this.cache = new Map(); }
  get(vs, fs) {
    const key = vs.length + '|' + fs.length + '|' + vs.slice(0, 64) + fs.slice(0, 64);
    if (!this.cache.has(key)) this.cache.set(key, new Program(this.gl, vs, fs));
    return this.cache.get(key);
  }
}

class Geo {
  constructor(gl, data, attribs, indices = null, mode = null, dynamic = false) {
    this.gl = gl;
    this.attribs = attribs;
    this.stride = attribs.reduce((s, a) => s + a.size, 0) * 4;
    this.count = indices ? indices.length : data.length / (this.stride / 4);
    this.mode = mode !== null ? mode : gl.TRIANGLES;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    this.ibo = null;
    if (indices) {
      this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }
    this.vaos = new Map();
  }
  update(src) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, src);
  }
}

function sphereGeo(gl, latN = 44, lonN = 64) {
  const pos = [], idx = [];
  for (let i = 0; i <= latN; i++) {
    const ph = i / latN * Math.PI, sp = Math.sin(ph), cp = Math.cos(ph);
    for (let j = 0; j <= lonN; j++) {
      const th = j / lonN * Math.PI * 2;
      const x = sp * Math.cos(th), y = cp, z = sp * Math.sin(th);
      pos.push(x, y, z, x, y, z);
    }
  }
  for (let i = 0; i < latN; i++) for (let j = 0; j < lonN; j++) {
    const a = i * (lonN + 1) + j, b = a + lonN + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return new Geo(gl, new Float32Array(pos),
    [{ name: 'aPos', size: 3 }, { name: 'aNormal', size: 3 }], new Uint16Array(idx));
}

function ringGeo(gl, rIn, rOut, segs = 140, ringsN = 5) {
  const data = [], idx = [];
  for (let ri = 0; ri <= ringsN; ri++) {
    const fr = ri / ringsN, r = rIn + (rOut - rIn) * fr;
    for (let si = 0; si <= segs; si++) {
      const a = si / segs * Math.PI * 2;
      data.push(Math.cos(a) * r, 0, Math.sin(a) * r, si / segs, fr);
    }
  }
  for (let ri = 0; ri < ringsN; ri++) for (let si = 0; si < segs; si++) {
    const a = ri * (segs + 1) + si, b = a + segs + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return new Geo(gl, new Float32Array(data),
    [{ name: 'aPos', size: 3 }, { name: 'aAngle', size: 1 }, { name: 'aRadius', size: 1 }],
    new Uint16Array(idx));
}

/* ============================== Camera ============================== */
class Camera {
  constructor() {
    this.def = { target: [1.7, 0.35, -0.45], yaw: 0.62, pitch: 0.3, dist: 10.8 };
    this.target = this.def.target.slice();
    this.yaw = this.def.yaw; this.pitch = this.def.pitch; this.dist = this.def.dist;
    this.fov = 45 * Math.PI / 180;
    this.aspect = 1;
    this.view = M4.ident(); this.proj = M4.ident(); this.vp = M4.ident(); this.invVP = M4.ident();
    this.eye = [0, 0, 10];
    this.resetT = 0;
  }
  reset() { this.resetT = 0.7; }
  update(dt, autoRotate, dragging) {
    if (this.resetT > 0) {
      this.resetT -= dt;
      const f = 1 - Math.exp(-dt * 6);
      this.yaw += (this.def.yaw - this.yaw) * f;
      this.pitch += (this.def.pitch - this.pitch) * f;
      this.dist += (this.def.dist - this.dist) * f;
      for (let i = 0; i < 3; i++) this.target[i] += (this.def.target[i] - this.target[i]) * f;
    } else if (autoRotate && !dragging) {
      this.yaw += dt * 0.07;
    }
    this.pitch = Utils.clamp(this.pitch, -1.35, 1.45);
    this.dist = Utils.clamp(this.dist, 3.2, 40);
    const cp = Math.cos(this.pitch);
    this.eye = [
      this.target[0] + this.dist * cp * Math.sin(this.yaw),
      this.target[1] + this.dist * Math.sin(this.pitch),
      this.target[2] + this.dist * cp * Math.cos(this.yaw)
    ];
    this.view = M4.lookAt(this.eye, this.target, [0, 1, 0]);
    this.proj = M4.persp(this.fov, this.aspect, 0.1, 200);
    this.vp = M4.mul(this.proj, this.view);
    this.invVP = M4.invert(this.vp);
  }
  rotate(dx, dy) { this.yaw -= dx * 0.0055; this.pitch += dy * 0.005; this.resetT = 0; }
  pan(dx, dy) {
    const v = this.view, s = this.dist * 0.0018;
    const right = [v[0], v[4], v[8]], up = [v[1], v[5], v[9]];
    for (let i = 0; i < 3; i++) this.target[i] += -right[i] * dx * s + up[i] * dy * s;
    this.target[0] = Utils.clamp(this.target[0], -8, 9);
    this.target[1] = Utils.clamp(this.target[1], -4, 5);
    this.target[2] = Utils.clamp(this.target[2], -8, 8);
    this.resetT = 0;
  }
  zoom(f) { this.dist *= f; this.resetT = 0; }
  screenToRay(px, py, w, h) {
    const x = (px / w) * 2 - 1, y = 1 - (py / h) * 2;
    const p0 = M4.p4(this.invVP, [x, y, -1]);
    const p1 = M4.p4(this.invVP, [x, y, 1]);
    return { ro: p0, rd: V3.norm(V3.sub(p1, p0)) };
  }
  worldToScreen(p, w, h) {
    const v = M4.p4(this.vp, [p[0], p[1], p[2], 1]);
    if (v[3] <= 0.001) return null;
    return [(v[0] * 0.5 + 0.5) * w, (1 - (v[1] * 0.5 + 0.5)) * h];
  }
}

/* ============================== Raycaster ============================== */
class Raycaster {
  static sphere(ro, rd, c, r) {
    const oc = V3.sub(ro, c);
    const b = V3.dot(oc, rd);
    const cc = V3.dot(oc, oc) - r * r;
    const h = b * b - cc;
    if (h < 0) return -1;
    const t = -b - Math.sqrt(h);
    return t > 0 ? t : -1;
  }
  static ring(ro, rd, center, normal, rIn, rOut) {
    const dn = V3.dot(rd, normal);
    if (Math.abs(dn) < 1e-5) return -1;
    const t = V3.dot(V3.sub(center, ro), normal) / dn;
    if (t <= 0) return -1;
    const p = V3.add(ro, V3.scale(rd, t));
    const rel = V3.sub(p, center);
    const proj = V3.dot(rel, normal);
    const q = [rel[0] - normal[0]*proj, rel[1] - normal[1]*proj, rel[2] - normal[2]*proj];
    const d = V3.len(q);
    return (d >= rIn && d <= rOut) ? t : -1;
  }
  static pointOnRay(ro, rd, target) {
    const t = V3.dot(V3.sub(target, ro), rd);
    return t > 0 ? V3.add(ro, V3.scale(rd, t)) : null;
  }
}

/* ============================== InputManager ============================== */
class InputManager {
  constructor(canvas, camera, app) {
    this.canvas = canvas; this.cam = camera; this.app = app;
    this.pointers = new Map();
    this.pinch = null;
    this.dragging = false;
    this.moved = 0;
    this.lastAct = 0;
    this.hoverX = -1; this.hoverY = -1; this.hoverActive = false;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), b: e.button });
      this.lastAct = performance.now();
      this.moved = 0;
      this.dragging = true;
      if (this.pointers.size === 2) this.pinchInit();
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        this.hoverX = e.clientX; this.hoverY = e.clientY; this.hoverActive = true;
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      this.lastAct = performance.now();
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.pointers.size === 2 && this.pinch) {
        this.pinchMove();
      } else if (p.b === 2 || p.b === 1) {
        this.cam.pan(dx, dy);
      } else {
        this.cam.rotate(dx, dy);
      }
    });
    const up = e => {
      const p = this.pointers.get(e.pointerId);
      if (p) {
        const dt = performance.now() - p.t;
        if (this.moved < 7 && dt < 400 && this.pointers.size === 1)
          this.app.handleClick(e.clientX, e.clientY, p.b);
        this.pointers.delete(e.pointerId);
      }
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) this.dragging = false;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => { this.hoverActive = false; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.cam.zoom(Math.exp(e.deltaY * 0.0011));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => { this.cam.reset(); app.audio.click(); });
    this.pinchInit = () => {
      const pts = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx: (pts[0].x + pts[1].x)/2, my: (pts[0].y + pts[1].y)/2 };
    };
    this.pinchMove = () => {
      const pts = [...this.pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x)/2, my = (pts[0].y + pts[1].y)/2;
      if (this.pinch.d > 1) this.cam.zoom(Utils.clamp(this.pinch.d / d, 0.6, 1.6));
      this.cam.pan(mx - this.pinch.mx, my - this.pinch.my);
      this.pinch.d = d; this.pinch.mx = mx; this.pinch.my = my;
    };
  }
  tick() {
    if (this.dragging && this.lastAct && performance.now() - this.lastAct > 3000) {
      this.pointers.clear();
      this.pinch = null;
      this.dragging = false;
    }
  }
}

/* ============================== PerformanceMonitor ============================== */
class PerformanceMonitor {
  constructor() {
    this.fps = 0; this.ft = 16.7; this.frames = 0; this.acc = 0;
    this.draws = 0; this.particles = 0; this.lastDom = 0;
    this.el = {
      fps: document.getElementById('pFps'), ft: document.getElementById('pFt'),
      dc: document.getElementById('pDc'), pc: document.getElementById('pPc'),
      mem: document.getElementById('pMem'), gpu: document.getElementById('pGpu'),
      bFps: document.getElementById('bFps'), bLat: document.getElementById('bLat'),
      bRes: document.getElementById('bRes')
    };
  }
  tick(dtMs, state, w, h) {
    this.ft = Utils.lerp(this.ft, dtMs, 0.08);
    this.frames++; this.acc += dtMs;
    if (this.acc >= 500) {
      this.fps = Math.round(this.frames * 1000 / this.acc);
      this.frames = 0; this.acc = 0;
    }
    const now = performance.now();
    if (now - this.lastDom > 500) {
      this.lastDom = now;
      this.el.fps.textContent = this.fps || '--';
      this.el.ft.textContent = this.ft.toFixed(1) + ' ms';
      this.el.dc.textContent = this.draws;
      this.el.pc.textContent = this.particles.toLocaleString('en-US');
      let mem = 'N/A';
      if (performance.memory) mem = (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB HEAP';
      this.el.mem.textContent = mem;
      this.el.bFps.textContent = this.fps || '--';
      this.el.bLat.textContent = state.display.latency;
      this.el.bRes.textContent = w + '×' + h;
    }
  }
}

/* ============================== ParticleSystem ============================== */
class ParticleSystem {
  constructor(gl) {
    this.max = 10000; this.burstMax = 1200;
    this.total = this.max + this.burstMax;
    this.pos = new Float32Array(this.total * 3);
    this.vel = new Float32Array(this.total * 3);
    this.seed = new Float32Array(this.total);
    this.size = new Float32Array(this.total);
    this.life = new Float32Array(this.burstMax);
    this.maxLife = new Float32Array(this.burstMax);
    this.gpu = new Float32Array(this.total * 8);
    this.ambientCount = 0; this.initialized = 0;
    this.burstHead = 0; this.burstLen = 0; this.burstAlive = 0;
    for (let i = 0; i < 3000; i++) this.#initAmbient(i);
    this.initialized = 3000; this.ambientCount = 3000;
    this.geo = new Geo(gl, this.gpu,
      [{ name: 'aPos', size: 3 }, { name: 'aColor', size: 4 }, { name: 'aSize', size: 1 }],
      null, gl.POINTS, true);
  }
  #initAmbient(i) {
    const i3 = i * 3;
    const a = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    const r = 2.2 + Math.random() * 3.2;
    const sp = Math.sin(ph), cp = Math.cos(ph);
    const dx = sp * Math.cos(a), dy = cp, dz = sp * Math.sin(a);
    this.pos[i3] = dx * r; this.pos[i3+1] = dy * r; this.pos[i3+2] = dz * r;
    const tx = -dz, tz = dx, tl = Math.hypot(tx, tz) || 1e-4;
    const v = 1.0 + Math.random() * 0.8;
    this.vel[i3] = tx / tl * v; this.vel[i3+1] = (Math.random() - 0.5) * 0.4; this.vel[i3+2] = tz / tl * v;
    this.seed[i] = Math.random();
    this.size[i] = 0.028 + Math.random() * 0.062;
  }
  setCount(n) {
    n = Math.min(n, this.max);
    for (let i = this.initialized; i < n; i++) this.#initAmbient(i);
    if (n > this.initialized) this.initialized = n;
    this.ambientCount = n;
  }
  burst(point, normal, n = 500) {
    for (let k = 0; k < n; k++) {
      const idx = this.burstHead % this.burstMax;
      this.burstHead++;
      const i = this.max + idx, i3 = i * 3;
      let dx = normal[0] + (Math.random() - 0.5) * 1.3;
      let dy = normal[1] + (Math.random() - 0.5) * 1.3;
      let dz = normal[2] + (Math.random() - 0.5) * 1.3;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      const sp = 2.0 + Math.random() * 6.5;
      this.pos[i3] = point[0] + dx * 0.06; this.pos[i3+1] = point[1] + dy * 0.06; this.pos[i3+2] = point[2] + dz * 0.06;
      this.vel[i3] = dx * sp + (Math.random() - 0.5) * 1.6;
      this.vel[i3+1] = dy * sp + (Math.random() - 0.5) * 1.6;
      this.vel[i3+2] = dz * sp + (Math.random() - 0.5) * 1.6;
      this.life[idx] = this.maxLife[idx] = 0.8 + Math.random() * 1.0;
      this.seed[i] = Math.random();
      this.size[i] = 0.05 + Math.random() * 0.07;
    }
    this.burstLen = Math.min(this.burstMax, this.burstHead);
  }
  update(dt, t, ctx) {
    const P = this.pos, V = this.vel, S = this.seed;
    const G = ctx.gravity, mode = ctx.mode;
    const damp = mode === 'ATTRACT' ? 2.1 : mode === 'CHAOS' ? 0.9 : 0.5;
    const dmp = Math.max(0, 1 - damp * dt);
    const mx = ctx.mouse ? ctx.mouse[0] : 0, my = ctx.mouse ? ctx.mouse[1] : 0, mz = ctx.mouse ? ctx.mouse[2] : 0;
    const hasM = !!ctx.mouse;
    const n = this.ambientCount;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      let x = P[i3], y = P[i3+1], z = P[i3+2];
      const r = Math.hypot(x, y, z) || 1e-4;
      const nx = x / r, ny = y / r, nz = z / r;
      let fx = 0, fy = 0, fz = 0;
      if (mode === 'ORBIT') {
        const r0 = 1.9 + S[i] * 1.7;
        const k = (r0 - r) * 1.4;
        fx = -nx * k - nx * G * 2.0;
        fy = -ny * k - ny * G * 2.0 + Math.sin(t * 0.6 + S[i] * 40) * 0.5;
        fz = -nz * k - nz * G * 2.0;
        let tx = -nz, tz = nx;
        const tl = Math.hypot(tx, tz) || 1e-4;
        const ts = 1.15 * ctx.orbitSpeed * (0.7 + 0.6 * (S[i] * 7.3 % 1));
        fx += tx / tl * ts; fz += tz / tl * ts;
      } else if (mode === 'ATTRACT') {
        const s = Math.min(9 / (r * r), 9) * G * 2.2;
        fx = -nx * s - nz * 0.6;
        fy = -ny * s;
        fz = -nz * s + nx * 0.6;
      } else {
        fx = Math.sin(y * 1.35 + t * 1.1 + S[i] * 9) * 2.0;
        fy = Math.sin(z * 1.35 + t * 0.9 + S[i] * 5) * 2.0;
        fz = Math.sin(x * 1.35 + t * 1.3 + S[i] * 3) * 2.0;
        const rep = r < 2.0 ? (2.0 - r) * 3.0 : 0;
        fx += nx * rep - nx * G * 0.8;
        fy += ny * rep - ny * G * 0.8;
        fz += nz * rep - nz * G * 0.8;
      }
      if (hasM) {
        const ddx = mx - x, ddy = my - y, ddz = mz - z;
        const d = Math.hypot(ddx, ddy, ddz);
        if (d < 5.5 && d > 1e-3) {
          const f = (1 - d / 5.5) * 7.0 / d;
          fx += ddx * f; fy += ddy * f; fz += ddz * f;
        }
      }
      let vx = (V[i3] + fx * dt) * dmp;
      let vy = (V[i3+1] + fy * dt) * dmp;
      let vz = (V[i3+2] + fz * dt) * dmp;
      x += vx * dt; y += vy * dt; z += vz * dt;
      const r2 = Math.hypot(x, y, z);
      if (r2 < 1.12 && r2 > 1e-4) {
        const s = 1.12 / r2;
        x *= s; y *= s; z *= s;
        const nnx = x / 1.12, nny = y / 1.12, nnz = z / 1.12;
        const vn = vx * nnx + vy * nny + vz * nnz;
        if (vn < 0) { vx -= 1.7 * vn * nnx; vy -= 1.7 * vn * nny; vz -= 1.7 * vn * nnz; }
      }
      if (r2 > 11.5) {
        this.#initAmbient(i);
        continue;
      }
      P[i3] = x; P[i3+1] = y; P[i3+2] = z;
      V[i3] = vx; V[i3+1] = vy; V[i3+2] = vz;
    }
    let alive = 0;
    for (let k = 0; k < this.burstLen; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      const i = this.max + k, i3 = i * 3;
      if (this.life[k] <= 0) { this.life[k] = 0; continue; }
      let x = P[i3], y = P[i3+1], z = P[i3+2];
      const r = Math.hypot(x, y, z) || 1e-4;
      const pull = 3.0 / r;
      let vx = (V[i3] - x / r * pull * dt) * Math.max(0, 1 - 0.5 * dt);
      let vy = (V[i3+1] - y / r * pull * dt) * Math.max(0, 1 - 0.5 * dt);
      let vz = (V[i3+2] - z / r * pull * dt) * Math.max(0, 1 - 0.5 * dt);
      x += vx * dt; y += vy * dt; z += vz * dt;
      P[i3] = x; P[i3+1] = y; P[i3+2] = z;
      V[i3] = vx; V[i3+1] = vy; V[i3+2] = vz;
      if (Math.hypot(x, y, z) > 15) this.life[k] = 0;
      else alive++;
    }
    this.burstAlive = alive;
    if (alive === 0 && this.burstLen > 0) { this.burstLen = 0; this.burstHead = 0; }
  }
  fill(t, energyNorm) {
    const g = this.gpu;
    const n = this.ambientCount;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3, i8 = i * 8;
      const x = this.pos[i3], y = this.pos[i3+1], z = this.pos[i3+2];
      const r = Math.hypot(x, y, z);
      const heat = Utils.clamp((3.8 - r) / 2.8, 0, 1);
      const s = this.seed[i];
      let cr, cg, cb;
      if (s > 0.86) { cr = 0.66; cg = 0.5; cb = 1.0; }
      else { cr = 0.16 + 0.7 * heat; cg = 0.75 + 0.25 * heat; cb = 1.0; }
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (1.5 + s * 3) + s * 40));
      g[i8] = x; g[i8+1] = y; g[i8+2] = z;
      g[i8+3] = cr; g[i8+4] = cg; g[i8+5] = cb;
      g[i8+6] = tw * (0.45 + 0.55 * energyNorm);
      g[i8+7] = this.size[i];
    }
    for (let k = 0; k < this.burstLen; k++) {
      const i = this.max + k, i3 = i * 3, i8 = i * 8;
      const life = this.life[k];
      if (life > 0) {
        const f = life / this.maxLife[k];
        g[i8] = this.pos[i3]; g[i8+1] = this.pos[i3+1]; g[i8+2] = this.pos[i3+2];
        g[i8+3] = 1.0; g[i8+4] = 0.45 + 0.5 * f; g[i8+5] = 0.15 + 0.5 * f;
        g[i8+6] = Math.min(1, f * 1.4);
        g[i8+7] = this.size[i];
      } else g[i8+6] = 0;
    }
  }
  upload() {
    this.geo.update(this.gpu.subarray(0, (this.ambientCount + this.burstLen) * 8));
  }
  get count() { return this.ambientCount + this.burstAlive; }
}

/* ============================== EnergyNetwork ============================== */
const CITY_DEFS = [
  ['TOKYO', 35.7, 139.7], ['SHANGHAI', 31.2, 121.5], ['SINGAPORE', 1.35, 103.8],
  ['SYDNEY', -33.9, 151.2], ['SAN FRANCISCO', 37.8, -122.4], ['NEW YORK', 40.7, -74.0],
  ['LONDON', 51.5, -0.1], ['PARIS', 48.9, 2.35], ['BERLIN', 52.5, 13.4],
  ['MOSCOW', 55.8, 37.6], ['DUBAI', 25.2, 55.3], ['MUMBAI', 19.1, 72.9],
  ['BEIJING', 39.9, 116.4], ['SEOUL', 37.6, 127.0], ['LOS ANGELES', 34.05, -118.2],
  ['CHICAGO', 41.9, -87.6], ['MEXICO CITY', 19.4, -99.1], ['SAO PAULO', -23.55, -46.6],
  ['BUENOS AIRES', -34.6, -58.4], ['LAGOS', 6.5, 3.4], ['CAIRO', 30.0, 31.2],
  ['NAIROBI', -1.29, 36.8], ['JOHANNESBURG', -26.2, 28.0], ['ISTANBUL', 41.0, 28.9],
  ['STOCKHOLM', 59.3, 18.1], ['JAKARTA', -6.2, 106.8], ['MANILA', 14.6, 121.0],
  ['AUCKLAND', -36.85, 174.76], ['TORONTO', 43.7, -79.4], ['VANCOUVER', 49.3, -123.1]
];
const PALETTE = [
  [0.2, 0.9, 1.0], [1.0, 0.75, 0.3], [0.55, 1.0, 0.65], [0.8, 0.55, 1.0],
  [1.0, 0.5, 0.6], [0.45, 0.75, 1.0]
];

class EnergyNetwork {
  constructor(earth) {
    this.earth = earth;
    this.cities = CITY_DEFS.map((c, i) => ({
      name: c[0], lat: c[1], lon: c[2],
      local: Utils.latLon(c[1], c[2]),
      color: PALETTE[i % PALETTE.length],
      phase: i / 30 * 0.4,
      out: 60 + Math.random() * 240,
      world: [0, 0, 0], screen: null
    }));
    const idx = name => this.cities.findIndex(c => c.name === name);
    const req = [['TOKYO','SHANGHAI'],['SHANGHAI','SINGAPORE'],['SINGAPORE','SYDNEY'],
      ['TOKYO','SAN FRANCISCO'],['SAN FRANCISCO','NEW YORK']];
    this.links = req.map(l => ({ a: idx(l[0]), b: idx(l[1]), seed: Math.random() }));
    let guard = 0;
    while (this.links.length < 18 && guard++ < 300) {
      const a = Math.floor(Math.random() * 30), b = Math.floor(Math.random() * 30);
      if (a === b) continue;
      if (this.links.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a))) continue;
      this.links.push({ a, b, seed: Math.random() });
    }
    this.stations = [
      { name: 'ORBITAL STATION A', ring: 0, phase: 0.90, world: [0,0,0], screen: null },
      { name: 'ORBITAL STATION B', ring: 0, phase: 0.42, world: [0,0,0], screen: null },
      { name: 'ORBITAL STATION C', ring: 1, phase: 0.93, world: [0,0,0], screen: null },
      { name: 'ORBITAL STATION D', ring: 2, phase: 0.96, world: [0,0,0], screen: null }
    ];
    this.satellites = [
      { name: 'RELAY SAT-1', r: 1.75, incl: 0.5, speed: 0.5, phase: 0.50, world: [0,0,0], screen: null },
      { name: 'RELAY SAT-2', r: 2.05, incl: -0.3, speed: -0.35, phase: 0.56, world: [0,0,0], screen: null },
      { name: 'RELAY SAT-3', r: 1.9, incl: 1.1, speed: 0.28, phase: 0.62, world: [0,0,0], screen: null }
    ];
  }
  buildArcsGeo(gl) {
    const SEG = 24, data = [];
    const R = 1.0, lift = 0.24;
    for (const link of this.links) {
      const A = this.cities[link.a], B = this.cities[link.b];
      const phase = link.seed % 1;
      for (let s = 0; s < SEG; s++) {
        const pts = [s / SEG, (s + 1) / SEG];
        for (const t of pts) {
          const p = Utils.slerp(A.local, B.local, t);
          const rr = R * (1 + lift * Math.sin(Math.PI * t));
          const c = [Utils.lerp(A.color[0], B.color[0], t), Utils.lerp(A.color[1], B.color[1], t), Utils.lerp(A.color[2], B.color[2], t)];
          data.push(p[0]*rr, p[1]*rr, p[2]*rr, t, phase, c[0], c[1], c[2]);
        }
      }
    }
    return new Geo(gl, new Float32Array(data),
      [{ name: 'aPos', size: 3 }, { name: 'aT', size: 1 }, { name: 'aPhase', size: 1 }, { name: 'aColor', size: 3 }],
      null, gl.LINES);
  }
  buildCityPointsGeo(gl) {
    const data = [];
    for (const c of this.cities) {
      data.push(c.local[0], c.local[1], c.local[2], c.color[0], c.color[1], c.color[2], c.phase, 0.052);
    }
    return new Geo(gl, new Float32Array(data),
      [{ name: 'aPos', size: 3 }, { name: 'aColor', size: 3 }, { name: 'aPhase', size: 1 }, { name: 'aSize', size: 1 }],
      null, gl.POINTS);
  }
  update(dt, t, cam, w, h, gridNorm) {
    for (const c of this.cities) {
      const p = M4.p4(this.earth.model, [c.local[0], c.local[1], c.local[2], 1]);
      c.world = [p[0], p[1], p[2]];
      c.screen = cam.worldToScreen(c.world, w, h);
      c.out += (Math.random() - 0.5) * 6;
      c.out = Utils.clamp(c.out, 40, 320);
    }
    for (const st of this.stations) {
      const g = this.earth.orbitersRef;
      if (g) {
        const wp = g.stationWorld(st);
        st.world = wp;
        st.screen = cam.worldToScreen(wp, w, h);
      }
    }
    const ep = this.earth.pos;
    for (const sat of this.satellites) {
      const a = sat.phase * Math.PI * 2 + t * sat.speed;
      let p = [Math.cos(a) * sat.r, 0, Math.sin(a) * sat.r];
      const rx = M4.rotX(sat.incl);
      const q = M4.p4(rx, [p[0], p[1], p[2], 1]);
      sat.world = [q[0] + ep[0], q[1] + ep[1], q[2] + ep[2]];
      sat.screen = cam.worldToScreen(sat.world, w, h);
    }
  }
  buildSatOrbitGeo(gl) {
    const data = [];
    const ep = this.earth.pos;
    for (const sat of this.satellites) {
      const rx = M4.rotX(sat.incl);
      const c = [0.45, 0.6, 1.0];
      const SEG = 90;
      for (let s = 0; s < SEG; s++) {
        for (const tt of [s / SEG, (s + 1) / SEG]) {
          const a = tt * Math.PI * 2;
          const q = M4.p4(rx, [Math.cos(a) * sat.r, 0, Math.sin(a) * sat.r, 1]);
          data.push(q[0] + ep[0], q[1] + ep[1], q[2] + ep[2], tt, sat.phase, c[0], c[1], c[2]);
        }
      }
    }
    return new Geo(gl, new Float32Array(data),
      [{ name: 'aPos', size: 3 }, { name: 'aT', size: 1 }, { name: 'aPhase', size: 1 }, { name: 'aColor', size: 3 }],
      null, gl.LINES);
  }
}

/* ============================== Earth ============================== */
class Earth {
  constructor() {
    this.pos = [5.4, 1.05, -1.4];
    this.R = 1.16;
    this.tilt = 0.41;
    this.ang = 0;
    this.model = M4.ident();
    this.atmoModel = M4.ident();
    this.hoverK = 0; this.selK = 0;
    this.orbitersRef = null;
  }
  update(dt, t, hovered, selected) {
    this.ang += dt * 0.06;
    const rot = M4.mul(M4.rotZ(this.tilt), M4.rotY(this.ang));
    this.model = M4.mul(M4.trans(...this.pos), M4.mul(rot, M4.scale(this.R)));
    this.atmoModel = M4.mul(M4.trans(...this.pos), M4.mul(rot, M4.scale(this.R * 1.08)));
    this.hoverK += ((hovered ? 1 : 0) - this.hoverK) * Math.min(1, dt * 6);
    this.selK += ((selected ? 1 : 0) - this.selK) * Math.min(1, dt * 6);
  }
}

/* ============================== EnergyCore ============================== */
class EnergyCore {
  constructor() {
    this.center = [0, 0.15, 0];
    this.highlight = 0;
    this.rings = [
      { rIn: 1.65, rOut: 2.05, tiltX: 0.42, tiltZ: 0.10, speed: 0.45, colA: [0.1,0.9,0.9], colB: [0.3,0.5,1.0], dash: 26, flow: 0.05, normal: [0,1,0], model: M4.ident() },
      { rIn: 2.15, rOut: 2.50, tiltX: -0.25, tiltZ: 0.55, speed: -0.30, colA: [0.2,0.7,1.0], colB: [0.8,0.4,1.0], dash: 18, flow: -0.04, normal: [0,1,0], model: M4.ident() },
      { rIn: 2.62, rOut: 2.95, tiltX: 1.05, tiltZ: -0.2, speed: 0.22, colA: [0.9,0.6,0.2], colB: [0.3,0.9,1.0], dash: 34, flow: 0.08, normal: [0,1,0], model: M4.ident() }
    ];
    for (const r of this.rings) {
      const m = M4.mul(M4.rotX(r.tiltX), M4.rotZ(r.tiltZ));
      r.normal = [m[1], m[5], m[9]];
    }
    this.haloPulse = 0;
  }
  update(dt, t, orbitSpeed, selected) {
    this.spin = t * 0.05;
    this.model = M4.mul(M4.trans(...this.center), M4.mul(M4.rotY(this.spin), M4.scale(1.0)));
    this.shellModel = M4.mul(M4.trans(...this.center), M4.mul(M4.rotY(-this.spin * 0.6), M4.scale(1.42)));
    for (const r of this.rings)
      r.model = M4.mul(M4.trans(...this.center), M4.mul(M4.rotX(r.tiltX), M4.mul(M4.rotZ(r.tiltZ), M4.rotY(t * r.speed * orbitSpeed))));
    this.highlight += ((selected ? 1 : 0) - this.highlight) * Math.min(1, dt * 6);
    this.haloPulse = 2.05 + 0.16 * Math.sin(t * 2.4);
  }
  stationWorld(st) {
    const r = this.rings[st.ring];
    const spin = this.spin !== undefined ? this.lastT * r.speed * this.lastOrbit : 0;
    const a = st.phase * Math.PI * 2 + spin;
    const local = [Math.cos(a) * (r.rIn + r.rOut) / 2, 0, Math.sin(a) * (r.rIn + r.rOut) / 2];
    const m = M4.mul(M4.rotX(r.tiltX), M4.rotZ(r.tiltZ));
    const q = M4.p4(m, [local[0], local[1], local[2], 1]);
    return [q[0] + this.center[0], q[1] + this.center[1], q[2] + this.center[2]];
  }
  track(t, orbitSpeed) { this.lastT = t; this.lastOrbit = orbitSpeed; }
  buildStreamsGeo(gl) {
    const data = [];
    const N = 12, SEG = 24;
    for (let s = 0; s < N; s++) {
      const a0 = s / N * Math.PI * 2;
      const phase = (s * 0.37) % 1;
      const rx = M4.rotX(Utils.rnd(-0.5, 0.5)), rz = M4.rotZ(Utils.rnd(-0.5, 0.5));
      for (let i = 0; i < SEG; i++) {
        for (const t of [i / SEG, (i + 1) / SEG]) {
          const a = a0 + t * 2.6;
          const r = 1.15 + t * 1.85;
          let p = [Math.cos(a) * r, Math.sin(t * Math.PI * 1.5 + a0) * 0.4 * (1 - t * 0.5), Math.sin(a) * r];
          const q1 = M4.p4(rx, [p[0], p[1], p[2], 1]);
          const q2 = M4.p4(rz, [q1[0], q1[1], q1[2], 1]);
          const c = [Utils.lerp(0.25, 1.0, t), Utils.lerp(0.85, 0.6, t), Utils.lerp(1.0, 0.25, t)];
          data.push(q2[0], q2[1] + this.center[1], q2[2], t, phase, c[0], c[1], c[2]);
        }
      }
    }
    return new Geo(gl, new Float32Array(data),
      [{ name: 'aPos', size: 3 }, { name: 'aT', size: 1 }, { name: 'aPhase', size: 1 }, { name: 'aColor', size: 3 }],
      null, gl.LINES);
  }
  buildOrbitGeo(gl) {
    const data = [];
    const defs = [
      { r: 2.0, tx: 0.3, tz: 0.2 }, { r: 2.6, tx: -0.5, tz: 0.3 }, { r: 3.2, tx: 0.15, tz: -0.6 }
    ];
    defs.forEach((d, di) => {
      const m = M4.mul(M4.rotX(d.tx), M4.rotZ(d.tz));
      const SEG = 96;
      for (let s = 0; s < SEG; s++) {
        for (const t of [s / SEG, (s + 1) / SEG]) {
          const a = t * Math.PI * 2;
          const q = M4.p4(m, [Math.cos(a) * d.r, 0, Math.sin(a) * d.r, 1]);
          data.push(q[0], q[1] + this.center[1], q[2], t, di * 0.31, 0.25, 0.65, 0.85);
        }
      }
    });
    return new Geo(gl, new Float32Array(data),
      [{ name: 'aPos', size: 3 }, { name: 'aT', size: 1 }, { name: 'aPhase', size: 1 }, { name: 'aColor', size: 3 }],
      null, gl.LINES);
  }
}

/* ============================== Renderer ============================== */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not supported by this browser/device.');
    this.gl = gl;
    this.sm = new ShaderManager(gl);
    this.draws = 0;
    this.w = 1; this.h = 1;
    this.scene = null; this.bloomA = null; this.bloomB = null;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : BRAND.gpuFallback;
    this.pxScale = 1000;
    this.pCore = this.sm.get(VS_SPHERE, FS_CORE);
    this.pShell = this.sm.get(VS_SPHERE, FS_SHELL);
    this.pEarth = this.sm.get(VS_SPHERE, FS_EARTH);
    this.pAtmo = this.sm.get(VS_SPHERE, FS_ATMO);
    this.pRing = this.sm.get(VS_RING, FS_RING);
    this.pLine = this.sm.get(VS_LINE, FS_LINE);
    this.pNode = this.sm.get(VS_NODE, FS_NODE);
    this.pPart = this.sm.get(VS_PART, FS_PART);
    this.pSprite = this.sm.get(VS_SPRITE, FS_SPRITE);
    this.pBright = this.sm.get(VS_POST, FS_BRIGHT);
    this.pBlur = this.sm.get(VS_POST, FS_BLUR);
    this.pComp = this.sm.get(VS_POST, FS_COMP);
    this.blurs = 2;
  }
  resize(w, h, dprCap) {
    const gl = this.gl;
    let s = Math.min(dprCap, window.devicePixelRatio || 1);
    while (w * h * s * s > 6500000 && s > 0.75) s -= 0.25;
    this.canvas.width = Math.max(2, Math.round(w * s));
    this.canvas.height = Math.max(2, Math.round(h * s));
    this.w = this.canvas.width; this.h = this.canvas.height;
    this.#destroyTargets();
    this.scene = this.#mkTarget(this.w, this.h, true);
    const bw = Math.max(2, this.w >> 2), bh = Math.max(2, this.h >> 2);
    this.bloomA = this.#mkTarget(bw, bh, false);
    this.bloomB = this.#mkTarget(bw, bh, false);
  }
  #destroyTargets() {
    const gl = this.gl;
    for (const t of [this.scene, this.bloomA, this.bloomB]) {
      if (!t) continue;
      gl.deleteFramebuffer(t.fb);
      gl.deleteTexture(t.tex);
      if (t.rb) gl.deleteRenderbuffer(t.rb);
    }
  }
  #mkTarget(w, h, depth) {
    const gl = this.gl;
    const mk = (ifmt, type) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, gl.RGBA, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      let rb = null;
      if (depth) {
        rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      }
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (ok) return { fb, tex, rb, w, h };
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      if (rb) gl.deleteRenderbuffer(rb);
      return null;
    };
    let t = null;
    if (this.hdr) t = mk(gl.RGBA16F, gl.HALF_FLOAT);
    if (!t) t = mk(gl.RGBA8, gl.UNSIGNED_BYTE);
    if (!t) throw new Error('Framebuffer allocation failed.');
    return t;
  }
  ensureVAO(geo, prog) {
    let vao = geo.vaos.get(prog.id);
    if (vao) return vao;
    const gl = this.gl;
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
    let off = 0;
    for (const a of geo.attribs) {
      const loc = gl.getAttribLocation(prog.p, a.name);
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, geo.stride, off);
      }
      off += a.size * 4;
    }
    if (geo.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ibo);
    gl.bindVertexArray(null);
    geo.vaos.set(prog.id, vao);
    return vao;
  }
  setUniforms(prog, uni) {
    const gl = this.gl;
    for (const k in uni) {
      const v = uni[k];
      const loc = prog.loc(gl, k);
      if (loc === null) continue;
      if (v && v.__tex !== undefined) {
        gl.activeTexture(gl.TEXTURE0 + v.unit);
        gl.bindTexture(gl.TEXTURE_2D, v.tex);
        gl.uniform1i(loc, v.unit);
      } else if (typeof v === 'number') {
        gl.uniform1f(loc, v);
      } else if (v.length === 16) {
        gl.uniformMatrix4fv(loc, false, v);
      } else if (v.length === 3) {
        gl.uniform3fv(loc, v);
      } else if (v.length === 2) {
        gl.uniform2fv(loc, v);
      } else if (v.length === 4) {
        gl.uniform4fv(loc, v);
      }
    }
  }
  draw(prog, geo, uni, opts = {}) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    this.setUniforms(prog, uni);
    gl.bindVertexArray(this.ensureVAO(geo, prog));
    const count = opts.count !== undefined ? opts.count : geo.count;
    const first = opts.first || 0;
    if (geo.ibo) gl.drawElements(geo.mode, count, gl.UNSIGNED_SHORT, first * 2);
    else gl.drawArrays(geo.mode, first, count);
    this.draws++;
  }
  beginFrame() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0.006, 0.014, 0.04, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    this.draws = 0;
  }
  additive() {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
  }
  #postPass(prog, uni, fb, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    this.setUniforms(prog, uni);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.draws++;
  }
  endFrame(time, glowAmt) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const A = this.bloomA, B = this.bloomB;
    this.#postPass(this.pBright, { uTex: { __tex: 1, tex: this.scene.tex, unit: 0 }, uThresh: 0.58 }, A.fb, A.w, A.h);
    const base = 1.0;
    for (let i = 0; i < this.blurs; i++) {
      const r = base * (i + 1);
      this.#postPass(this.pBlur, { uTex: { __tex: 1, tex: A.tex, unit: 0 }, uDir: [r / A.w, 0] }, B.fb, B.w, B.h);
      this.#postPass(this.pBlur, { uTex: { __tex: 1, tex: B.tex, unit: 0 }, uDir: [0, r / A.h] }, A.fb, A.w, A.h);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.pComp.p);
    this.setUniforms(this.pComp, {
      uScene: { __tex: 1, tex: this.scene.tex, unit: 0 },
      uBloom: { __tex: 1, tex: A.tex, unit: 1 },
      uGlow: 0.55 + 0.75 * glowAmt,
      uCA: 0.55, uScan: 0.8, uVig: 1.0, uTime: time,
      uRes: [this.w, this.h]
    });
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.draws++;
    gl.enable(gl.DEPTH_TEST);
  }
}

/* ============================== Chart ============================== */
class Chart {
  constructor(canvas, cfg) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.cfg = cfg;
    this.hoverX = -1;
    this.last = 0;
    this.animK = 0;
    this.data = null;
    canvas.addEventListener('pointermove', e => { this.hoverX = e.offsetX; this.last = 0; });
    canvas.addEventListener('pointerleave', () => { this.hoverX = -1; this.last = 0; });
  }
  resize() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth || 200, h = this.cv.clientHeight || 90;
    if (this.cv.width !== Math.round(w * d) || this.cv.height !== Math.round(h * d)) {
      this.cv.width = Math.round(w * d);
      this.cv.height = Math.round(h * d);
    }
    this.g.setTransform(d, 0, 0, d, 0, 0);
    this.w = w; this.h = h;
  }
  draw(state, now) {
    if (now - this.last < 130 && this.hoverX < 0) return;
    this.last = now;
    const g = this.g, c = this.cfg;
    const padL = c.padL || 42, padR = 8, padT = 8, padB = 14;
    const pw = this.w - padL - padR, ph = this.h - padT - padB;
    g.clearRect(0, 0, this.w, this.h);
    if (c.type === 'radial') {
      this.#grid(g, padL, padT, pw, ph, c);
      this.#radial(g, state, padL, padT, pw, ph);
      return;
    }
    if (c.type === 'bars') {
      this.#grid(g, padL, padT, pw, ph, c);
      this.#bars(g, state, now, padL, padT, pw, ph);
      return;
    }
    const data = state.getWindow(c.metric, c.secs || 40);
    if (data.length >= 2) {
      let mn = Infinity, mx = -Infinity;
      for (const d of data) { if (d.v < mn) mn = d.v; if (d.v > mx) mx = d.v; }
      const margin = (mx - mn) * 0.15 + 0.01;
      this.minV = mn - margin;
      this.maxV = mx + margin;
      this.data = data;
    }
    this.#grid(g, padL, padT, pw, ph, c);
    if (this.data && this.data.length >= 2) this.#series(g, this.data, padL, padT, pw, ph, c);
  }
  #grid(g, padL, padT, pw, ph, c) {
    g.strokeStyle = 'rgba(70,232,255,0.10)';
    g.lineWidth = 1;
    g.fillStyle = 'rgba(111,167,200,0.75)';
    g.font = '8px "SF Mono",ui-monospace,Menlo,monospace';
    const N = 4;
    for (let i = 0; i <= N; i++) {
      const y = padT + ph * i / N;
      g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke();
      if (c.type === 'radial') continue;
      let val;
      if (c.type === 'bars') val = 100 - i * 25;
      else if (this.minV !== undefined) val = this.maxV - (this.maxV - this.minV) * i / N;
      else val = '';
      g.textAlign = 'right';
      g.fillText(c.type === 'bars' ? val + '%' : (val === '' ? '' : this.fmt(val)), padL - 5, y + 3);
    }
    g.strokeStyle = 'rgba(70,232,255,0.28)';
    g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + ph); g.lineTo(padL + pw, padT + ph); g.stroke();
  }
  fmt(v) {
    if (this.cfg.metric === 'power' || this.cfg.metric === 'temp') return Math.round(v).toString();
    return v.toFixed(1);
  }
  #series(g, data, padL, padT, pw, ph, c) {
    const mn = this.minV, mx = this.maxV;
    const t0 = data[0].t, t1 = data[data.length - 1].t;
    const X = d => padL + (d.t - t0) / Math.max(1e-3, t1 - t0) * pw;
    const Y = d => padT + ph - (d.v - mn) / (mx - mn) * ph;
    if (c.type === 'area' || c.type === 'wave') {
      const grad = g.createLinearGradient(0, padT, 0, padT + ph);
      grad.addColorStop(0, c.fillA);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.beginPath();
      g.moveTo(X(data[0]), padT + ph);
      for (const d of data) g.lineTo(X(d), Y(d));
      g.lineTo(X(data[data.length - 1]), padT + ph);
      g.closePath();
      g.fillStyle = grad;
      g.fill();
    }
    g.beginPath();
    data.forEach((d, i) => i ? g.lineTo(X(d), Y(d)) : g.moveTo(X(d), Y(d)));
    g.strokeStyle = c.color;
    g.lineWidth = 1.6;
    g.shadowColor = c.color;
    g.shadowBlur = 7;
    g.stroke();
    g.shadowBlur = 0;
    const lastP = data[data.length - 1];
    g.beginPath();
    g.arc(X(lastP), Y(lastP), 2.6, 0, Math.PI * 2);
    g.fillStyle = '#eafcff';
    g.shadowColor = c.color; g.shadowBlur = 10;
    g.fill();
    g.shadowBlur = 0;
    if (this.hoverX >= padL && this.hoverX <= padL + pw) {
      let best = null, bd = 1e9;
      for (const d of data) {
        const dd = Math.abs(X(d) - this.hoverX);
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best && bd < 24) {
        const bx = X(best), by = Y(best);
        g.strokeStyle = 'rgba(70,232,255,0.5)';
        g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(bx, padT); g.lineTo(bx, padT + ph); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.arc(bx, by, 3.4, 0, Math.PI * 2);
        g.fillStyle = '#fff'; g.fill();
        const rel = Math.max(0, Math.round(state.clock - state.viewOffset - best.t));
        const txt = c.label + ': ' + this.fmt(best.v) + ' ' + c.unit + '  ·  T-' + rel + 's';
        g.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        const tw = g.measureText(txt).width + 12;
        let tx = Utils.clamp(bx - tw / 2, padL, padL + pw - tw);
        const ty = Math.max(padT, by - 24);
        g.fillStyle = 'rgba(4,14,28,0.92)';
        g.strokeStyle = c.color;
        g.beginPath();
        if (g.roundRect) g.roundRect(tx, ty, tw, 17, 4); else g.rect(tx, ty, tw, 17);
        g.fill(); g.stroke();
        g.fillStyle = '#d7f2ff';
        g.textAlign = 'left';
        g.fillText(txt, tx + 6, ty + 12);
      }
    }
  }
  #bars(g, state, now, padL, padT, pw, ph) {
    const loads = state.regionLoads(now);
    const n = loads.length;
    const bw = pw / n * 0.62, gap = pw / n;
    this.minV = 0; this.maxV = 100;
    loads.forEach((L, i) => {
      const x = padL + i * gap + (gap - bw) / 2;
      const bh = L.v / 100 * ph;
      const hot = L.v > 90;
      const grad = g.createLinearGradient(0, padT + ph - bh, 0, padT + ph);
      if (hot) { grad.addColorStop(0, '#ff5470'); grad.addColorStop(1, 'rgba(255,84,112,0.1)'); }
      else { grad.addColorStop(0, '#46e8ff'); grad.addColorStop(1, 'rgba(70,232,255,0.08)'); }
      g.fillStyle = grad;
      g.shadowColor = hot ? '#ff5470' : '#46e8ff';
      g.shadowBlur = 6;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, padT + ph - bh, bw, bh, 2); else g.rect(x, padT + ph - bh, bw, bh);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(111,167,200,0.85)';
      g.font = '7px "SF Mono",ui-monospace,Menlo,monospace';
      g.textAlign = 'center';
      g.fillText(L.name, x + bw / 2, this.h - 3);
      if (this.hoverX >= x && this.hoverX <= x + bw) {
        const txt = L.name + ' · ' + L.v.toFixed(1) + '%';
        g.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        const tw = g.measureText(txt).width + 12;
        const tx = Utils.clamp(x + bw / 2 - tw / 2, padL, padL + pw - tw);
        g.fillStyle = 'rgba(4,14,28,0.92)';
        g.strokeStyle = '#46e8ff';
        g.beginPath();
        if (g.roundRect) g.roundRect(tx, padT, tw, 17, 4); else g.rect(tx, padT, tw, 17);
        g.fill(); g.stroke();
        g.fillStyle = '#d7f2ff'; g.textAlign = 'left';
        g.fillText(txt, tx + 6, padT + 12);
      }
    });
  }
  #radial(g, state, padL, padT, pw, ph) {
    const cx = padL + pw / 2, cy = padT + ph / 2 + 2;
    const R = Math.min(pw, ph) / 2 - 8;
    const v = Utils.clamp(state.disp('eff'), 0, 100) / 100;
    this.animK += (v - this.animK) * 0.12;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.lineWidth = 9;
    g.strokeStyle = 'rgba(70,232,255,0.12)';
    g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    const grad = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    grad.addColorStop(0, '#2df0c8');
    grad.addColorStop(1, '#46e8ff');
    g.strokeStyle = grad;
    g.shadowColor = '#46e8ff';
    g.shadowBlur = 12;
    g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * this.animK); g.stroke();
    g.shadowBlur = 0;
    for (let i = 0; i <= 20; i++) {
      const a = a0 + (a1 - a0) * i / 20;
      const r1 = R + 7, r2 = R + (i / 20 <= this.animK ? 11 : 9);
      g.strokeStyle = i / 20 <= this.animK ? 'rgba(70,232,255,0.8)' : 'rgba(70,232,255,0.25)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.stroke();
    }
    g.fillStyle = '#eafcff';
    g.font = '600 17px "SF Mono",ui-monospace,Menlo,monospace';
    g.textAlign = 'center';
    g.shadowColor = '#46e8ff'; g.shadowBlur = 10;
    g.fillText((this.animK * 100).toFixed(2) + '%', cx, cy + 2);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(111,167,200,0.9)';
    g.font = '8px "SF Mono",ui-monospace,Menlo,monospace';
    g.fillText('CORE EFFICIENCY', cx, cy + 16);
    if (this.hoverX >= 0) {
      g.fillStyle = 'rgba(4,14,28,0.92)';
      g.strokeStyle = '#46e8ff';
      const txt = 'EFFICIENCY: ' + state.disp('eff').toFixed(2) + '%';
      g.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
      const tw = g.measureText(txt).width + 12;
      g.beginPath();
      if (g.roundRect) g.roundRect(cx - tw / 2, padT, tw, 17, 4); else g.rect(cx - tw / 2, padT, tw, 17);
      g.fill(); g.stroke();
      g.fillStyle = '#d7f2ff'; g.fillText(txt, cx, padT + 12);
    }
  }
}

/* ============================== Timeline ============================== */
class Timeline {
  constructor(canvas, state, audio) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.state = state;
    this.audio = audio;
    this.dragging = false;
    this.last = 0;
    this.lastDragT = 0;
    this.modeEl = document.getElementById('tlMode');
    this.timeEl = document.getElementById('tlTime');
    canvas.addEventListener('pointerdown', e => {
      this.dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      this.#scrub(e);
    });
    canvas.addEventListener('pointermove', e => { if (this.dragging) this.#scrub(e); });
    const end = () => { this.dragging = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    document.getElementById('tlLive').addEventListener('click', () => {
      state.viewOffset = 0;
      this.#updateMode();
      audio.click();
    });
  }
  #scrub(e) {
    const r = this.cv.getBoundingClientRect();
    const x = Utils.clamp((e.clientX - r.left) / r.width, 0, 1);
    let off = (1 - x) * 60;
    if (off < 0.6) off = 0;
    this.state.viewOffset = Utils.clamp(off, 0, 59);
    this.lastDragT = performance.now();
    this.#updateMode();
  }
  #updateMode() {
    const off = this.state.viewOffset;
    if (off <= 0.01) {
      this.modeEl.textContent = '● LIVE';
      this.modeEl.className = '';
      this.timeEl.textContent = '';
    } else {
      this.modeEl.textContent = '▶ SCRUB T-' + off.toFixed(1) + 's';
      this.modeEl.className = 'scrub';
      const t = new Date(Date.now() - off * 1000);
      this.timeEl.textContent = 'VIEW ' + t.toISOString().slice(11, 19) + 'Z';
    }
  }
  resize() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth || 300, h = this.cv.clientHeight || 52;
    this.cv.width = Math.round(w * d);
    this.cv.height = Math.round(h * d);
    this.g.setTransform(d, 0, 0, d, 0, 0);
    this.w = w; this.h = h;
  }
  draw(now) {
    if (this.dragging && performance.now() - this.lastDragT > 1500) this.dragging = false;
    if (now - this.last < 120 && !this.dragging) return;
    this.last = now;
    const g = this.g, st = this.state, w = this.w, h = this.h;
    const data = st.getWindow('power', 60);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,232,255,0.10)';
    g.font = '8px "SF Mono",ui-monospace,Menlo,monospace';
    g.fillStyle = 'rgba(111,167,200,0.7)';
    for (let i = 0; i <= 6; i++) {
      const x = w * i / 6;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h - 10); g.stroke();
      if (i > 0) { g.textAlign = 'center'; g.fillText('-' + (60 - i * 10) + 's', x, h - 1); }
    }
    for (let i = 1; i < 4; i++) {
      const y = (h - 10) * i / 4;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    if (data.length > 1) {
      let mn = Infinity, mx = -Infinity;
      for (const d of data) { if (d.v < mn) mn = d.v; if (d.v > mx) mx = d.v; }
      const pad = (mx - mn) * 0.2 + 1;
      mn -= pad; mx += pad;
      const t0 = data[0].t, t1 = data[data.length - 1].t;
      const X = d => (d.t - t0) / Math.max(1e-3, t1 - t0) * w;
      const Y = d => 4 + (h - 18) - (d.v - mn) / (mx - mn) * (h - 18);
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(70,232,255,0.45)');
      grad.addColorStop(1, 'rgba(70,232,255,0.02)');
      g.beginPath();
      g.moveTo(X(data[0]), h - 14);
      for (const d of data) g.lineTo(X(d), Y(d));
      g.lineTo(X(data[data.length - 1]), h - 14);
      g.closePath();
      g.fillStyle = grad;
      g.fill();
      g.beginPath();
      data.forEach((d, i) => i ? g.lineTo(X(d), Y(d)) : g.moveTo(X(d), Y(d)));
      g.strokeStyle = '#46e8ff';
      g.lineWidth = 1.5;
      g.shadowColor = '#46e8ff'; g.shadowBlur = 6;
      g.stroke();
      g.shadowBlur = 0;
    }
    const off = st.viewOffset;
    const px = w * (1 - off / 60);
    if (off > 0.01) {
      g.fillStyle = 'rgba(2,6,14,0.55)';
      g.fillRect(px, 0, w - px, h);
      g.strokeStyle = '#ffb454';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke();
      g.fillStyle = '#ffb454';
      g.beginPath(); g.arc(px, 8, 3.5, 0, Math.PI * 2); g.fill();
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(now * 4);
      g.fillStyle = 'rgba(92,240,138,' + (0.4 + 0.6 * pulse) + ')';
      g.beginPath(); g.arc(w - 2, 8, 3.5 + pulse * 1.5, 0, Math.PI * 2); g.fill();
    }
  }
}

/* ============================== HUD ============================== */
class HUD {
  constructor(state) {
    this.state = state;
    this.el = {
      utc: document.getElementById('hUtc'), up: document.getElementById('hUp'),
      stab: document.getElementById('hStab'), shield: document.getElementById('hShield'),
      status: document.getElementById('hStatus'), net: document.getElementById('hNet'),
      nodes: document.getElementById('hNodes'),
      mPower: document.getElementById('mPower'), mEff: document.getElementById('mEff'),
      mGrid: document.getElementById('mGrid'), mFlow: document.getElementById('mFlow'),
      mTemp: document.getElementById('mTemp'), mFlux: document.getElementById('mFlux'),
      sysDot: document.getElementById('sysDot'), sysState: document.getElementById('sysState'),
      banner: document.getElementById('alertBanner')
    };
    this.t0 = performance.now();
    this.lastClock = 0; this.lastWarn = 0;
  }
  update(now, audio) {
    const s = this.state, e = this.el;
    e.mPower.textContent = Utils.fmtInt(s.disp('power'));
    e.mEff.textContent = s.disp('eff').toFixed(2);
    e.mGrid.textContent = s.disp('grid').toFixed(2);
    e.mFlow.textContent = s.disp('flow').toFixed(2);
    e.mTemp.textContent = s.disp('temp').toFixed(1);
    e.mFlux.textContent = s.disp('flux').toFixed(2);
    if (now - this.lastClock > 0.24) {
      this.lastClock = now;
      e.utc.textContent = new Date().toISOString().slice(11, 19);
      const up = Math.floor((performance.now() - this.t0) / 1000);
      e.up.textContent = Math.floor(up / 3600) + ':' + Utils.pad2(Math.floor(up / 60) % 60) + ':' + Utils.pad2(up % 60);
      e.stab.textContent = s.disp('stability').toFixed(2) + '%';
      e.shield.textContent = s.disp('shield').toFixed(2) + '%';
    }
    const alert = s.alert;
    e.banner.hidden = !alert;
    if (alert) e.banner.textContent = '⚠ ' + s.alertCause;
    e.sysDot.className = 'dot' + (alert ? ' warn' : '');
    e.sysState.textContent = alert ? 'SYSTEM ALERT' : 'SYSTEM ONLINE';
    e.status.textContent = alert ? 'ALERT' : 'ONLINE';
    e.status.className = 'v ' + (alert ? 'am' : 'gr');
    if (alert && now - this.lastWarn > 2.6) {
      this.lastWarn = now;
      audio.warn();
    }
  }
}

/* ============================== ControlPanel ============================== */
const DENSITY_STEPS = [1000, 2000, 3000, 5000, 10000];
class ControlPanel {
  constructor(state, particles, camera, audio, app) {
    this.state = state; this.particles = particles; this.camera = camera; this.audio = audio; this.app = app;
    const $ = id => document.getElementById(id);
    const bindSlider = (sid, vid, fn, fmt) => {
      const s = $(sid), v = $(vid);
      s.addEventListener('input', () => { fn(parseFloat(s.value)); v.textContent = fmt(parseFloat(s.value)); });
    };
    bindSlider('sDensity', 'vDensity', x => { state.settings.density = DENSITY_STEPS[x]; particles.setCount(DENSITY_STEPS[x]); },
      x => DENSITY_STEPS[x]);
    bindSlider('sEnergy', 'vEnergy', x => { state.settings.coreEnergy = x / 100; }, x => x + '%');
    bindSlider('sGrav', 'vGrav', x => { state.settings.gravity = x; }, x => x.toFixed(2));
    bindSlider('sOrbit', 'vOrbit', x => { state.settings.orbitSpeed = x; }, x => x.toFixed(1));
    bindSlider('sGlow', 'vGlow', x => { state.settings.glow = x; }, x => x.toFixed(2));
    $('segQ').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      $('segQ').querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.settings.quality = b.dataset.q;
      audio.click();
      app.applyQuality();
    }));
    $('segM').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      $('segM').querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.settings.particleMode = b.dataset.m;
      audio.click();
    }));
    $('tRotate').addEventListener('click', () => {
      state.settings.autoRotate = !state.settings.autoRotate;
      $('tRotate').classList.toggle('active', state.settings.autoRotate);
      audio.click();
    });
    $('tAudio').addEventListener('click', () => {
      state.settings.audio = !state.settings.audio;
      audio.setMuted(!state.settings.audio);
      $('tAudio').classList.toggle('active', state.settings.audio);
      if (state.settings.audio) audio.click();
    });
    $('btnBurst').addEventListener('click', () => app.coreBurst());
    $('btnView').addEventListener('click', () => { camera.reset(); audio.click(); });
    const tabData = $('tabData'), tabCtrl = $('tabCtrl'), paneData = $('paneData'), paneCtrl = $('paneCtrl');
    const setTab = which => {
      tabData.classList.toggle('active', which === 'data');
      tabCtrl.classList.toggle('active', which === 'ctrl');
      paneData.style.display = which === 'data' ? '' : 'none';
      paneCtrl.style.display = which === 'ctrl' ? '' : 'none';
    };
    tabData.addEventListener('click', () => { setTab('data'); audio.click(); });
    tabCtrl.addEventListener('click', () => { setTab('ctrl'); audio.click(); });
    const sidebar = $('sidebar');
    $('fabData').addEventListener('click', () => { setTab('data'); sidebar.classList.add('open'); audio.click(); });
    $('fabCtrl').addEventListener('click', () => { setTab('ctrl'); sidebar.classList.add('open'); audio.click(); });
    $('sideClose').addEventListener('click', () => { sidebar.classList.remove('open'); audio.click(); });
  }
}

/* ============================== Scene ============================== */
class Scene {
  constructor(renderer, state, audio) {
    const gl = renderer.gl;
    this.state = state;
    this.audio = audio;
    this.core = new EnergyCore();
    this.earth = new Earth();
    this.network = new EnergyNetwork(this.earth);
    this.earth.orbitersRef = this.core;
    this.particles = new ParticleSystem(gl);
    this.sphere = sphereGeo(gl);
    this.ringGeos = this.core.rings.map(rg => ringGeo(gl, rg.rIn, rg.rOut));
    this.streamsGeo = this.core.buildStreamsGeo(gl);
    this.coreOrbitGeo = this.core.buildOrbitGeo(gl);
    this.arcsGeo = this.network.buildArcsGeo(gl);
    this.cityGeo = this.network.buildCityPointsGeo(gl);
    this.satOrbitGeo = this.network.buildSatOrbitGeo(gl);
    this.haloGeo = new Geo(gl, new Float32Array([-1,-1, 3,-1, -1,3]),
      [{ name: 'aCorner', size: 2 }], null, gl.TRIANGLES);
    const starData = [];
    for (let i = 0; i < 650; i++) {
      const a = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const sp = Math.sin(ph), rad = 55 + Math.random() * 22;
      const warm = Math.random() < 0.25;
      starData.push(sp*Math.cos(a)*rad, Math.cos(ph)*rad, sp*Math.sin(a)*rad,
        warm ? 1 : 0.65 + Math.random()*0.35, warm ? 0.8 : 0.8 + Math.random()*0.2, 1,
        Math.random(), 0.05 + Math.random()*0.08);
    }
    this.starsGeo = new Geo(gl, new Float32Array(starData),
      [{ name: 'aPos', size: 3 }, { name: 'aColor', size: 3 }, { name: 'aPhase', size: 1 }, { name: 'aSize', size: 1 }],
      null, gl.POINTS);
    this.dynGpu = new Float32Array(8 * 8);
    this.dynGeo = new Geo(gl, this.dynGpu,
      [{ name: 'aPos', size: 3 }, { name: 'aColor', size: 3 }, { name: 'aPhase', size: 1 }, { name: 'aSize', size: 1 }],
      null, gl.POINTS, true);
  }
  update(dt, t, cam, w, h) {
    const st = this.state;
    this.core.track(t, st.settings.orbitSpeed);
    this.core.update(dt, t, st.settings.orbitSpeed,
      st.selection && st.selection.type === 'core');
    const hovEarth = st.hover && st.hover.type === 'earth';
    const selEarth = st.selection && (st.selection.type === 'earth' || st.selection.type === 'city');
    this.earth.update(dt, t, hovEarth, selEarth);
    this.network.update(dt, t, cam, w, h, Utils.clamp(st.disp('grid') / 100, 0, 1));
    const powNorm = Utils.clamp(st.disp('power') / 3400, 0, 1.2);
    const mouseWorld = st.mouseWorld;
    this.particles.update(dt, t, {
      gravity: st.settings.gravity,
      mode: st.settings.particleMode,
      orbitSpeed: st.settings.orbitSpeed,
      mouse: mouseWorld
    });
    this.particles.fill(t, 0.35 + 0.65 * powNorm);
    this.particles.upload();
    let n = 0;
    const put = (p, c, ph, s) => {
      this.dynGpu[n*8] = p[0]; this.dynGpu[n*8+1] = p[1]; this.dynGpu[n*8+2] = p[2];
      this.dynGpu[n*8+3] = c[0]; this.dynGpu[n*8+4] = c[1]; this.dynGpu[n*8+5] = c[2];
      this.dynGpu[n*8+6] = ph; this.dynGpu[n*8+7] = s;
      n++;
    };
    for (const stn of this.network.stations) put(stn.world, [1, 0.72, 0.3], stn.phase, 0.072);
    for (const sat of this.network.satellites) put(sat.world, [0.66, 0.5, 1], sat.phase, 0.05);
    this.dynGeo.update(this.dynGpu.subarray(0, n * 8));
    this.dynCount = n;
  }
  render(r, cam, t) {
    const gl = r.gl, st = this.state;
    const vp = cam.vp, view = cam.view, eye = cam.eye;
    const e = Utils.clamp(st.energyVis, 0, 2);
    const focus = (st.hover && st.hover.id !== undefined) ? st.hover :
      ((st.selection && st.selection.id !== undefined) ? st.selection : null);
    let nodePhase = -9;
    if (focus) {
      const arr = focus.type === 'city' ? this.network.cities :
        focus.type === 'station' ? this.network.stations :
        focus.type === 'satellite' ? this.network.satellites : null;
      if (arr) nodePhase = arr[focus.id].phase;
    }
    r.draw(r.pEarth, this.sphere, {
      uModel: this.earth.model, uView: view, uProj: cam.proj,
      uCamPos: eye, uLightDir: LIGHT_DIR, uTime: t,
      uHover: this.earth.hoverK, uHighlight: this.earth.selK, uEnergy: e
    });
    r.draw(r.pCore, this.sphere, {
      uModel: this.core.model, uView: view, uProj: cam.proj,
      uTime: t, uEnergy: e, uHighlight: this.core.highlight, uCamPos: eye
    });
    r.additive();
    r.draw(r.pSprite, this.haloGeo, {
      uView: view, uProj: cam.proj, uCenter: this.core.center,
      uRadius: this.core.haloPulse, uColor: [0.22, 0.6, 1.0],
      uIntensity: 0.4 + 0.35 * e + st.impulse * 0.5
    });
    r.draw(r.pShell, this.sphere, {
      uModel: this.core.shellModel, uView: view, uProj: cam.proj,
      uCamPos: eye, uTint: [0.3, 0.65, 1.0], uTime: t, uEnergy: e, uHighlight: this.core.highlight
    });
    this.core.rings.forEach((rg, i) => {
      const hovRing = (st.hover && st.hover.type === 'ring' && st.hover.id === i) ||
        (st.selection && st.selection.type === 'ring' && st.selection.id === i) ? 1 : 0;
      r.draw(r.pRing, this.ringGeos[i], {
        uVP: vp, uModel: rg.model, uTime: t, uEnergy: e, uHighlight: hovRing,
        uDash: rg.dash, uFlow: rg.flow, uColA: rg.colA, uColB: rg.colB
      });
    });
    const hovOrbit = (st.hover && st.hover.type === 'orbit') || (st.selection && st.selection.type === 'orbit');
    r.draw(r.pLine, this.coreOrbitGeo, {
      uVP: vp, uModel: IDENT, uTime: t, uIntensity: 0.55 + (hovOrbit ? 0.8 : 0), uFlow: 0.06
    });
    r.draw(r.pLine, this.streamsGeo, {
      uVP: vp, uModel: IDENT, uTime: t, uIntensity: 0.7 + 0.3 * Math.sin(t * 1.7), uFlow: 0.22
    });
    r.draw(r.pLine, this.satOrbitGeo, {
      uVP: vp, uModel: IDENT, uTime: t, uIntensity: 0.4, uFlow: 0.1
    });
    r.draw(r.pLine, this.arcsGeo, {
      uVP: vp, uModel: this.earth.model, uTime: t,
      uIntensity: 0.5 + 0.6 * Utils.clamp(st.disp('grid') / 100, 0, 1), uFlow: 0.12
    });
    r.draw(r.pPart, this.particles.geo, {
      uVP: vp, uView: view, uScale: r.pxScale
    }, { first: 0, count: this.particles.ambientCount });
    if (this.particles.burstLen > 0)
      r.draw(r.pPart, this.particles.geo, {
        uVP: vp, uView: view, uScale: r.pxScale
      }, { first: this.particles.max, count: this.particles.burstLen });
    r.draw(r.pNode, this.starsGeo, {
      uVP: vp, uView: view, uModel: IDENT, uTime: t, uSelPhase: -9, uScale: r.pxScale, uAlpha: 0.9
    });
    r.draw(r.pNode, this.dynGeo, {
      uVP: vp, uView: view, uModel: IDENT, uTime: t,
      uSelPhase: nodePhase,
      uScale: r.pxScale, uAlpha: 1
    }, { count: this.dynCount });
    r.draw(r.pNode, this.cityGeo, {
      uVP: vp, uView: view, uModel: this.earth.model, uTime: t,
      uSelPhase: nodePhase,
      uScale: r.pxScale, uAlpha: 1
    });
    r.draw(r.pAtmo, this.sphere, {
      uModel: this.earth.atmoModel, uView: view, uProj: cam.proj,
      uCamPos: eye, uLightDir: LIGHT_DIR, uBoost: 1 + this.earth.hoverK * 0.8 + this.earth.selK * 0.6
    });
    gl.depthMask(true);
  }
}
const LIGHT_DIR = V3.norm([0.55, 0.28, 0.55]);

/* ============================== App ============================== */
class App {
  constructor() {
    this.canvas = document.getElementById('glcanvas');
    this.state = new StateManager();
    this.audio = new AudioManager();
    this.camera = new Camera();
    this.perf = new PerformanceMonitor();
    this.dead = false;
    this.booted = false;
    this.lastT = 0;
    this.tSec = 0;
    this.hoverThrottle = 0;
    this.tooltipT = 0;
    this.lowFpsAcc = 0;
    this.autoDropped = 0;
    this.orbitPick = [
      { tx: 0.3, tz: 0.2, r: 2.0 }, { tx: -0.5, tz: 0.3, r: 2.6 }, { tx: 0.15, tz: -0.6, r: 3.2 }
    ].map(od => {
      const m = M4.mul(M4.rotX(od.tx), M4.rotZ(od.tz));
      return { n: [m[1], m[5], m[9]], r: od.r };
    });
  }
  fatal(msg) {
    if (this.dead) return;
    this.dead = true;
    document.getElementById('boot').style.display = 'none';
    document.getElementById('ui').style.display = 'none';
    const tt = document.getElementById('tooltip');
    if (tt) tt.style.display = 'none';
    document.getElementById('fbMsg').textContent = String(msg);
    document.getElementById('fallback').hidden = false;
  }
  start() {
    try {
      this.renderer = new Renderer(this.canvas);
    } catch (e) {
      this.fatal(e.message || 'WebGL2 initialization failed.');
      return;
    }
    try {
      this.scene = new Scene(this.renderer, this.state, this.audio);
    } catch (e) {
      this.fatal(e.message || 'Scene initialization failed.');
      return;
    }
    this.canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.fatal('GPU context lost. Please reload the page.');
    });
    this.input = new InputManager(this.canvas, this.camera, this);
    document.getElementById('fbReload').addEventListener('click', () => location.reload());
    document.getElementById('pGpu').textContent = this.renderer.gpuName;
    this.hud = new HUD(this.state);
    this.charts = [
      new Chart(document.getElementById('chPower'), { type: 'line', metric: 'power', label: 'POWER', unit: 'MW', color: '#46e8ff', secs: 40 }),
      new Chart(document.getElementById('chFlow'), { type: 'area', metric: 'flow', label: 'FLOW', unit: 'GW', color: '#2df0c8', fillA: 'rgba(45,240,200,0.4)', secs: 40 }),
      new Chart(document.getElementById('chGrid'), { type: 'bars' }),
      new Chart(document.getElementById('chEff'), { type: 'radial' }),
      new Chart(document.getElementById('chTemp'), { type: 'wave', metric: 'temp', label: 'TEMP', unit: 'K', color: '#ffb454', fillA: 'rgba(255,180,84,0.35)', secs: 20 })
    ];
    this.timeline = new Timeline(document.getElementById('tlCanvas'), this.state, this.audio);
    this.ctrl = new ControlPanel(this.state, this.scene.particles, this.camera, this.audio, this);
    this.state.selNodePhase = -9;
    if (matchMedia('(pointer:coarse)').matches || innerWidth < 900) {
      this.state.settings.quality = 'MEDIUM';
      document.querySelectorAll('#segQ button').forEach(b =>
        b.classList.toggle('active', b.dataset.q === 'MEDIUM'));
    }
    this.tooltip = document.getElementById('tooltip');
    this.boot = document.getElementById('boot');
    const bootFn = () => {
      if (this.booted) return;
      this.booted = true;
      this.audio.init();
      this.audio.startup();
      this.boot.classList.add('hide');
      setTimeout(() => { this.boot.style.display = 'none'; }, 800);
    };
    document.addEventListener('pointerdown', bootFn, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.lastT = performance.now();
      this.audio.init();
    });
    this.#resize();
    window.addEventListener('resize', () => { clearTimeout(this._rt); this._rt = setTimeout(() => this.#resize(), 120); });
    window.addEventListener('orientationchange', () => { clearTimeout(this._rt); this._rt = setTimeout(() => this.#resize(), 250); });
    setTimeout(() => this.#resize(), 350);
    this.lastT = performance.now();
    requestAnimationFrame(ts => this.#frame(ts));
  }
  applyQuality() {
    this.#resize();
  }
  #qualityDpr() {
    const q = this.state.settings.quality;
    return q === 'LOW' ? 1 : q === 'MEDIUM' ? 1.5 : 2;
  }
  #resize() {
    if (this.dead) return;
    const w = window.innerWidth, h = window.innerHeight;
    try {
      this.renderer.resize(w, h, this.#qualityDpr());
      this.renderer.blurs = this.state.settings.quality === 'LOW' ? 1 : this.state.settings.quality === 'MEDIUM' ? 2 : 3;
    } catch (e) {
      this.fatal('Resize failed: ' + e.message);
      return;
    }
    this.camera.aspect = w / h;
    this.renderer.pxScale = this.renderer.canvas.height * 0.5 / Math.tan(this.camera.fov / 2);
    for (const c of this.charts) c.resize();
    this.timeline.resize();
  }
  coreBurst() {
    const c = this.scene.core.center;
    this.scene.particles.burst([c[0], c[1], c[2] + 0.9], [0.1, 0.2, 0.97], 500);
    this.state.triggerImpulse();
    this.audio.boom();
  }
  handleClick(x, y, button) {
    if (button !== 0) return;
    const hit = this.#pick(x, y);
    const st = this.state;
    if (!hit) {
      st.selection = null;
      st.selNodePhase = -9;
      this.tooltip.style.display = 'none';
      this.audio.click();
      return;
    }
    this.audio.click();
    switch (hit.type) {
      case 'core':
        this.scene.particles.burst(hit.point, V3.norm(V3.sub(hit.point, this.scene.core.center)), 500);
        this.state.triggerImpulse();
        this.audio.boom();
        st.selection = { type: 'core' };
        st.selNodePhase = -9;
        break;
      case 'city':
        st.selection = { type: 'city', id: hit.id };
        st.selNodePhase = this.scene.network.cities[hit.id].phase;
        break;
      case 'station':
        st.selection = { type: 'station', id: hit.id };
        st.selNodePhase = this.scene.network.stations[hit.id].phase;
        break;
      case 'satellite':
        st.selection = { type: 'satellite', id: hit.id };
        st.selNodePhase = this.scene.network.satellites[hit.id].phase;
        break;
      case 'earth':
        st.selection = { type: 'earth' };
        st.selNodePhase = -9;
        break;
      case 'ring':
        st.selection = { type: 'ring', id: hit.id };
        st.selNodePhase = -9;
        break;
      case 'orbit':
        st.selection = { type: 'orbit' };
        st.selNodePhase = -9;
        break;
    }
    this.#showTooltip(hit, x, y, true);
  }
  #pick(x, y) {
    const cam = this.camera, w = window.innerWidth, h = window.innerHeight;
    const ray = cam.screenToRay(x, y, w, h);
    const net = this.scene.network;
    const near = (obj, type, rr) => {
      if (!obj.screen) return false;
      const d = Math.hypot(obj.screen[0] - x, obj.screen[1] - y);
      return d < rr;
    };
    let best = null, bd = 18;
    net.cities.forEach((c, i) => {
      if (!c.screen) return;
      const d = Math.hypot(c.screen[0] - x, c.screen[1] - y);
      if (d < bd) { bd = d; best = { type: 'city', id: i }; }
    });
    if (best) return best;
    for (let i = 0; i < net.stations.length; i++)
      if (near(net.stations[i], 'station', 16)) return { type: 'station', id: i };
    for (let i = 0; i < net.satellites.length; i++)
      if (near(net.satellites[i], 'satellite', 16)) return { type: 'satellite', id: i };
    const core = this.scene.core;
    const tCore = Raycaster.sphere(ray.ro, ray.rd, core.center, 1.05);
    if (tCore > 0) return { type: 'core', point: V3.add(ray.ro, V3.scale(ray.rd, tCore)) };
    const tEarth = Raycaster.sphere(ray.ro, ray.rd, this.scene.earth.pos, this.scene.earth.R);
    if (tEarth > 0) return { type: 'earth', point: V3.add(ray.ro, V3.scale(ray.rd, tEarth)) };
    for (let i = 0; i < core.rings.length; i++) {
      const rg = core.rings[i];
      const t = Raycaster.ring(ray.ro, ray.rd, core.center, rg.normal, rg.rIn, rg.rOut);
      if (t > 0) return { type: 'ring', id: i };
    }
    for (const od of this.orbitPick) {
      const t = Raycaster.ring(ray.ro, ray.rd, core.center, od.n, od.r - 0.12, od.r + 0.12);
      if (t > 0) return { type: 'orbit' };
    }
    return null;
  }
  #tooltipHtml(hit) {
    const st = this.state, net = this.scene.network;
    const row = (k, v) => `<div class="tt-row"><span>${k}</span><b>${v}</b></div>`;
    switch (hit.type) {
      case 'core':
        return `<div class="tt-name">◈ ${BRAND.coreName}</div>` +
          row('STATUS', 'ACTIVE') +
          row('OUTPUT', Utils.fmtInt(st.disp('power')) + ' MW') +
          row('CORE TEMP', st.disp('temp').toFixed(1) + ' K') +
          row('STABILITY', st.disp('stability').toFixed(2) + '%') +
          row('ENERGY FLUX', st.disp('flux').toFixed(2) + ' TW/sr');
      case 'earth':
        return `<div class="tt-name">⊕ TERRA ENERGY GRID</div>` +
          row('NODES', net.cities.length + ' CITIES') +
          row('ACTIVE LINKS', net.links.length + '') +
          row('GRID LOAD', st.disp('grid').toFixed(2) + '%') +
          row('RESERVE', (100 - st.disp('grid')).toFixed(1) + '%');
      case 'city': {
        const c = net.cities[hit.id];
        return `<div class="tt-name">◉ ${c.name}</div>` +
          row('STATUS', 'LINKED') +
          row('OUTPUT', Math.round(c.out) + ' MW') +
          row('LAT/LON', c.lat.toFixed(1) + '° / ' + c.lon.toFixed(1) + '°') +
          row('GRID LOAD', st.disp('grid').toFixed(1) + '%');
      }
      case 'station': {
        const s = net.stations[hit.id];
        return `<div class="tt-name">▣ ${s.name}</div>` +
          row('ALTITUDE', Math.round(380 + hit.id * 120) + ' KM') +
          row('VELOCITY', (7.2 + hit.id * 0.3).toFixed(1) + ' KM/S') +
          row('LOAD', st.regionLoads(this.tSec)[7].v.toFixed(1) + '%') +
          row('DOCKS', 2 + hit.id + '/6');
      }
      case 'satellite': {
        const s = net.satellites[hit.id];
        return `<div class="tt-name">◇ ${s.name}</div>` +
          row('ORBIT R', s.r.toFixed(2) + ' AU-s') +
          row('SIGNAL', (92 + Math.sin(this.tSec + hit.id) * 5).toFixed(1) + '%') +
          row('BAND', 'KA/' + (24 + hit.id) + ' GHZ');
      }
      case 'ring': {
        const rg = this.scene.core.rings[hit.id];
        return `<div class="tt-name">◎ ORBITAL RING ${['I','II','III'][hit.id]}</div>` +
          row('RADIUS', ((rg.rIn + rg.rOut) / 2).toFixed(2) + ' KM-e') +
          row('ANG. VEL', (Math.abs(rg.speed) * this.state.settings.orbitSpeed).toFixed(2) + ' RAD/S') +
          row('STATIONS', '1') +
          row('FLOW', st.disp('flow').toFixed(2) + ' GW');
      }
      case 'orbit':
        return `<div class="tt-name">◯ TRANSIT ORBIT</div>` +
          row('USAGE', 'LOGISTICS') +
          row('TRAFFIC', Math.round(20 + 30 * Math.abs(Math.sin(this.tSec))) + ' OBJ/S');
      default:
        return '';
    }
  }
  #selectionCenter() {
    const sel = this.state.selection;
    if (!sel) return null;
    switch (sel.type) {
      case 'core': return this.scene.core.center;
      case 'earth': return this.scene.earth.pos;
      case 'city': return this.scene.network.cities[sel.id].world;
      case 'station': return this.scene.network.stations[sel.id].world;
      case 'satellite': return this.scene.network.satellites[sel.id].world;
      case 'ring': return this.scene.core.center;
      case 'orbit': return this.scene.core.center;
      default: return null;
    }
  }
  #showTooltip(hit, x, y, pinned) {
    this.tooltip.innerHTML = this.#tooltipHtml(hit);
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = Math.min(x + 16, window.innerWidth - 190) + 'px';
    this.tooltip.style.top = Math.min(y + 14, window.innerHeight - 140) + 'px';
  }
  #handleHover() {
    const inp = this.input;
    if (!inp.hoverActive || inp.dragging) {
      if (!this.state.selection) this.tooltip.style.display = 'none';
      this.state.hover = null;
      this.state.mouseWorld = null;
      this.canvas.style.cursor = 'grab';
      return;
    }
    const hit = this.#pick(inp.hoverX, inp.hoverY);
    const prev = this.state.hover;
    const key = hit ? hit.type + (hit.id !== undefined ? ':' + hit.id : '') : '';
    const prevKey = prev ? prev.type + (prev.id !== undefined ? ':' + prev.id : '') : '';
    if (key !== prevKey) {
      this.state.hover = hit;
      if (hit) this.audio.hover();
    }
    this.canvas.style.cursor = hit ? 'pointer' : 'grab';
    const ray = this.camera.screenToRay(inp.hoverX, inp.hoverY, window.innerWidth, window.innerHeight);
    this.state.mouseWorld = Raycaster.pointOnRay(ray.ro, ray.rd, this.scene.core.center);
    if (hit && !this.state.selection) {
      this.#showTooltip(hit, inp.hoverX, inp.hoverY, false);
      this.tooltipT = this.tSec;
    } else if (!hit && !this.state.selection) {
      this.tooltip.style.display = 'none';
    }
  }
  #frame(ts) {
    if (this.dead) return;
    requestAnimationFrame(t => this.#frame(t));
    try {
      const dt = Utils.clamp((ts - this.lastT) / 1000, 0, 0.05);
      this.lastT = ts;
      this.tSec += dt;
      const st = this.state;
      st.update(this.tSec, dt);
      this.camera.update(dt, st.settings.autoRotate, this.input.dragging);
      this.input.tick();
      this.scene.update(dt, this.tSec, this.camera, window.innerWidth, window.innerHeight);
      this.#handleHover();
      if (st.selection && this.tSec - this.tooltipT > 0.15) {
        this.tooltipT = this.tSec;
        const c = this.#selectionCenter();
        const scr = c ? this.camera.worldToScreen(c, window.innerWidth, window.innerHeight) : null;
        if (scr) this.#showTooltip(st.selection, scr[0], scr[1], true);
      }
      const r = this.renderer;
      r.beginFrame();
      this.scene.render(r, this.camera, this.tSec);
      r.endFrame(this.tSec, st.settings.glow);
      this.perf.draws = r.draws;
      this.perf.particles = this.scene.particles.count;
      this.perf.tick(dt * 1000, st, window.innerWidth, window.innerHeight);
      if (this.perf.fps > 0 && this.perf.fps < 24) this.lowFpsAcc += dt;
      else this.lowFpsAcc = Math.max(0, this.lowFpsAcc - dt * 0.5);
      if (this.lowFpsAcc > 4 && this.autoDropped < 2) {
        this.lowFpsAcc = 0;
        this.autoDropped++;
        const order = ['HIGH', 'MEDIUM', 'LOW'];
        const cur = order.indexOf(this.state.settings.quality);
        if (cur > 0) {
          this.state.settings.quality = order[cur - 1];
          document.querySelectorAll('#segQ button').forEach(b =>
            b.classList.toggle('active', b.dataset.q === this.state.settings.quality));
          this.applyQuality();
        }
      }
      this.hud.update(this.tSec, this.audio);
      for (const c of this.charts) c.draw(st, this.tSec);
      this.timeline.draw(this.tSec);
    } catch (e) {
      console.error(e);
      this.fatal('Runtime error: ' + (e && e.message ? e.message : e));
    }
  }
}

const app = new App();
app.start();
})();
