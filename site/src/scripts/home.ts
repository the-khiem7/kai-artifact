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

/* ---------- hero counters ---------- */
function counters() {
  if (reduced()) return;
  document.querySelectorAll<HTMLElement>("[data-count]").forEach((node) => {
    const target = Number(node.dataset.count);
    animate(0, target, { duration: 1.4, ease: "easeOut", onUpdate: (v: number) => (node.textContent = String(Math.round(v))) });
  });
}

/* ---------- library filters ---------- */
function library(items: Item[], base: string) {
  const grid = document.getElementById("grid")!;
  const cards = [...grid.querySelectorAll<HTMLElement>(".card")];
  const empty = document.getElementById("empty")!;
  const count = document.getElementById("count")!;
  const q = document.getElementById("q") as HTMLInputElement;
  const chipRow = document.querySelector<HTMLElement>("#filters .chips")!;
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
    count.textContent = `${shown.length} shown`;
    empty.hidden = shown.length > 0;
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

  const toggle = (key: "type" | "lang" | "topic", value: string) => {
    state[key] = state[key] === value ? "" : value;
    render(true);
  };
  document.querySelectorAll<HTMLButtonElement>("#filters [data-type]").forEach((b) => (b.onclick = () => ((state.type = b.dataset.type ?? ""), render(true))));
  document.querySelectorAll<HTMLButtonElement>("#filters [data-lang]").forEach((b) => (b.onclick = () => toggle("lang", b.dataset.lang!)));
  chipRow.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-topic]");
    if (b) toggle("topic", b.dataset.topic!);
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
    timer = window.setTimeout(() => ((state.q = q.value), render(true)), 120);
  });
  render(false);

  return {
    pickTopic(topic: string) {
      state.topic = state.topic === topic ? "" : topic;
      render(true);
    },
    onTopicChange(fn: (topic: string) => void) {
      onChange = fn;
      fn(state.topic);
    },
  };
}

/* ---------- knowledge map ---------- */
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

function buildMap(svg: SVGSVGElement, items: Item[], base: string, onTopic: (t: string) => void) {
  const tip = document.getElementById("map-tip")!;
  const W = svg.clientWidth || 900;
  const H = svg.clientHeight || 540;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();

  const counts = new Map<string, number>();
  for (const i of items) for (const t of new Set(i.topics)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const shared = [...counts.entries()].filter(([, n]) => n > 1);

  const nodes: MapNode[] = items.map((i) => ({ id: "i:" + i.slug, kind: "item", item: i, n: i.topics.filter((t) => (counts.get(t) ?? 0) > 1).length, r: 0 }));
  for (const n of nodes) n.r = 6 + Math.min(n.n, 5);
  for (const [t, n] of shared) nodes.push({ id: "t:" + t, kind: "topic", topic: t, n, r: 3 + Math.min(n, 5) });
  const links: MapLink[] = [];
  for (const i of items) for (const t of new Set(i.topics)) if ((counts.get(t) ?? 0) > 1) links.push({ source: "i:" + i.slug, target: "t:" + t });

  const sim = forceSimulation(nodes as any)
    .force("link", forceLink(links as any).id((d: any) => d.id).distance(90).strength(0.4))
    .force("charge", forceManyBody().strength((d: any) => (d.kind === "topic" ? -160 : -520)))
    .force("collide", forceCollide((d: any) => d.r + (d.kind === "item" ? 34 : 16)))
    .force("x", forceX(W / 2).strength(0.025))
    .force("y", forceY(H / 2).strength(0.045))
    .stop();
  for (let i = 0; i < 400; i++) sim.tick();
  // Fit the settled layout to the frame so the sky fills the card instead of clumping in the middle.
  const padX = 80;
  const padY = 48;
  const bottom = 34;
  const xs = nodes.map((n) => n.x ?? 0);
  const ys = nodes.map((n) => n.y ?? 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = Math.min(3, (W - 2 * padX) / Math.max(1, maxX - minX));
  const sy = Math.min(3, (H - padY - bottom - padY) / Math.max(1, maxY - minY));
  const offX = (W - (maxX - minX) * sx) / 2;
  const offY = (H - bottom - (maxY - minY) * sy) / 2;
  for (const n of nodes) {
    n.x = offX + ((n.x ?? 0) - minX) * sx;
    n.y = offY + ((n.y ?? 0) - minY) * sy;
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const linkLayer = el("g");
  const nodeLayer = el("g");
  svg.append(linkLayer, nodeLayer);
  const linkEls = links.map((l) => {
    // forceLink replaces the id strings with the node objects once the simulation has run.
    const s = byId.get((l.source as MapNode).id)!;
    const t = byId.get((l.target as MapNode).id)!;
    const line = el("line", { class: "link", x1: s.x!, y1: s.y!, x2: t.x!, y2: t.y! });
    linkLayer.append(line);
    return { line, s: s.id, t: t.id };
  });

  const nodeEls = new Map<string, SVGElement>();
  for (const n of nodes) {
    let g: SVGElement;
    if (n.kind === "item") {
      const i = n.item!;
      g = el("a", { class: `node ${i.type}`, href: base + i.href, tabindex: 0, "aria-label": `${i.type}: ${i.title}` });
      g.append(el("circle", { class: "halo", cx: n.x!, cy: n.y!, r: n.r + 7 }), el("circle", { class: "star", cx: n.x!, cy: n.y!, r: n.r }));
      const label = el("text", { x: n.x!, y: n.y! + n.r + 15, "text-anchor": "middle" });
      label.textContent = short(i.title.split(/ - | – /)[0], 26);
      g.append(label);
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

  if (!reduced()) {
    const els = [...nodeEls.values()];
    const lines = linkEls.map((l) => l.line);
    els.forEach((e) => (e.style.opacity = "0"));
    lines.forEach((e) => (e.style.opacity = "0"));
    // Inline opacity from the entrance animation would beat the .dim rule, so clear it once finished.
    animate(els, { opacity: [0, 1] }, { delay: stagger(0.05), duration: 0.5 }).then(() => els.forEach((e) => e.style.removeProperty("opacity")));
    animate(lines, { opacity: [0, 1] }, { delay: stagger(0.02, { startDelay: 0.5 }), duration: 0.5 }).then(() => lines.forEach((e) => e.style.removeProperty("opacity")));
  }

  return {
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
  counters();
  const lib = library(items, base);
  let active = "";
  let map: ReturnType<typeof buildMap> | undefined;
  const mount = () => {
    map = buildMap(
      svg,
      items,
      base,
      (t) => {
        lib.pickTopic(t);
        document.getElementById("library")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
      },
    );
    map.setActive(active);
  };
  lib.onTopicChange((t) => {
    active = t;
    map?.setActive(t);
  });
  mount();
  let width = svg.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(svg.clientWidth - width) > 40) {
      width = svg.clientWidth;
      mount();
    }
  }).observe(svg);
}

init();
document.addEventListener("astro:page-load", init);
