// Admin → Wisata: add, edit and delete tours and homestays, with photos and dates.
import { $, el, t, rp, api, toast, shrinkPhoto, confirmTap } from "/common.js";

let listings = [];
let editing = null;     // the listing being edited, or null when adding
let dates = [];         // tour dates in the form, "2026-10-18T08:00"
let savedPhotos = [];   // photos already on the listing being edited
let pendingPhotos = []; // photos picked but not uploaded yet (data URLs)

const kind = () => $("#l-kind").value;
const mode = () => document.querySelector('input[name="l-mode"]:checked').value;

function handle(e) { toast(e.message); }

async function load() {
  try { ({ listings } = await api("/api/admin/listings")); } catch (e) { return handle(e); }
  renderRows();
}
document.querySelector('[data-tab="wisata"]').addEventListener("click", load);

// ---------- form ----------
// Fields and labels that differ between tours and homestays.
function syncKind() {
  const tour = kind() === "tour";
  document.querySelectorAll("#listingForm .tour-only").forEach((n) => (n.hidden = !tour));
  $("#l-price-label").textContent = t(tour ? "lst.pricePerson" : "lst.priceNight");
  $("#l-max-label").textContent = t(tour ? "lst.groupMax" : "lst.guestsMax");
  $("#l-loc-label").textContent = t(tour ? "lst.meetingPoint" : "lst.stayLocation");
  $("#l-inc-label").textContent = t(tour ? "lst.includesLabel" : "lst.facilitiesLabel");
}
function syncMode() {
  $("#l-notice-field").hidden = mode() !== "request";
  $("#l-dates-field").hidden = mode() !== "dates";
}
$("#l-kind").addEventListener("change", syncKind);
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
  $("#l-photos").disabled = savedPhotos.length + pendingPhotos.length >= 5;
}
$("#l-photos").addEventListener("change", async (e) => {
  for (const f of [...e.target.files]) {
    if (savedPhotos.length + pendingPhotos.length >= 5) { toast(t("lst.maxPhotos")); break; }
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
  editing = null; dates = []; savedPhotos = []; pendingPhotos = [];
  $("#listingForm").reset(); $("#listingErr").hidden = true;
  document.querySelectorAll("#listingForm [data-auto]").forEach((n) => { n.placeholder = ""; delete n.dataset.auto; });
  syncKind(); syncMode(); renderDates(); renderThumbs(); labelForm();
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
  savedPhotos = [...l.photos];
  syncKind(); syncMode(); renderDates(); renderThumbs(); labelForm();
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
    groupMin: kind() === "tour" ? $("#l-min").value : "", groupMax: $("#l-max").value, location: $("#l-loc").value,
    schedule: mode() === "dates" ? { mode: "dates", dates } : { mode: "request", noticeDays: $("#l-notice").value },
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
  if (l.kind !== "tour" || !l.schedule) return "–";
  if (l.schedule.mode === "request") return t("lst.anyTime", { n: l.schedule.noticeDays || 0 });
  const now = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }).replace(" ", "T").slice(0, 16);
  const next = l.schedule.dates.filter((d) => d > now);
  return next.length ? t("lst.nextDate", { date: fmtDate(next[0]), n: next.length }) : t("lst.noUpcoming");
}
function renderRows() {
  const body = $("#listingRows"); body.replaceChildren();
  if (!listings.length) body.append(el("tr", {}, el("td", { colspan: "6", class: "muted", text: t("lst.none") })));
  for (const l of listings) {
    const pill = { shown: ["live", "lst.shownShort"], hidden: ["hidden", "lst.hiddenShort"], full: ["paused", "lst.fullShort"] }[l.status];
    body.append(el("tr", {},
      el("td", {}, l.photos[0] ? el("img", { src: l.photos[0], alt: "" }) : el("img", { alt: "" })),
      el("td", {}, el("strong", { text: l.name }), l.price != null ? el("div", { class: "muted small", text: l.price ? rp(l.price) : t("wisata.free") }) : null),
      el("td", { text: t(l.kind === "tour" ? "lst.tour" : "lst.homestay") }),
      el("td", {}, el("span", { class: "pill " + pill[0], text: t(pill[1]) })),
      el("td", { class: "small", text: scheduleCell(l) }),
      el("td", {}, el("div", { class: "acts" },
        el("button", { class: "btn small ghost", type: "button", onclick: () => editListing(l) }, t("common.edit")),
        el("button", { class: "btn small warn", type: "button", onclick: (ev) => confirmTap(ev.currentTarget, t("admin.deleteConfirm"), () => removeListing(l)) }, t("admin.delete"))))));
  }
}
async function removeListing(l) {
  try { await api("/api/admin/listings/" + l.id, { method: "DELETE" }); if (editing?.id === l.id) resetForm(); toast(t("admin.deleted", { name: l.name })); load(); }
  catch (e) { handle(e); }
}

window.addEventListener("langchange", () => { syncKind(); labelForm(); renderDates(); renderRows(); });
resetForm();
