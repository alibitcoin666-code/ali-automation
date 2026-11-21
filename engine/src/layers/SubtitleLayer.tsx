import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { BrandTheme, Caption, Format } from "@amf/pipeline/core";
import { getLayout } from "@amf/templates";
import { clamp, bez, isLatinWord } from "@amf/styles";

/** 16-direction outline + soft drop shadow (robust in headless Chrome, no paint-order needed). */
const outline = (px: number, color: string) => {
  const s: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    s.push(`${(Math.cos(a) * px).toFixed(2)}px ${(Math.sin(a) * px).toFixed(2)}px 0 ${color}`);
  }
  s.push(`0 ${px * 0.9}px ${px * 2.2}px rgba(0,0,0,0.55)`);
  return s.join(", ");
};

const Page: React.FC<{ page: Caption; startFrame: number; theme: BrandTheme; format: Format; boxed: boolean }> = ({ page, startFrame, theme, format, boxed }) => {
  const frame = useCurrentFrame() + startFrame; // absolute frame
  const { fps } = useVideoConfig();
  const L = getLayout(format);
  const z = L.zones.subtitle!.rect;
  const c = L.caption;
  const p = theme.palette;
  const local = frame - startFrame;
  const enter = interpolate(local, [0, 3], [0, 1], { ...clamp, easing: bez([0.16, 1, 0.3, 1]) });

  // map line words -> tokens (same order, 1:1 by construction of buildCaptions)
  let k = 0;
  const lines = page.lines.map((l) => l.split(" ").filter(Boolean).map((w) => ({ w, tok: page.tokens[k++] })));
  const ok = k === page.tokens.length;
  if (!ok) console.warn(`AMF_WARN caption page ${page.pageIndex} word/token mismatch`);

  // Active token: from its first frame until the next token starts (bridges short gaps <= 200 ms).
  const activeIdx = (() => {
    let idx = -1;
    for (let i = 0; i < page.tokens.length; i++) {
      const t = page.tokens[i]!;
      const next = page.tokens[i + 1];
      const holdTo = next ? (next.fromFrame - t.toFrame <= Math.round(0.2 * fps) ? next.fromFrame : t.toFrame) : t.toFrame;
      if (frame >= t.fromFrame && frame < holdTo) idx = i;
    }
    return idx;
  })();

  let gi = -1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        data-amf-layer="subtitle"
        data-amf-text={page.text}
        data-amf-page={page.pageIndex}
        dir="rtl"
        lang="fa"
        style={{
          position: "absolute",
          left: z.x,
          top: z.y,
          width: z.w,
          height: z.h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          opacity: 0.55 + 0.45 * enter,
          // scale from the bottom edge so the entering page never leaves the subtitle zone
          transform: `scale(${0.97 + 0.03 * enter})`,
          transformOrigin: "50% 100%",
        }}
      >
        <div
          data-amf-box="subtitle"
          style={{
            direction: "rtl",
            textAlign: "center",
            whiteSpace: "pre",
            fontFamily: `"${theme.fonts.captionFa}", "Vazirmatn", "NotoNaskhArabic"`,
            fontWeight: c.weight,
            fontSize: c.fontSize,
            lineHeight: c.lineHeight,
            letterSpacing: 0,
            color: p.captionText,
            textShadow: boxed ? undefined : outline(c.stroke * 0.5, p.captionStroke),
            background: boxed ? p.captionBox : undefined,
            borderRadius: boxed ? 14 : undefined,
            padding: boxed ? "2px 26px 8px" : undefined,
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {lines.map((ln, li) => {
            // group consecutive Latin words into one LTR-isolated run (see mergeLatinRuns)
            const runs: { latin: boolean; items: { w: string; gi: number }[] }[] = [];
            for (const { w } of ln) {
              gi++;
              const latin = isLatinWord(w);
              const last = runs[runs.length - 1];
              if (last && latin && last.latin) last.items.push({ w, gi });
              else runs.push({ latin, items: [{ w, gi }] });
            }
            const word = (w: string, idx: number) => {
              const active = ok && idx === activeIdx;
              const spoken = ok && activeIdx >= 0 && idx < activeIdx;
              return (
                <span
                  key={idx}
                  data-amf-word={idx}
                  data-amf-active={active ? "1" : undefined}
                  style={{
                    display: "inline-block",
                    whiteSpace: "pre",
                    color: active ? p.captionHighlight : p.captionText,
                    opacity: spoken || active || activeIdx < 0 ? 1 : 0.94,
                    transform: active ? "scale(1.06)" : undefined,
                    transformOrigin: "50% 60%",
                  }}
                >
                  {w}
                </span>
              );
            };
            return (
              <div key={li} style={{ display: "block" }}>
                {runs.map((r, ri) => (
                  <React.Fragment key={ri}>
                    {ri > 0 ? " " : null}
                    {r.latin ? (
                      <span dir="ltr" style={{ display: "inline-block", unicodeBidi: "isolate", whiteSpace: "pre" }}>
                        {r.items.map((it, k) => (
                          <React.Fragment key={it.gi}>
                            {k > 0 ? " " : null}
                            {word(it.w, it.gi)}
                          </React.Fragment>
                        ))}
                      </span>
                    ) : (
                      word(r.items[0]!.w, r.items[0]!.gi)
                    )}
                  </React.Fragment>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Subtitle layer on the absolute timeline. Captions carry absolute ms. */
export const SubtitleLayer: React.FC<{ captions: Caption[]; theme: BrandTheme; format: Format; boxed?: boolean }> = ({ captions, theme, format, boxed = false }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {captions
        .filter((c) => !c.hidden)
        .map((c) => {
          const from = Math.round((c.startMs * fps) / 1000);
          const to = Math.round((c.endMs * fps) / 1000);
          return (
            <Sequence key={c.pageIndex} from={from} durationInFrames={Math.max(1, to - from)} layout="none" name={`cap-${c.pageIndex}`}>
              <Page page={c} startFrame={from} theme={theme} format={format} boxed={boxed} />
            </Sequence>
          );
        })}
    </>
  );
};
