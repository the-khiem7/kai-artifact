import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { animate, stagger } from "motion";

interface Item {
  type: "artifact" | "document";
  slug: string;
  title: string;
  description: string;
  lang: string;
  topics: string[];
  href: string;
}
interface State {
  type: string;
  lang: string;
  topic: string;
  q: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function short(text: string, n: number): string {
  return text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text;
}

// Seeded so the background sky is the same on every visit and every resize.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The hero fills the first screen; any filter used from there brings the library into view so the result is visible. */
function revealLibrary() {
  const hero = document.getElementById("map");
  if (hero && window.scrollY < hero.offsetHeight * 0.6) {
    document.getElementById("library")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
  }
}

/* ---------- library filters and the floating dock ---------- */
// Document-level listeners outlive a client-side navigation; each home visit aborts the previous set.
let docListeners: AbortController | undefined;

function library() {
  docListeners?.abort();
  docListeners = new AbortController();
  const { signal } = docListeners;
  const grid = document.getElementById("grid")!;
  const cards = [...grid.querySelectorAll<HTMLElement>(".card")];
  const empty = document.getElementById("empty")!;
  const count = document.getElementById("count")!;
  const badge = document.getElementById("badge")!;
  const tray = document.getElementById("tray")!;
  const trayBtn = document.getElementById("tray-btn")!;
  const q = document.getElementById("q") as HTMLInputElement;
  const chipRow = tray.querySelector<HTMLElement>(".chips")!;
  const params = new URLSearchParams(location.search);
  const state: State = { type: params.get("type") ?? "", lang: params.get("lang") ?? "", topic: params.get("topic") ?? "", q: params.get("q") ?? "" };
  q.value = state.q;
  let onChange: (topic: string) => void = () => {};

  function render(animateCards: boolean) {
    const needle = state.q.trim().toLowerCase();
    const shown: HTMLElement[] = [];
    for (const c of cards) {
      const ok =
        (!state.type || c.dataset.type === state.type) &&
        (!state.lang || c.dataset.lang === state.lang) &&
        (!state.topic || (c.dataset.topics ?? "").split(",").includes(state.topic)) &&
        (!needle || (c.dataset.text ?? "").includes(needle));
      c.hidden = !ok;
      if (ok) shown.push(c);
    }
    count.textContent = String(shown.length);
    count.title = `${shown.length} shown`;
    empty.hidden = shown.length > 0;
    const active = Number(!!state.lang) + Number(!!state.topic);
    badge.hidden = active === 0;
    badge.textContent = String(active);
    document.querySelectorAll<HTMLButtonElement>("#filters [data-type]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === state.type)));
    document.querySelectorAll<HTMLButtonElement>("#filters [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
    // A topic picked from the map or a card may not be one of the quick chips: show it as a temporary chip so it can be cleared.
    chipRow.querySelector("[data-temp]")?.remove();
    let found = false;
    chipRow.querySelectorAll<HTMLButtonElement>("[data-topic]").forEach((b) => {
      const on = b.dataset.topic === state.topic;
      found ||= on;
      b.setAttribute("aria-pressed", String(on));
    });
    if (state.topic && !found) {
      const b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.dataset.topic = state.topic;
      b.dataset.temp = "1";
      b.setAttribute("aria-pressed", "true");
      b.textContent = `${state.topic} ×`;
      chipRow.append(b);
    }
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v) sp.set(k, v);
    history.replaceState(history.state, "", `${location.pathname}${sp.size ? "?" + sp : ""}${location.hash}`);
    onChange(state.topic);
    if (animateCards && !reduced() && shown.length) {
      animate(shown, { opacity: [0, 1], transform: ["translateY(14px)", "translateY(0px)"] }, { delay: stagger(0.045), duration: 0.45, ease: "easeOut" }).then(() =>
        shown.forEach((c) => {
          c.style.removeProperty("opacity");
          c.style.removeProperty("transform");
        }),
      );
    }
  }

  const apply = () => {
    render(true);
    revealLibrary();
  };
  const toggle = (key: "type" | "lang" | "topic", value: string) => {
    state[key] = state[key] === value ? "" : value;
    apply();
  };
  document.querySelectorAll<HTMLButtonElement>("#filters [data-type]").forEach((b) => (b.onclick = () => ((state.type = b.dataset.type ?? ""), apply())));
  chipRow.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (b?.dataset.lang) toggle("lang", b.dataset.lang);
    else if (b?.dataset.topic) toggle("topic", b.dataset.topic);
  });
  grid.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.topic");
    if (!a) return;
    e.preventDefault();
    state.topic = a.dataset.topic!;
    render(true);
  });
  let timer = 0;
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => ((state.q = q.value), apply()), 120);
  });

  const setTray = (open: boolean) => {
    tray.hidden = !open;
    trayBtn.setAttribute("aria-expanded", String(open));
  };
  trayBtn.onclick = () => setTray(tray.hidden);
  document.addEventListener("click", (e) => {
    const dock = document.getElementById("filters");
    // composedPath still holds the dock when the clicked chip was removed by the re-render.
    if (!tray.hidden && dock && !e.composedPath().includes(dock)) setTray(false);
  }, { signal });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !tray.hidden) {
      setTray(false);
      trayBtn.focus();
    }
  }, { signal });
  render(false);

  return {
    pickTopic(topic: string) {
      state.topic = state.topic === topic ? "" : topic;
      apply();
    },
    onTopicChange(fn: (topic: string) => void) {
      onChange = fn;
      fn(state.topic);
    },
  };
}

