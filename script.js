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
  const letters = [...text].map((char) => {
    const span = document.createElement("span");
    span.className = "ch";
    span.setAttribute("aria-hidden", "true");
    span.textContent = char;
    el.appendChild(span);
    return { span, weight: from, x: 0, y: 0, vx: 0, vy: 0 };
  });
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

function animate() {
  for (const g of groups) {
    for (const l of g.letters) {
      const r = l.span.getBoundingClientRect();
      // resting center (remove the offset we've already applied)
      const cx = r.left + r.width / 2 - l.x;
      const cy = r.top + r.height / 2 - l.y;
      const dx = mouse.x - cx;
      const dy = mouse.y - cy;
      const d = Math.hypot(dx, dy);
      const falloff = Math.max(0, 1 - d / g.radius);

      // weight
      const target = g.from + (g.to - g.from) * falloff;
      l.weight += (target - l.weight) * 0.2;
      l.span.style.fontVariationSettings = `'wght' ${l.weight.toFixed(1)}`;

      // stickiness: spring toward a point partway to the cursor
      const tx = dx * falloff * g.pull;
      const ty = dy * falloff * g.pull;
      l.vx = (l.vx + (tx - l.x) * STIFFNESS) * DAMPING;
      l.vy = (l.vy + (ty - l.y) * STIFFNESS) * DAMPING;
      l.x += l.vx;
      l.y += l.vy;
      l.span.style.transform = `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px)`;
    }
  }
  requestAnimationFrame(animate);
}

// Corner rounding on the name scales with the text size.
function updateRounding() {
  const name = document.querySelector(".name");
  if (!name) return; // only on the home page
  const size = parseFloat(getComputedStyle(name).fontSize);
  document.getElementById("round-blur").setAttribute("stdDeviation", (size * 0.016).toFixed(2));
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
    blurTarget.style.filter = `blur(${(BLUR_BASE + (BLUR_PEAK - BLUR_BASE) * eased).toFixed(1)}px)`;
  }
  requestAnimationFrame(updateVideoBlur);
}
requestAnimationFrame(updateVideoBlur);

