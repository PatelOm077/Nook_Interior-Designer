document.documentElement.classList.add("js");

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phone = matchMedia("(max-width: 700px)");

/* ---------- Hero video: wide cut, or the tall cut on phones ---------- */
const heroVideo = document.querySelector(".hero-video");
function pickHeroCut() {
  const src = phone.matches ? heroVideo.dataset.tall : heroVideo.dataset.wide;
  if (heroVideo.getAttribute("src") === src) return;
  heroVideo.src = src;
  if (!reduceMotion) heroVideo.play().catch(() => {});
}
pickHeroCut();
phone.addEventListener("change", pickHeroCut);

/* ---------- The exploding house, drawn from scroll ----------
   Every frame is decoded up front (ImageBitmap) so drawing never stalls, the
   position eases toward the scroll target, and between two frames the next one
   is blended in, so the motion has no steps. */
const house = document.querySelector(".house");
const canvas = document.querySelector(".house-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const FRAME_COUNT = 121;
const FIELD = [226, 215, 201]; // --house
const frames = new Array(FRAME_COUNT);
const frameSrc = (i) => `media/house/f${String(i + 1).padStart(3, "0")}.webp`;
let current = 0;
let target = 0;
let dirty = true;

async function loadFrame(i) {
  const res = await fetch(frameSrc(i));
  const blob = await res.blob();
  frames[i] = "createImageBitmap" in window ? await createImageBitmap(blob) : await new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.src = URL.createObjectURL(blob);
  });
  dirty = true;
}
loadFrame(0).then(async () => {
  // Load the rest a few at a time, in order.
  for (let i = 1; i < FRAME_COUNT; i += 6) {
    await Promise.all(Array.from({ length: 6 }, (_, k) => i + k).filter((n) => n < FRAME_COUNT).map(loadFrame));
  }
});

function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  dirty = true;
}

function nearest(i) {
  for (let d = 0; d < FRAME_COUNT; d++) {
    if (frames[i - d]) return frames[i - d];
    if (frames[i + d]) return frames[i + d];
  }
  return null;
}

function placement(img) {
  const cw = canvas.width, ch = canvas.height;
  const iw = img.width, ih = img.height;
  if (cw / ch > 0.9) {
    const s = Math.max(cw / iw, ch / ih);
    return { x: (cw - iw * s) / 2, y: (ch - ih * s) / 2, w: iw * s, h: ih * s, fade: 0 };
  }
  // Phones: the house fills the width and sits mid-screen; its top and bottom dissolve into the field.
  const s = (cw * 1.32) / iw;
  const w = iw * s, h = ih * s;
  return { x: (cw - w) / 2, y: ch * 0.5 - h / 2, w, h, fade: h * 0.16 };
}

// After the last frame the scroll keeps going: the camera moves into the
// open rooms (the kitchen and dining table), as one more step.
const ZOOM_UNITS = 70;
const FOCUS = { x: 0.49, y: 0.68 }; // the kitchen-dining room, as a share of the frame
const easeInOut = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function draw(pos) {
  const last = FRAME_COUNT - 1;
  const zoom = easeInOut(Math.min(1, Math.max(0, (pos - last) / ZOOM_UNITS)));
  pos = Math.min(pos, last);
  const a = Math.floor(pos);
  const t = pos - a;
  const imgA = nearest(a);
  if (!imgA) return;
  const imgB = t > 0.01 && frames[a + 1] ? frames[a + 1] : null;
  const p = placement(imgA);
  if (zoom > 0) {
    const scale = 1 + zoom * (canvas.width / canvas.height > 0.9 ? 1.4 : 1.9);
    const fx = p.x + FOCUS.x * p.w, fy = p.y + FOCUS.y * p.h;
    const tx = fx + (canvas.width / 2 - fx) * zoom, ty = fy + (canvas.height * 0.52 - fy) * zoom;
    p.x = tx - FOCUS.x * p.w * scale; p.y = ty - FOCUS.y * p.h * scale;
    p.w *= scale; p.h *= scale; p.fade *= scale;
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgb(${FIELD})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imgA, p.x, p.y, p.w, p.h);
  if (imgB) {
    ctx.globalAlpha = t;
    ctx.drawImage(imgB, p.x, p.y, p.w, p.h);
    ctx.globalAlpha = 1;
  }
  if (p.fade) {
    const top = ctx.createLinearGradient(0, p.y, 0, p.y + p.fade);
    top.addColorStop(0, `rgba(${FIELD},1)`); top.addColorStop(1, `rgba(${FIELD},0)`);
    ctx.fillStyle = top; ctx.fillRect(0, p.y - 1, canvas.width, p.fade + 1);
    const bottom = ctx.createLinearGradient(0, p.y + p.h - p.fade, 0, p.y + p.h);
    bottom.addColorStop(0, `rgba(${FIELD},0)`); bottom.addColorStop(1, `rgba(${FIELD},1)`);
    ctx.fillStyle = bottom; ctx.fillRect(0, p.y + p.h - p.fade, canvas.width, p.fade + 1);
  }
}

