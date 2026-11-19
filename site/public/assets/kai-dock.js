/* kai-dock: a floating constellation icon injected into every published artifact by scripts/build_site.py.
 * It lives in a closed Shadow DOM so the artifact's CSS cannot reach it and its CSS cannot reach the artifact.
 * The only thing it adds to the page is one <kai-dock> element at the end of <body>.
 * Opt out or move it with <meta name="kai:dock" content="off | top-right | bottom-left">. */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || customElements.get("kai-dock")) return;
  var BASE = script.src.replace(/assets\/kai-dock\.js(\?.*)?$/, "");
  var SLUG = script.getAttribute("data-slug") || "";
  var metaPos = (document.querySelector('meta[name="kai:dock"]') || {}).content || "";
  var EXPLICIT = { "top-right": 1, "bottom-left": 1, "bottom-right": 1, "top-left": 1 }[metaPos.toLowerCase()] ? metaPos.toLowerCase() : "";
  var POS = EXPLICIT || "bottom-right";
  if (metaPos.toLowerCase() === "off") return;

  var CSS = [
    ":host{all:initial;position:fixed;z-index:2147483000;font:14px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;",
    "--bg:#0e1629;--fg:#e8ecf8;--muted:#9aa5c6;--line:rgba(150,170,235,.28);--accent:#8ab4ff;--a:#ffc857;--d:#5eead4;--shadow:0 10px 30px rgba(3,6,18,.45)}",
    ":host([data-mode=light]){--bg:#fffdf8;--fg:#141a2e;--muted:#596180;--line:rgba(30,40,80,.22);--accent:#3451d1;--a:#b45309;--d:#0f766e;--shadow:0 10px 30px rgba(30,40,80,.22)}",
    ":host([data-pos=bottom-right]){right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom))}",
    ":host([data-pos=top-right]){right:max(16px,env(safe-area-inset-right));top:max(16px,env(safe-area-inset-top))}",
    ":host([data-pos=bottom-left]){left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom))}",
    ":host([data-pos=top-left]){left:max(16px,env(safe-area-inset-left));top:max(16px,env(safe-area-inset-top))}",
    "*{box-sizing:border-box}",
    "button.pill{position:relative;display:grid;place-items:center;width:44px;height:44px;padding:0;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:var(--fg);cursor:pointer;box-shadow:var(--shadow)}",
    "button.pill:hover{border-color:var(--accent)}",
    "button.pill:focus-visible,a:focus-visible,button.copy:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    "svg.glyph{width:26px;height:26px;overflow:visible}",
    ".glyph path{stroke:currentColor;stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset .35s}",
    ".glyph circle{transform-box:fill-box;transform-origin:center;transition:transform .35s cubic-bezier(.34,1.56,.64,1)}",
    ".glyph .n1{fill:currentColor}.glyph .n2{fill:var(--a)}.glyph .n3{fill:var(--d)}.glyph .n4{fill:currentColor}",
    "@media (prefers-reduced-motion:no-preference){.glyph circle{animation:tw 3.4s ease-in-out infinite}.glyph .n2{animation-delay:.6s}.glyph .n3{animation-delay:1.3s}.glyph .n4{animation-delay:2s}}",
    "@keyframes tw{0%,100%{opacity:1}50%{opacity:.45}}",
    ":host([data-open]) .n1{transform:translate(-2px,2px) scale(1.15)}:host([data-open]) .n2{transform:translate(-1px,-2px) scale(1.15)}:host([data-open]) .n3{transform:translate(2px,-1px) scale(1.15)}:host([data-open]) .n4{transform:translate(2px,2px) scale(1.15)}",
    ".panel{position:absolute;width:min(320px,calc(100vw - 32px));padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--bg);color:var(--fg);box-shadow:var(--shadow);display:none}",
    ":host([data-open]) .panel{display:block}",
    ":host([data-pos=bottom-right]) .panel{right:0;bottom:56px}:host([data-pos=top-right]) .panel{right:0;top:56px}:host([data-pos=bottom-left]) .panel{left:0;bottom:56px}:host([data-pos=top-left]) .panel{left:0;top:56px}",
    "@media (prefers-reduced-motion:no-preference){:host([data-open]) .panel{animation:in .18s ease-out}}",
    "@keyframes in{from{opacity:0;transform:translateY(6px) scale(.98)}}",
    ".head{display:flex;align-items:center;gap:8px;margin:0 0 10px;font:600 12px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}",
    ".now{margin:0 0 10px;font-weight:600;font-size:15px;line-height:1.3}",
    "a.row{display:block;padding:8px 10px;margin:0 -4px;border-radius:10px;color:var(--fg);text-decoration:none}",
    "a.row:hover{background:color-mix(in srgb,var(--accent) 14%,transparent)}",
    "a.row small{display:block;font:500 10.5px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}",
    ".nav{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}",
    ".nav a.row{border:1px solid var(--line);margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}",
    ".chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}",
    ".chips a{padding:2px 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted);text-decoration:none;font:500 11px ui-monospace,Menlo,Consolas,monospace}",
    ".chips a:hover{color:var(--fg);border-color:var(--accent)}",
    "button.copy{width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--fg);font:inherit;cursor:pointer}",
    "button.copy:hover{border-color:var(--accent)}",
    "@media print{:host{display:none!important}}"
  ].join("");

  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function glyph() {
    var s = svgEl("svg", { "class": "glyph", viewBox: "0 0 32 32", "aria-hidden": "true" });
    s.append(svgEl("path", { pathLength: "1", d: "M6 24 13 8 25 13 21 26" }));
    [["n1", 6, 24, 2.2], ["n2", 13, 8, 3.2], ["n3", 25, 13, 2.2], ["n4", 21, 26, 2.2]].forEach(function (c) {
      s.append(svgEl("circle", { "class": c[0], cx: c[1], cy: c[2], r: c[3] }));
    });
    return s;
  }

  function text(tag, cls, str) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    n.textContent = str;
    return n;
  }
  function link(href, cls) {
    var a = document.createElement("a");
    a.href = href;
    a.className = cls || "";
    return a;
  }

  function currentMode() {
    var h = document.documentElement;
    var t = h.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    if (h.classList.contains("dark")) return "dark";
    if (h.classList.contains("light")) return "light";
    return window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function KaiDock() {
    return Reflect.construct(HTMLElement, [], KaiDock);
  }
  KaiDock.prototype = Object.create(HTMLElement.prototype);
  KaiDock.prototype.constructor = KaiDock;
  Object.setPrototypeOf(KaiDock, HTMLElement);

  KaiDock.prototype.connectedCallback = function () {
    if (this._root) return;
    var host = this;
    var root = host.attachShadow({ mode: "closed" });
    host._root = root;
    host.setAttribute("data-pos", POS);

    // Without an explicit <meta name="kai:dock">, take the first corner that does not sit on one of the
    // artifact's own fixed or sticky controls. Measured on load and on resize only.
    function place() {
      if (EXPLICIT || host.hasAttribute("data-open")) return;
      var vw = window.innerWidth, vh = window.innerHeight, m = 16, s = 44, pad = 6;
      var rects = [];
      var all = document.body.getElementsByTagName("*");
      for (var i = 0; i < all.length; i++) {
        var e = all[i];
        if (e === host) continue;
        var cs = getComputedStyle(e);
        if (cs.position !== "fixed" && cs.position !== "sticky") continue;
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
        var b = e.getBoundingClientRect();
        if (b.width < 3 || b.height < 3) continue;
        if (b.width >= vw * 0.95 && b.height >= vh * 0.95) continue;
        rects.push(b);
      }
      var corners = [["bottom-right", vw - m - s, vh - m - s], ["top-right", vw - m - s, m], ["bottom-left", m, vh - m - s], ["top-left", m, m]];
      var pick = "bottom-right";
      for (var c = 0; c < corners.length; c++) {
        var x = corners[c][1], y = corners[c][2];
        var clear = rects.every(function (b) { return b.right <= x - pad || b.left >= x + s + pad || b.bottom <= y - pad || b.top >= y + s + pad; });
        if (clear) { pick = corners[c][0]; break; }
      }
      host.setAttribute("data-pos", pick);
    }
    var placeTimer = 0;
    window.addEventListener("load", function () { setTimeout(place, 400); });
    window.addEventListener("resize", function () { clearTimeout(placeTimer); placeTimer = setTimeout(place, 250); });
    function syncMode() { host.setAttribute("data-mode", currentMode()); }
    syncMode();
    // Follow the artifact's own theme switch without owning one.
    new MutationObserver(syncMode).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    var style = document.createElement("style");
    style.textContent = CSS;
    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "pill";
    pill.setAttribute("aria-label", "Open kai-artifact menu");
    pill.setAttribute("aria-expanded", "false");
    pill.setAttribute("aria-haspopup", "true");
    pill.append(glyph());

    var panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "kai-artifact");
    root.append(style, pill, panel);

    var loaded = false;
    var homeRow = link(BASE, "row");
    homeRow.append(text("small", "", "home"), document.createTextNode("All artifacts and documents"));
    panel.append(text("div", "head", "kai-artifact"), homeRow);

    function fill(items) {
      var list = items.filter(function (i) { return i.type === "artifact"; });
      var idx = list.findIndex(function (i) { return i.slug === SLUG; });
      if (idx < 0) return;
      var me = list[idx];
      panel.insertBefore(text("p", "now", me.title), homeRow);
      var nav = document.createElement("div");
      nav.className = "nav";
      var newer = list[idx - 1], older = list[idx + 1];
      [[newer, "newer"], [older, "older"]].forEach(function (p) {
        if (!p[0]) { nav.append(document.createElement("span")); return; }
        var a = link(BASE + p[0].href, "row");
        a.title = p[0].title;
        a.append(text("small", "", p[1]), document.createTextNode(p[0].title));
        nav.append(a);
      });
      panel.insertBefore(nav, copy);
      if (me.topics && me.topics.length) {
        var chips = document.createElement("div");
        chips.className = "chips";
        me.topics.forEach(function (t) {
          var a = link(BASE + "?topic=" + encodeURIComponent(t) + "#library");
          a.textContent = t;
          chips.append(a);
        });
        panel.insertBefore(chips, copy);
      }
    }

    var copy = text("button", "copy", "Copy link");
    copy.type = "button";
    copy.addEventListener("click", function () {
      var u = location.origin + location.pathname;
      var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy link"; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { window.prompt("Copy this link", u); });
      else window.prompt("Copy this link", u);
    });
    panel.append(copy);

    function open() {
      host.setAttribute("data-open", "");
      pill.setAttribute("aria-expanded", "true");
      if (!loaded) {
        loaded = true;
        // Fetched on first open only, so the dock costs nothing while the reader just reads.
        fetch(BASE + "assets/registry.json", { credentials: "omit" })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (d) { fill(d.items || []); })
          .catch(function () {});
      }
    }
    function close(refocus) {
      host.removeAttribute("data-open");
      pill.setAttribute("aria-expanded", "false");
      if (refocus) pill.focus();
    }
    pill.addEventListener("click", function () { host.hasAttribute("data-open") ? close(false) : open(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && host.hasAttribute("data-open")) close(true);
    });
    document.addEventListener("pointerdown", function (e) {
      if (host.hasAttribute("data-open") && e.target !== host) close(false);
    });
  };

  customElements.define("kai-dock", KaiDock);
  function mount() { document.body.appendChild(document.createElement("kai-dock")); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
