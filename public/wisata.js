// Wisata tab: tours and homestays the admins list, each with a "sign up / ask" helper that opens WhatsApp.
// The message to the host is always in Indonesian; English visitors also see what it says.
import { $, el, t, rp, icon, api, leafSvg, waNumber, telNumber } from "/common.js";
import { lang, tIn } from "/i18n.js";

let listings = [];
let site = null;

const pick = (l, field) => (lang === "en" && l[field + "En"]) || l[field];
const num = (n) => new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: 1 }).format(n);

// ---------- cards ----------
function photos(l) {
  if (!l.photos.length) return el("div", { class: "photo" }, leafSvg());
  if (l.photos.length === 1) return el("div", { class: "photo" }, el("img", { src: l.photos[0], alt: "", loading: "lazy" }));
  const track = el("div", { class: "pics" }, ...l.photos.map((src) => el("div", {}, el("img", { src, alt: "", loading: "lazy" }))));
  const dots = el("div", { class: "pic-dots", "aria-hidden": "true" }, ...l.photos.map((_, i) => el("span", { class: i ? "" : "on" })));
  track.addEventListener("scroll", () => {
    const at = Math.round(track.scrollLeft / track.clientWidth);
    [...dots.children].forEach((d, i) => (d.className = i === at ? "on" : ""));
  }, { passive: true });
  const go = (d) => track.scrollBy({ left: d * track.clientWidth, behavior: "smooth" });
  return el("div", { class: "photo multi" }, track, dots,
    el("button", { type: "button", class: "pic-nav prev", "aria-label": t("photos.prev"), onclick: () => go(-1) }, icon("chevron-left")),
    el("button", { type: "button", class: "pic-nav next", "aria-label": t("photos.next"), onclick: () => go(1) }, icon("chevron-right")));
}
function priceText(l) {
  if (l.price == null) return t("wisata.priceAsk");
  if (l.price === 0) return t("wisata.free");
  return rp(l.price) + " " + t(l.kind === "tour" ? "wisata.perPerson" : "wisata.perNight");
}
function groupText(l) {
  const who = l.kind === "tour" ? "wisata.people" : "wisata.guests";
  if (l.groupMin && l.groupMax) return t(who, { n: l.groupMin + "–" + l.groupMax });
  if (l.groupMax) return t("wisata.atMost", { n: t(who, { n: l.groupMax }) });
  if (l.groupMin) return t("wisata.atLeast", { n: t(who, { n: l.groupMin }) });
  return null;
}
// "2026-10-18T08:00" → "Sabtu, 18 Oktober 2026 · 08.00" in the given language.
function dateText(stamp, l2 = lang) {
  const [d, time] = stamp.split("T");
  const day = new Date(d + "T12:00:00").toLocaleDateString(l2 === "id" ? "id-ID" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return time ? day + " · " + (l2 === "id" ? time.replace(":", ".") : time) : day;
}
function scheduleLine(l) {
  const s = l.schedule;
  if (!s) return null;
  if (s.mode === "request") return el("p", { class: "fact" }, icon("calendar"), s.noticeDays ? t("wisata.onRequestNotice", { n: s.noticeDays }) : t("wisata.onRequest"));
  if (!s.dates.length) return el("p", { class: "fact" }, icon("calendar"), t("wisata.noDates"));
  return el("div", { class: "fact dates" }, icon("calendar"),
    el("div", {}, el("strong", { text: t("wisata.nextDates") }), el("ul", {}, ...s.dates.slice(0, 4).map((d) => el("li", { text: dateText(d) })))));
}
function card(l) {
  const phone = l.kind === "tour" ? site?.tourPhone : site?.homestayPhone;
  const includes = (pick(l, "includes") || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const full = l.status === "full";
  return el("article", { class: "card listing", id: (l.kind === "tour" ? "tur-" : "homestay-") + l.id },
    photos(l),
    full ? el("span", { class: "full-badge", text: t("wisata.full") }) : null,
    el("div", { class: "body" },
      el("div", { class: "card-head" }, el("h3", { text: pick(l, "name") }), el("span", { class: "price", text: priceText(l) })),
      l.description ? el("p", { class: "desc", text: pick(l, "description") }) : null,
      el("div", { class: "facts" },
        l.durationHours ? el("p", { class: "fact" }, icon("clock"), t("wisata.duration", { n: num(l.durationHours) })) : null,
        groupText(l) ? el("p", { class: "fact" }, icon("home"), groupText(l)) : null,
        l.location ? el("p", { class: "fact" }, icon("map-pin"), l.location) : null,
        scheduleLine(l)),
      includes.length ? el("div", { class: "includes" }, el("strong", { text: t(l.kind === "tour" ? "wisata.included" : "wisata.facilities") }),
        el("ul", {}, ...includes.map((x) => el("li", { text: x })))) : null,
      full ? el("p", { class: "muted small", text: t(l.kind === "tour" ? "wisata.fullText" : "wisata.fullTextStay") })
        : waNumber(phone) ? el("div", { class: "reach" },
            el("button", { type: "button", class: "btn", onclick: () => openBooking(l) }, icon("message"), t(l.kind === "tour" ? "wisata.signUp" : "wisata.askStay")),
            telNumber(phone) ? el("a", { class: "btn ghost", href: "tel:" + telNumber(phone) }, icon("phone"), t("contact.call")) : null)
        : el("p", { class: "muted small", text: t("site.soon") })));
}
function render() {
  for (const [kind, grid, empty] of [["tour", "#tourGrid", "#toursEmpty"], ["homestay", "#stayGrid", "#staysEmpty"]]) {
    const items = listings.filter((l) => l.kind === kind);
    $(grid).replaceChildren(...items.map(card));
    $(grid).hidden = !items.length;
    $(empty).hidden = items.length > 0;
  }
  if (location.hash && !render.scrolled) { render.scrolled = true; document.querySelector(location.hash)?.scrollIntoView({ block: "start" }); }
}

// ---------- booking helper ----------
const dialog = $("#book");
let booking = null;
$("#bookClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
const todayWib = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const addDays = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

function openBooking(l) {
  booking = { l, date: "", people: l.groupMin || (l.kind === "tour" ? 1 : 1), nights: 1, name: "" };
  const s = l.schedule;
  if (l.kind === "tour" && s && s.mode === "dates" && s.dates.length) booking.date = s.dates[0];
  drawBooking();
  if (!dialog.open) dialog.showModal();
}
function message(l2) {
  const { l, date, people, nights, name } = booking;
  const say = (k, v) => tIn(l2, k, v);
  const lines = l.kind === "tour"
    ? [say("book.msgTour", { name: l.name }), date ? say("book.msgDate", { date: dateText(date, l2) }) : null, say("book.msgPeople", { n: people })]
    : [say("book.msgStay", { name: l.name }), date ? say("book.msgCheckIn", { date: dateText(date, l2), n: nights }) : null, say("book.msgGuests", { n: people })];
  return [...lines, name ? say("book.msgName", { name }) : null, "", say("msg.thanks")].filter((x) => x != null).join("\n");
}
function drawBooking() {
  const { l } = booking;
  const tour = l.kind === "tour";
  $("#bookTitle").textContent = t(tour ? "book.titleTour" : "book.titleStay", { name: pick(l, "name") });
  const form = $("#bookForm"); form.replaceChildren();
  const field = (id, label, input) => el("div", { class: "field" }, el("label", { for: id, text: label }), input);
  const s = l.schedule;
  const minDate = addDays(todayWib(), tour && s?.mode === "request" ? s.noticeDays || 0 : 0);
  let dateInput;
  if (tour && s?.mode === "dates" && s.dates.length) {
    dateInput = el("select", { id: "book-date", onchange: (e) => { booking.date = e.target.value; update(); } },
      ...s.dates.map((d) => el("option", { value: d, selected: d === booking.date, text: dateText(d) })));
  } else {
    dateInput = el("input", { type: "date", id: "book-date", min: minDate, value: booking.date, required: true, oninput: (e) => { booking.date = e.target.value; update(); } });
  }
  form.append(field("book-date", t(tour ? "book.date" : "book.checkIn"), dateInput));
  if (!tour) form.append(field("book-nights", t("book.nights"), el("input", { type: "number", id: "book-nights", min: "1", max: "30", value: String(booking.nights), oninput: (e) => { booking.nights = Math.max(1, Number(e.target.value) || 1); update(); } })));
  form.append(field("book-people", t(tour ? "book.people" : "book.guests"), el("input", { type: "number", id: "book-people", min: String(l.groupMin || 1), max: l.groupMax ? String(l.groupMax) : null, value: String(booking.people),
    oninput: (e) => { booking.people = Math.max(1, Number(e.target.value) || 1); update(); } })));
  form.append(field("book-name", t("order.nameLabel"), el("input", { type: "text", id: "book-name", maxlength: "40", autocomplete: "name", value: booking.name, oninput: (e) => { booking.name = e.target.value.trim(); update(); } })));
  if (tour && s?.mode === "request" && s.noticeDays) form.append(el("p", { class: "muted small", text: t("wisata.onRequestNotice", { n: s.noticeDays }) }));
  const preview = el("pre", { class: "order-message" });
  const meaning = lang === "en" ? el("details", { class: "order-meaning" }, el("summary", { text: t("order.meaning") }), el("pre", { class: "order-message", id: "book-meaning" })) : null;
  const send = el("a", { class: "btn", target: "_blank", rel: "noopener" }, icon("message"), t("order.send"));
  const warn = el("p", { class: "formerr", hidden: true });
  form.append(el("p", { class: "small", text: t("book.preview") }), preview, meaning, warn, el("div", { class: "order-nav" }, send));
  function update() {
    const phone = l.kind === "tour" ? site?.tourPhone : site?.homestayPhone;
    const text = message("id");
    preview.textContent = text;
    if (meaning) meaning.querySelector("pre").textContent = message("en");
    const missing = !booking.date ? t("book.needDate") : !booking.name ? t("book.needName") : "";
    warn.textContent = missing; warn.hidden = !missing;
    send.setAttribute("aria-disabled", String(!!missing));
    send.href = missing ? "#" : "https://wa.me/" + waNumber(phone) + "?text=" + encodeURIComponent(text);
  }
  send.addEventListener("click", (e) => { if (send.getAttribute("aria-disabled") === "true") e.preventDefault(); });
  form.onsubmit = (e) => e.preventDefault();
  update();
}

// ---------- start ----------
async function load() {
  try {
    const [a, b] = await Promise.all([api("/api/listings"), api("/api/site").catch(() => ({ site: null }))]);
    listings = a.listings; site = b.site;
  } catch { listings = []; }
  render();
}
window.addEventListener("langchange", () => { render(); if (dialog.open && booking) drawBooking(); });
load();
