// ---------- Smooth scrolling (Lenis) ----------
const lenis = new Lenis();
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ---------- Tagline comes into focus word by word, once, after the page loads ----------
// (Only opacity and blur are animated: the letters' transform belongs to the cursor effect.)
const tagline = document.getElementById("tagline");
function introTagline() {
  if (!tagline) return;
  tagline.classList.add("shown");
  let word = 0;
  tagline.querySelectorAll(".ch").forEach((letter) => {
    if (letter.textContent === " ") { word++; return; }
    letter.animate(
      [{ opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)" }],
      { duration: 900, delay: 450 + word * 70, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" }
    );
  });
}

// ---------- Section index on project pages (markup) ----------
// Built from each project page's section headings, so new sections show up on
// their own. Built here, before Variable Proximity below splits text into
// letters, so the index names get the same cursor-weight effect.
// Behaviour (show/hide, current section, jumping) is in the "Section index" part
// near the end.
const caseIndexes = [...document.querySelectorAll(".view--project")].map((view) => {
  const sections = [...view.querySelectorAll(".case-section")];
  if (!sections.length) return null;
  const nav = document.createElement("nav");
  nav.className = "case-index";
  nav.setAttribute("aria-label", "sections");
  nav.innerHTML = `<button class="case-index-toggle" type="button" aria-expanded="false">sections</button><ol class="case-index-list"></ol>`;
  const list = nav.querySelector("ol");
  const items = sections.map((sec) => {
    const name = sec.querySelector(".case-heading").textContent.trim();
    sec.id = `${view.id.replace(/-view$/, "")}-${name.replace(/\W+/g, "-")}`;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vp";
    Object.assign(btn.dataset, { from: "500", to: "800", radius: "70", pull: "0.08" });
    btn.textContent = name;
    li.appendChild(btn);
    list.appendChild(li);
    return { sec, btn };
  });
  view.appendChild(nav);
  return { view, nav, items, sheet: view.querySelector(".case-sheet"), active: null };
}).filter(Boolean);

// ---------- Variable Proximity ----------
// Plain-JS version of the React Bits "Variable Proximity" effect:
// each letter gets heavier the closer the cursor is to it.
const mouse = { x: -9999, y: -9999 };
window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener("touchmove", (e) => {
  const t = e.touches[0];
  mouse.x = t.clientX; mouse.y = t.clientY;
}, { passive: true });

const groups = [...document.querySelectorAll(".vp")].map((el) => {
  const text = el.textContent;
  el.setAttribute("aria-label", text);
  el.textContent = "";
  const from = Number(el.dataset.from);
  // each word's letters sit in a .vp-word wrapper, so a long label wraps
  // between words, never mid-word (the spaces stay outside, as break points)
  const letters = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    const isSpace = /^\s+$/.test(part);
    const holder = isSpace ? el : el.appendChild(document.createElement("span"));
    if (!isSpace) { holder.className = "vp-word"; holder.setAttribute("aria-hidden", "true"); }
    for (const char of part) {
      const span = document.createElement("span");
      span.className = "ch";
      span.setAttribute("aria-hidden", "true");
      span.textContent = char;
      holder.appendChild(span);
      letters.push({ span, weight: from, x: 0, y: 0, vx: 0, vy: 0 });
    }
  }
  return {
    el, letters, from,
    to: Number(el.dataset.to),
    radius: Number(el.dataset.radius),
    pull: Number(el.dataset.pull), // how far letters are tugged toward the cursor
  };
});

// "Sticky" feel: letters are pulled toward the cursor and spring back
// with a little overshoot when it leaves.
const STIFFNESS = 0.06; // higher = snappier
const DAMPING = 0.82;   // lower = more wobble

// Performance: every position is READ first, then every style is WRITTEN, so the
// browser lays the page out once per frame (reading right after writing forces a
// fresh layout, which per letter made the whole site lag). Text that's hidden,
// off screen, or resting with the cursor far away is skipped entirely.
function isSettled(g) {
  return g.letters.every((l) =>
    Math.abs(l.weight - g.from) < 0.5 && Math.abs(l.x) < 0.05 && Math.abs(l.y) < 0.05 &&
    Math.abs(l.vx) < 0.05 && Math.abs(l.vy) < 0.05);
}

function animate() {
  const vh = window.innerHeight;
  const active = [];

  // ---- read phase: no style changes in here ----
  for (const g of groups) {
    const box = g.el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;                  // on a hidden page
    if (box.bottom < -g.radius || box.top > vh + g.radius) continue;    // off screen
    const near = mouse.x > box.left - g.radius && mouse.x < box.right + g.radius &&
                 mouse.y > box.top - g.radius && mouse.y < box.bottom + g.radius;
    if (!near && g.settled) continue;                                   // resting: nothing to do
    g.settled = false;
    // resting centre of each letter (minus the offset we've already applied)
    const centres = near
      ? g.letters.map((l) => { const r = l.span.getBoundingClientRect(); return [r.left + r.width / 2 - l.x, r.top + r.height / 2 - l.y]; })
      : null;                                                           // far away: falloff is 0 anyway
    active.push([g, centres]);
  }

  // ---- write phase ----
  for (const [g, centres] of active) {
    g.letters.forEach((l, i) => {
      let dx = 0, dy = 0, falloff = 0;
      if (centres) {
        dx = mouse.x - centres[i][0];
        dy = mouse.y - centres[i][1];
        falloff = Math.max(0, 1 - Math.hypot(dx, dy) / g.radius);
      }

      // weight
      const target = g.from + (g.to - g.from) * falloff;
      l.weight += (target - l.weight) * 0.2;

      // stickiness: spring toward a point partway to the cursor
      const tx = dx * falloff * g.pull;
      const ty = dy * falloff * g.pull;
      l.vx = (l.vx + (tx - l.x) * STIFFNESS) * DAMPING;
      l.vy = (l.vy + (ty - l.y) * STIFFNESS) * DAMPING;
      l.x += l.vx;
      l.y += l.vy;
    });
    if (!centres && isSettled(g)) {            // snap exactly to rest, then stop updating it
      g.letters.forEach((l) => { l.weight = g.from; l.x = l.y = l.vx = l.vy = 0; });
      g.settled = true;
    }
    for (const l of g.letters) {
      l.span.style.fontVariationSettings = `'wght' ${l.weight.toFixed(1)}`;
      l.span.style.transform = l.x || l.y ? `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px)` : "";
    }
  }
  requestAnimationFrame(animate);
}

// Corner rounding scales with the text size: the name, and the section
// headings on project pages (each has its own filter, since they differ in size).
function updateRounding() {
  [[".name", "round-blur"], [".case-heading", "round-head-blur"]].forEach(([sel, blurId]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    document.getElementById(blurId).setAttribute("stdDeviation", (size * 0.016).toFixed(2));
  });
}
window.addEventListener("resize", updateRounding);
updateRounding();

// Wait for Acumin to load, then pin the left edge so growing letters
// don't shift the whole block around.
document.fonts.ready.then(() => {
  pinLockup();
  introTagline();
  requestAnimationFrame(animate);
});

// ---------- Video background ----------
const bgVideo = document.getElementById("bg-video");

// No sound, ever.
bgVideo.muted = true;
bgVideo.defaultMuted = true;

// Play at half speed.
bgVideo.playbackRate = 0.5;
bgVideo.addEventListener("loadedmetadata", () => { bgVideo.playbackRate = 0.5; });

// ---------- Colourways: pick the background video ----------
// The swatches in the nav swap the clip; each colourway's tint lives in
// style.css (:root[data-colourway=…]). The choice is remembered in this
// browser, and a tiny script in <head> applies it before the page paints.
const COLOURWAYS = {
  aquarium: "assets/aquarium.mp4",
  dark: "assets/dark.mp4",
};
const bgEl = document.querySelector(".bg");
const cwButtons = [...document.querySelectorAll(".cw")];

function setColourway(name, animate) {
  if (!COLOURWAYS[name]) name = "aquarium";
  document.documentElement.dataset.colourway = name;
  cwButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cw === name)));
  try { localStorage.setItem("colourway", name); } catch (e) { /* private mode: just don't remember */ }

  const src = COLOURWAYS[name];
  if (bgVideo.getAttribute("src") === src) return;
  if (!animate) { bgVideo.src = src; return; }

  // dip the footage out (the tint stays), swap the clip, fade the new one in
  bgEl.classList.add("swapping");
  setTimeout(() => {
    bgVideo.src = src;
    bgVideo.play().catch(() => {});
    const reveal = () => bgEl.classList.remove("swapping");
    bgVideo.addEventListener("playing", reveal, { once: true });
    setTimeout(reveal, 2500);                    // never stay hidden if "playing" is slow
  }, 450);
}
cwButtons.forEach((b) => b.addEventListener("click", () => setColourway(b.dataset.cw, true)));
setColourway(document.documentElement.dataset.colourway, false);

