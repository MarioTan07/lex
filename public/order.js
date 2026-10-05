// Step-by-step order helper: asks what and how many, when to pick up, any requests and a name,
// then opens WhatsApp with the order written out. The seller always gets it in Indonesian.
// For shops that deliver, the buyer can instead ask for delivery to an area; the cost and time are
// then agreed with the seller on WhatsApp, so the message asks for the delivery cost.
import { $, el, rp, t, api, waNumber, deliveryLine, sizesOf } from "/common.js";
import { lang, tIn, langInfo } from "/i18n.js";

// Ready-made requests (text keys). Not spicy and extra spicy can't both be picked.
const REQUESTS = ["req.sauceSeparate", "req.notSpicy", "req.extraSpicy", "req.extraKrupuk"];
const CLASHES = { "req.notSpicy": "req.extraSpicy", "req.extraSpicy": "req.notSpicy" };

// Pickup times every half hour from 07.00 to 21.00; today's list starts at least 30 minutes from now.
function slots(day) {
  const out = [];
  const now = new Date(), earliest = now.getHours() * 60 + now.getMinutes() + 30;
  for (let m = 7 * 60; m <= 21 * 60; m += 30) if (day !== "today" || m >= earliest) out.push(m);
  return out;
}
const hhmm = (m, sep = ":") => String(Math.floor(m / 60)).padStart(2, "0") + sep + String(m % 60).padStart(2, "0");

let o = null;           // the order being put together
const translated = new Map(); // language + note → { id, back }, so going back and forth doesn't translate again

