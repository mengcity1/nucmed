/**
 * WebGL 背景色场（2026-11-04 v17）—— 真 shader，不是 CSS 渐变
 *
 * 为什么这么做：CSS 的 radial-gradient 是**静态**的，玻璃叠上去"透"到的是死色；
 * 用片元着色器画一个**极慢流动**的柔光场，卡片的 backdrop-filter 采到的是活颜色，
 * 边缘才会出现"光在玻璃里走"的错觉（这是任何纯 CSS 方案拿不到的）。
 *
 * 约束（逐条都为了不拖累这个 1.7 MB 首屏 / 217 MB 图集的站）：
 *  - 单 canvas、单 context、全屏一个 quad；
 *  - DPR 上限 1.5，尺寸变化去抖 200ms；
 *  - 页面隐藏即停 rAF；`prefers-reduced-motion` 只画一帧（静止）；
 *  - ≤640px 直接不启用（移动端省电）；
 *  - WebGL 不可用 ⇒ 返回 null，原 CSS 背景原样保留（零风险回退）。
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

// 柔光球：指数衰减，没有硬边
float blob(vec2 uv, vec2 c, vec2 s) {
  vec2 d = (uv - c) * s;
  return exp(-dot(d, d) * 3.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.035;

  // 四个极慢漂移的光球（暖橙 / 淡紫 / 薄荷 / 天蓝），振幅只有 ~4%
  vec2 c0 = vec2(0.14 + 0.035 * sin(t * 0.9), 0.08 + 0.03 * cos(t * 0.7));
  vec2 c1 = vec2(0.88 + 0.03 * cos(t * 0.6), 0.05 + 0.035 * sin(t * 0.8));
  vec2 c2 = vec2(0.55 + 0.04 * sin(t * 0.5 + 1.7), 0.96 + 0.03 * cos(t * 0.9));
  vec2 c3 = vec2(0.97 + 0.03 * sin(t * 0.7 + 2.1), 0.72 + 0.04 * cos(t * 0.6));

  float w0 = blob(uv, c0, vec2(1.05, 1.45));
  float w1 = blob(uv, c1, vec2(1.15, 1.5));
  float w2 = blob(uv, c2, vec2(1.0, 1.35));
  float w3 = blob(uv, c3, vec2(1.3, 1.6));

  // 近白底（与 CSS #fbfbfd 对齐）
  vec3 col = vec3(0.984, 0.984, 0.992);
  col = mix(col, vec3(1.000, 0.870, 0.800), w0 * 0.26);   // 暖橙
  col = mix(col, vec3(0.845, 0.840, 1.000), w1 * 0.24);   // 淡紫
  col = mix(col, vec3(0.800, 0.945, 0.910), w2 * 0.22);   // 薄荷
  col = mix(col, vec3(0.800, 0.890, 1.000), w3 * 0.20);   // 天蓝

  // 抖动：消除大面积渐变的条带（1/255 量级）
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += dither * (1.5 / 255.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function mountBackgroundShader(): (() => void) | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia?.("(max-width: 640px)").matches) return null;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block";
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const resize = () => {
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };

  const t0 = performance.now();
  const draw = (now: number) => {
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  document.body.appendChild(canvas);
  document.documentElement.classList.add("has-gl-bg");
  resize();

  let raf = 0;
  let last = 0;
  const loop = (now: number) => {
    // 限到 ~30fps：背景是慢速流体，30 帧完全够，省一半 GPU
    if (now - last >= 33) {
      last = now;
      draw(now);
    }
    raf = requestAnimationFrame(loop);
  };

  const onVisibility = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (!reduce && !raf) {
      raf = requestAnimationFrame(loop);
    }
  };

  let rt = 0;
  const onResize = () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      resize();
      draw(performance.now());
    }, 200);
  };

  if (reduce) {
    draw(performance.now());
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVisibility);
  }
  window.addEventListener("resize", onResize, { passive: true });

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.clearTimeout(rt);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    document.documentElement.classList.remove("has-gl-bg");
    canvas.remove();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