bgVideo.play().catch(() => { /* autoplay blocked: the blue background stays */ });

// Blur is gentle in the middle of the clip and ramps up at the very start and
// very end, so the jump when it loops is hidden.
const BLUR_BASE = 4;   // px, during the clip
const BLUR_PEAK = 16;  // px, at the loop point
const RAMP = 1.2;      // seconds of video over which the blur ramps

// Whichever element is showing the footage gets the blur (the water canvas
// takes over from the video once it's running).
let blurTarget = bgVideo;

function updateVideoBlur() {
  const d = bgVideo.duration;
  if (d && isFinite(d)) {
    const t = bgVideo.currentTime;
    const edge = Math.min(t, d - t);                    // seconds from nearest end
    const k = Math.max(0, 1 - edge / Math.min(RAMP, d / 2));
    const eased = k * k * (3 - 2 * k);                  // smoothstep
    const f = `blur(${(BLUR_BASE + (BLUR_PEAK - BLUR_BASE) * eased).toFixed(1)}px)`;
    if (blurTarget.style.filter !== f) blurTarget.style.filter = f;   // only touch it when it changes
  }
  requestAnimationFrame(updateVideoBlur);
}
requestAnimationFrame(updateVideoBlur);

// ---------- Water ripples ----------
// The video is redrawn on a WebGL canvas (#bg-water) through a simulated water
// surface, so the footage warps softly around the cursor — no light or lines
// drawn on top. Moving leaves a short wake; clicking/tapping drops a splash.
// Needs the browser to share the video's pixels, so when index.html is opened
// straight from disk the plain video stays and there are no ripples.
(function waterRipples() {
  const bg = document.querySelector(".bg");
  const canvas = document.getElementById("bg-water");

  const CELL = 6;          // css px per simulation cell (bigger = broader, smoother waves)
  const DAMPING = 0.95;    // how quickly ripples fade (closer to 1 = longer, spreads further)
  const REFRACT = 0.035;   // how much the waves bend the footage
  const TRAIL_AMP = 0.3;   // strength of the cursor wake
  const SPLASH_AMP = 1.2;  // strength of a click splash
  const ZOOM = 1.12;       // must match the scale() on .bg canvas in style.css

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
  if (!gl) return;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, `
    attribute vec2 a;
    varying vec2 vUv;
    void main() {
      vUv = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); // y = 0 at the top
      gl_Position = vec4(a, 0.0, 1.0);
    }`);
  // Slopes arrive as a 2-channel texture (x in .r, y in .a), centred on 0.5.
  const fs = compile(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D uSlope;
    uniform sampler2D uVideo;
    uniform vec2 uCover;
    uniform float uRefract;
    varying vec2 vUv;
    void main() {
      vec4 t = texture2D(uSlope, vUv);
      vec2 slope = vec2(t.r, t.a) * 2.0 - 1.0;
      vec2 uv = (vUv - 0.5) * uCover + 0.5;   // object-fit: cover
      gl_FragColor = vec4(texture2D(uVideo, uv + slope * uRefract).rgb, 1.0);
    }`);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  const makeTex = (unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  makeTex(0); // slopes
  makeTex(1); // video
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U("uSlope"), 0);
  gl.uniform1i(U("uVideo"), 1);
  gl.uniform1f(U("uRefract"), REFRACT);

  // --- water surface simulation (CPU, low resolution) ---
  let W = 0, H = 0, gw = 0, gh = 0;
  let cur, prev, slopes;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;   // the footage is blurred, so 1x resolution is plenty
    canvas.height = H;
    gl.viewport(0, 0, W, H);
    gw = Math.ceil(W / CELL) + 2;
    gh = Math.ceil(H / CELL) + 2;
    cur = new Float32Array(gw * gh);
    prev = new Float32Array(gw * gh);
    slopes = new Uint8Array(gw * gh * 2).fill(128);
    uploadSlopes();
    updateCover();
  }

  function updateCover() {
    const vw = bgVideo.videoWidth, vh = bgVideo.videoHeight;
    if (!vw || !vh || !W) { gl.uniform2f(U("uCover"), 1, 1); return; }
    const a = W / H, v = vw / vh;
    if (a > v) gl.uniform2f(U("uCover"), 1, v / a);
    else gl.uniform2f(U("uCover"), a / v, 1);
  }
  bgVideo.addEventListener("loadedmetadata", updateCover);

  function step() {
    for (let y = 1; y < gh - 1; y++) {
      const row = y * gw;
      for (let x = 1; x < gw - 1; x++) {
        const i = row + x;
        prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - gw] + cur[i + gw]) * 0.5 - prev[i]) * DAMPING;
      }
    }
    const t = cur; cur = prev; prev = t;
  }

  // Slopes are worked out here in full precision, then packed into bytes.
  const pack = (s) => (s > 1 ? 255 : s < -1 ? 0 : (s * 127.5 + 127.5) | 0);
  function uploadSlopes() {
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const sx = x > 0 && x < gw - 1 ? (cur[i + 1] - cur[i - 1]) * 0.5 : 0;
        const sy = y > 0 && y < gh - 1 ? (cur[i + gw] - cur[i - gw]) * 0.5 : 0;
        slopes[i * 2] = pack(sx);
        slopes[i * 2 + 1] = pack(sy);
      }
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, gw, gh, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, slopes);
  }

  // Push the surface down in a soft round dip around (cx, cy) in grid cells.
  function drop(cx, cy, radius, amp) {
    const r = Math.ceil(radius);
    for (let y = Math.max(1, Math.floor(cy) - r); y <= Math.min(gh - 2, Math.ceil(cy) + r); y++) {
      for (let x = Math.max(1, Math.floor(cx) - r); x <= Math.min(gw - 2, Math.ceil(cx) + r); x++) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d < 1) cur[y * gw + x] -= amp * 0.5 * (1 + Math.cos(Math.PI * d));
      }
    }
    lastInput = performance.now();
  }

  // Viewport px → grid cells (the canvas is zoomed around its centre).
  const toGrid = (px, py) => [
    ((px - W / 2) / ZOOM + W / 2) / CELL + 1,
    ((py - H / 2) / ZOOM + H / 2) / CELL + 1,
  ];

  // --- input ---
  let lastX = null, lastY = null, lastInput = -Infinity;

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return; // touch gets splashes on tap instead
    const [gx, gy] = toGrid(e.clientX, e.clientY);
    if (lastX !== null) {
      // Faster strokes make a stronger wake; drops are laid ~3 cells apart.
      const dist = Math.hypot(gx - lastX, gy - lastY);
      const amp = TRAIL_AMP * Math.min(1, 0.4 + dist * 0.06);
      const n = Math.min(12, Math.floor(dist / 3));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        drop(lastX + (gx - lastX) * t, lastY + (gy - lastY) * t, 4, amp);
      }
      if (n === 0) return; // tiny move: wait until it adds up to a full gap
    }
    lastX = gx; lastY = gy;
  }, { passive: true });

  document.addEventListener("pointerleave", () => { lastX = lastY = null; });

  window.addEventListener("pointerdown", (e) => {
    const [gx, gy] = toGrid(e.clientX, e.clientY);
    drop(gx, gy, 7, SPLASH_AMP);
  }, { passive: true });

  // --- render loop ---
  let lastVideoTime = -1, acc = 0, lastFrame = performance.now(), settled = true;

  function frame(now) {
    // Copy a new video frame into the texture when the video has moved on.
    let fresh = false;
    if (bgVideo.readyState >= 2 && bgVideo.currentTime !== lastVideoTime) {
      lastVideoTime = bgVideo.currentTime;
      gl.activeTexture(gl.TEXTURE1);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bgVideo);
      } catch (err) {
        // Browser won't share the video (e.g. opened from disk): keep the
        // plain video and stop.
        bg.classList.remove("water");
        blurTarget = bgVideo;
        return;
      }
      fresh = true;
      if (!bg.classList.contains("water")) {
        updateCover();
        bg.classList.add("water");
        canvas.style.filter = bgVideo.style.filter;
        blurTarget = canvas;
      }
    }

    // Step the water at a fixed 60 steps/s so it behaves the same on any screen.
    acc += Math.min(100, now - lastFrame);
    lastFrame = now;
    let moved = false;
    if (now - lastInput < 3000) {          // waves have died out by then
      settled = false;
      while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
      uploadSlopes();
      moved = true;
    } else {
      acc = 0;
      if (!settled) { cur.fill(0); prev.fill(0); uploadSlopes(); settled = true; moved = true; }
    }

    if ((fresh || moved) && bg.classList.contains("water")) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", () => { resize(); if (bg.classList.contains("water")) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); });
  requestAnimationFrame(frame);
})();

// ---------- Custom cursor ----------
// A small bubble replaces the arrow on mouse/trackpad. It swells over anything
// clickable, pops (and instantly reforms) on click, turns blue over the white
// work sheet, and steps aside for the text cursor in form fields. Now and then
// a tiny bubble breaks off and floats up while moving over the video.
(function customCursor() {
  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  const bubble = document.createElement("div");
  bubble.className = "cursor-bubble";
  cursor.appendChild(bubble);
  document.body.appendChild(cursor);

  const CLICKABLE = "a, button, label, summary, select, mark.hl, [role='button'], .project";
  const TEXT = "input:not([type='checkbox']):not([type='radio']), textarea";
  const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

  const DRIFT_EVERY = 260;   // px of cursor travel between chances of a drift bubble
  const DRIFT_CHANCE = 0.5;  // odds a bubble actually appears at each chance
  const DRIFT_MAX = 3;       // most drift bubbles on screen at once

  let x = 0, y = 0, travelled = 0, drifting = 0;

  function spawn(className, size, cx, cy) {
    const el = document.createElement("div");
    el.className = className;
    el.style.width = el.style.height = `${size}px`;
    el.style.left = `${cx - size / 2}px`;
    el.style.top = `${cy - size / 2}px`;
    document.body.appendChild(el);
    return el;
  }

  function drift() {
    if (drifting >= DRIFT_MAX) return;
    const size = 4 + Math.random() * 4;
    const el = spawn("cursor-drift", size, x + (Math.random() - 0.5) * 14, y - 6);
    const rise = 45 + Math.random() * 35;
    const sway = (Math.random() - 0.5) * 16;
    drifting++;
    el.animate([
      { transform: "translate(0, 0) scale(0.4)", opacity: 0 },
      { transform: `translate(${sway * 0.4}px, ${-rise * 0.25}px) scale(1)`, opacity: 0.9, offset: 0.2 },
      { transform: `translate(${-sway * 0.3}px, ${-rise * 0.65}px) scale(1)`, opacity: 0.6, offset: 0.65 },
      { transform: `translate(${sway}px, ${-rise}px) scale(0.9)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: "ease-out" })
      .finished.then(() => { el.remove(); drifting--; });
  }

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    document.documentElement.classList.add("has-cursor");
    if (cursor.classList.contains("shown")) travelled += Math.hypot(e.clientX - x, e.clientY - y);
    x = e.clientX;
    y = e.clientY;
    cursor.style.transform = `translate(${x}px, ${y}px)`;

    const t = e.target instanceof Element ? e.target : null;
    const inText = !!t?.closest(TEXT);
    const onSheet = !!t?.closest(".contents, .case-sheet, .matrix, .case-index, .case-hero--light"); // the white sheets + light hero photos (isogu's hero keeps the white cursor: Sam's call)
    cursor.classList.toggle("hover", !!t?.closest(CLICKABLE));
    cursor.classList.toggle("text", inText);
    cursor.classList.toggle("light", onSheet);
    cursor.classList.add("shown");

    // Only over the video, and only now and then.
    if (travelled > DRIFT_EVERY) {
      travelled = 0;
      if (!onSheet && !inText && !t?.closest(".lightbox") && Math.random() < DRIFT_CHANCE) drift();
    }
  }, { passive: true });

  // Click: the bubble pops into a spreading ring and a new one forms.
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || cursor.classList.contains("text")) return;
    const size = bubble.offsetWidth;
    const ring = spawn("cursor-pop" + (cursor.classList.contains("light") ? " light" : ""), size, e.clientX, e.clientY);
    ring.animate([
      { transform: "scale(1)", opacity: 0.9 },
      { transform: "scale(2)", opacity: 0 },
    ], { duration: 420, easing: EASE }).finished.then(() => ring.remove());
    bubble.animate([
      { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
    ], { duration: 380, delay: 60, easing: EASE, fill: "backwards" });
  });

  document.addEventListener("pointerleave", () => cursor.classList.remove("shown"));
  window.addEventListener("blur", () => cursor.classList.remove("shown"));
})();

