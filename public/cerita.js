import { el, api } from "/common.js";

// Links from before Collaborations had its own page.
if (location.hash === "#collab" || location.hash === "#sponsor") location.replace("/kerja-sama" + (location.hash === "#sponsor" ? "#sponsor" : ""));

// Coming from another page ("/cerita#people"): jump to that section once the page has finished building.
const target = location.hash && document.getElementById(location.hash.slice(1));
if (target) addEventListener("load", () => target.scrollIntoView({ block: "start", behavior: "instant" }));

// Our people: the sellers on the site, each linking to their shop.
const box = document.getElementById("peopleSellers");
api("/api/stalls").then(({ stalls }) => {
  if (!stalls.length) return;
  document.getElementById("peopleList").append(...stalls.map((s) => el("a", { href: "/lokasi#lapak-" + s.id }, s.stallName)));
  box.hidden = false;
}).catch(() => {});

// Tapping a photo opens it bigger, with its caption.
const view = document.getElementById("photoView");
document.querySelectorAll(".group .zoom").forEach((b) => b.addEventListener("click", () => {
  const img = b.querySelector("img");
  document.getElementById("photoBig").src = b.dataset.full;
  document.getElementById("photoBig").alt = img.alt;
  document.getElementById("photoCap").textContent = b.closest("figure").querySelector("figcaption").textContent;
  view.showModal();
}));
document.getElementById("photoClose").addEventListener("click", () => view.close());
view.addEventListener("click", (e) => { if (e.target === view) view.close(); });