function updateTarget() {
  const rect = house.getBoundingClientRect();
  const travel = rect.height - innerHeight;
  const p = Math.min(1, Math.max(0, -rect.top / travel));
  // Closed house held, then the house opens, a short pause, then the camera moves in.
  const last = FRAME_COUNT - 1;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  if (p < 0.64) target = clamp((p - 0.05) / 0.55) * last;
  else target = last + clamp((p - 0.66) / 0.28) * ZOOM_UNITS;
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(64, now - last);
  last = now;
  // Frame-rate independent easing toward the scroll position.
  const ease = reduceMotion ? 1 : 1 - Math.pow(0.86, dt / 16.67);
  const before = current;
  current += (target - current) * ease;
  if (Math.abs(target - current) < 0.002) current = target;
  if (dirty || Math.abs(current - before) > 0.0005) { draw(current); dirty = false; }
  requestAnimationFrame(tick);
}

sizeCanvas();
updateTarget();
current = target;
requestAnimationFrame(tick);
addEventListener("scroll", updateTarget, { passive: true });
addEventListener("resize", () => { sizeCanvas(); updateTarget(); });

/* ---------- Section entrances, staggered ---------- */
const seen = new WeakMap();
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    const n = seen.get(el.parentElement) || 0;
    seen.set(el.parentElement, n + 1);
    el.style.setProperty("--d", `${Math.min(n, 5) * 80}ms`);
    el.classList.add("is-in");
    io.unobserve(el);
  }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

/* ---------- Work plates: slow drift while they pass ---------- */
const plates = [...document.querySelectorAll(".plate img")];
if (!reduceMotion) {
  addEventListener("scroll", () => {
    for (const img of plates) {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const k = (innerHeight - r.top) / (innerHeight + r.height);
      img.style.transform = `scale(${1.3 - k * 0.08}) translateY(${(k - 0.5) * -3}%)`;
    }
  }, { passive: true });
}

/* ---------- Process steps: progress bar for the phone row ---------- */
const row = document.querySelector(".process-grid");
const bar = document.querySelector(".process-bar span");
function updateBar() {
  if (row.scrollWidth <= row.clientWidth) return;
  const visible = row.clientWidth / row.scrollWidth;
  const p = row.scrollLeft / (row.scrollWidth - row.clientWidth);
  bar.style.width = `${visible * 100}%`;
  bar.style.transform = `translateX(${(p * (1 - visible) / visible) * 100}%)`;
}
row.addEventListener("scroll", updateBar, { passive: true });
addEventListener("resize", updateBar);
updateBar();

/* ---------- Plan your nook ---------- */
const form = document.querySelector(".planner");
const size = form.querySelector("#size");
const sizeOut = form.querySelector("#size-out");
const feeOut = form.querySelector("#fee");
const weeksOut = form.querySelector("#weeks");
const send = form.querySelector("#plan-send");
const inr = new Intl.NumberFormat("en-IN");

function plan() {
  const rooms = [...form.querySelectorAll('input[name="room"]:checked')].map((i) => i.value);
  const sqft = Number(size.value);
  const site = form.querySelector('input[name="site"]').checked;

  // Room design is ₹65,000; whole-home design caps at ₹2,40,000 plus ₹40 a sq ft over 1,200.
  let fee = rooms.length === 0 ? 18000 : Math.min(rooms.length * 65000, 240000);
  if (rooms.length >= 4 && sqft > 1200) fee += (sqft - 1200) * 40;
  const designWeeks = rooms.length === 0 ? 1 : 3 + rooms.length * 1.5;
  const buildWeeks = site ? Math.max(4, Math.round(sqft / 150)) : 0;
  const weeks = Math.round(designWeeks + buildWeeks);

  sizeOut.textContent = `${inr.format(sqft)} sq ft`;
  feeOut.textContent = `₹${inr.format(Math.round(fee / 1000) * 1000)}`;
  weeksOut.textContent = `${weeks} week${weeks === 1 ? "" : "s"}`;

  const body = [
    "Hello Nook,",
    "",
    `I'd like help with: ${rooms.length ? rooms.join(", ") : "a one-room consult"}.`,
    `Home size: about ${inr.format(sqft)} sq ft.`,
    site ? "I'd like you to look after the build too." : "I'll manage the build myself.",
    `Your estimate said ${feeOut.textContent} and ${weeksOut.textContent}.`,
    "",
    "When could you visit?",
  ].join("\n");
  send.href = `mailto:hello@nook.studio?subject=${encodeURIComponent("Plan my nook")}&body=${encodeURIComponent(body)}`;
}
form.addEventListener("input", plan);
form.addEventListener("submit", (e) => e.preventDefault());
plan();

/* ---------- Visit: the photograph slowly changes ---------- */
const visitImgs = [...document.querySelectorAll(".visit-photos img")];
if (!reduceMotion && visitImgs.length > 1) {
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    visitImgs[i].classList.remove("is-on");
    i = (i + 1) % visitImgs.length;
    visitImgs[i].classList.add("is-on");
  }, 6000);
}
