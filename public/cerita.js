import { el, api } from "/common.js";
import "/photo-view.js";

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
