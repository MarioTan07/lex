// Admin → Paket: add, edit and delete tours, experiences and homestays, with photos and dates.
// A tour is the full package and can include experiences; an experience is one activity on its own.
import { $, el, t, rp, api, toast, shrinkPhoto, confirmBox } from "/common.js";
import { tIn } from "/i18n.js";

let listings = [];
let editing = null;     // the listing being edited, or null when adding
let dates = [];         // tour dates in the form, "2026-10-18T08:00"
let savedPhotos = [];   // photos already on the listing being edited
let pendingPhotos = []; // photos picked but not uploaded yet (data URLs)
let expIds = [];        // experiences ticked for the tour in the form

const kind = () => $("#l-kind").value;
const mode = () => document.querySelector('input[name="l-mode"]:checked').value;

function handle(e) { toast(e.message); }

async function load() {
  try { ({ listings } = await api("/api/admin/listings")); } catch (e) { return handle(e); }
  renderRows(); renderExps();
}
document.querySelector('[data-tab="wisata"]').addEventListener("click", load);

// ---------- form ----------
// Fields and labels that differ between tours, experiences and homestays.
// .tour-only: tours and experiences (length, group, schedule); .tour-pack: tours only; .exp-only: experiences only.
function syncKind() {
  const k = kind(), timed = k !== "homestay";
  document.querySelectorAll("#listingForm .tour-only").forEach((n) => (n.hidden = !timed));
  document.querySelectorAll("#listingForm .tour-pack").forEach((n) => (n.hidden = k !== "tour"));
  document.querySelectorAll("#listingForm .exp-only").forEach((n) => { n.hidden = k !== "experience"; if (n.tagName === "OPTION") n.disabled = k !== "experience"; });
  if (k !== "experience" && $("#l-status").value === "tours_only") $("#l-status").value = "shown";
  $("#l-kind-hint").textContent = t({ tour: "lst.kindHintTour", experience: "lst.kindHintExp", homestay: "lst.kindHintStay" }[k]);
  $("#l-name").placeholder = t({ tour: "lst.namePlaceholder", experience: "lst.namePlaceholderExp", homestay: "lst.namePlaceholderStay" }[k]);
  $("#l-hours-label").textContent = t(k === "experience" ? "lst.hoursExp" : "lst.hours");
  $("#l-price-label").textContent = t(timed ? "lst.pricePerson" : "lst.priceNight");
  $("#l-max-label").textContent = t(timed ? "lst.groupMax" : "lst.guestsMax");
  $("#l-loc-label").textContent = t(timed ? "lst.meetingPoint" : "lst.stayLocation");
  $("#l-inc-label").textContent = t(timed ? "lst.includesLabel" : "lst.facilitiesLabel");
}