// ---------- Contents page ----------
const projects = [...document.querySelectorAll(".project")];

// Reveal each project the first time it scrolls into view.
const revealer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); }
  }
}, { threshold: 0.25 });
projects.forEach((p) => revealer.observe(p));
// anything marked data-reveal (used on the about page) fades up the same way
document.querySelectorAll("[data-reveal]").forEach((el) => revealer.observe(el));

// Parallax: each project drifts at its own speed (data-speed) so the two
// columns slide past each other as you scroll.
projects.forEach((p) => { p.dy = 0; });
function updateParallax() {
  if (document.getElementById("home-view")?.hidden) return; // about view is showing
  const vh = window.innerHeight;
  for (const p of projects) {
    const speed = Number(p.dataset.speed) || 0;
    if (!speed) continue;
    const r = p.getBoundingClientRect();
    const restCenter = r.top + r.height / 2 - p.dy;   // where it would sit with no shift
    p.dy = (restCenter - vh / 2) * speed;
    p.style.transform = `translate3d(0, ${p.dy.toFixed(1)}px, 0)`;
  }
}
lenis.on("scroll", updateParallax);
window.addEventListener("resize", updateParallax);
updateParallax();

// ---------- Navigation ----------
const nav = document.querySelector(".nav");
const contentsSheet = document.querySelector(".contents");
const homeIcon = document.querySelector(".home");

