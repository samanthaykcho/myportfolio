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