// ---------- experiences inside a tour ----------
const experiences = () => listings.filter((l) => l.kind === "experience" && l.id !== editing?.id).sort((a, b) => a.id - b.id);
const statusShort = { shown: "lst.shownShort", hidden: "lst.hiddenShort", full: "lst.fullShort", tours_only: "lst.toursOnlyShort" };
function renderExps() {
  const box = $("#l-exps"), list = experiences();
  expIds = expIds.filter((id) => list.some((e) => e.id === id));
  if (!list.length) return box.replaceChildren(el("p", { class: "muted small", text: t("lst.noExps") }));
  box.replaceChildren(...list.map((e) => el("label", { class: "check" },
    el("input", { type: "checkbox", checked: expIds.includes(e.id), onchange: (ev) => {
      expIds = ev.target.checked ? [...expIds, e.id] : expIds.filter((x) => x !== e.id);
      expIds.sort((a, b) => list.findIndex((x) => x.id === a) - list.findIndex((x) => x.id === b));
    } }),
    el("span", {}, el("strong", { text: e.name }), " ",
      el("span", { class: "muted small", text: [e.durationHours ? t("wisata.duration", { n: e.durationHours }) : "", t(statusShort[e.status])].filter(Boolean).join(" · ") })))));
}
// Writes the tour's description and "included" list (Indonesian and English) from the ticked experiences.
const firstSentence = (txt) => { const line = (txt || "").split("\n").find((x) => x.trim()) || ""; return (line.match(/^.*?[.!?](?=\s|$)/) || [line])[0].trim(); };
const lines = (txt) => (txt || "").split("\n").map((x) => x.trim()).filter(Boolean);
$("#l-autofill").addEventListener("click", () => {
  const picked = expIds.map((id) => listings.find((l) => l.id === id)).filter(Boolean);
  if (!picked.length) return toast(t("lst.pickExps"));
  if (($("#l-desc").value.trim() || $("#l-inc").value.trim()) && !confirm(t("lst.overwrite"))) return;
  const hours = picked.reduce((sum, e) => sum + (e.durationHours || 0), 0);
  const fmtH = (n, l2) => new Intl.NumberFormat(l2 === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: 1 }).format(n);
  const write = (l2) => {
    const en = l2 === "en";
    const name = (e) => (en && e.nameEn) || e.name;
    const desc = (e) => firstSentence((en && e.descriptionEn) || e.description);
    const items = picked.map((e, i) => `${i + 1}. ${name(e)}${e.durationHours ? " (" + tIn(l2, "lst.autoHours", { n: fmtH(e.durationHours, l2) }) + ")" : ""}${desc(e) ? ": " + desc(e) : ""}`);
    const inc = [...new Set(picked.flatMap((e) => lines((en && e.includesEn) || e.includes)))];
    return { desc: [tIn(l2, "lst.autoIntro", { n: picked.length }), ...items].join("\n"), inc: (inc.length ? inc : picked.map(name)).join("\n") };
  };
  const id = write("id"), en = write("en");
  $("#l-desc").value = id.desc; $("#l-inc").value = id.inc; $("#l-desc-en").value = en.desc; $("#l-inc-en").value = en.inc;
  for (const n of [$("#l-desc-en"), $("#l-inc-en")]) { n.placeholder = ""; delete n.dataset.auto; }
  if (hours) $("#l-hours").value = hours;
  if (!$("#l-loc").value.trim()) $("#l-loc").value = picked.find((e) => e.location)?.location || "";
  const note = $("#l-autofill-note");
  note.textContent = t(hours ? "lst.autofillDoneHours" : "lst.autofillDone", { n: picked.length, h: fmtH(hours, document.documentElement.lang) });
  note.hidden = false;
});

// ---------- writing an experience's description from four short answers ----------
const clean = (v) => v.trim().replace(/[.!\s]+$/, "");
$("#w-go").addEventListener("click", () => {
  const [act, who, take, good] = ["#w-do", "#w-who", "#w-take", "#w-for"].map((id) => clean($(id).value));
  if (!act) { toast(t("lst.wNeedDo")); return $("#w-do").focus(); }
  if ($("#l-desc").value.trim() && !confirm(t("lst.overwrite"))) return;
  $("#l-desc").value = [
    `Dalam pengalaman ini, Anda akan ${act}.`,
    who ? `Kegiatan dipandu oleh ${who}.` : "",
    take ? `Di akhir kegiatan, Anda membawa pulang ${take}.` : "",
    good ? `Cocok untuk ${good}.` : "",
  ].filter(Boolean).join(" ");
  if (take && !$("#l-inc").value.toLowerCase().includes(take.toLowerCase())) $("#l-inc").value = [...lines($("#l-inc").value), "Bawa pulang: " + take].join("\n");
  // The old English no longer matches, so it's left empty and translated again when saved.
  $("#l-desc-en").value = "";
  toast(t("lst.wDone"));
});
function syncMode() {
  $("#l-notice-field").hidden = mode() !== "request";
  $("#l-dates-field").hidden = mode() !== "dates";
}
$("#l-kind").addEventListener("change", () => { syncKind(); renderExps(); });
document.querySelectorAll('input[name="l-mode"]').forEach((r) => r.addEventListener("change", syncMode));