const dialog = $("#order");
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // tap outside the box
$("#orderClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { if (!dialog.open) o = null; }); // it may already be reopened for another order
window.addEventListener("langchange", () => { if (o) render(); });

// One line per packaging on sale, so a product in several packagings gives several lines to choose from.
const linesOf = (menu) => menu.flatMap((p) => {
  const all = sizesOf(p);
  return all.map((s, i) => ({ ...s, key: p.id + ":" + i, id: p.id, name: p.name, sized: all.length > 1 })).filter((l) => !l.out);
});
// "Pecel semanggi", or "Pecel semanggi (kotak isi 10)" for one of several packagings.
const label = (p) => (p.sized && p.unit ? `${p.name} (${p.unit})` : p.name);

// `menu` is the shop's products that can be ordered; `firstId` starts with one of that product.
export function openOrder(stall, menu, firstId) {
  const lines = linesOf(menu), first = lines.find((l) => l.id === firstId);
  o = { stall, menu: lines, qty: new Map(first ? [[first.key, 1]] : []), how: "pickup", area: "", day: null, time: null, reqs: new Set(), note: "", name: "", step: 0, noteId: null, noteFailed: false };
  if (delivers()) o.how = null;
  render();
  if (!dialog.open) dialog.showModal();
}

const chosen = () => o.menu.filter((p) => o.qty.get(p.key) > 0);
const delivers = () => o.stall.delivery?.mode === "delivery";
// "secepatnya" / "hari ini" / "besok", for delivery (no pickup time).
const dayWord = (l) => tIn(l, { asap: "msg.asap", today: "msg.dayToday", tomorrow: "msg.dayTomorrow" }[o.day]);
const total = () => chosen().reduce((sum, p) => sum + p.price * o.qty.get(p.key), 0);

// ---------- the WhatsApp message ----------
// "2 bungkus Peyek semanggi" reads well, but a "Dijual per" that is just a count ("1", "65", "isi 12", "10 buah")
// would give "2 1 car". Then the line is "2× car", plus the pack size when it's more than one: "2× car, isi 65 buah".
const COUNT_UNIT = /^\s*(?:isi\s*)?(\d+)\s*(?:buah|biji|pcs?|potong|butir)?\s*$/i;
// " / bungkus" after a price; a count unit shows as the pack size (" / isi 65 buah"), or nothing for one piece.
function unitText(p, l = lang) {
  const count = COUNT_UNIT.exec(p.unit || "");
  const pack = p.pieces || (count ? Number(count[1]) : 0);
  if (p.unit && !count) return " / " + p.unit;
  return pack > 1 ? " / " + tIn(l, "msg.pack", { n: pack }) : "";
}
function itemLine(p, l) {
  const n = o.qty.get(p.key);
  const count = COUNT_UNIT.exec(p.unit || "");
  const pack = p.pieces || (count ? Number(count[1]) : 0);
  const what = p.unit && !count ? `${n} ${p.unit} ${p.name}`
    : `${n}× ${p.name}` + (pack > 1 ? ", " + tIn(l, "msg.pack", { n: pack }) : "");
  return "• " + what + " (" + rp(p.price * n) + ")";
}
function message(l, note) {
  const when = o.day === "asap" ? tIn(l, "msg.asap")
    : tIn(l, o.day === "today" ? "msg.today" : "msg.tomorrow", { time: hhmm(o.time, l === "id" ? "." : ":") });
  const reqs = [...o.reqs].map((k) => tIn(l, k).toLowerCase());
  return [
    tIn(l, "msg.hello", { stall: o.stall.stallName }),
    ...chosen().map((p) => itemLine(p, l)),
    tIn(l, "msg.total", { total: rp(total()) }),
    "",
    ...(o.how === "deliver" ? [tIn(l, "msg.deliver", { area: o.area, when: dayWord(l) }), tIn(l, "msg.deliverCost")] : [tIn(l, "msg.pickup", { when })]),
    reqs.length ? tIn(l, "msg.requests", { list: reqs.join(", ") }) : null,
    note ? tIn(l, "msg.note", { note }) : null,
    note && l === "id" && note !== o.note ? tIn(l, "msg.noteOriginal", { note: o.note, language: langInfo().idName }) : null,
    tIn(l, "msg.name", { name: o.name }),
    "",
    tIn(l, "msg.thanks"),
  ].filter((x) => x != null).join("\n");
}

// ---------- steps ----------
// Each step has the helper's question, the buyer's answer once given, and the controls to answer it.
const STEPS = [
  { q: "order.qItems", answer: () => chosen().map((p) => `${o.qty.get(p.key)} × ${label(p)}`).join(", "), controls: itemsStep },
  { q: () => delivers() ? "order.qHow" : "order.qPickup", controls: pickupStep,
    answer: () => o.how === "deliver" ? t("order.answerDeliver", { area: o.area, when: dayWord(lang) })
      : (delivers() ? t("order.howPickup") + ", " : "") + (o.day === "asap" ? t("order.asap") : t(o.day === "today" ? "order.pickupToday" : "order.pickupTomorrow", { time: hhmm(o.time) })) },
  { q: "order.qRequests", answer: () => [...[...o.reqs].map((k) => t(k)), o.note ? "“" + o.note + "”" : null].filter(Boolean).join(", ") || t("order.noRequests"), controls: requestsStep },
  { q: "order.qName", answer: () => o.name, controls: nameStep },
  { q: "order.qReady", controls: readyStep },
];

function render() {
  $("#orderTitle").textContent = t("order.title", { name: o.stall.stallName });
  $("#orderClose").textContent = t("order.close");
  const chat = $("#orderChat"); chat.replaceChildren();
  const question = (s) => t(typeof s.q === "function" ? s.q() : s.q);
  for (let i = 0; i < o.step; i++) {
    chat.append(el("p", { class: "bubble bot", text: question(STEPS[i]) }), el("p", { class: "bubble me", text: STEPS[i].answer() }));
  }
  const step = STEPS[o.step];
  chat.append(el("p", { class: "bubble bot", text: question(step) }));
  const box = el("div", { class: "order-step" });
  chat.append(box);
  step.controls(box);
  requestAnimationFrame(() => box.scrollIntoView({ block: "end", behavior: "smooth" }));
}

const go = (step) => { o.step = step; render(); };
// Back and next buttons under each step.
function nav(box, { next, canNext = true, extra } = {}) {
  box.append(el("div", { class: "order-nav" },
    o.step > 0 ? el("button", { type: "button", class: "btn ghost", onclick: () => go(o.step - 1), text: t("order.back") }) : null,
    extra || null,
    next ? el("button", { type: next === "submit" ? "submit" : "button", class: "btn", disabled: !canNext, onclick: next === "submit" ? null : next, text: t("order.next") }) : null));
}

function itemsStep(box) {
  const totalLine = el("p", { class: "order-total" });
  const nextBtn = () => box.querySelector(".order-nav .btn:not(.ghost)");
  const refresh = () => {
    totalLine.replaceChildren(el("span", { text: t("order.total") }), el("strong", { text: rp(total()) }));
    const b = nextBtn(); if (b) b.disabled = !chosen().length;
  };
  const list = el("div", { class: "order-items" });
  for (const p of o.menu) {
    const count = el("output", { text: String(o.qty.get(p.key) || 0) });
    const change = (d) => {
      const n = Math.max(0, Math.min(99, (o.qty.get(p.key) || 0) + d));
      o.qty.set(p.key, n); count.textContent = String(n); refresh();
    };
    list.append(el("div", { class: "order-item" },
      el("div", {}, el("strong", { text: p.name }), el("span", { class: "muted small", text: " " + rp(p.price) + unitText(p) })),
      el("div", { class: "stepper" },
        el("button", { type: "button", "aria-label": t("order.less", { name: label(p) }), onclick: () => change(-1), text: "−" }),
        count,
        el("button", { type: "button", "aria-label": t("order.more", { name: label(p) }), onclick: () => change(1), text: "+" }))));
  }
  box.append(list, totalLine);
  nav(box, { next: () => go(1), canNext: chosen().length > 0 });
  refresh();
}

function pickupStep(box) {
  const today = slots("today");
  const days = [["asap", "order.asap"], ["today", "order.today"], ["tomorrow", "order.tomorrow"]];
  const draw = () => {
    box.replaceChildren();
    // Shops that deliver: first pick up or delivery.
    if (delivers()) {
      box.append(el("div", { class: "chips" }, ...[["pickup", "order.howPickup"], ["deliver", "order.howDeliver"]].map(([h, key]) => el("button", {
        type: "button", "aria-pressed": String(o.how === h), text: t(key),
        // Today's pickup times may have run out; delivery today can still be asked for.
        onclick: () => { o.how = h; if (h === "pickup" && o.day === "today" && !today.length) o.day = null; draw(); },
      }))));
      if (!o.how) return nav(box, { next: () => go(2), canNext: false });
    }
    const deliver = o.how === "deliver";
    if (deliver) {
      const area = el("input", { type: "text", id: "order-area", maxlength: "80", autocomplete: "address-level2", placeholder: t("order.areaPlaceholder"),
        oninput: (e) => { o.area = e.target.value.trim(); const b = box.querySelector(".order-nav .btn:not(.ghost)"); if (b) b.disabled = !(o.day && o.area); } });
      area.value = o.area;
      box.append(deliveryLine(o.stall, { full: true }) || "",
        el("div", { class: "field" }, el("label", { for: "order-area", text: t("order.areaLabel") }), area,
          el("span", { class: "hint", text: t("order.deliverHint") })),
        el("p", { class: "small", style: "font-weight:600", text: t("order.deliverWhen") }));
    }
    box.append(el("div", { class: "chips" }, ...days.map(([d, key]) => el("button", {
      type: "button", "aria-pressed": String(o.day === d), disabled: !deliver && d === "today" && !today.length,
      onclick: () => { o.day = d; if (d !== "asap" && !slots(d).includes(o.time)) o.time = slots(d)[0]; draw(); },
      text: t(key),
    }))));
    if (deliver) return nav(box, { next: () => go(2), canNext: !!(o.day && o.area) });
    if (o.day === "today" || o.day === "tomorrow") {
      const sel = el("select", { id: "order-time", onchange: (e) => { o.time = Number(e.target.value); } },
        ...slots(o.day).map((m) => el("option", { value: String(m), selected: m === o.time, text: hhmm(m) })));
      box.append(el("div", { class: "field" }, el("label", { for: "order-time", text: t("order.time") }), sel));
    }
    nav(box, { next: () => go(2), canNext: !!o.day });
  };
  draw();
}

function requestsStep(box) {
  const chips = el("div", { class: "chips" });
  const drawChips = () => chips.replaceChildren(...REQUESTS.map((k) => el("button", {
    type: "button", "aria-pressed": String(o.reqs.has(k)), text: t(k),
    onclick: () => { if (o.reqs.has(k)) o.reqs.delete(k); else { o.reqs.add(k); o.reqs.delete(CLASHES[k]); } drawChips(); },
  })));
  drawChips();
  const note = el("textarea", { id: "order-note", maxlength: "200", rows: "2", placeholder: t("order.notePlaceholder"), oninput: (e) => { o.note = e.target.value.trim(); } });
  note.value = o.note;
  box.append(chips, el("div", { class: "field" },
    el("label", { for: "order-note", text: t("order.noteLabel") }), note, el("span", { class: "hint", text: t("order.noteHint") })));
  nav(box, { next: () => go(3) });
}

function nameStep(box) {
  const input = el("input", { type: "text", id: "order-name", maxlength: "40", required: true, autocomplete: "name" });
  input.value = o.name;
  const form = el("form", { class: "stack", onsubmit: (e) => { e.preventDefault(); o.name = input.value.trim(); if (o.name) go(4); } },
    el("div", { class: "field" }, el("label", { for: "order-name", text: t("order.nameLabel") }), input));
  box.append(form);
  nav(form, { next: "submit" });
  setTimeout(() => input.focus(), 50);
}

function readyStep(box) {
  const wa = waNumber(o.stall.phone);
  const preview = el("pre", { class: "order-message" });
  const send = el("a", { class: "btn", target: "_blank", rel: "noopener" }, t("order.send"));
  const status = el("p", { class: "muted small" });
  const meaning = lang !== "id" ? el("details", { class: "order-meaning" }, el("summary", { text: t("order.meaning") }), el("pre", { class: "order-message", text: message(lang, o.note) })) : null;
  box.append(preview, ...(meaning ? [meaning, el("p", { class: "muted small", text: t("order.sentInId") })] : []), status);
  nav(box, { extra: send });

  const back = el("p", { class: "order-back" });
  box.insertBefore(back, status);
  const fill = (noteId) => {
    const text = message("id", noteId);
    preview.textContent = text;
    send.href = "https://wa.me/" + wa + "?text=" + encodeURIComponent(text);
    send.removeAttribute("aria-disabled");
  };
  // Indonesian buyers' notes go as written; others are translated into Indonesian first, and back to check.
  if (!o.note || lang === "id") return fill(o.note);
  const showBack = (b) => {
    back.replaceChildren(el("strong", { text: t("order.backTitle") }), " “" + b + "”", el("br"), el("span", { class: "muted small", text: t("order.backHint") }));
  };
  const mt = langInfo().mt, key = lang + "|" + o.note;
  if (translated.has(key)) { const tr = translated.get(key); showBack(tr.back); return fill(tr.id); }
  send.setAttribute("aria-disabled", "true");
  send.addEventListener("click", (e) => { if (send.getAttribute("aria-disabled")) e.preventDefault(); });
  preview.textContent = t("order.translating");
  const note = o.note, current = o;
  const tr = (text, from, to) => api("/api/translate", { method: "POST", body: { text, from, to } }).then((r) => r.text);
  tr(note, mt, "id")
    .then(async (id) => {
      const b = await tr(id, "id", mt).catch(() => null);
      if (b) translated.set(key, { id, back: b });
      if (o === current && o.step === 4 && b) showBack(b);
      return id;
    })
    .catch(() => { if (o === current) status.textContent = t("order.translateFailed"); return note; })
    .then((text) => { if (o === current && o.step === 4) fill(text); });
}