/* ---------- knowledge map: the full-screen sky ---------- */
interface MapNode {
  id: string;
  kind: "item" | "topic";
  item?: Item;
  topic?: string;
  n: number;
  r: number;
  x?: number;
  y?: number;
}
interface MapLink {
  source: string | MapNode;
  target: string | MapNode;
}

function starfield(W: number, H: number) {
  const rand = rng(7);
  const layers = [el("g", { class: "field drift" }), el("g", { class: "field drift" })];
  const total = Math.min(340, Math.round((W * H) / 4200));
  for (let i = 0; i < total; i++) {
    const far = rand() < 0.65;
    const r = far ? 0.35 + rand() * 0.5 : 0.6 + rand() * 0.9;
    const o = far ? 0.15 + rand() * 0.35 : 0.35 + rand() * 0.5;
    const c = el("circle", { cx: (rand() * W).toFixed(1), cy: (rand() * H).toFixed(1), r: r.toFixed(2), opacity: o.toFixed(2) });
    if (rand() < 0.3) {
      c.classList.add("tw");
      c.style.setProperty("--t", `${(2.5 + rand() * 4).toFixed(2)}s`);
      c.style.setProperty("--d", `${(-rand() * 6).toFixed(2)}s`);
    }
    layers[far ? 0 : 1].append(c);
  }
  return layers;
}