const homeView = document.getElementById("home-view");
const aboutView = document.getElementById("about-view");
const navAbout = document.getElementById("nav-about");
const navWork = document.getElementById("nav-work");

// Every page besides home, by its hash. Project pages are the .view--project
// blocks (id "<name>-view" → "#<name>"), so a new project only needs markup.
const pages = { "#about": aboutView };
document.querySelectorAll(".view--project").forEach((v) => {
  pages["#" + v.id.replace(/-view$/, "")] = v;
});
let current = null;                       // the page showing, or null for home
const isAbout = () => current === aboutView;

// what slides in, one after another, when a page arrives
function entranceItems(view) {
  return view === aboutView
    ? view.querySelectorAll(".about-photo, .about-text > *")
    : view.querySelector(".case-hero")
      ? view.querySelectorAll(".case-logo, .kove-spill")   // the logo (and kove's cut-out) trail the photo
      : view.querySelectorAll(".soon-text > *, .soon-photo");   // "coming soon" pages
}

// Pin the name block's width so letters getting heavier don't shift it around.
// Measured only while the home view is visible (a hidden view measures 0 wide),
// and stored in em so it scales with the text when the window is resized.
function pinLockup() {
  const lockup = document.getElementById("lockup");
  if (!lockup || homeView.hidden) return;
  lockup.style.width = "";
  const size = parseFloat(getComputedStyle(lockup).fontSize);
  lockup.style.width = `${lockup.getBoundingClientRect().width / size}em`;
}

