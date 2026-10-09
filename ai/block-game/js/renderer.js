/* WebGL 渲染器：区块主通道、方块高亮线框、粒子点精灵、雾效 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  function compile(gl, vsSrc, fsSrc) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        var err = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error('Shader 编译失败: ' + err);
      }
      return s;
    }
    var vs = null, fs = null, p = null;
    try {
      vs = sh(gl.VERTEX_SHADER, vsSrc);
      fs = sh(gl.FRAGMENT_SHADER, fsSrc);
      p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        var err2 = gl.getProgramInfoLog(p);
        throw new Error('Program 链接失败: ' + err2);
      }
      return p;
    } catch (e) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (p) gl.deleteProgram(p);
      throw e;
    }
  }

  /* ---------- 着色器 ---------- */
  var CHUNK_VS = [
    'attribute vec3 aPos;',
    'attribute vec2 aUV;',
    'attribute float aLight;',  /* 天空光（受日照强度影响） */
    'attribute float aBlock;',  /* 方块光（火把/萤石自发光） */
    'uniform mat4 uProj, uView;',
    'varying vec2 vUV; varying float vLight; varying float vBlock; varying float vDist;',
    'void main(){',
    '  vec4 vp = uView * vec4(aPos, 1.0);',
    '  gl_Position = uProj * vp;',
    '  vUV = aUV; vLight = aLight; vBlock = aBlock; vDist = length(vp.xyz);',
    '}'
  ].join('\n');

  var CHUNK_FS = [
    'precision mediump float;',
    'varying vec2 vUV; varying float vLight; varying float vBlock; varying float vDist;',
    'uniform sampler2D uTex;',
    'uniform vec3 uFogColor;',
    'uniform float uFogNear, uFogFar;',
    'uniform float uAlphaMode;',
    'uniform float uSunLight;',
    'uniform float uHandLight;',
    'void main(){',
    '  vec4 t = texture2D(uTex, vUV);',
    '  if (uAlphaMode < 0.5 && t.a < 0.5) discard;',
    '  float f = clamp((vDist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);',
    '  float handGlow = uHandLight > 0.05 ? max(0.0, 1.0 - vDist / 9.5) * 0.88 : 0.0;',
    '  float finalLight = max(max(vLight * uSunLight, vBlock), handGlow);',
    '  vec3 col = mix(t.rgb * finalLight, uFogColor, f);',
    '  gl_FragColor = vec4(col, uAlphaMode < 0.5 ? 1.0 : t.a);',
    '}'
  ].join('\n');

  var FLAT_VS = [
    'attribute vec3 aPos;',
    'uniform mat4 uProj, uView;',
    'void main(){ gl_Position = uProj * uView * vec4(aPos, 1.0); }'
  ].join('\n');

  var FLAT_FS = [
    'precision mediump float;',
    'uniform vec4 uColor;',
    'void main(){ gl_FragColor = uColor; }'
  ].join('\n');

  var POINT_VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aCol;',
    'attribute float aSize;',
    'uniform mat4 uProj, uView;',
    'uniform float uPointScale;',
    'varying vec3 vCol;',
    'void main(){',
    '  vec4 vp = uView * vec4(aPos, 1.0);',
    '  gl_Position = uProj * vp;',
    '  gl_PointSize = clamp(aSize * uPointScale / max(gl_Position.w, 0.1), 2.0, 22.0);',
    '  vCol = aCol;',
    '}'
  ].join('\n');

  var POINT_FS = [
    'precision mediump float;',
    'varying vec3 vCol;',
    'void main(){ gl_FragColor = vec4(vCol, 1.0); }'
  ].join('\n');

  /* ---------- 数学 ---------- */
  function perspective(out, fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2);
    out.fill(0);
    out[0] = f / aspect; out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = 2 * far * near / (near - far);
    return out;
  }

  /* 由相机位置与朝向直接构造视图矩阵（列主序） */
  function viewFromBasis(out, eye, fwd) {
    var rx, ry, rz;
    /* right = normalize(cross(fwd, (0,1,0))) = (-f.z, 0, f.x) */
    rx = -fwd[2]; ry = 0; rz = fwd[0];
    var rl = Math.hypot(rx, ry, rz);
    if (rl < 1e-6) { rx = 1; ry = 0; rz = 0; } else { rx /= rl; ry /= rl; rz /= rl; }
    /* up = cross(right, fwd) */
    var ux = ry * fwd[2] - rz * fwd[1];
    var uy = rz * fwd[0] - rx * fwd[2];
    var uz = rx * fwd[1] - ry * fwd[0];

    out[0] = rx; out[1] = ux; out[2] = -fwd[0]; out[3] = 0;
    out[4] = ry; out[5] = uy; out[6] = -fwd[1]; out[7] = 0;
    out[8] = rz; out[9] = uz; out[10] = -fwd[2]; out[11] = 0;
    out[12] = -(rx * eye[0] + ry * eye[1] + rz * eye[2]);
    out[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
    out[14] = (fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2]);
    out[15] = 1;
    return out;
  }

  /* 单位盒 12 条边顶点（含微小外扩防 z-fighting） */
  function boxEdges() {
    var e = 0.004;
    var c = [[-e,-e,-e],[1+e,-e,-e],[1+e,-e,1+e],[-e,-e,1+e],
             [-e,1+e,-e],[1+e,1+e,-e],[1+e,1+e,1+e],[-e,1+e,1+e]];
    var edges = [0,1,1,2,2,3,3,0, 4,5,5,6,6,7,7,4, 0,4,1,5,2,6,3,7];
    var arr = [];
    for (var i = 0; i < edges.length; i++) arr.push.apply(arr, c[edges[i]]);
    return new Float32Array(arr);
  }

  /* ---------- 渲染器 ---------- */
  function Renderer(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
          || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL 不可用');
    this.gl = gl;
    this.canvas = canvas;
    this.uint32Ext = !!gl.getExtension('OES_element_index_uint');

    this.progChunk = compile(gl, CHUNK_VS, CHUNK_FS);
    this.progFlat = compile(gl, FLAT_VS, FLAT_FS);
    this.progPoint = compile(gl, POINT_VS, POINT_FS);

    this.locChunk = {
      aPos: gl.getAttribLocation(this.progChunk, 'aPos'),
      aUV: gl.getAttribLocation(this.progChunk, 'aUV'),
      aLight: gl.getAttribLocation(this.progChunk, 'aLight'),
      aBlock: gl.getAttribLocation(this.progChunk, 'aBlock'),
      uProj: gl.getUniformLocation(this.progChunk, 'uProj'),
      uView: gl.getUniformLocation(this.progChunk, 'uView'),
      uTex: gl.getUniformLocation(this.progChunk, 'uTex'),
      uFogColor: gl.getUniformLocation(this.progChunk, 'uFogColor'),
      uFogNear: gl.getUniformLocation(this.progChunk, 'uFogNear'),
      uFogFar: gl.getUniformLocation(this.progChunk, 'uFogFar'),
      uAlphaMode: gl.getUniformLocation(this.progChunk, 'uAlphaMode'),
      uSunLight: gl.getUniformLocation(this.progChunk, 'uSunLight'),
      uHandLight: gl.getUniformLocation(this.progChunk, 'uHandLight')
    };
    this.locFlat = {
      aPos: gl.getAttribLocation(this.progFlat, 'aPos'),
      uProj: gl.getUniformLocation(this.progFlat, 'uProj'),
      uView: gl.getUniformLocation(this.progFlat, 'uView'),
      uColor: gl.getUniformLocation(this.progFlat, 'uColor')
    };
    this.locPoint = {
      aPos: gl.getAttribLocation(this.progPoint, 'aPos'),
      aCol: gl.getAttribLocation(this.progPoint, 'aCol'),
      aSize: gl.getAttribLocation(this.progPoint, 'aSize'),
      uProj: gl.getUniformLocation(this.progPoint, 'uProj'),
      uView: gl.getUniformLocation(this.progPoint, 'uView'),
      uPointScale: gl.getUniformLocation(this.progPoint, 'uPointScale')
    };

    /* 贴图图集 */
    var atlas = MC.buildAtlas();
    this.atlas = atlas;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    /* 高亮线框 */
    this.lineBase = boxEdges();
    this.lineCount = this.lineBase.length / 3;
    this.lineBuf = gl.createBuffer();

    /* 粒子动态缓冲 */
    this.pointBuf = gl.createBuffer();

    /* 天空、日月星辰与云层缓冲 */
    this._initSky(gl);

    this.proj = new Float32Array(16);
    this.view = new Float32Array(16);
    this.fov = 75 * Math.PI / 180;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    this.resize();
  }

  Renderer.prototype.resize = function () {
    var w = Math.floor(window.innerWidth * this.dpr);
    var h = Math.floor(window.innerHeight * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  };

  /* 无 OES_element_index_uint 时：把 32 位索引网格按三角形切成若干批，每批局部顶点 <= 65536，
     输出 Uint16 索引 + 逐批拷贝的顶点数据（每顶点 7 个 float，布局不变） */
  function splitForU16(vert, idx) {
    var U16 = 65536;
    var nVert = vert.length / 7;
    var map = new Int32Array(nVert);
    for (var i = 0; i < nVert; i++) map[i] = -1;

    var batches = [];
    var cur = null;
    function open() { cur = { src: [], ind: [] }; batches.push(cur); }
    open();

    for (var t = 0; t < idx.length; t += 3) {
      var need = 0, k;
      for (k = 0; k < 3; k++) if (map[idx[t + k]] < 0) need++;
      if (cur.src.length + need > U16) {
        /* 当前批放不下：释放本批占用的映射，开新批 */
        for (var s = 0; s < cur.src.length; s++) map[cur.src[s]] = -1;
        open();
      }
      for (k = 0; k < 3; k++) {
        var v = idx[t + k];
        if (map[v] < 0) { map[v] = cur.src.length; cur.src.push(v); }
        cur.ind.push(map[v]);
      }
    }

    var pieces = [];
    for (var b = 0; b < batches.length; b++) {
      var bt = batches[b];
      var vf = new Float32Array(bt.src.length * 7);
      for (var j = 0; j < bt.src.length; j++) {
        var sv = bt.src[j] * 7;
        for (var c = 0; c < 7; c++) vf[j * 7 + c] = vert[sv + c];
      }
      pieces.push({ vert: vf, idx: new Uint16Array(bt.ind) });
    }
    return pieces;
  }

  /* 按 CPU 侧网格数据创建 GPU 绘制批次；索引类型由数组类型与扩展可用性共同决定 */
  Renderer.prototype._makeDraws = function (part) {
    var gl = this.gl;
    if (!part.idx.length) return [];
    var needSplit = (part.idx instanceof Uint32Array) && !this.uint32Ext;
    var pieces = needSplit ? splitForU16(part.vert, part.idx) : [part];
    var draws = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (!p.idx.length) continue;
      var vbo = gl.createBuffer(), ibo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, p.vert, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, p.idx, gl.STATIC_DRAW);
      draws.push({
        vbo: vbo, ibo: ibo, n: p.idx.length,
        type: (p.idx instanceof Uint32Array) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
      });
    }
    return draws;
  };

  Renderer.prototype._freeDraws = function (draws) {
    var gl = this.gl;
    for (var i = 0; i < draws.length; i++) {
      gl.deleteBuffer(draws[i].vbo);
      gl.deleteBuffer(draws[i].ibo);
    }
  };

  Renderer.prototype.uploadChunk = function (chunk, mesh) {
    if (chunk.mesh) this._freeDraws(chunk.mesh.solid.concat(chunk.mesh.trans));
    chunk.mesh = {
      solid: this._makeDraws(mesh.solid),
      trans: this._makeDraws(mesh.trans)
    };
  };

  Renderer.prototype.disposeChunk = function (chunk) {
    if (chunk.mesh) {
      this._freeDraws(chunk.mesh.solid.concat(chunk.mesh.trans));
      chunk.mesh = null;
    }
  };

  Renderer.prototype._drawDraws = function (draws) {
    var gl = this.gl;
    for (var i = 0; i < draws.length; i++) {
      this._bindChunkAttribs(draws[i].vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, draws[i].ibo);
      gl.drawElements(gl.TRIANGLES, draws[i].n, draws[i].type, 0);
    }
  };

  Renderer.prototype.dispose = function () {
    var gl = this.gl;
    if (this.progChunk) gl.deleteProgram(this.progChunk);
    if (this.progFlat) gl.deleteProgram(this.progFlat);
    if (this.progPoint) gl.deleteProgram(this.progPoint);
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.lineBuf) gl.deleteBuffer(this.lineBuf);
    if (this.pointBuf) gl.deleteBuffer(this.pointBuf);
    if (this.skyQuadBuf) gl.deleteBuffer(this.skyQuadBuf);
    if (this.starBuf) gl.deleteBuffer(this.starBuf);
    if (this.cloudBuf) gl.deleteBuffer(this.cloudBuf);
    if (this.tntBoxBuf) gl.deleteBuffer(this.tntBoxBuf);
  };

  Renderer.prototype._bindChunkAttribs = function (vbo) {
    var gl = this.gl, L = this.locChunk;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(L.aPos);
    gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(L.aUV);
    gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(L.aLight);
    gl.vertexAttribPointer(L.aLight, 1, gl.FLOAT, false, 28, 20);
    gl.enableVertexAttribArray(L.aBlock);
    gl.vertexAttribPointer(L.aBlock, 1, gl.FLOAT, false, 28, 24);
  };

  Renderer.prototype.render = function (opts) {
    var gl = this.gl;
    this.resize();
    var w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);

    var fogColor = opts.underwater ? [0.05, 0.2, 0.42] : (opts.skyColor || [0.62, 0.8, 0.95]);
    var fogFar = opts.underwater ? 16 : opts.fogFar;
    var fogNear = opts.underwater ? 0 : fogFar * 0.6;
    var sunLight = opts.sunLight !== undefined ? opts.sunLight : 1.0;

    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    perspective(this.proj, this.fov, w / h, 0.1, 420);
    viewFromBasis(this.view, opts.eye, opts.fwd);
    var pointScale = h * this.proj[5] * 0.5;

    /* --- 天空系统（太阳、月亮、星宿、浮云） --- */
    if (!opts.underwater) {
      this._renderSky(opts, pointScale);
    }

    /* --- 不透明通道 --- */
    gl.useProgram(this.progChunk);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.locChunk.uTex, 0);
    gl.uniformMatrix4fv(this.locChunk.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.locChunk.uView, false, this.view);
    gl.uniform3f(this.locChunk.uFogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform1f(this.locChunk.uFogNear, fogNear);
    gl.uniform1f(this.locChunk.uFogFar, fogFar);
    gl.uniform1f(this.locChunk.uAlphaMode, 0);
    gl.uniform1f(this.locChunk.uSunLight, sunLight);
    gl.uniform1f(this.locChunk.uHandLight, opts.handLight ? 1.0 : 0.0);

    var i, ch;
    for (i = 0; i < opts.chunks.length; i++) {
      ch = opts.chunks[i];
      if (!ch.mesh) continue;
      this._drawDraws(ch.mesh.solid);
    }

    /* --- 引信激活的 TNT 实体渲染 --- */
    if (opts.tntList && opts.tntList.length > 0) {
      this._renderTNT(opts.tntList);
    }

    /* --- 3D 浮空旋转掉落物渲染 --- */
    if (opts.dropList && opts.dropList.length > 0) {
      this._renderDrops(opts.dropList);
    }

    /* --- 目标方块高亮线框与逐级碎裂裂纹 --- */
    if (opts.target && opts.showTarget) {
      gl.useProgram(this.progFlat);
      gl.uniformMatrix4fv(this.locFlat.uProj, false, this.proj);
      gl.uniformMatrix4fv(this.locFlat.uView, false, this.view);
      gl.uniform4f(this.locFlat.uColor, 0.05, 0.05, 0.05, 1);
      var lineRes = this._buildTargetAndCrackLines(opts.target, opts.breakProgress || 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lineRes.arr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.locFlat.aPos);
      gl.vertexAttribPointer(this.locFlat.aPos, 3, gl.FLOAT, false, 12, 0);
      gl.drawArrays(gl.LINES, 0, lineRes.count);
    }

    /* --- 半透明通道（水/玻璃），远到近 --- */
    gl.useProgram(this.progChunk);
    gl.uniform1f(this.locChunk.uAlphaMode, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE); /* 临时关闭面剔除，使水下仰视水面双面可见 */
    for (i = opts.chunks.length - 1; i >= 0; i--) {
      ch = opts.chunks[i];
      if (!ch.mesh) continue;
      this._drawDraws(ch.mesh.trans);
    }
    gl.enable(gl.CULL_FACE);

    /* --- 粒子 --- */
    if (opts.particleData && opts.particleCount > 0) {
      gl.useProgram(this.progPoint);
      gl.uniformMatrix4fv(this.locPoint.uProj, false, this.proj);
      gl.uniformMatrix4fv(this.locPoint.uView, false, this.view);
      gl.uniform1f(this.locPoint.uPointScale, pointScale);
      var P = this.locPoint;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
      gl.bufferData(gl.ARRAY_BUFFER, opts.particleData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(P.aPos);
      gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(P.aCol);
      gl.vertexAttribPointer(P.aCol, 3, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(P.aSize);
      gl.vertexAttribPointer(P.aSize, 1, gl.FLOAT, false, 28, 24);
      gl.drawArrays(gl.POINTS, 0, opts.particleCount);
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };

  var CRACK_SEGS = [
    [0.5, 0.5, 0.28, 0.72], [0.5, 0.5, 0.72, 0.32],
    [0.5, 0.5, 0.34, 0.25], [0.5, 0.5, 0.68, 0.75],
    [0.28, 0.72, 0.12, 0.90], [0.72, 0.32, 0.90, 0.15],
    [0.34, 0.25, 0.15, 0.10], [0.68, 0.75, 0.88, 0.92],
    [0.28, 0.72, 0.45, 0.88], [0.72, 0.32, 0.55, 0.12],
    [0.34, 0.25, 0.58, 0.38], [0.68, 0.75, 0.42, 0.62],
    [0.12, 0.90, 0.02, 0.98], [0.90, 0.15, 0.98, 0.05]
  ];

  Renderer.prototype._buildTargetAndCrackLines = function (t, bp) {
    if (!this._crackLineBuf) this._crackLineBuf = new Float32Array(256);
    var out = this._crackLineBuf;
    var base = this.lineBase;
    var tx = t.x, ty = t.y, tz = t.z;
    var ptr = 0;

    /* 敲击微震颤反馈 */
    var jitter = bp > 0 ? (Math.sin(performance.now() * 0.09) * 0.012 * bp) : 0;

    /* 1. 基础方块 12 条线框 */
    for (var k = 0; k < base.length; k += 3) {
      out[ptr++] = base[k] + tx + jitter;
      out[ptr++] = base[k + 1] + ty + jitter;
      out[ptr++] = base[k + 2] + tz + jitter;
    }

    /* 2. 挖掘裂纹（根据进度逐级展开蛛网裂纹） */
    if (bp > 0.08 && t.face) {
      var dir = t.face;
      var numCracks = bp >= 0.75 ? 14 : (bp >= 0.45 ? 8 : (bp >= 0.15 ? 4 : 2));
      for (var ci = 0; ci < numCracks; ci++) {
        var seg = CRACK_SEGS[ci];
        this._mapFaceUV(out, ptr, tx, ty, tz, dir, seg[0], seg[1]);
        ptr += 3;
        this._mapFaceUV(out, ptr, tx, ty, tz, dir, seg[2], seg[3]);
        ptr += 3;
      }
    }

    return { arr: out.subarray(0, ptr), count: ptr / 3 };
  };

  Renderer.prototype._mapFaceUV = function (out, ptr, tx, ty, tz, dir, u, v) {
    var eps = 0.006;
    if (dir[0] !== 0) {
      out[ptr]     = tx + (dir[0] > 0 ? 1 + eps : -eps);
      out[ptr + 1] = ty + v;
      out[ptr + 2] = tz + u;
    } else if (dir[1] !== 0) {
      out[ptr]     = tx + u;
      out[ptr + 1] = ty + (dir[1] > 0 ? 1 + eps : -eps);
      out[ptr + 2] = tz + v;
    } else {
      out[ptr]     = tx + u;
      out[ptr + 1] = ty + v;
      out[ptr + 2] = tz + (dir[2] > 0 ? 1 + eps : -eps);
    }
  };

  Renderer.prototype._translatedLines = function (tx, ty, tz) {
    if (!this._lineTmp || this._lineTmp.length !== this.lineBase.length) {
      this._lineTmp = new Float32Array(this.lineBase.length);
    }
    var out = this._lineTmp, base = this.lineBase;
    for (var k = 0; k < base.length; k += 3) {
      out[k] = base[k] + tx;
      out[k + 1] = base[k + 1] + ty;
      out[k + 2] = base[k + 2] + tz;
    }
    return out;
  };

  /* ---------- 天空系统：太阳、月亮、星宿、浮云 ---------- */
  Renderer.prototype._initSky = function (gl) {
    this.skyQuadBuf = gl.createBuffer();
    this.starBuf = gl.createBuffer();
    this.tntBoxBuf = gl.createBuffer();

    var starList = [];
    var rng = MC.mulberry32(133742);
    for (var i = 0; i < 140; i++) {
      var th = rng() * Math.PI * 2;
      var ph = rng() * Math.PI * 0.42;
      var r = 190;
      var sx = Math.cos(th) * Math.cos(ph) * r;
      var sy = Math.sin(ph) * r + 20;
      var sz = Math.sin(th) * Math.cos(ph) * r;
      var br = 0.75 + rng() * 0.25;
      starList.push(sx, sy, sz, br, br, br * 1.15, 2.5 + rng() * 3.5);
    }
    this.starRaw = new Float32Array(starList);
    this.starTrans = new Float32Array(starList.length);
    this.starCount = starList.length / 7;
    this.billboardQuadArr = new Float32Array(18);
    this.cloudArr = new Float32Array(640);

    /* 单位立方体 36 顶点 */
    var c = [
      [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
      [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5]
    ];
    var fIdx = [
      0,1,2, 0,2,3,  5,4,7, 5,7,6,  4,0,3, 4,3,7,
      1,5,6, 1,6,2,  3,2,6, 3,6,7,  4,5,1, 4,1,0
    ];
    var boxV = [];
    for (var k = 0; k < fIdx.length; k++) {
      boxV.push(c[fIdx[k]][0], c[fIdx[k]][1], c[fIdx[k]][2]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tntBoxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxV), gl.STATIC_DRAW);
  };

  Renderer.prototype._renderSky = function (opts, pointScale) {
    var gl = this.gl;
    var dayPhase = opts.dayPhase !== undefined ? opts.dayPhase : 0.25;
    var sunLight = opts.sunLight !== undefined ? opts.sunLight : 1.0;
    var eye = opts.eye;

    gl.depthMask(false);

    /* 1. 璀璨夜空繁星（入夜后逐渐绽放） */
    if (sunLight < 0.72) {
      var starAlpha = Math.min(1.0, (0.72 - sunLight) / 0.35);
      var src = this.starRaw, dst = this.starTrans;
      for (var s = 0; s < this.starCount; s++) {
        var sk = s * 7;
        dst[sk]     = src[sk] + eye[0];
        dst[sk + 1] = src[sk + 1] + eye[1];
        dst[sk + 2] = src[sk + 2] + eye[2];
        dst[sk + 3] = src[sk + 3] * starAlpha;
        dst[sk + 4] = src[sk + 4] * starAlpha;
        dst[sk + 5] = src[sk + 5] * starAlpha;
        dst[sk + 6] = src[sk + 6];
      }
      gl.useProgram(this.progPoint);
      gl.uniformMatrix4fv(this.locPoint.uProj, false, this.proj);
      gl.uniformMatrix4fv(this.locPoint.uView, false, this.view);
      gl.uniform1f(this.locPoint.uPointScale, pointScale);
      var P = this.locPoint;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf);
      gl.bufferData(gl.ARRAY_BUFFER, dst, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(P.aPos);
      gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(P.aCol);
      gl.vertexAttribPointer(P.aCol, 3, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(P.aSize);
      gl.vertexAttribPointer(P.aSize, 1, gl.FLOAT, false, 28, 24);
      gl.drawArrays(gl.POINTS, 0, this.starCount);
    }

    /* 2. 太阳与月亮方块天体 */
    gl.useProgram(this.progFlat);
    gl.uniformMatrix4fv(this.locFlat.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.locFlat.uView, false, this.view);

    var ang = dayPhase * Math.PI * 2 - Math.PI / 2;
    var sx = Math.cos(ang), sy = Math.sin(ang), sz = 0.22;
    var sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl; sy /= sl; sz /= sl;

    /* 太阳（金黄暖阳）—— 始终正对相机 */
    if (sy > -0.25) {
      this._drawBillboardQuad(eye[0] + sx * 190, eye[1] + sy * 190, eye[2] + sz * 190, 18, [1.0, 0.94, 0.45, 1.0]);
    }
    /* 月亮（银白清冷，在太阳正对面） */
    if (-sy > -0.25) {
      this._drawBillboardQuad(eye[0] - sx * 190, eye[1] - sy * 190, eye[2] - sz * 190, 14, [0.92, 0.96, 1.0, 0.95]);
    }

    /* 3. 经典体素平顶浮云（Y=56 高度层） */
    this._renderClouds(opts);

    gl.depthMask(true);
  };

  Renderer.prototype._drawBillboardQuad = function (x, y, z, size, color) {
    var gl = this.gl;
    var hs = size * 0.5;
    /* 用视图矩阵的 right/up 基向量展开面片，保证始终正对相机 */
    var v = this.view;
    var rx = v[0] * hs, ry = v[4] * hs, rz = v[8] * hs;
    var ux = v[1] * hs, uy = v[5] * hs, uz = v[9] * hs;
    var q = this.billboardQuadArr;

    q[0]  = x - rx - ux; q[1]  = y - ry - uy; q[2]  = z - rz - uz;
    q[3]  = x + rx - ux; q[4]  = y + ry - uy; q[5]  = z + rz - uz;
    q[6]  = x + rx + ux; q[7]  = y + ry + uy; q[8]  = z + rz + uz;
    q[9]  = x - rx - ux; q[10] = y - ry - uy; q[11] = z - rz - uz;
    q[12] = x + rx + ux; q[13] = y + ry + uy; q[14] = z + rz + uz;
    q[15] = x - rx + ux; q[16] = y - ry + uy; q[17] = z - rz + uz;

    gl.uniform4f(this.locFlat.uColor, color[0], color[1], color[2], color[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyQuadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, q, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.locFlat.aPos);
    gl.vertexAttribPointer(this.locFlat.aPos, 3, gl.FLOAT, false, 12, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  Renderer.prototype._renderClouds = function (opts) {
    var gl = this.gl;
    var eye = opts.eye;
    var time = opts.time || 0;
    var sunLight = opts.sunLight !== undefined ? opts.sunLight : 1.0;
    var cloudY = 72.0;
    if (eye[1] > 69.0 && eye[1] < 75.0) return;

    var wind = time * 1.6;
    var tileSize = 24.0;
    var span = 4;
    var baseGridX = Math.floor((eye[0] + wind) / tileSize);
    var baseGridZ = Math.floor(eye[2] / tileSize);
    var arr = this.cloudArr;
    var ptr = 0;

    for (var gz = -span; gz <= span; gz++) {
      for (var gx = -span; gx <= span; gx++) {
        var tx = baseGridX + gx, tz = baseGridZ + gz;
        var h = MC.mulberry32((tx * 41 + tz * 79) & 0x7fffffff)();
        if (h > 0.42) continue;

        var x0 = tx * tileSize - wind;
        var z0 = tz * tileSize;
        var x1 = x0 + tileSize;
        var z1 = z0 + tileSize;

        if (ptr + 18 > arr.length) break;
        arr[ptr++] = x0; arr[ptr++] = cloudY; arr[ptr++] = z0;
        arr[ptr++] = x1; arr[ptr++] = cloudY; arr[ptr++] = z0;
        arr[ptr++] = x1; arr[ptr++] = cloudY; arr[ptr++] = z1;
        arr[ptr++] = x0; arr[ptr++] = cloudY; arr[ptr++] = z0;
        arr[ptr++] = x1; arr[ptr++] = cloudY; arr[ptr++] = z1;
        arr[ptr++] = x0; arr[ptr++] = cloudY; arr[ptr++] = z1;
      }
    }

    if (ptr === 0) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    var cAlpha = 0.55 * Math.min(1.0, sunLight + 0.2);
    gl.uniform4f(this.locFlat.uColor, 1.0, 1.0, 1.0, cAlpha);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyQuadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arr.subarray(0, ptr), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.locFlat.aPos);
    gl.vertexAttribPointer(this.locFlat.aPos, 3, gl.FLOAT, false, 12, 0);
    gl.drawArrays(gl.TRIANGLES, 0, ptr / 3);
    gl.disable(gl.BLEND);
  };

  /* ---------- 引信激发的 TNT 实体渲染 ---------- */
  Renderer.prototype._renderTNT = function (tntList) {
    var gl = this.gl;
    gl.useProgram(this.progFlat);
    gl.uniformMatrix4fv(this.locFlat.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.locFlat.uView, false, this.view);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tntBoxBuf);
    gl.enableVertexAttribArray(this.locFlat.aPos);
    gl.vertexAttribPointer(this.locFlat.aPos, 3, gl.FLOAT, false, 12, 0);

    for (var i = 0; i < tntList.length; i++) {
      var tnt = tntList[i];
      var flash = Math.floor(tnt.fuse * 9) % 2 === 0;
      var col = flash ? [1.0, 1.0, 1.0, 1.0] : [0.85, 0.22, 0.15, 1.0];
      gl.uniform4f(this.locFlat.uColor, col[0], col[1], col[2], col[3]);

      /* 借助 translate 平移 view 矩阵绘制单个方块 */
      var trView = this._translateView(this.view, tnt.x, tnt.y + 0.45, tnt.z);
      gl.uniformMatrix4fv(this.locFlat.uView, false, trView);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
  };

  Renderer.prototype._translateView = function (v, tx, ty, tz) {
    if (!this._tViewTmp) this._tViewTmp = new Float32Array(16);
    this._tViewTmp.set(v);
    this._tViewTmp[12] += v[0] * tx + v[4] * ty + v[8] * tz;
    this._tViewTmp[13] += v[1] * tx + v[5] * ty + v[9] * tz;
    this._tViewTmp[14] += v[2] * tx + v[6] * ty + v[10] * tz;
    return this._tViewTmp;
  };

  /* ---------- 3D 浮空自转掉落物渲染 ---------- */
  Renderer.prototype._renderDrops = function (dropList) {
    if (!dropList || dropList.length === 0) return;
    var gl = this.gl;
    gl.useProgram(this.progFlat);
    gl.uniformMatrix4fv(this.locFlat.uProj, false, this.proj);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tntBoxBuf);
    gl.enableVertexAttribArray(this.locFlat.aPos);
    gl.vertexAttribPointer(this.locFlat.aPos, 3, gl.FLOAT, false, 12, 0);

    for (var i = 0; i < dropList.length; i++) {
      var d = dropList[i];
      var def = MC.DEFS[d.id];
      var tileId = def ? (def.top !== undefined ? def.top : (def.side !== undefined ? def.side : 3)) : 3;
      var rgb = this.atlas.avgColor(tileId);
      gl.uniform4f(this.locFlat.uColor, rgb[0] * 1.1, rgb[1] * 1.1, rgb[2] * 1.1, 1.0);

      var trView = this._transformDropView(this.view, d.x, d.y + 0.15, d.z, d.rot || 0, 0.28);
      gl.uniformMatrix4fv(this.locFlat.uView, false, trView);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
  };

  Renderer.prototype._transformDropView = function (v, tx, ty, tz, rot, scale) {
    if (!this._dropViewTmp) this._dropViewTmp = new Float32Array(16);
    var out = this._dropViewTmp;
    out.set(v);
    out[12] += v[0] * tx + v[4] * ty + v[8] * tz;
    out[13] += v[1] * tx + v[5] * ty + v[9] * tz;
    out[14] += v[2] * tx + v[6] * ty + v[10] * tz;

    var c = Math.cos(rot) * scale, s = Math.sin(rot) * scale;
    var m0 = out[0], m2 = out[2], m4 = out[4], m6 = out[6], m8 = out[8], m10 = out[10];
    out[0] = m0 * c - m2 * s;
    out[2] = m0 * s + m2 * c;
    out[4] = m4 * c - m6 * s;
    out[6] = m4 * s + m6 * c;
    out[8] = m8 * c - m10 * s;
    out[10] = m8 * s + m10 * c;
    out[1] *= scale; out[5] *= scale; out[9] *= scale;
    return out;
  };

  MC.Renderer = Renderer;
})();
