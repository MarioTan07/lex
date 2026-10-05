// The Help panel and guided tours shared by the admin page (admin-help.js) and the seller page (seller-help.js).
// Each page passes its own missions and written guide. A tour dims the page and lights up one part at a time
// with a speech bubble. It never saves, deletes or changes anything: while it runs, clicks outside the bubble are
// blocked except on the part it asks the person to tap, and forms can't be submitted. Finished missions are
// remembered on this device (browser storage).
//
// Text can be a plain string (always shown as is) or { id, en }: with `bilingual`, the page's ID/EN switch picks
// which one shows; without it, Indonesian is used. Tour and guide text is trusted HTML written in those files.
import { $, el } from "/common.js";
import { lang } from "/i18n.js";

const UI = {
  id: {
    help: "Bantuan", close: "Tutup bantuan", toursTitle: "🎮 Tur panduan", guideTitle: "📖 Panduan tertulis",
    toursIntro: "Belajar sambil mencoba. Setiap tur menyorot satu bagian halaman dan menjelaskannya. Tur tidak menyimpan atau menghapus apa pun.",
    search: "Cari, mis. kata sandi, foto, produk…", searchLabel: "Cari di panduan", noHits: "Tidak ada topik yang cocok. Coba kata lain.",
    progress: "{n} dari {total} selesai", allBadge: " 🏅 Semua tur selesai!", done: "Selesai", start: "Mulai", replay: "Ulangi",
    tapIt: "👆 Ketuk bagian yang menyala untuk lanjut.", skip: "Lewati tur", back: "Kembali", next: "Lanjut", finish: "Selesai ✓",
    tourDone: "✓ Tur \"{name}\" selesai", aboutThis: "Bantuan tentang bagian ini", later: "Nanti saja", startTour: "Mulai tur",
  },
  en: {
    help: "Help", close: "Close help", toursTitle: "🎮 Guided tours", guideTitle: "📖 Written guide",
    toursIntro: "Learn by trying. Each tour lights up one part of the page and explains it. Tours never save or delete anything.",
    search: "Search, e.g. password, photo, product…", searchLabel: "Search the guide", noHits: "No matching topics. Try another word.",
    progress: "{n} of {total} done", allBadge: " 🏅 All tours done!", done: "Done", start: "Start", replay: "Replay",
    tapIt: "👆 Tap the lit-up part to continue.", skip: "Skip tour", back: "Back", next: "Next", finish: "Done ✓",
    tourDone: "✓ \"{name}\" tour done", aboutThis: "Help about this section", later: "Later", startTour: "Start tour",
  },
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const html = (s) => { const t = document.createElement("template"); t.innerHTML = s; return t.content; };
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

// Clicks the help itself makes (switching tabs, opening a form) pass the tour's click guard.
let running = null;
export function pageClick(node) {
  if (!node) return;
  if (!running) return node.click();
  running.programmatic = true;
  try { node.click(); } finally { running.programmatic = false; }
}

export function setupHelp(cfg) {
  const { tours, guide, headLinks = [], bilingual = false, doneKey, welcomeKey, openTab, welcome, allDone } = cfg;
  const cur = () => (bilingual && lang === "en" ? "en" : "id");
  const L = (x) => (x && typeof x === "object" ? x[cur()] ?? x.id : x);
  const ui = (k, vars) => fill(UI[cur()][k], vars || {});
  const desk = $(cfg.page || "#deskView");
  const signedIn = () => !desk.hidden;

  const doneSet = () => { try { return new Set(JSON.parse(store.get(doneKey) || "[]")); } catch { return new Set(); } };
  const markDone = (id) => { const s = doneSet(); s.add(id); store.set(doneKey, JSON.stringify([...s])); };

  // ---------- the Help panel ----------
  // Built on first open, and again when the page language has changed since.
  let sheet = null;
  function buildSheet() {
    sheet?.remove();
    const search = el("input", { type: "search", class: "help-search", placeholder: ui("search"), "aria-label": ui("searchLabel") });
    const none = el("p", { class: "muted small", hidden: true, text: ui("noHits") });
    const topics = guide.map((g) => {
      const d = el("details", { class: "help-topic", id: "help-" + g.id }, el("summary", { text: L(g.title) }), el("div", { class: "help-body" }));
      d.lastChild.append(html(L(g.body)));
      return d;
    });
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      for (const d of topics) {
        const hit = !q || d.textContent.toLowerCase().includes(q);
        d.hidden = !hit; d.open = !!q && hit; shown += hit;
      }
      none.hidden = shown > 0;
    });
    const missions = el("ol", { class: "missions" });
    const progress = el("div", { class: "mission-progress" });
    const toursPart = el("section", { class: "help-part" },
      el("h3", { text: ui("toursTitle") }), el("p", { class: "muted small", text: ui("toursIntro") }), progress, missions);
    sheet = el("dialog", { class: "help-sheet", "aria-labelledby": "helpTitle" },
      el("div", { class: "help-head" },
        el("h2", { id: "helpTitle", text: ui("help") }),
        el("button", { type: "button", class: "btn ghost small", "aria-label": ui("close"), onclick: () => sheet.close() }, "✕")),
      toursPart,
      el("section", { class: "help-part" }, el("h3", { text: ui("guideTitle") }), search, none, ...topics));
    sheet.lang = cur();
    sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
    sheet.renderMissions = () => {
      // Tours need the signed-in page; before signing in, only the written guide shows.
      toursPart.hidden = !signedIn();
      const done = doneSet(), n = tours.filter((x) => done.has(x.id)).length;
      progress.replaceChildren(
        el("div", { class: "small" }, el("strong", { text: ui("progress", { n, total: tours.length }) }), n === tours.length ? el("span", { class: "mission-badge", text: ui("allBadge") }) : null),
        el("div", { class: "mission-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(tours.length), "aria-valuenow": String(n) }, el("span", { style: `width:${(n / tours.length) * 100}%` })));
      missions.replaceChildren(...tours.map((tr) => {
        const ok = done.has(tr.id);
        return el("li", { class: ok ? "done" : "" },
          el("span", { class: "mission-mark", "aria-hidden": "true", text: ok ? "✓" : "" }),
          el("span", { class: "mission-name" }, el("strong", { text: L(tr.title) }), el("span", { class: "muted small", text: (ok ? ui("done") + " · " : "") + L(tr.time) })),
          el("button", { type: "button", class: "btn small" + (ok ? " ghost" : ""), onclick: () => { sheet.close(); startTour(tr); } }, ui(ok ? "replay" : "start")));
      }));
    };
    document.body.append(sheet);
  }
  function openHelp(topic) {
    if (!sheet || sheet.lang !== cur()) buildSheet();
    sheet.renderMissions();
    sheet.showModal();
    const d = topic && sheet.querySelector("#help-" + topic);
    if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: "start" }), 0); }
    else sheet.scrollTop = 0;
  }
  document.querySelectorAll(cfg.button || "#helpBtn").forEach((b) => b.addEventListener("click", () => openHelp(b.dataset.helpTopic)));

  // Small "?" buttons beside headings that open the guide at the matching topic.
  const qButtons = [];
  for (const [sel, topic] of headLinks) {
    const h = document.querySelector(sel);
    if (!h) continue;
    const wrap = el("span", { class: "help-headwrap" });
    h.replaceWith(wrap);
    const q = el("button", { type: "button", class: "help-q", onclick: () => openHelp(topic) }, "?");
    qButtons.push(q);
    wrap.append(h, q);
  }
  const labelQ = () => qButtons.forEach((q) => { q.title = ui("aboutThis"); q.setAttribute("aria-label", ui("aboutThis")); });
  labelQ();

  // ---------- the guided tour ----------
  let run = null; // { tour, i, state, spot, dim, bubble, target, programmatic }

  function startTour(tour) {
    if (run) endTour(false);
    const state = {};
    run = running = { tour, i: 0, state, spot: el("div", { class: "tour-spot", "aria-hidden": "true" }),
      dim: [0, 1, 2, 3].map(() => el("div", { class: "tour-dim", "aria-hidden": "true" })), bubble: el("div", { class: "tour-bubble", role: "dialog", tabindex: "-1", "aria-live": "polite" }) };
    document.body.append(...run.dim, run.spot, run.bubble);
    document.documentElement.classList.add("touring");
    tour.before?.(state);
    show(0, 1);
  }

  function resolveTarget(step) {
    // A selector, or a function returning a selector or the element itself.
    const sel = typeof step.target === "function" ? step.target() : step.target;
    const node = typeof sel === "string" ? document.querySelector(sel) : sel || null;
    return node && node.getClientRects().length ? node : null;
  }

  function show(i, dir, rescroll = true) {
    const steps = run.tour.steps;
    if (i >= steps.length) return endTour(true);
    const step = steps[i];
    if (step.skipIf?.()) return show(i + dir < 0 ? 0 : i + dir, dir);
    run.i = i;
    if (step.tab && openTab) openTab(step.tab);
    step.before?.(run.state);
    const target = step.target ? resolveTarget(step) : null;
    run.target = target;
    const last = i === steps.length - 1;
    const text = L(step.text) + (step.target && !target && step.missing ? `<br><br><span class="muted">${L(step.missing)}</span>` : "");
    const doIt = step.do && target;
    run.bubble.replaceChildren(...[
      el("div", { class: "tour-count", text: `${L(run.tour.title)} · ${i + 1} / ${steps.length}` }),
      el("h3", { text: L(step.title) }),
      el("div", { class: "tour-text" }, html(text)),
      doIt ? el("p", { class: "tour-do", text: ui("tapIt") }) : null,
      el("div", { class: "tour-actions" },
        el("button", { type: "button", class: "linkish tour-skip", onclick: () => endTour(false) }, ui("skip")),
        el("span", { style: "flex:1" }),
        i > 0 ? el("button", { type: "button", class: "btn ghost small", onclick: () => show(i - 1, -1) }, ui("back")) : null,
        doIt ? null : el("button", { type: "button", class: "btn small tour-next", onclick: () => show(i + 1, 1) }, ui(last ? "finish" : "next"))),
    ].filter(Boolean));
    run.spot.classList.toggle("tour-do-spot", !!doIt);
    if (rescroll) {
      const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (target) target.scrollIntoView({ block: "center", behavior });
      else window.scrollTo({ top: 0, behavior });
    }
    place();
    setTimeout(place, 400); // again after the smooth scroll settles
    (run.bubble.querySelector(".tour-next") || run.bubble).focus({ preventScroll: true });
  }

  // Puts the spotlight over the target and the bubble beside it: below if there's room, otherwise above.
  // Without a target the bubble sits in the middle. On phones the bubble is pinned to the bottom by CSS.
  function place() {
    if (!run) return;
    const { spot, bubble, target } = run;
    const pad = 6, vw = innerWidth, vh = innerHeight;
    if (!target) {
      Object.assign(spot.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px" });
      dimAround({ left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2 });
      bubble.classList.add("tour-center");
      Object.assign(bubble.style, { left: "", top: "" });
      return;
    }
    bubble.classList.remove("tour-center");
    // Tall targets: only the part on screen is lit up.
    const b = target.getBoundingClientRect();
    const top0 = Math.max(b.top, 8), bottom0 = Math.min(b.bottom, vh - 8);
    const r = { left: b.left, width: b.width, top: top0, bottom: Math.max(bottom0, top0), height: Math.max(bottom0 - top0, 0) };
    Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    dimAround({ left: r.left - pad, top: r.top - pad, right: r.left + r.width + pad, bottom: r.top + r.height + pad });
    if (vw < 640) { Object.assign(bubble.style, { left: "", top: "" }); return; }
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight, gap = 14;
    let top = r.bottom + pad + gap;
    if (top + bh > vh - 12) top = r.top - pad - gap - bh;
    if (top < 12) top = Math.max(12, Math.min(vh - bh - 12, r.top + 12));
    const left = Math.max(12, Math.min(vw - bw - 12, r.left));
    Object.assign(bubble.style, { left: left + "px", top: top + "px" });
  }
  // Four dark panels around the lit-up box (a giant box-shadow doesn't draw reliably on phones).
  function dimAround(h) {
    const [above, below, left, right] = run.dim, px = (n) => Math.max(0, n) + "px";
    Object.assign(above.style, { left: "0px", top: "0px", width: "100vw", height: px(h.top) });
    Object.assign(below.style, { left: "0px", top: px(h.bottom), width: "100vw", height: "", bottom: "0px" });
    Object.assign(left.style, { left: "0px", top: px(h.top), width: px(h.left), height: px(h.bottom - h.top) });
    Object.assign(right.style, { left: px(h.right), top: px(h.top), right: "0px", width: "", height: px(h.bottom - h.top) });
  }
  addEventListener("resize", place);
  addEventListener("scroll", place, true);

  function endTour(finished) {
    if (!run) return;
    const { tour, state, spot, bubble, dim } = run;
    run = running = null;
    spot.remove(); bubble.remove(); dim.forEach((d) => d.remove());
    document.documentElement.classList.remove("touring");
    try { tour.end?.(state); } catch {}
    if (finished) {
      markDone(tour.id);
      celebrate(doneSet().size >= tours.length ? L(allDone) : ui("tourDone", { name: L(tour.title) }));
    }
  }

  function celebrate(msg) {
    const n = el("div", { class: "tour-cheer", role: "status", text: msg });
    document.body.append(n);
    setTimeout(() => n.remove(), 3200);
  }

  // While a tour runs: only the bubble works, plus the highlighted part on "tap it yourself" steps.
  // Nothing can be submitted, and Escape ends the tour.
  function guard(e) {
    if (!run || run.programmatic) return;
    if (run.bubble.contains(e.target)) return;
    const step = run.tour.steps[run.i];
    if (step.do && run.target && run.target.contains(e.target)) {
      if (e.type === "click") {
        const i = run.i;
        setTimeout(() => { if (run && run.i === i) show(i + 1, 1); }, 60);
      }
      return;
    }
    e.preventDefault(); e.stopPropagation();
  }
  for (const type of ["click", "pointerdown", "mousedown", "touchstart", "dblclick", "contextmenu"]) document.addEventListener(type, guard, { capture: true, passive: false });
  document.addEventListener("submit", (e) => { if (run) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  document.addEventListener("keydown", (e) => {
    if (!run) return;
    if (e.key === "Escape") { e.preventDefault(); return endTour(false); }
    if (!run.bubble.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("focusin", (e) => { if (run && !run.bubble.contains(e.target)) e.target.blur?.(); }, true);

  // The language switch is outside the bubble, so it can only change between tours; redraw labels anyway.
  window.addEventListener("langchange", () => { labelQ(); if (run) show(run.i, 1, false); });

  // ---------- first time on this device ----------
  // Offered once, the first time the signed-in page appears.
  function offerWelcome() {
    if (store.get(welcomeKey)) return;
    store.set(welcomeKey, "1");
    const d = el("dialog", { class: "confirm", "aria-labelledby": "welcomeTitle" },
      el("h2", { id: "welcomeTitle", text: L(welcome.title) }),
      el("p", { text: L(welcome.text) }),
      el("div", { class: "confirm-actions" },
        el("button", { type: "button", class: "btn ghost", onclick: () => d.close() }, ui("later")),
        el("button", { type: "button", class: "btn", onclick: () => { d.close(); startTour(tours[0]); } }, ui("startTour"))));
    d.addEventListener("close", () => d.remove());
    document.body.append(d);
    d.showModal();
  }
  const watchDesk = () => { if (signedIn()) setTimeout(offerWelcome, 400); else if (run) endTour(false); };
  new MutationObserver(watchDesk).observe(desk, { attributes: true, attributeFilter: ["hidden"] });
  watchDesk();

  return { openHelp, startTour };
}
