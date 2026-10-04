// Draws Our People groups and Collaborations partners from /api/about (edited under Warga & Mitra in /pengelola).
import { el, icon } from "/common.js";
import { lang } from "/i18n.js";

// Content is written in Indonesian and English; every language other than Indonesian shows the English.
export const pick = (x, field) => (lang !== "id" && x[field + "En"]) || x[field];
const caption = (p) => (lang !== "id" && p.captionEn) || p.caption;

// Intro texts: blank lines separate paragraphs. Replaces the page's built-in text once the saved one arrives.
export function introText(box, t) {
  if (!box || !t) return;
  const paras = ((lang !== "id" && t.en) || t.id).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  if (box.tagName === "P") { box.removeAttribute("data-i18n"); box.textContent = paras.join(" "); return; }
  box.replaceChildren(...paras.map((x) => el("p", { text: x })));
}

const zoom = (p) => el("button", { type: "button", class: "zoom", "data-full": p.src },
  el("img", { src: p.src, width: p.w || null, height: p.h || null, loading: "lazy", alt: caption(p) }));
const figure = (p) => el("figure", {}, zoom(p), caption(p) ? el("figcaption", { text: caption(p) }) : null);
// One photo: wide. Two: side by side. Three or more: one big and two small, the rest in a row to scroll.
function groupPhotos(photos) {
  if (photos.length === 1) return el("div", { class: "group-photos one" }, figure(photos[0]));
  if (photos.length === 2) return el("div", { class: "group-photos" }, ...photos.map(figure));
  const rest = photos.slice(3);
  return el("div", { class: "group-photos wide three" }, ...photos.slice(0, 3).map(figure),
    rest.length ? el("div", { class: "partner-photos" }, ...rest.map(zoom)) : null);
}
function groupText(g, sellers) {
  return el("div", { class: "group-text" },
    el("span", { class: "group-icon" }, icon(g.icon)),
    el("h3", { text: pick(g, "name") }),
    g.body ? el("p", { text: pick(g, "body") }) : null,
    g.showSellers ? sellers : null);
}
// Groups with photos get a row each (photos alternating sides); groups without photos share a grid of cards.
export function renderGroups(box, groups, sellers) {
  const rows = groups.filter((g) => g.photos.length).map((g) => el("article", { class: "group", id: "warga-" + g.id }, groupPhotos(g.photos), groupText(g, sellers)));
  const cards = groups.filter((g) => !g.photos.length).map((g) => el("article", { class: "group card", id: "warga-" + g.id }, groupText(g, sellers)));
  box.replaceChildren(...rows, cards.length ? el("div", { class: "group-cards" }, ...cards) : null);
}
export function renderPartners(box, partners) {
  box.replaceChildren(...partners.map((p) => el("li", { id: "mitra-" + p.id },
    p.years ? el("span", { class: "yr", text: p.years }) : null,
    el("b", { text: pick(p, "name") }),
    p.body ? el("p", { text: pick(p, "body") }) : null,
    p.photos.length ? el("div", { class: "partner-photos" }, ...p.photos.map(zoom)) : null)));
}
