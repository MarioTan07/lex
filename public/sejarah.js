// History page: the photo carousel. Slides scroll sideways (swipe on phones); the buttons, dots and arrow keys move one photo at a time.
import { $, el, t } from "/common.js";

const track = $("#track");
const slides = [...track.children];
const dots = $("#dots");
let current = 0;

// Each photo's caption doubles as its description for screen readers.
const label = () => slides.forEach((s, i) => {
  s.setAttribute("aria-roledescription", "slide");
  s.setAttribute("aria-label", t("sej.count", { n: i + 1, total: slides.length }));
  s.querySelector("img").alt = s.querySelector("figcaption").textContent;
});

function drawDots() {
  dots.replaceChildren(...slides.map((_, i) => el("button", {
    type: "button", "aria-label": t("sej.goTo", { n: i + 1 }), "aria-current": i === current ? "true" : null, onclick: () => go(i),
  })));
}
function show(i) {
  current = i;
  [...dots.children].forEach((d, j) => (j === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
  $("#count").textContent = t("sej.count", { n: i + 1, total: slides.length });
  $("#prev").disabled = i === 0;
  $("#next").disabled = i === slides.length - 1;
}
function go(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  show(i);
}

$("#prev").addEventListener("click", () => go(current - 1));
$("#next").addEventListener("click", () => go(current + 1));
track.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
  if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
});
// Keep the dots in step when the buyer swipes.
let timer;
track.addEventListener("scroll", () => {
  clearTimeout(timer);
  timer = setTimeout(() => show(Math.round(track.scrollLeft / track.clientWidth)), 80);
}, { passive: true });

window.addEventListener("langchange", () => { label(); drawDots(); show(current); });
label(); drawDots(); show(0);
