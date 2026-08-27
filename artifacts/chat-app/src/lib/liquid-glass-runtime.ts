type GlassInstance = { refresh: () => void; destroy: () => void };

const instances = new WeakMap<HTMLElement, GlassInstance>();
let filterId = 0;
let defs: SVGDefsElement | null = null;

function ensureDefs() {
  if (defs) return defs;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute"; svg.style.pointerEvents = "none";
  defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.appendChild(defs); document.body.appendChild(svg); return defs;
}

function makeDisplacementMap(w: number, h: number, radius: number) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 512 / Math.max(w, h));
  canvas.width = Math.max(32, Math.round(w * scale)); canvas.height = Math.max(32, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!; const cw = canvas.width, ch = canvas.height;
  const image = ctx.createImageData(cw, ch); const data = image.data;
  const bezel = Math.max(8, Math.min(cw, ch) * .075); const radiusPx = Math.max(2, radius * scale);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const edgeX = Math.min(x, cw - 1 - x), edgeY = Math.min(y, ch - 1 - y);
    const cornerDistance = Math.hypot(Math.max(0, radiusPx - edgeX), Math.max(0, radiusPx - edgeY));
    const d = Math.min(edgeX, edgeY, cornerDistance); const t = Math.max(0, Math.min(1, d / bezel));
    const strength = (1 - t) * (1 - t) * .9; const nx = x < cw / 2 ? 1 : -1; const ny = y < ch / 2 ? 1 : -1;
    const i = (y * cw + x) * 4; data[i] = 128 + nx * strength * 110; data[i + 1] = 128 + ny * strength * 110; data[i + 2] = 128; data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); return canvas.toDataURL("image/png");
}

function applyLiquidGlass(el: HTMLElement): GlassInstance {
  const id = `pulse-liquid-${++filterId}`;
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", id); filter.setAttribute("x", "-20%"); filter.setAttribute("y", "-20%"); filter.setAttribute("width", "140%"); filter.setAttribute("height", "140%"); filter.setAttribute("color-interpolation-filters", "sRGB");
  const image = document.createElementNS("http://www.w3.org/2000/svg", "feImage"); image.setAttribute("preserveAspectRatio", "none"); image.setAttribute("result", "map"); filter.appendChild(image);
  const displacement = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
  displacement.setAttribute("in", "SourceGraphic"); displacement.setAttribute("in2", "map"); displacement.setAttribute("xChannelSelector", "R"); displacement.setAttribute("yChannelSelector", "G"); displacement.setAttribute("scale", "-24"); filter.appendChild(displacement);
  ensureDefs().appendChild(filter);
  const refresh = () => { const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) return; const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 22; image.setAttribute("href", makeDisplacementMap(rect.width, rect.height, radius)); };
  el.classList.add("pulse-liquid-glass");
  el.style.setProperty("--pulse-liquid-filter", `url(#${id})`);
  const material = `var(--pulse-liquid-filter) blur(24px) saturate(180%) brightness(1.04)`;
  el.style.setProperty("backdrop-filter", material); el.style.setProperty("-webkit-backdrop-filter", material);
  refresh();
  const observer = new ResizeObserver(() => refresh()); observer.observe(el);
  return { refresh, destroy: () => { observer.disconnect(); filter.remove(); el.classList.remove("pulse-liquid-glass"); el.style.removeProperty("--pulse-liquid-filter"); el.style.removeProperty("backdrop-filter"); el.style.removeProperty("-webkit-backdrop-filter"); } };
}

function shouldGlass(el: Element) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.dataset.liquidGlass === "off" || el.classList.contains("pulse-liquid-glass")) return false;
  if (el.classList.contains("glass-panel")) return true;
  const cls = el.className; if (typeof cls !== "string") return false;
  if (!/(bg-card\/(30|40|50|70)|bg-background\/50|bg-secondary\/(20|30|35|40|50)|backdrop-blur)/.test(cls)) return false;
  const r = el.getBoundingClientRect(); return r.width >= 140 && r.height >= 36 && r.width * r.height < 900000;
}

function scan(root: ParentNode = document) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(".glass-panel, [class*='bg-card/'], [class*='bg-background/'], [class*='bg-secondary/'], [class*='backdrop-blur']"));
  for (const el of candidates) if (shouldGlass(el)) instances.set(el, applyLiquidGlass(el));
}

function start() {
  scan();
  const observer = new MutationObserver(mutations => { for (const mutation of mutations) for (const node of Array.from(mutation.addedNodes)) if (node instanceof HTMLElement) { if (shouldGlass(node)) instances.set(node, applyLiquidGlass(node)); scan(node); } });
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
