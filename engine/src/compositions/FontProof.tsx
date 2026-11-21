import React from "react";
import { AbsoluteFill } from "remotion";
import type { Channel } from "@amf/pipeline/core";
import { KineticText } from "@amf/styles";
import { Wordmark } from "@amf/templates";
import { FONT_FILES } from "../lib/fonts";
import { getTheme } from "../lib/brands";
import "../lib/fonts";

export const PROOF_FA = "می‌خواهیم با یک دست، یک رؤیا بسازیم — ۱۴۰۵ — Pianova 2026";
const PROOF_LATIN = "Pianova 2026 — ONE HAND, ONE DREAM — 0123456789";
const PERSIAN = new Set(["Vazirmatn", "Estedad", "Lalezar", "MarkaziText", "NotoNaskhArabic", "NotoSansArabic"]);

const row = (family: string, i: number) => {
  const fa = PERSIAN.has(family);
  return (
    <div key={family} style={{ display: "flex", alignItems: "center", height: 74, borderBottom: "1px solid #ffffff14", gap: 30 }}>
      <div style={{ width: 300, fontFamily: "Inter", fontSize: 24, color: "#9aa6c0", direction: "ltr" }}>{`${i + 1}. ${family}`}</div>
      <div style={{ flex: 1 }}>
        <KineticText id={`proof-${family}`} text={fa ? PROOF_FA : PROOF_LATIN} preset="cutIn" startFrame={0} fontFamily={family} fontWeight={fa ? 600 : 500} color="#ffffff" accent="#E8C77E" maxWidth={1500} maxLines={1} minSize={30} maxSize={46} lineHeight={1.45} align={fa ? "start" : "end"} springConfig={{ damping: 200, stiffness: 100, mass: 1 }} />
      </div>
    </div>
  );
};

/** CI font-proof still: every font with the canonical proof string. */
export const FontProofAll: React.FC = () => (
  <AbsoluteFill style={{ background: "#0B1020", padding: "40px 60px" }}>
    {FONT_FILES.map((f, i) => row(f.family, i))}
  </AbsoluteFill>
);

/** Per-brand typography proof: wordmark + heading/body/caption roles. */
export const BrandProof: React.FC<{ channel: Channel }> = ({ channel }) => {
  const t = getTheme(channel);
  const p = t.palette;
  const roles: [string, string, number, number][] = [
    ["headingFa", t.fonts.headingFa, 800, 110],
    ["displayFa", t.fonts.displayFa ?? t.fonts.headingFa, 700, 84],
    ["bodyFa", t.fonts.bodyFa, 500, 50],
    ["captionFa", t.fonts.captionFa, 650, 58],
  ];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 30%, ${p.bgAlt}, ${p.bg})`, alignItems: "center", paddingTop: 50 }}>
      <Wordmark theme={t} size={92} />
      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 18, width: 1700 }}>
        {roles.map(([role, fam, w, size]) => (
          <div key={role} style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ width: 230, fontFamily: "Inter", fontSize: 22, color: p.textMuted }}>{`${role}: ${fam}`}</div>
            <KineticText id={`bp-${role}`} text={role === "headingFa" ? "یک رؤیا بسازیم" : PROOF_FA} preset="cutIn" startFrame={0} fontFamily={fam} fontWeight={w} color={p.text} accent={p.accent} maxWidth={1440} maxLines={1} minSize={30} maxSize={size} lineHeight={1.4} align="end" springConfig={{ damping: 200, stiffness: 100, mass: 1 }} emphasis={["رؤیا"]} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