// The nav turns dark when it sits over something light: the white contents
// page, or a full project page (light hero photo, then its white sheet).
// "Coming soon" pages sit on the video, so the nav stays white there.
function updateNav() {
  const onSheet = !current && contentsSheet.getBoundingClientRect().top <= 40;
  // a project with a hero photo is light from the top; a "coming soon"-style page
  // (on the video) turns dark once its white sheet reaches the nav
  const sheet = current && current.querySelector(".case-sheet");
  const onProject = !!current && (!!current.querySelector(".case-hero") || (!!sheet && sheet.getBoundingClientRect().top <= 40));
  nav.classList.toggle("on-light", onSheet || onProject);
  homeIcon.classList.toggle("on-light", onSheet || onProject);
  // once the work page covers the screen, the top nav tucks away (it's in the footer)
  nav.classList.toggle("tucked", onSheet);
}
lenis.on("scroll", updateNav);
window.addEventListener("resize", updateNav);

// The current section's nav link sits a little heavier at rest:
// "about" on the about page, "work" on a project page.
function setCurrent(link, on) {
  if (on) link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");
  const g = groups.find((g) => g.el === link);
  if (g) { g.from = on ? 800 : 600; g.settled = false; }
}
function markCurrent() {
  setCurrent(navAbout, current === aboutView);
  setCurrent(navWork, !!current && current !== aboutView);
  const name = current === aboutView ? "about" : current && current.dataset.title;
  document.title = name ? `${name} – samantha cho` : "samantha cho";
}

