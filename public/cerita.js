import { el, api, t } from "/common.js";
import { introText, renderGroups } from "/about-render.js";
import "/photo-view.js";

// Links from before Collaborations had its own page.
if (location.hash === "#collab" || location.hash === "#sponsor") location.replace("/kerja-sama" + (location.hash === "#sponsor" ? "#sponsor" : ""));

// Coming from another page ("/cerita#people"): jump to that section once the page has finished building.
const target = location.hash && document.getElementById(location.hash.slice(1));
if (target) addEventListener("load", () => target.scrollIntoView({ block: "start", behavior: "instant" }));

// Our people: the groups and intro text admins edit, and the sellers on the site under the group that shows them.
const sellers = el("div", { class: "people-sellers", hidden: true },
  el("h4"), el("div", { class: "people-list" }));
let about = null;
function draw() {
  sellers.querySelector("h4").textContent = t("people.listTitle");
  if (!about) return;
  introText(document.getElementById("peopleIntro"), about.texts.peopleIntro);
  renderGroups(document.getElementById("groupList"), about.groups, sellers);
}
api("/api/about").then((a) => { about = a; draw(); }).catch(() => {});
api("/api/stalls").then(({ stalls }) => {
  if (!stalls.length) return;
  sellers.querySelector(".people-list").append(...stalls.map((s) => el("a", { href: "/lokasi#lapak-" + s.id }, s.stallName)));
  sellers.hidden = false;
}).catch(() => {});
addEventListener("langchange", draw);
