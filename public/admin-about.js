// Admin → Warga & Mitra: the groups on Our People, the partners on Collaborations, and their intro texts.
// Each has a name, a text and photos with captions; English left empty is machine-translated when saved.
import { $, el, t, api, toast, shrinkPhoto, confirmBox } from "/common.js";

const ICONS = ["store", "sprout", "palette", "users", "home", "sparkles", "leaf", "heart"];
const TEXTS = ["peopleIntro", "collabIntro", "sponsorText"];
const MAX = { groups: 20, partners: 30 };
const lists = { groups: [], partners: [] };
let kind = "groups";  // which list the form is editing
let editing = null;   // the item being edited, or null when adding
let photos = [];      // the form's photos in order: { src, caption, captionEn, auto, w, h } or, for new ones, { data, ... }
let texts = null;

function handle(e) { toast(e.message); }
const autoHint = (input, on, was) => {
  input.placeholder = on && was ? t("lst.autoWas", { text: was.slice(0, 120) }) : "";
  input.dataset.auto = on ? "1" : "";
};

// ---------- loading ----------
async function load() {
  try {
    const [g, p, x] = await Promise.all([api("/api/admin/groups"), api("/api/admin/partners"), api("/api/admin/about-texts")]);
    lists.groups = g.items; lists.partners = p.items; texts = x.texts;
  } catch (e) { return handle(e); }
  renderRows("groups"); renderRows("partners"); fillTexts();
}
document.querySelector('[data-tab="about"]').addEventListener("click", load);

// ---------- intro texts ----------
function fillTexts() {
  for (const k of TEXTS) {
    const v = texts[k];
    $("#t-" + k).value = v.id;
    $("#t-" + k + "-en").value = v.auto ? "" : v.en;
    autoHint($("#t-" + k + "-en"), v.auto, v.en);
  }
}
$("#aboutTexts").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#aboutTextsSave"); btn.disabled = true;
  const body = Object.fromEntries(TEXTS.map((k) => [k, { id: $("#t-" + k).value, en: $("#t-" + k + "-en").value }]));
  try { ({ texts } = await api("/api/admin/about-texts", { method: "PUT", body })); fillTexts(); toast(t("ab.textsSaved")); }
  catch (x) { handle(x); }
  btn.disabled = false;
});

// ---------- lists ----------
function renderRows(k) {
  const body = $("#ab-rows-" + k); body.replaceChildren();
  if (!lists[k].length) body.append(el("tr", {}, el("td", { colspan: "4", class: "muted", text: t("ab.empty") })));
  lists[k].forEach((it, i) => body.append(el("tr", {},
    el("td", {}, it.photos[0] ? el("img", { src: it.photos[0].src, alt: "" }) : el("img", { alt: "" })),
    el("td", {}, el("strong", { text: it.name }), it.years ? el("div", { class: "muted small", text: it.years }) : null,
      it.showSellers ? el("div", { class: "muted small", text: t("ab.sellersShown") }) : null),
    el("td", { class: "small", text: it.photos.length ? t("ab.photoCount", { n: it.photos.length }) : t("ab.noPhotos") }),
    el("td", {}, el("div", { class: "acts" },
      el("button", { class: "btn small ghost", type: "button", disabled: i === 0, "aria-label": t("ab.up"), onclick: () => move(k, it, -1) }, "↑"),
      el("button", { class: "btn small ghost", type: "button", disabled: i === lists[k].length - 1, "aria-label": t("ab.down"), onclick: () => move(k, it, 1) }, "↓"),
      el("button", { class: "btn small ghost", type: "button", onclick: () => openForm(k, it) }, t("common.edit")),
      el("button", { class: "btn small warn", type: "button", onclick: async () => { if (await confirmBox({ title: t("del.title", { name: it.name }), text: t("del.itemText"), confirm: t("admin.delete") })) remove(k, it); } }, t("admin.delete")))))));
}
async function move(k, it, dir) {
  try { ({ items: lists[k] } = await api(`/api/admin/${k}/${it.id}/move`, { method: "POST", body: { dir } })); renderRows(k); }
  catch (e) { handle(e); }
}
async function remove(k, it) {
  try {
    await api(`/api/admin/${k}/${it.id}`, { method: "DELETE" });
    if (editing?.id === it.id && kind === k) closeForm();
    toast(t("admin.deleted", { name: it.name })); load();
  } catch (e) { handle(e); }
}