// ---------- Router: slide between home, about and the project pages ----------
// All views live in one page so the background video never restarts.
// Going to a page: whatever's showing slides out to the left, the page slides in
// from the right. Going home: the reverse.
const SLIDE = { duration: 900, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" };
let busy = false;
let savedHomeY = 0;

function fixInPlace(el, top) {
  Object.assign(el.style, { position: "fixed", top: `${top}px`, left: "0", right: "0", zIndex: "1" });
}
function release(el) {
  el.getAnimations().forEach((a) => a.cancel());
  Object.assign(el.style, { position: "", top: "", left: "", right: "", zIndex: "" });
}
function jumpTo(y) {
  lenis.resize();
  lenis.scrollTo(y, { immediate: true, force: true });
}
function homeTarget(hash) {
  if (hash === "#work") return contentsSheet.getBoundingClientRect().top + window.scrollY;
  return 0;
}
// A project page with a hero photo covers the background completely, so the
// video (and the water + blur drawn from it) pauses there to save work; it
// picks up again as soon as you head back to a page that shows it.
function syncBackground() {
  const covered = !!current && !!current.querySelector(".case-hero") && !busy;
  if (covered) { if (!bgVideo.paused) bgVideo.pause(); }
  else if (bgVideo.paused) bgVideo.play().catch(() => {});
}
function refresh() { updateNav(); updateParallax(); updateCaseIndex(); syncBackground(); }

async function showPage(view, animate) {
  const from = current;
  if (from === view) return;
  if (!from) savedHomeY = window.scrollY;      // remember where you were on home
  const leaving = from || homeView;
  if (from) fixInPlace(from, -window.scrollY); // freeze the old page where it is
  current = view;
  if (!view.querySelector(".case-hero")) syncBackground();   // e.g. about: it sits on the video
  view.hidden = false;
  markCurrent();
  updateNav();
  if (!animate) { leaving.hidden = true; release(leaving); jumpTo(0); refresh(); return; }

  busy = true; lenis.stop();
  fixInPlace(view, 0);
  view.style.zIndex = "2";
  const out = leaving.animate([{ transform: "none" }, { transform: "translateX(-100%)" }], SLIDE);
  // a project's hero photo pushes in alongside, like the next page of a book
  const hero = view.querySelector(".case-hero");
  if (hero) hero.animate([{ transform: "translateX(100%)" }, { transform: "none" }], { ...SLIDE, fill: "backwards" });

  // Each element slides in on its own, in reading order. The gaps shrink as
  // it goes (uneven, not a metronome), so it reads as one swoop, not a queue.
  // (on a project page, the logo waits a little longer so it trails the photo)
  const delays = hero ? [300, 420] : [120, 200, 270, 325, 370, 405, 435, 460];
  entranceItems(view).forEach((el, i) => {
    if (el.hasAttribute("data-reveal")) el.classList.add("in"); // the slide is their entrance
    el.animate(
      [{ transform: "translateX(70vw)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 1000, delay: delays[Math.min(i, delays.length - 1)],
        easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" }
    );
  });

  await out.finished;                           // free the page once the old one is gone; items keep settling
  leaving.hidden = true;
  jumpTo(0);
  release(leaving); release(view);
  lenis.start(); busy = false; refresh();
}

async function showHome(hash, fromHistory, animate) {
  const from = current;
  if (!from) { lenis.scrollTo(homeTarget(hash)); return; }  // already home: just glide
  fixInPlace(from, -window.scrollY);            // freeze the page where it is
  current = null;
  syncBackground();                             // video back on before home slides in
  homeView.hidden = false;
  pinLockup();                                  // measure now that home is visible again
  // back button: land exactly where you were (e.g. next to the card you clicked)
  const y = fromHistory ? savedHomeY : homeTarget(hash);
  jumpTo(y);
  updateNav();                                  // nav colour follows the page coming in
  if (!animate) { from.hidden = true; release(from); markCurrent(); refresh(); return; }

  busy = true; lenis.stop();
  const inn = homeView.animate([{ transform: "translateX(-100%)" }, { transform: "none" }], SLIDE);
  const out = from.animate([{ transform: "none" }, { transform: "translateX(100%)" }], SLIDE);
  await Promise.all([out.finished, inn.finished]);
  from.hidden = true;
  release(homeView); release(from);
  markCurrent();
  lenis.start(); busy = false; refresh();
}

// "contact": slide over to the about page (if needed), then glide down to the form
const contactSection = document.getElementById("contact");
async function showContact(animate) {
  const wasAbout = isAbout();
  await showPage(aboutView, animate);
  // let the page land for a beat so the slide and the scroll read as two moves
  if (animate && !wasAbout) await new Promise((r) => setTimeout(r, 150));
  // the about page was pinned in place during the slide, so Lenis still thinks the
  // page is short; re-measure first or it can't scroll down
  lenis.resize();
  lenis.scrollTo(contactSection, {
    offset: -window.innerHeight * 0.12,
    immediate: !animate,
    force: true,
    duration: wasAbout ? 0.9 : 1.1,
    easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // ease in-out
  });
}

function route(hash, fromHistory, animate = true) {
  const page = pages[hash];
  if (page) {
    if (current === page) lenis.scrollTo(0);    // already there: glide back to the top
    else showPage(page, animate);
  }
  else if (hash === "#contact") showContact(animate);
  else showHome(hash, fromHistory, animate);
}

// nav links, the ray icon, project cards: change the URL and slide, without reloading
document.querySelectorAll('.nav a, .foot-nav a, a.home, a.back, a.case-link, a.project:not([href="#"])').forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (busy) return;
    const hash = a.getAttribute("href") === "#" ? "" : a.getAttribute("href");
    if (hash !== location.hash) history.pushState(null, "", hash || location.pathname);
    route(hash, false);
  });
});

