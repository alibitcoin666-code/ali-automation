import { useEffect, useState } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";

/**
 * Collision QA probe. Logs the bounding boxes of every element tagged with
 * data-amf-layer as "AMF_PROBE {json}". The renderer collects these via onBrowserLog.
 */
export const QaProbe: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const frame = useCurrentFrame();
  const [handle] = useState(() => (enabled ? delayRender("qa-probe") : null));
  useEffect(() => {
    if (!enabled) return;
    const h = handle ?? delayRender("qa-probe-frame");
    requestAnimationFrame(() => {
      const items = Array.from(document.querySelectorAll<HTMLElement>("[data-amf-layer]")).map((el) => {
        const r = (el.querySelector("[data-amf-box]") as HTMLElement | null)?.getBoundingClientRect() ?? el.getBoundingClientRect();
        // tight box around actual glyph spans when present
        const spans = Array.from(el.querySelectorAll<HTMLElement>("span"));
        let box = { x: r.x, y: r.y, w: r.width, h: r.height };
        if (spans.length) {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const s of spans) {
            const b = s.getBoundingClientRect();
            if (b.width === 0) continue;
            x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
          }
          if (x1 > x0) box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
        // effective visible opacity: ancestors × the most opaque glyph span (words fade individually)
        const chain = (from: HTMLElement, stop: HTMLElement | null) => {
          let o = 1;
          for (let n: HTMLElement | null = from; n && n !== stop; n = n.parentElement) o *= Number(getComputedStyle(n).opacity || 1);
          return o;
        };
        let op = chain(el, null);
        if (spans.length) op *= Math.max(...spans.map((s) => chain(s, el)));
        return {
          layer: el.dataset.amfLayer,
          id: el.dataset.amfId,
          text: el.dataset.amfText,
          rendered: el.textContent?.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim(),
          opacity: op,
          box,
        };
      });
      console.log("AMF_PROBE " + JSON.stringify({ frame, items }));
      continueRender(h);
    });
  }, [enabled, frame, handle]);
  return null;
};