function buildMap(svg: SVGSVGElement, items: Item[], base: string, onTopic: (t: string) => void) {
  const tip = document.getElementById("map-tip")!;
  const W = svg.clientWidth || 1200;
  const H = svg.clientHeight || 800;
  const narrow = W < 640;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();

  const counts = new Map<string, number>();
  for (const i of items) for (const t of new Set(i.topics)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const shared = [...counts.entries()].filter(([, n]) => n > 1);

  const nodes: MapNode[] = items.map((i) => ({ id: "i:" + i.slug, kind: "item", item: i, n: i.topics.filter((t) => (counts.get(t) ?? 0) > 1).length, r: 0 }));
  for (const n of nodes) n.r = 5 + Math.min(n.n, 5) * 0.9;
  for (const [t, n] of shared) nodes.push({ id: "t:" + t, kind: "topic", topic: t, n, r: 2.5 + Math.min(n, 5) * 0.8 });
  const links: MapLink[] = [];
  for (const i of items) for (const t of new Set(i.topics)) if ((counts.get(t) ?? 0) > 1) links.push({ source: "i:" + i.slug, target: "t:" + t });

  const sim = forceSimulation(nodes as any)
    .force("link", forceLink(links as any).id((d: any) => d.id).distance(95).strength(0.4))
    .force("charge", forceManyBody().strength((d: any) => (d.kind === "topic" ? -170 : -560)))
    .force("collide", forceCollide((d: any) => d.r + (d.kind === "item" ? 40 : 16)))
    // A phone screen is tall: pull harder sideways so the sky spreads down the screen instead of across it.
    .force("x", forceX(W / 2).strength(narrow ? 0.14 : 0.02))
    .force("y", forceY(H / 2).strength(narrow ? 0.008 : 0.05))
    .stop();
  for (let i = 0; i < 420; i++) sim.tick();
  // Fit the settled layout to the screen; the top keeps room for the mark, the bottom for the floating dock.
  // Labels are centred on their star, so the side padding is about half a label wide.
  const padX = narrow ? 78 : 120;
  const top = narrow ? 92 : 84;
  const bottom = narrow ? 104 : 120;
  const xs = nodes.map((n) => n.x ?? 0);
  const ys = nodes.map((n) => n.y ?? 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = Math.min(3, (W - 2 * padX) / Math.max(1, maxX - minX));
  const sy = Math.min(3, (H - top - bottom) / Math.max(1, maxY - minY));
  const offX = (W - (maxX - minX) * sx) / 2;
  const offY = top + (H - top - bottom - (maxY - minY) * sy) / 2;
  for (const n of nodes) {
    n.x = offX + ((n.x ?? 0) - minX) * sx;
    n.y = offY + ((n.y ?? 0) - minY) * sy;
  }
  // Second pass in screen space: star names are wide, round collision cannot keep them apart, so push overlapping label boxes away and keep every box on screen.
  const box = (n: MapNode) =>
    n.kind === "item"
      ? { w: Math.max(2 * n.r, short(n.item!.title.split(/ - | – /)[0], narrow ? 20 : 30).length * 6.9) + 12, h: n.r * 2 + 40, dy: 18 }
      : { w: n.topic!.length * 6 + 10, h: n.r * 2 + 18, dy: 8 };
  const boxes = new Map(nodes.map((n) => [n, box(n)]));
  const labels = () => {
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const p = nodes[a], q = nodes[b];
        const bp = boxes.get(p)!, bq = boxes.get(q)!;
        const dx = q.x! - p.x!;
        const dy = q.y! + bq.dy - (p.y! + bp.dy);
        const ox = (bp.w + bq.w) / 2 + 6 - Math.abs(dx);
        const oy = (bp.h + bq.h) / 2 + 4 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        // Move along the cheaper axis; on a tall phone screen prefer moving down the page.
        if (oy < ox || narrow) {
          const m = (oy / 2) * Math.sign(dy || 1) * 0.6;
          (p.y! -= m), (q.y! += m);
        } else {
          const m = (ox / 2) * Math.sign(dx || 1) * 0.6;
          (p.x! -= m), (q.x! += m);
        }
      }
    }
    for (const n of nodes) {
      const bx = boxes.get(n)!;
      n.x = Math.min(W - 12 - bx.w / 2, Math.max(12 + bx.w / 2, n.x!));
      n.y = Math.min(H - bottom - bx.h / 2 + bx.dy, Math.max(top, n.y!));
    }
  };
  for (let i = 0; i < 160; i++) labels();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const fields = starfield(W, H);
  const linkLayer = el("g");
  const nodeLayer = el("g");
  svg.append(...fields, linkLayer, nodeLayer);
  const animated = !reduced();
  const linkEls = links.map((l, idx) => {
    // forceLink replaces the id strings with the node objects once the simulation has run.
    const s = byId.get((l.source as MapNode).id)!;
    const t = byId.get((l.target as MapNode).id)!;
    const line = el("line", { class: "link", x1: s.x!, y1: s.y!, x2: t.x!, y2: t.y!, pathLength: 1 });
    if (animated) {
      line.classList.add("draw");
      line.style.setProperty("--d", `${(0.5 + idx * 0.025).toFixed(3)}s`);
    }
    linkLayer.append(line);
    return { line, s: s.id, t: t.id };
  });

  const nodeEls = new Map<string, SVGElement>();
  for (const n of nodes) {
    let g: SVGElement;
    if (n.kind === "item") {
      const i = n.item!;
      g = el("a", { class: `node ${i.type}`, href: base + i.href, tabindex: 0, "aria-label": `${i.type}: ${i.title}` });
      g.append(
        el("circle", { class: "halo", cx: n.x!, cy: n.y!, r: n.r + 8 }),
        el("circle", { class: "star", cx: n.x!, cy: n.y!, r: n.r }),
        el("circle", { class: "core", cx: n.x!, cy: n.y!, r: Math.max(1.4, n.r * 0.32) }),
      );
      // Star chart label: the name, then a catalogue line with the kind and language.
      const name = el("text", { class: "name", x: n.x!, y: n.y! + n.r + 17, "text-anchor": "middle" });
      name.textContent = short(i.title.split(/ - | – /)[0], narrow ? 20 : 30);
      const desig = el("text", { class: "desig", x: n.x!, y: n.y! + n.r + 29, "text-anchor": "middle" });
      desig.textContent = `${i.type === "artifact" ? "ART" : "DOC"} · ${(i.lang || "").toUpperCase()}`;
      g.append(name, desig);
    } else {
      g = el("g", { class: "topic node", role: "button", tabindex: 0, "data-topic": n.topic!, "aria-label": `Filter by topic ${n.topic}` });
      g.append(el("circle", { class: "ring", cx: n.x!, cy: n.y!, r: n.r }));
      const label = el("text", { x: n.x!, y: n.y! + n.r + 12, "text-anchor": "middle" });
      label.textContent = n.topic!;
      g.append(label);
      const go = () => onTopic(n.topic!);
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
          e.preventDefault();
          go();
        }
      });
    }
    nodeLayer.append(g);
    nodeEls.set(n.id, g);
    g.addEventListener("pointerenter", () => focus(n));
    g.addEventListener("focus", () => focus(n));
    g.addEventListener("pointerleave", blur);
    g.addEventListener("blur", blur);
  }

  function focus(n: MapNode) {
    const hit = new Set<string>([n.id]);
    const topicsHit = new Set<string>();
    if (n.kind === "item") {
      for (const l of linkEls) if (l.s === n.id) (hit.add(l.t), topicsHit.add(l.t));
      for (const l of linkEls) if (topicsHit.has(l.t)) hit.add(l.s);
    } else {
      topicsHit.add(n.id);
      for (const l of linkEls) if (l.t === n.id) hit.add(l.s);
    }
    svg.classList.add("focus");
    for (const [id, g] of nodeEls) {
      g.classList.toggle("hit", hit.has(id));
      g.classList.toggle("dim", !hit.has(id));
    }
    for (const l of linkEls) {
      const on = topicsHit.has(l.t) && hit.has(l.s);
      l.line.classList.toggle("hit", on);
      l.line.classList.toggle("dim", !on);
    }
    tip.replaceChildren();
    const title = document.createElement("b");
    const sub = document.createElement("span");
    if (n.kind === "item") {
      title.textContent = n.item!.title;
      sub.textContent = short(n.item!.description, 120);
    } else {
      title.textContent = n.topic!;
      sub.textContent = `${n.n} pages share this topic. Click to filter the library.`;
    }
    tip.append(title, sub);
    tip.classList.add("show");
  }
  function blur() {
    svg.classList.remove("focus");
    for (const g of nodeEls.values()) g.classList.remove("hit", "dim");
    for (const l of linkEls) l.line.classList.remove("hit", "dim");
    tip.classList.remove("show");
  }

  if (animated) {
    const els = [...nodeEls.values()];
    els.forEach((e) => (e.style.opacity = "0"));
    // Inline opacity from the entrance animation would beat the .dim rule, so clear it once finished.
    animate(els, { opacity: [0, 1] }, { delay: stagger(0.045), duration: 0.6 }).then(() => els.forEach((e) => e.style.removeProperty("opacity")));
  }

  return {
    fields,
    setActive(topic: string) {
      for (const n of nodes) if (n.kind === "topic") nodeEls.get(n.id)!.classList.toggle("on", n.topic === topic);
    },
  };
}