// placeholder links (projects without a page yet) don't go anywhere; keep them
// from changing the URL and sending you back to the top
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href="#"]');
  if (a && !a.matches(".home")) e.preventDefault();
});

// browser back / forward buttons
window.addEventListener("popstate", () => { if (!busy) route(location.hash, true); });

// opened directly at a page (e.g. index.html#about, #isogu, or the old about.html link)
if (pages[location.hash] || location.hash === "#contact") route(location.hash, false, false);
markCurrent();
updateNav();

/* ---------- contact form ----------
   Sends through Web3Forms, which forwards the message to your inbox,
   so your email address never appears on the page. */
const contactForm = document.getElementById("contact-form");
if (contactForm) {
  const status = contactForm.querySelector(".form-status");
  const sendBtn = contactForm.querySelector(".send");
  const key = contactForm.dataset.key;

  // clear the red outline as soon as someone fixes a field
  contactForm.addEventListener("input", (e) => {
    e.target.closest(".field")?.classList.remove("invalid");
  });

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // check fields ourselves so the messages match the site's tone
    let firstBad = null;
    contactForm.querySelectorAll("input[required], textarea[required]").forEach((f) => {
      const bad = !f.value.trim() || (f.type === "email" && !f.checkValidity());
      f.closest(".field").classList.toggle("invalid", bad);
      if (bad && !firstBad) firstBad = f;
    });
    if (firstBad) {
      status.textContent = "please fill in all three boxes (with a real email!)";
      firstBad.focus();
      return;
    }
    if (!key || key === "YOUR_WEB3FORMS_KEY") {
      status.textContent = "the form isn't hooked up yet, check back soon!";
      return;
    }

    const data = Object.fromEntries(new FormData(contactForm));
    data.access_key = key;
    data.subject = `portfolio message from ${data.name}`;
    data.from_name = "samantha cho portfolio";
    data.botcheck = contactForm.querySelector(".trap").checked;

    sendBtn.disabled = true;
    sendBtn.textContent = "sending…";
    status.textContent = "";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      contactForm.reset();
      sendBtn.textContent = "sent!";
      status.textContent = "thanks! i'll get back to you soon :)";
      setTimeout(() => { sendBtn.disabled = false; sendBtn.textContent = "send"; }, 4000);
    } catch {
      sendBtn.disabled = false;
      sendBtn.textContent = "send";
      status.textContent = "hm, that didn't go through. mind trying again?";
    }
  });
}

/* ---------- lightbox ----------
   Full-screen view for a sketchbook page (buttons with data-zoom: shows their
   image) or a panel (buttons with data-zoom-panel="<template id>": shows a copy
   of that template, e.g. the concept evaluation matrix).
   Closes on a click anywhere outside the image/panel, the × button, Esc, or the
   browser back button. A plain overlay, not <dialog>, so the custom cursor
   (z-index 9999) stays visible on top of it. */
const lightbox = document.getElementById("lightbox");
const lightboxBody = lightbox.querySelector(".lightbox-body");
const lightboxClose = lightbox.querySelector(".lightbox-close");
let lightboxOpener = null;

