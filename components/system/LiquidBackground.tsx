'use client';
/*!
Componentry WebGL Liquid — light background adaptation.
https://github.com/harshjdhv/componentry/blob/main/packages/ui/src/components/webgl-liquid.tsx
MIT License

Copyright (c) 2026 Harsh Jadhav

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_colorDeep;
uniform vec3 u_colorMid;
uniform vec3 u_colorHighlight;
uniform float u_speed;
uniform float u_flowStrength;
uniform float u_grain;
uniform float u_contrast;
uniform float u_opacity;
uniform float u_reveal;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.86, 0.51, -0.51, 0.86);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 applyContrast(vec3 c, float contrast) {
  return clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * (0.14 * u_speed);
  vec2 aspect = vec2(u_res.x / max(u_res.y, 1.0), 1.0);
  vec2 p = (uv - 0.5) * aspect;

  vec2 flowP = vec2(p.x * 1.1, p.y - t * 0.35);
  float n1 = fbm(flowP * 2.8 + vec2(0.0, t * 0.2));
  float n2 = fbm((flowP + n1 * 0.45) * 4.0 - vec2(0.0, t * 0.35));
  float n3 = fbm((flowP + n2 * 0.4) * 6.5 + vec2(t * 0.15, 0.0));

  float structure = n3 * 1.15 + (n2 - 0.5) * 0.5;
  structure += (n1 - 0.5) * 0.3 * u_flowStrength;

  float lowBand = smoothstep(0.25, 0.78, structure);
  float highBand = smoothstep(0.62, 0.95, structure);
  vec3 col = mix(u_colorDeep, u_colorMid, lowBand);
  col = mix(col, u_colorHighlight, highBand);

  float glow = smoothstep(0.52, 0.95, structure) * (0.35 + 0.5 * u_flowStrength);
  col = mix(col, u_colorHighlight, glow * 0.08);

  float verticalMask = (1.0 - smoothstep(0.05, 1.05, uv.y));
  verticalMask = pow(verticalMask, 1.1);

  float vignette = (1.0 - smoothstep(0.36, 1.28, length(uv - 0.5)));
  col *= mix(0.98, 1.0, vignette);

  col = applyContrast(col, u_contrast);

  float dither = (hash(gl_FragCoord.xy + t * 10.0) - 0.5) * u_grain;
  col += dither;

  float alpha = 1.0;
  alpha *= smoothstep(0.0, 0.28, u_reveal - uv.x);
  alpha *= u_opacity;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
}
`;

// The original shader is retained; the light palette avoids additive white clipping.
const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
export function LiquidBackground({ paused = false }: { paused?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(8);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (failed || !ref.current) return;
    const canvas = ref.current;
    const context = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'low-power' });
    if (!context) { setFailed(true); return; }
    const gl: WebGLRenderingContext = context;
    let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null, frame = 0, observer: ResizeObserver | undefined;
    const shaders: WebGLShader[] = [];
    function dispose() {
      cancelAnimationFrame(frame); observer?.disconnect();
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach(shader => gl.deleteShader(shader));
    }
    try {
      function compile(type: number, source: string) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Shader unavailable');
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
        return shader;
      }
      const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error('Program unavailable');
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program link failed');
      gl.useProgram(program);
      buffer = gl.createBuffer(); if (!buffer) throw new Error('Buffer unavailable');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const uniform = (name: string) => gl.getUniformLocation(program!, name);
      gl.uniform3fv(uniform('u_colorDeep'), rgb('#c8b5df'));
      gl.uniform3fv(uniform('u_colorMid'), rgb('#e4d7ef'));
      gl.uniform3fv(uniform('u_colorHighlight'), rgb('#faf9fc'));
      for (const [name, value] of Object.entries({u_speed:.85,u_flowStrength:.7,u_grain:0,u_contrast:1,u_opacity:.95,u_reveal:1.3})) gl.uniform1f(uniform(name), value);
      const resolution = uniform('u_res'), time = uniform('u_time');
      function draw() {
        gl.uniform1f(time, elapsed.current);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        canvas.dataset.time = elapsed.current.toFixed(3);
      }
      function resize() {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(1, 800 / Math.max(rect.width, rect.height, 1));
        canvas.width = Math.max(1, Math.round(rect.width * scale));
        canvas.height = Math.max(1, Math.round(rect.height * scale));
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform2f(resolution,canvas.width,canvas.height); draw();
      }
      resize(); canvas.dataset.renderer = 'webgl';
      observer = new ResizeObserver(resize); observer.observe(canvas);
      const reducedMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
      let previous = performance.now();
      function render(now: number) {
        if (now - previous >= 1000/30) {
          elapsed.current += Math.min((now - previous)/1000,.1); previous=now; draw();
        }
        frame=requestAnimationFrame(render);
      }
      function visibility() {
        cancelAnimationFrame(frame);
        canvas.dataset.mode = document.hidden ? 'hidden' : paused || reducedMedia.matches ? 'still' : 'running';
        if (!document.hidden && !paused && !reducedMedia.matches) { previous=performance.now(); frame=requestAnimationFrame(render); }
      }
      function contextLost(event: Event) { event.preventDefault(); setFailed(true); }
      canvas.addEventListener('webglcontextlost',contextLost);
      document.addEventListener('visibilitychange',visibility); reducedMedia.addEventListener('change',visibility); visibility();
      return () => { reducedMedia.removeEventListener('change',visibility); document.removeEventListener('visibilitychange',visibility); canvas.removeEventListener('webglcontextlost',contextLost); dispose(); };
    } catch { dispose(); setFailed(true); }
  }, [paused, reduced, failed]);
  return <div className="liquid-background" aria-hidden="true">{!failed && <canvas ref={ref}/>}</div>;
}