const fmtDate = (d) => new Date(d).toLocaleString(document.documentElement.lang === "en" ? "en-GB" : "id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
function renderDates() {
  $("#l-dates").replaceChildren(...dates.map((d) => el("button", { type: "button", "aria-label": t("lst.removeDate", { date: fmtDate(d) }), onclick: () => { dates = dates.filter((x) => x !== d); renderDates(); } }, fmtDate(d) + "  ×")));
}
$("#l-date-add").addEventListener("click", () => {
  const v = $("#l-date").value;
  if (!v) return toast(t("lst.pickDate"));
  if (!dates.includes(v)) dates = [...dates, v].sort();
  $("#l-date").value = ""; renderDates();
});

function renderThumbs() {
  const box = $("#l-thumbs"); box.replaceChildren();
  const thumb = (src, remove) => el("div", { class: "thumb" }, el("img", { src, alt: "" }), el("button", { type: "button", "aria-label": t("product.removePhoto"), onclick: remove, text: "×" }));
  savedPhotos.forEach((src) => box.append(thumb(src, async () => {
    try { ({ photos: savedPhotos } = await api(`/api/admin/listings/${editing.id}/photos`, { method: "DELETE", body: { photo: src } })); renderThumbs(); load(); toast(t("product.photoRemoved")); }
    catch (e) { handle(e); }
  })));
  pendingPhotos.forEach((src, i) => box.append(thumb(src, () => { pendingPhotos.splice(i, 1); renderThumbs(); })));
  $("#l-photos").disabled = savedPhotos.length + pendingPhotos.length >= 10;
}
$("#l-photos").addEventListener("change", async (e) => {
  for (const f of [...e.target.files]) {
    if (savedPhotos.length + pendingPhotos.length >= 10) { toast(t("lst.maxPhotos")); break; }
    try { pendingPhotos.push(await shrinkPhoto(f)); } catch { toast(t("product.badPhoto")); }
  }
  e.target.value = ""; renderThumbs();
});

function labelForm() {
  $("#listingFormTitle").textContent = editing ? t("common.editTitle", { name: editing.name }) : t("lst.addTitle");
  $("#listingSubmit").textContent = t(editing ? "common.saveChanges" : "lst.save");
  $("#listingCancel").hidden = !editing;
}
function resetForm() {
  editing = null; dates = []; savedPhotos = []; pendingPhotos = []; expIds = [];
  $("#l-autofill-note").hidden = true; $("#l-writer").open = false;
  $("#listingForm").reset(); $("#listingErr").hidden = true;
  document.querySelectorAll("#listingForm [data-auto]").forEach((n) => { n.placeholder = ""; delete n.dataset.auto; });
  syncKind(); syncMode(); renderDates(); renderThumbs(); renderExps(); labelForm();
}
$("#listingCancel").addEventListener("click", resetForm);

function editListing(l) {
  resetForm();
  editing = l;
  $("#l-kind").value = l.kind; $("#l-status").value = l.status;
  $("#l-name").value = l.name; $("#l-desc").value = l.description; $("#l-inc").value = l.includes;
  // Machine-translated English stays out of the boxes (shown as a hint) so it's translated again if the Indonesian changes.
  for (const [id, v] of [["#l-name-en", l.nameEn], ["#l-desc-en", l.descriptionEn], ["#l-inc-en", l.includesEn]]) {
    if (l.enAuto) { $(id).value = ""; $(id).placeholder = v ? t("lst.autoWas", { text: v.slice(0, 120) }) : ""; $(id).dataset.auto = "1"; }
    else $(id).value = v;
  }
  $("#l-price").value = l.price ?? ""; $("#l-hours").value = l.durationHours ?? "";
  $("#l-min").value = l.groupMin ?? ""; $("#l-max").value = l.groupMax ?? ""; $("#l-loc").value = l.location;
  const s = l.schedule || { mode: "request", noticeDays: 3 };
  document.querySelector(`input[name="l-mode"][value="${s.mode}"]`).checked = true;
  $("#l-notice").value = s.noticeDays ?? 3; dates = s.mode === "dates" ? [...s.dates] : [];
  savedPhotos = [...l.photos]; expIds = [...(l.experienceIds || [])];
  syncKind(); syncMode(); renderDates(); renderThumbs(); renderExps(); labelForm();
  $("#listingForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#listingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#listingErr"); err.hidden = true;
  const btn = $("#listingSubmit"); btn.disabled = true; btn.textContent = t("lst.saving");
  const body = {
    kind: kind(), status: $("#l-status").value,
    name: $("#l-name").value, nameEn: $("#l-name-en").value,
    description: $("#l-desc").value, descriptionEn: $("#l-desc-en").value,
    includes: $("#l-inc").value, includesEn: $("#l-inc-en").value,
    price: $("#l-price").value, durationHours: $("#l-hours").value,
    groupMin: kind() !== "homestay" ? $("#l-min").value : "", groupMax: $("#l-max").value, location: $("#l-loc").value,
    schedule: mode() === "dates" ? { mode: "dates", dates } : { mode: "request", noticeDays: $("#l-notice").value },
    experienceIds: kind() === "tour" ? expIds : [],
  };
  try {
    const { listing } = await api(editing ? "/api/admin/listings/" + editing.id : "/api/admin/listings", { method: editing ? "PUT" : "POST", body });
    for (const photo of pendingPhotos) await api(`/api/admin/listings/${listing.id}/photos`, { method: "POST", body: { photo } });
    toast(t(editing ? "lst.saved" : "lst.added", { name: listing.name }) + (listing.enAuto && !listing.nameEn ? " " + t("lst.translateFailed") : ""));
    resetForm(); load();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
  btn.disabled = false; labelForm();
});

// ---------- list ----------
function scheduleCell(l) {
  if (l.kind === "homestay" || !l.schedule) return "–";
  if (l.schedule.mode === "request") return t("lst.anyTime", { n: l.schedule.noticeDays || 0 });
  const now = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }).replace(" ", "T").slice(0, 16);
  const next = l.schedule.dates.filter((d) => d > now);
  return next.length ? t("lst.nextDate", { date: fmtDate(next[0]), n: next.length }) : t("lst.noUpcoming");
}
function renderRows() {
  const body = $("#listingRows"); body.replaceChildren();
  if (!listings.length) body.append(el("tr", {}, el("td", { colspan: "6", class: "muted", text: t("lst.none") })));
  for (const l of listings) {
    const pill = { shown: ["live", "lst.shownShort"], hidden: ["hidden", "lst.hiddenShort"], full: ["paused", "lst.fullShort"], tours_only: ["live", "lst.toursOnlyShort"] }[l.status];
    const inTour = l.kind === "tour" && l.experienceIds.length ? t("lst.expCount", { n: l.experienceIds.length }) : "";
    body.append(el("tr", {},
      el("td", {}, l.photos[0] ? el("img", { src: l.photos[0], alt: "" }) : el("img", { alt: "" })),
      el("td", {}, el("strong", { text: l.name }), l.price != null || inTour ? el("div", { class: "muted small", text: [l.price == null ? "" : l.price ? rp(l.price) : t("wisata.free"), inTour].filter(Boolean).join(" · ") }) : null),
      el("td", { text: t({ tour: "lst.tour", experience: "lst.experience", homestay: "lst.homestay" }[l.kind]) }),
      el("td", {}, el("span", { class: "pill " + pill[0], text: t(pill[1]) })),
      el("td", { class: "small", text: scheduleCell(l) }),
      el("td", {}, el("div", { class: "acts" },
        el("button", { class: "btn small ghost", type: "button", onclick: () => editListing(l) }, t("common.edit")),
        el("button", { class: "btn small warn", type: "button", onclick: async () => { if (await confirmBox({ title: t("del.title", { name: l.name }), text: t("del.itemText"), confirm: t("admin.delete") })) removeListing(l); } }, t("admin.delete"))))));
  }
}
async function removeListing(l) {
  try { await api("/api/admin/listings/" + l.id, { method: "DELETE" }); if (editing?.id === l.id) resetForm(); toast(t("admin.deleted", { name: l.name })); load(); }
  catch (e) { handle(e); }
}

window.addEventListener("langchange", () => { syncKind(); labelForm(); renderDates(); renderRows(); renderExps(); });
resetForm();