function openLightbox(content, opener) {
  lightboxOpener = opener;
  lightboxBody.replaceChildren(content);
  lightbox.classList.remove("closing");
  lightbox.hidden = false;
  lenis.stop();                                  // the page behind stays put
  lightboxClose.focus({ preventScroll: true });
}

function closeLightbox() {
  if (lightbox.hidden || lightbox.classList.contains("closing")) return;
  lightbox.classList.add("closing");             // quick fade out, then hide
  setTimeout(() => {
    lightbox.hidden = true;
    lightbox.classList.remove("closing");
    lightboxBody.replaceChildren();
    lenis.start();
    if (lightboxOpener) lightboxOpener.focus({ preventScroll: true });
  }, 180);
}

document.querySelectorAll("[data-zoom]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const src = btn.querySelector("img");
    const img = document.createElement("img");
    img.className = "lightbox-img";
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    openLightbox(img, btn);
  });
});
// a text link that opens an image (e.g. "view full brand board"): data-zoom-src + data-zoom-alt
document.querySelectorAll("[data-zoom-src]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const img = document.createElement("img");
    img.className = "lightbox-img";
    img.src = btn.dataset.zoomSrc;
    img.alt = btn.dataset.zoomAlt || "";
    openLightbox(img, btn);
  });
});
document.querySelectorAll("[data-zoom-panel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tpl = document.getElementById(btn.dataset.zoomPanel);
    openLightbox(tpl.content.firstElementChild.cloneNode(true), btn);
  });
});
// anywhere outside the shown image/panel closes it (the backdrop, the × button)
lightbox.addEventListener("click", (e) => {
  const shown = lightboxBody.firstElementChild;
  if (!shown || !shown.contains(e.target)) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "Tab") { e.preventDefault(); lightboxClose.focus(); } // keep focus inside
});
window.addEventListener("popstate", closeLightbox);

/* ---------- Analysis folders (kove) ----------
   Mouse: hover fans the pages out (CSS). Touch has no hover, so the first tap
   on a folder opens it (and closes any other), a tap on a page then opens the
   page in the lightbox, and a tap on the folder itself or anywhere else closes it. */
const folders = document.querySelectorAll(".folder");
const noHover = window.matchMedia("(hover: none)");
folders.forEach((folder) => {
  folder.addEventListener("click", (e) => {
    if (!noHover.matches) return;
    const open = folder.classList.contains("open");
    if (open && e.target.closest(".folder-page")) return;   // let the page open in the lightbox
    e.preventDefault();
    e.stopPropagation();
    folders.forEach((f) => f.classList.toggle("open", f === folder && !open));
  }, true);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".folder, .lightbox")) folders.forEach((f) => f.classList.remove("open"));
});

/* ---------- Section index (behaviour) ----------
   Fades in once the white sheet reaches mid-screen (hidden over the hero),
   marks the section you're reading (blue + heavier), and glides to a section
   when you click its name. On narrower screens it's a "sections" pill at the
   bottom that opens the same list. */
function setIndexCurrent(btn, on) {
  btn.classList.toggle("is-current", on);
  if (on) btn.setAttribute("aria-current", "location");
  else btn.removeAttribute("aria-current");
  const g = groups.find((g) => g.el === btn);
  if (g) { g.from = on ? 800 : 500; g.settled = false; }
}
function setIndexOpen(ix, open) {
  ix.nav.classList.toggle("open", open);
  ix.nav.querySelector(".case-index-toggle").setAttribute("aria-expanded", String(open));
}
function updateCaseIndex() {
  const vh = window.innerHeight;
  for (const ix of caseIndexes) {
    if (ix.view !== current) { ix.nav.classList.remove("shown"); continue; }
    const shown = ix.sheet.getBoundingClientRect().top < vh * 0.5;
    ix.nav.classList.toggle("shown", shown);
    if (!shown) setIndexOpen(ix, false);
    let active = null;
    for (const it of ix.items) if (it.sec.getBoundingClientRect().top < vh * 0.4) active = it;
    if (active !== ix.active) {
      ix.items.forEach((it) => setIndexCurrent(it.btn, it === active));
      ix.active = active;
    }
  }
}
lenis.on("scroll", updateCaseIndex);
window.addEventListener("resize", updateCaseIndex);

for (const ix of caseIndexes) {
  ix.nav.querySelector(".case-index-toggle").addEventListener("click", () => {
    setIndexOpen(ix, !ix.nav.classList.contains("open"));
  });
  ix.items.forEach(({ sec, btn }) => btn.addEventListener("click", () => {
    setIndexOpen(ix, false);
    lenis.scrollTo(sec, { offset: -window.innerHeight * 0.1, duration: 1.1 });
  }));
}
// the pill's list closes on a click elsewhere or Esc
document.addEventListener("click", (e) => {
  for (const ix of caseIndexes) if (!ix.nav.contains(e.target)) setIndexOpen(ix, false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") caseIndexes.forEach((ix) => setIndexOpen(ix, false));
});