function init() {
  const svg = document.getElementById("map-svg") as SVGSVGElement | null;
  if (!svg || svg.dataset.ready) return;
  svg.dataset.ready = "1";
  const items: Item[] = JSON.parse(document.getElementById("registry-data")!.textContent!);
  const base = document.body.dataset.base!;
  const lib = library();
  let active = "";
  let map: ReturnType<typeof buildMap> | undefined;
  const mount = () => {
    map = buildMap(svg, items, base, (t) => lib.pickTopic(t));
    map.setActive(active);
  };
  lib.onTopicChange((t) => {
    active = t;
    map?.setActive(t);
  });
  mount();

  // Depth: the two background star layers drift against the pointer; the constellation itself stays put so it is easy to aim at.
  const hero = document.getElementById("map")!;
  if (!reduced() && matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      map?.fields.forEach((f, i) => (f.style.transform = `translate(${(-dx * (i ? 18 : 8)).toFixed(1)}px, ${(-dy * (i ? 12 : 5)).toFixed(1)}px)`));
    });
  }

  let size = [svg.clientWidth, svg.clientHeight];
  new ResizeObserver(() => {
    if (Math.abs(svg.clientWidth - size[0]) > 40 || Math.abs(svg.clientHeight - size[1]) > 80) {
      size = [svg.clientWidth, svg.clientHeight];
      mount();
    }
  }).observe(svg);
}

init();
document.addEventListener("astro:page-load", init);
