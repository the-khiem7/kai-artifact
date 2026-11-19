const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* One scroll listener for the page lifetime; it looks the bar up each time because navigation swaps the DOM. */
function onScroll() {
  const bar = document.querySelector<HTMLElement>(".progress");
  if (!bar) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
}
addEventListener("scroll", onScroll, { passive: true });

function toc(prose: HTMLElement) {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".toc a")];
  const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.remove("active"));
        byId.get(e.target.id)?.classList.add("active");
      }
    },
    { rootMargin: "-80px 0px -70% 0px" },
  );
  prose.querySelectorAll("h2[id], h3[id]").forEach((h) => obs.observe(h));
}

async function mermaids(prose: HTMLElement) {
  const blocks = [...prose.querySelectorAll<HTMLElement>('pre[data-language="mermaid"]')];
  if (!blocks.length) return;
  const { default: mermaid } = await import("mermaid");
  const wraps = blocks.map((pre) => {
    const lines = pre.querySelectorAll(".line");
    const src = lines.length ? [...lines].map((l) => l.textContent).join("\n") : (pre.textContent ?? "");
    const wrap = document.createElement("div");
    wrap.className = "mermaid-wrap";
    wrap.dataset.src = src;
    pre.replaceWith(wrap);
    return wrap;
  });
  let run = 0;
  async function draw() {
    const mine = ++run;
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark", fontFamily: "system-ui, sans-serif" });
    for (const [i, wrap] of wraps.entries()) {
      const id = `mmd-${mine}-${i}`;
      try {
        const { svg } = await mermaid.render(id, wrap.dataset.src!);
        if (mine !== run) return;
        wrap.classList.remove("err");
        // Trusted: the source is a note committed to this repo, and securityLevel "strict" makes Mermaid sanitize its own SVG.
        wrap.innerHTML = svg;
      } catch {
        document.getElementById("d" + id)?.remove();
        wrap.classList.add("err");
        wrap.textContent = "Diagram failed to render. Source:\n" + wrap.dataset.src;
      }
    }
  }
  await draw();
}

function init() {
  const prose = document.getElementById("prose");
  if (!prose || prose.dataset.ready) return;
  prose.dataset.ready = "1";
  onScroll();
  toc(prose);
  void mermaids(prose);
  if (location.hash && !reduced()) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

init();
document.addEventListener("astro:page-load", init);