// ---------- Water ripples ----------
// The video is redrawn on a WebGL canvas through a rippling water surface.
// Moving the cursor leaves a gentle wake; clicking/tapping drops a splash.
// If WebGL isn't available (or the browser won't share the video's pixels,
// e.g. when index.html is opened straight from disk), the plain video stays.
(function waterRipples() {
  const canvas = document.getElementById("bg-water");
  const bg = canvas.parentElement;

  const CELL = 6;          // css px per simulation cell (bigger = broader waves)
  const DAMPING = 0.984;   // how quickly ripples fade (closer to 1 = longer)
  const REFRACT = 0.05;    // how much the waves bend the footage
  const SHINE = 0.55;      // light glinting off the wave slopes
  const TRAIL_AMP = 0.22;  // strength of the cursor wake
  const SPLASH_AMP = 1.1;  // strength of a click splash
  const ZOOM = 1.12;       // must match the scale() on .bg canvas in style.css

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return;

  // --- shaders ---
  const vsSrc = `
    attribute vec2 a;
    varying vec2 vUv;
    void main() {
      vUv = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); // y = 0 at the top
      gl_Position = vec4(a, 0.0, 1.0);
    }`;
  const fsSrc = `
    precision mediump float;
    uniform sampler2D uVideo;
    uniform sampler2D uHeight;
    uniform vec2 uTexel;
    uniform vec2 uCover;
    uniform float uRefract;
    uniform float uShine;
    varying vec2 vUv;
    void main() {
      float l = texture2D(uHeight, vUv - vec2(uTexel.x, 0.0)).r;
      float r = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r;
      float u = texture2D(uHeight, vUv - vec2(0.0, uTexel.y)).r;
      float d = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r;
      vec2 slope = vec2(r - l, d - u);
      vec2 uv = (vUv - 0.5) * uCover + 0.5;   // object-fit: cover
      vec3 c = texture2D(uVideo, uv + slope * uRefract).rgb;
      c += max(0.0, -slope.x - slope.y) * uShine; // light from the top-left
      gl_FragColor = vec4(c, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(prog, n);
  const uTexel = U("uTexel"), uCover = U("uCover");
  gl.uniform1i(U("uVideo"), 0);
  gl.uniform1i(U("uHeight"), 1);
  gl.uniform1f(U("uRefract"), REFRACT);
  gl.uniform1f(U("uShine"), SHINE);

  function makeTex(unit) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const videoTex = makeTex(0);
  const heightTex = makeTex(1);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // --- water surface simulation (runs on the CPU at low resolution) ---
  let W = 0, H = 0, gw = 0, gh = 0;
  let cur, prev, bytes;

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
    bytes = new Uint8Array(gw * gh).fill(128);
    gl.uniform2f(uTexel, 1 / gw, 1 / gh);
    uploadHeight();
    updateCover();
  }

  function updateCover() {
    const vw = bgVideo.videoWidth, vh = bgVideo.videoHeight;
    if (!vw || !vh || !W) { gl.uniform2f(uCover, 1, 1); return; }
    const a = W / H, v = vw / vh;
    if (a > v) gl.uniform2f(uCover, 1, v / a);
    else gl.uniform2f(uCover, a / v, 1);
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

  function uploadHeight() {
    for (let i = 0; i < cur.length; i++) {
      const h = cur[i];
      bytes[i] = h > 1 ? 255 : h < -1 ? 0 : (h * 127.5 + 127.5) | 0;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gw, gh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
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
      const dist = Math.hypot(gx - lastX, gy - lastY);
      const n = Math.min(12, Math.ceil(dist / 1.5)); // fill in fast movements
      const amp = Math.min(TRAIL_AMP, 0.04 + dist * 0.03) / Math.max(1, n * 0.5);
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        drop(lastX + (gx - lastX) * t, lastY + (gy - lastY) * t, 2.5, amp);
      }
    }
    lastX = gx; lastY = gy;
  }, { passive: true });

  document.addEventListener("pointerleave", () => { lastX = lastY = null; });

  window.addEventListener("pointerdown", (e) => {
    const [gx, gy] = toGrid(e.clientX, e.clientY);
    drop(gx, gy, 5, SPLASH_AMP);
  }, { passive: true });

  // --- render loop ---
  let lastVideoTime = -1, acc = 0, lastFrame = performance.now(), settled = true;

  function frame(now) {
    // Copy a new video frame into the texture only when the video has moved on.
    if (bgVideo.readyState >= 2 && bgVideo.currentTime !== lastVideoTime) {
      lastVideoTime = bgVideo.currentTime;
      gl.activeTexture(gl.TEXTURE0);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bgVideo);
      } catch (err) {
        // Browser won't let WebGL read the video (e.g. opened from disk):
        // give the plain video back and stop.
        bg.classList.remove("water");
        blurTarget = bgVideo;
        return;
      }
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
    const active = now - lastInput < 5000; // waves have died out after ~5s
    if (active) {
      settled = false;
      while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
      uploadHeight();
    } else {
      acc = 0;
      if (!settled) { cur.fill(0); prev.fill(0); uploadHeight(); settled = true; }
    }

    if (bg.classList.contains("water")) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
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
const isAbout = () => !aboutView.hidden;

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

// The nav turns dark when it sits over the white contents page.
function updateNav() {
  const onLight = !isAbout() && contentsSheet.getBoundingClientRect().top <= 40;
  nav.classList.toggle("on-light", onLight);
  homeIcon.classList.toggle("on-light", onLight);
  // once the work page covers the screen, the top nav tucks away (it's in the footer)
  nav.classList.toggle("tucked", onLight);
}
lenis.on("scroll", updateNav);
window.addEventListener("resize", updateNav);

// "about" sits a little heavier at rest while the about view is showing.
function markCurrent() {
  const about = isAbout();
  if (about) navAbout.setAttribute("aria-current", "page");
  else navAbout.removeAttribute("aria-current");
  const g = groups.find((g) => g.el === navAbout);
  if (g) g.from = about ? 800 : 600;
  document.title = about ? "about – samantha cho" : "samantha cho";
}

// ---------- Router: slide between the home and about views ----------
// The two views live in one page so the background video never restarts.
// Going to about: home slides out to the left, about slides in from the right.
// Going home: the reverse.
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
function refresh() { updateNav(); updateParallax(); }

async function showAbout(animate) {
  if (isAbout()) return;
  savedHomeY = window.scrollY;
  aboutView.hidden = false;
  markCurrent();
  if (!animate) { homeView.hidden = true; jumpTo(0); refresh(); return; }

  busy = true; lenis.stop();
  fixInPlace(aboutView, 0);
  const out = homeView.animate([{ transform: "none" }, { transform: "translateX(-100%)" }], SLIDE);

  // Each bio element slides in on its own, in reading order. The gaps shrink as
  // it goes (uneven, not a metronome), so it reads as one swoop, not a queue.
  const items = [...aboutView.querySelectorAll(".about-photo, .about-text > *")];
  const delays = [120, 200, 270, 325, 370, 405, 435, 460];
  items.forEach((el, i) => {
    if (el.hasAttribute("data-reveal")) el.classList.add("in"); // the slide is their entrance
    el.animate(
      [{ transform: "translateX(70vw)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 1000, delay: delays[Math.min(i, delays.length - 1)],
        easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" }
    );
  });

  await out.finished;                           // free the page once home is gone; items keep settling
  homeView.hidden = true;
  jumpTo(0);
  release(homeView); release(aboutView);
  lenis.start(); busy = false; refresh();
}

async function showHome(hash, fromHistory, animate) {
  if (!isAbout()) { lenis.scrollTo(homeTarget(hash)); return; }  // already home: just glide
  fixInPlace(aboutView, -window.scrollY);       // freeze about where it is
  homeView.hidden = false;
  pinLockup();                                  // measure now that home is visible again
  const y = fromHistory && !hash ? savedHomeY : homeTarget(hash);
  jumpTo(y);
  if (!animate) { aboutView.hidden = true; release(aboutView); markCurrent(); refresh(); return; }

  busy = true; lenis.stop();
  const inn = homeView.animate([{ transform: "translateX(-100%)" }, { transform: "none" }], SLIDE);
  const out = aboutView.animate([{ transform: "none" }, { transform: "translateX(100%)" }], SLIDE);
  aboutView.hidden = false;
  await Promise.all([out.finished, inn.finished]);
  aboutView.hidden = true;
  release(homeView); release(aboutView);
  markCurrent();
  lenis.start(); busy = false; refresh();
}

// "contact": slide over to the about page (if needed), then glide down to the form
const contactSection = document.getElementById("contact");
async function showContact(animate) {
  const wasAbout = isAbout();
  await showAbout(animate);
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
  if (hash === "#about") {
    if (isAbout()) lenis.scrollTo(0);           // already there: glide back to the top
    else showAbout(animate);
  }
  else if (hash === "#contact") showContact(animate);
  else showHome(hash, fromHistory, animate);
}

// nav links, the ray icon: change the URL and slide, without reloading
document.querySelectorAll('.nav a, .foot-nav a, a.home').forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (busy) return;
    const hash = a.getAttribute("href") === "#" ? "" : a.getAttribute("href");
    if (hash !== location.hash) history.pushState(null, "", hash || location.pathname);
    route(hash, false);
  });
});

// placeholder links (projects, contact) don't go anywhere yet; keep them from
// changing the URL and sending you back to the top
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href="#"]');
  if (a && !a.matches(".home")) e.preventDefault();
});

// browser back / forward buttons
window.addEventListener("popstate", () => { if (!busy) route(location.hash, true); });

// opened directly at index.html#about (or via the old about.html link)
if (location.hash === "#about" || location.hash === "#contact") route(location.hash, false, false);
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
