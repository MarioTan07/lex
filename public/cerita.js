import { el, api } from "/common.js";

// Our people: the sellers on the site, each linking to their shop.
const box = document.getElementById("peopleSellers");
api("/api/stalls").then(({ stalls }) => {
  if (!stalls.length) return;
  document.getElementById("peopleList").append(...stalls.map((s) => el("a", { href: "/lokasi#lapak-" + s.id }, s.stallName)));
  box.hidden = false;
}).catch(() => {});
