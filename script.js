// ---------- Smooth scrolling (Lenis) ----------
const lenis = new Lenis();
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ---------- Tagline fades in once the user starts scrolling ----------
const tagline = document.getElementById("tagline");
function updateFade() {
  tagline.style.opacity = Math.min(window.scrollY / (window.innerHeight * 0.25), 1);
}
lenis.on("scroll", updateFade);
window.addEventListener("resize", updateFade);
updateFade();

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
  const size = parseFloat(getComputedStyle(document.querySelector(".name")).fontSize);
  document.getElementById("round-blur").setAttribute("stdDeviation", (size * 0.016).toFixed(2));
}
window.addEventListener("resize", updateRounding);
updateRounding();

// Wait for Acumin to load, then pin the left edge so growing letters
// don't shift the whole block around.
document.fonts.ready.then(() => {
  const lockup = document.getElementById("lockup");
  lockup.style.width = lockup.getBoundingClientRect().width + "px";
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

function updateVideoBlur() {
  const d = bgVideo.duration;
  if (d && isFinite(d)) {
    const t = bgVideo.currentTime;
    const edge = Math.min(t, d - t);                    // seconds from nearest end
    const k = Math.max(0, 1 - edge / Math.min(RAMP, d / 2));
    const eased = k * k * (3 - 2 * k);                  // smoothstep
    bgVideo.style.filter = `blur(${(BLUR_BASE + (BLUR_PEAK - BLUR_BASE) * eased).toFixed(1)}px)`;
  }
  requestAnimationFrame(updateVideoBlur);
}
requestAnimationFrame(updateVideoBlur);

// ---------- Contents page ----------
const projects = [...document.querySelectorAll(".project")];

// Reveal each project the first time it scrolls into view.
const revealer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); }
  }
}, { threshold: 0.25 });
projects.forEach((p) => revealer.observe(p));

// Parallax: each project drifts at its own speed (data-speed) so the two
// columns slide past each other as you scroll.
projects.forEach((p) => { p.dy = 0; });
function updateParallax() {
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