// ---------- form ----------
function fillIcons() {
  const v = $("#ab-icon").value;
  $("#ab-icon").replaceChildren(...ICONS.map((i) => el("option", { value: i, text: t("ab.icon." + i) })));
  if (v) $("#ab-icon").value = v;
}
function openForm(k, it) {
  kind = k; editing = it || null;
  const form = $("#aboutForm"); form.reset(); form.hidden = false; $("#ab-err").hidden = true;
  form.querySelectorAll(".ab-group").forEach((n) => (n.hidden = k !== "groups"));
  form.querySelectorAll(".ab-partner").forEach((n) => (n.hidden = k !== "partners"));
  fillIcons();
  $("#ab-title").textContent = it ? t("common.editTitle", { name: it.name }) : t(k === "groups" ? "ab.addGroupTitle" : "ab.addPartnerTitle");
  $("#ab-save").textContent = t(it ? "common.saveChanges" : "lst.save");
  $("#ab-name").value = it?.name || ""; $("#ab-body").value = it?.body || "";
  for (const [id, col, v] of [["#ab-name-en", "name_en", it?.nameEn], ["#ab-body-en", "body_en", it?.bodyEn]]) {
    const auto = !!it?.auto.includes(col);
    $(id).value = auto ? "" : v || ""; autoHint($(id), auto, v);
  }
  $("#ab-years").value = it?.years || "";
  $("#ab-icon").value = it?.icon || "users";
  $("#ab-sellers").checked = !!it?.showSellers;
  // What the boxes started with, so English that wasn't touched is translated again when the Indonesian changes.
  editing && (editing.was = { name: it.name, nameEn: $("#ab-name-en").value, body: it.body, bodyEn: $("#ab-body-en").value });
  photos = (it?.photos || []).map((p) => ({ ...p, was: { caption: p.caption, captionEn: p.captionEn } }));
  renderPhotos();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
function closeForm() { $("#aboutForm").hidden = true; editing = null; photos = []; }
$("#ab-close").addEventListener("click", closeForm);
$("#ab-add-groups").addEventListener("click", () => openForm("groups", null));
$("#ab-add-partners").addEventListener("click", () => openForm("partners", null));

function renderPhotos() {
  const box = $("#ab-photos"); box.replaceChildren();
  if (!photos.length) box.append(el("p", { class: "muted small", text: t("ab.noPhotos") }));
  photos.forEach((p, i) => {
    const cap = el("input", { type: "text", maxlength: "200", value: p.caption || "", placeholder: t("ab.captionPh"), "aria-label": t("ab.captionPh"), oninput: (e) => (p.caption = e.target.value) });
    const capEn = el("input", { type: "text", maxlength: "200", value: p.auto ? "" : p.captionEn || "", "aria-label": t("ab.captionEnPh"), oninput: (e) => (p.captionEn = e.target.value, p.auto = false) });
    capEn.placeholder = p.auto && p.captionEn ? t("lst.autoWas", { text: p.captionEn.slice(0, 80) }) : t("ab.captionEnPh");
    const swap = (j) => { [photos[i], photos[j]] = [photos[j], photos[i]]; renderPhotos(); };
    box.append(el("div", { class: "ab-photo" },
      el("img", { src: p.data || p.src, alt: "" }),
      el("div", { class: "ab-caps" }, cap, capEn, p.data ? el("span", { class: "pill paused", text: t("ab.new") }) : null),
      el("div", { class: "acts" },
        el("button", { class: "btn small ghost", type: "button", disabled: i === 0, "aria-label": t("ab.up"), onclick: () => swap(i - 1) }, "↑"),
        el("button", { class: "btn small ghost", type: "button", disabled: i === photos.length - 1, "aria-label": t("ab.down"), onclick: () => swap(i + 1) }, "↓"),
        el("button", { class: "btn small warn", type: "button", "aria-label": t("product.removePhoto"), onclick: () => { photos.splice(i, 1); renderPhotos(); } }, "×"))));
  });
  $("#ab-add-photo").disabled = photos.length >= MAX[kind];
}
const sizeOf = (data) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({}); i.src = data; });
$("#ab-add-photo").addEventListener("change", async (e) => {
  for (const f of [...e.target.files]) {
    if (photos.length >= MAX[kind]) { toast(t("ab.maxPhotos", { n: MAX[kind] })); break; }
    try { const data = await shrinkPhoto(f); photos.push({ data, ...(await sizeOf(data)), caption: "", captionEn: "" }); }
    catch { toast(t("product.badPhoto")); }
  }
  e.target.value = ""; renderPhotos();
});

// Saving: the item's fields and saved photos first, then each new photo, then the final order if new ones were moved.
const stale = (p) => p.was && p.caption !== p.was.caption && p.captionEn === p.was.captionEn;
const photoBody = (list) => list.filter((p) => p.src).map((p) => ({ src: p.src, caption: p.caption || "", captionEn: p.auto || stale(p) ? "" : p.captionEn || "" }));
$("#aboutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#ab-err"); err.hidden = true;
  const btn = $("#ab-save"); btn.disabled = true; btn.textContent = t("lst.saving");
  const was = editing?.was, keepEn = (id, en, wasId, wasEn) => (was && $(id).value !== wasId && $(en).value === wasEn ? "" : $(en).value);
  const body = { name: $("#ab-name").value, nameEn: keepEn("#ab-name", "#ab-name-en", was?.name, was?.nameEn), body: $("#ab-body").value, bodyEn: keepEn("#ab-body", "#ab-body-en", was?.body, was?.bodyEn),
    years: $("#ab-years").value, icon: $("#ab-icon").value, showSellers: $("#ab-sellers").checked, photos: photoBody(photos) };
  const base = "/api/admin/" + kind;
  try {
    let { item } = await api(editing ? base + "/" + editing.id : base, { method: editing ? "PUT" : "POST", body });
    const fresh = photos.filter((p) => p.data);
    for (const p of fresh) {
      ({ item } = await api(`${base}/${item.id}/photos`, { method: "POST", body: { photo: p.data, w: p.w, h: p.h, caption: p.caption || "", captionEn: p.captionEn || "" } }));
      Object.assign(p, item.photos[item.photos.length - 1]); delete p.data;
    }
    if (fresh.length && photos.some((p, i) => p.src !== item.photos[i]?.src)) ({ item } = await api(`${base}/${item.id}`, { method: "PUT", body: { ...body, photos: photoBody(photos) } }));
    toast(t(editing ? "lst.saved" : "lst.added", { name: item.name }));
    closeForm(); load();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
  btn.disabled = false; btn.textContent = t(editing ? "common.saveChanges" : "lst.save");
});

window.addEventListener("langchange", () => { renderRows("groups"); renderRows("partners"); fillIcons(); if (!$("#aboutForm").hidden) renderPhotos(); });
