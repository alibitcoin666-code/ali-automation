import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D, noise3D } from "@remotion/noise";
import type { BrandTheme, MotionStyle } from "@amf/pipeline/core";

export interface BgProps {
  style: MotionStyle;
  theme: BrandTheme;
  seed: string;
  /** 0..1 audio energy for audio-reactive backgrounds (bass). */
  energy?: number;
  spectrum?: number[];
  intensity?: number;
}

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* ---------------------------------------------------------------- */

const Gradient: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const x1 = 50 + noise2D(seed + "x1", f / 300, 0) * 30;
  const y1 = 40 + noise2D(seed + "y1", 0, f / 300) * 25;
  const x2 = 50 + noise2D(seed + "x2", f / 260, 1) * 35;
  const y2 = 60 + noise2D(seed + "y2", 1, f / 260) * 25;
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at ${x1}% ${y1}%, ${hexA(p.bgAlt, 1)} 0%, transparent 70%),
                       radial-gradient(ellipse 55% 50% at ${x2}% ${y2}%, ${hexA(p.accent, 0.16)} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${hexA(p.bg, 0.55)} 100%)`,
          width,
          height,
        }}
      />
    </AbsoluteFill>
  );
};

const Bokeh: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const dots = useMemo(
    () =>
      new Array(26).fill(0).map((_, i) => ({
        x: random(`${seed}-bx-${i}`) * width,
        y: random(`${seed}-by-${i}`) * height,
        r: 30 + random(`${seed}-br-${i}`) * 140,
        a: 0.05 + random(`${seed}-ba-${i}`) * 0.16,
        sp: 0.15 + random(`${seed}-bs-${i}`) * 0.5,
        gold: random(`${seed}-bg-${i}`) > 0.35,
      })),
    [seed, width, height],
  );
  return (
    <AbsoluteFill>
      <Gradient theme={theme} seed={seed} style={undefined as never} />
      {dots.map((d, i) => {
        const dx = noise2D(`${seed}-dn-${i}`, f / 240, 0) * 60;
        const dy = -f * d.sp * 0.6 + noise2D(`${seed}-dm-${i}`, 0, f / 240) * 40;
        const y = ((d.y + dy) % (height + 300) + height + 300) % (height + 300) - 150;
        const tw = 0.75 + 0.25 * Math.sin(f / 22 + i);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x + dx - d.r,
              top: y - d.r,
              width: d.r * 2,
              height: d.r * 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${hexA(d.gold ? p.accent : p.primary, d.a * tw)} 0%, ${hexA(
                d.gold ? p.accent : p.primary,
                d.a * 0.5 * tw,
              )} 45%, transparent 70%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const IsoGrid: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const shift = (f * 0.6) % 80;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${p.bgAlt}, ${p.bg})` }}>
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.35 }}>
        <defs>
          <pattern id={`iso-${seed}`} width="80" height="46.188" patternUnits="userSpaceOnUse" patternTransform={`translate(${shift},${shift * 0.577})`}>
            <path d="M0 23.094 L40 0 L80 23.094 L40 46.188 Z" fill="none" stroke={hexA(p.accent, 0.5)} strokeWidth="1" />
          </pattern>
          <linearGradient id={`isofade-${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.1" />
            <stop offset="0.6" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id={`isomask-${seed}`}>
            <rect width={width} height={height} fill={`url(#isofade-${seed})`} />
          </mask>
        </defs>
        <rect width={width} height={height} fill={`url(#iso-${seed})`} mask={`url(#isomask-${seed})`} />
      </svg>
      {new Array(6).fill(0).map((_, i) => {
        const x = random(`${seed}-ic-${i}`) * width;
        const y = height * 0.35 + random(`${seed}-iy-${i}`) * height * 0.55;
        const s = 60 + random(`${seed}-is-${i}`) * 90;
        const bob = Math.sin(f / 30 + i * 1.7) * 8;
        return <IsoCube key={i} x={x} y={y + bob} size={s} color={i % 2 ? p.accent : p.primary} />;
      })}
    </AbsoluteFill>
  );
};

const IsoCube: React.FC<{ x: number; y: number; size: number; color: string }> = ({ x, y, size, color }) => {
  const h = size * 0.577;
  return (
    <svg style={{ position: "absolute", left: x - size, top: y - size }} width={size * 2} height={size * 2} viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}>
      <path d={`M0 ${-h} L${size} 0 L0 ${h} L${-size} 0 Z`} fill={hexA(color, 0.28)} />
      <path d={`M${-size} 0 L0 ${h} L0 ${h + size * 0.8} L${-size} ${size * 0.8} Z`} fill={hexA(color, 0.14)} />
      <path d={`M${size} 0 L0 ${h} L0 ${h + size * 0.8} L${size} ${size * 0.8} Z`} fill={hexA(color, 0.08)} />
    </svg>
  );
};

const ParallaxLayers: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const layers = [0.15, 0.35, 0.7];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 30%, ${p.bgAlt}, ${p.bg} 75%)` }}>
      {layers.map((depth, li) => (
        <AbsoluteFill key={li} style={{ transform: `translateX(${-f * depth * 0.8}px)` }}>
          {new Array(9).fill(0).map((_, i) => {
            const x = random(`${seed}-px-${li}-${i}`) * (width + 600) - 100;
            const y = height * (0.25 + li * 0.22) + random(`${seed}-py-${li}-${i}`) * 140;
            const w = 200 + random(`${seed}-pw-${li}-${i}`) * 500;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: w,
                  height: w * 0.08,
                  borderRadius: w,
                  background: `linear-gradient(90deg, transparent, ${hexA(li === 2 ? p.accent : p.primary, 0.05 + li * 0.05)}, transparent)`,
                  filter: `blur(${(2 - li) * 3}px)`,
                }}
              />
            );
          })}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

const Glass: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const p = theme.palette;
  const blobs = [p.accent, p.accent2 ?? p.primary, p.primary];
  return (
    <AbsoluteFill style={{ background: p.bg, overflow: "hidden" }}>
      {blobs.map((c, i) => {
        const x = 20 + i * 30 + noise2D(`${seed}-g${i}`, f / 200, i) * 18;
        const y = 35 + noise2D(`${seed}-h${i}`, i, f / 200) * 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 900,
              height: 900,
              marginLeft: -450,
              marginTop: -450,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${hexA(c, 0.55)} 0%, transparent 65%)`,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ backdropFilter: "blur(40px)", background: hexA(p.bg, 0.35) }} />
    </AbsoluteFill>
  );
};

const NeonGrid: React.FC<BgProps> = ({ theme, seed, energy = 0 }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const horizon = height * 0.58;
  const speed = (f * 4) % 80;
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < 18; i++) {
    const t = (i * 80 + speed) / (18 * 80);
    const y = horizon + Math.pow(t, 2.2) * (height - horizon + 200);
    lines.push(<line key={`h${i}`} x1={0} x2={width} y1={y} y2={y} stroke={p.accent} strokeOpacity={0.15 + t * 0.6} strokeWidth={1 + t * 2} />);
  }
  for (let i = -14; i <= 14; i++) {
    lines.push(
      <line key={`v${i}`} x1={width / 2 + i * 40} y1={horizon} x2={width / 2 + i * 260} y2={height + 200} stroke={p.accent} strokeOpacity={0.35} strokeWidth={1.5} />,
    );
  }
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.bg} 0%, ${p.bgAlt} 58%, ${p.bg} 100%)` }}>
      <div
        style={{
          position: "absolute",
          left: width / 2 - 420,
          top: horizon - 520,
          width: 840,
          height: 840,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexA(p.accent, 0.32 + energy * 0.3)} 0%, transparent 62%)`,
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute", filter: `drop-shadow(0 0 6px ${p.accent})` }}>
        {lines}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: horizon - 1, height: 2, background: p.accent, boxShadow: `0 0 30px 6px ${hexA(p.accent, 0.8)}` }} />
      <span style={{ display: "none" }}>{seed}</span>
    </AbsoluteFill>
  );
};

const Paper: React.FC<BgProps> = ({ theme, seed }) => {
  const { width, height } = useVideoConfig();
  const f = useCurrentFrame();
  const p = theme.palette;
  const step = Math.floor(f / 4); // stop-motion: texture re-seeds every 4 frames
  return (
    <AbsoluteFill style={{ background: "#e9dfcc" }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        <filter id={`paper-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed={(step % 7) + 1} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 0.22 0" />
        </filter>
        <rect width={width} height={height} filter={`url(#paper-${seed})`} />
      </svg>
      {new Array(5).fill(0).map((_, i) => {
        const r = random(`${seed}-pc-${i}-${Math.floor(step / 2)}`) * 2 - 1;
        const x = random(`${seed}-px-${i}`) * width * 0.9;
        const y = random(`${seed}-py-${i}`) * height * 0.9;
        const w = 220 + random(`${seed}-pw-${i}`) * 420;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: w * 0.62,
              background: i % 2 ? hexA(p.accent, 0.5) : hexA(p.bgAlt, 0.18),
              transform: `rotate(${r * 6}deg)`,
              clipPath: "polygon(2% 4%, 30% 0%, 62% 3%, 100% 0%, 97% 40%, 100% 96%, 60% 100%, 28% 97%, 0% 100%, 3% 55%)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const SwissGrid: React.FC<BgProps> = ({ theme }) => {
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const cols = 12;
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      {new Array(cols + 1).fill(0).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: (i * width) / cols, top: 0, bottom: 0, width: 1, background: hexA(p.text, 0.06) }} />
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: height * 0.62, height: 1, background: hexA(p.text, 0.08) }} />
      <div style={{ position: "absolute", right: width / cols, top: height * 0.1, width: width / cols / 3, height: height * 0.8, background: p.accent }} />
    </AbsoluteFill>
  );
};

const Spectrum: React.FC<BgProps> = ({ theme, spectrum, energy = 0 }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const bins = spectrum && spectrum.length ? spectrum : new Array(64).fill(0).map((_, i) => 0.2 + 0.2 * Math.abs(Math.sin(f / 9 + i / 3)));
  const n = bins.length;
  const bw = width / n;
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) * 0.22 * (1 + energy * 0.08);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, ${p.bgAlt} 0%, ${p.bg} 70%)` }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="spec-g" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={p.accent} stopOpacity="0.15" />
            <stop offset="1" stopColor={p.accent} stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {bins.map((v, i) => {
          const h = Math.max(4, v * height * 0.32);
          return <rect key={i} x={i * bw + bw * 0.18} y={height - h} width={bw * 0.64} height={h} rx={bw * 0.3} fill="url(#spec-g)" />;
        })}
        {bins.map((v, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const r2 = R + 10 + v * 150;
          return (
            <line
              key={`r${i}`}
              x1={cx + Math.cos(a) * R}
              y1={cy + Math.sin(a) * R}
              x2={cx + Math.cos(a) * r2}
              y2={cy + Math.sin(a) * r2}
              stroke={p.primary}
              strokeOpacity={0.55}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={p.accent} strokeOpacity={0.6} strokeWidth={2} />
      </svg>
    </AbsoluteFill>
  );
};

const Film: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const p = theme.palette;
  const flick = 0.92 + 0.08 * random(`${seed}-fl-${f}`);
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      <AbsoluteFill
        style={{
          opacity: flick,
          background: `radial-gradient(ellipse 80% 70% at 60% 45%, ${hexA(p.bgAlt, 1)} 0%, ${p.bg} 75%),
                       radial-gradient(ellipse 40% 40% at ${30 + noise2D(seed, f / 200, 0) * 10}% 30%, ${hexA(p.accent, 0.18)} 0%, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Noise: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const cols = 32;
  const rows = Math.round((cols * height) / width);
  const cw = width / cols;
  const dots: React.ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const n = noise3D(seed, x / 10, y / 10, f / 120);
      const a = (n + 1) / 2;
      const ang = n * Math.PI;
      dots.push(
        <line
          key={`${x}-${y}`}
          x1={x * cw + cw / 2}
          y1={y * cw + cw / 2}
          x2={x * cw + cw / 2 + Math.cos(ang) * cw * 0.45}
          y2={y * cw + cw / 2 + Math.sin(ang) * cw * 0.45}
          stroke={a > 0.6 ? p.accent : p.primary}
          strokeOpacity={0.08 + a * 0.3}
          strokeWidth={3}
          strokeLinecap="round"
        />,
      );
    }
  }
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${p.bg}, ${p.bgAlt})` }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {dots}
      </svg>
    </AbsoluteFill>
  );
};

const Studio3d: React.FC<BgProps> = ({ theme }) => {
  const f = useCurrentFrame();
  const p = theme.palette;
  const a = interpolate(Math.sin(f / 90), [-1, 1], [40, 60]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 60% 50% at ${a}% 42%, ${hexA(p.primary, 0.12)} 0%, transparent 60%),
                     radial-gradient(ellipse 120% 60% at 50% 110%, ${hexA(p.accent, 0.2)} 0%, transparent 60%),
                     linear-gradient(180deg, ${p.bgAlt}, ${p.bg})`,
      }}
    />
  );
};

const Newsroom: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(120deg, ${p.bg} 0%, ${p.bgAlt} 60%, ${p.bg} 100%)` }}>
      {new Array(7).fill(0).map((_, i) => {
        const x = ((i * width) / 6 + f * (0.4 + i * 0.05)) % (width + 400) - 200;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: -100,
              width: 120 + (i % 3) * 60,
              height: height + 200,
              transform: "skewX(-18deg)",
              background: `linear-gradient(180deg, transparent, ${hexA(p.accent, 0.05 + (i % 2) * 0.04)}, transparent)`,
            }}
          />
        );
      })}
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.12 }}>
        <circle cx={width * 0.78} cy={height * 0.42} r={height * 0.36} fill="none" stroke={p.text} strokeWidth="1" />
        {new Array(9).fill(0).map((_, i) => (
          <ellipse key={i} cx={width * 0.78} cy={height * 0.42} rx={height * 0.36 * Math.cos((i / 9) * Math.PI)} ry={height * 0.36} fill="none" stroke={p.text} strokeWidth="1" transform={`rotate(${(f * 0.2) % 360} ${width * 0.78} ${height * 0.42})`} />
        ))}
        {new Array(7).fill(0).map((_, i) => (
          <ellipse key={`l${i}`} cx={width * 0.78} cy={height * 0.42} rx={height * 0.36} ry={height * 0.36 * Math.sin(((i + 1) / 8) * Math.PI) * 0.4} fill="none" stroke={p.text} strokeWidth="1" />
        ))}
      </svg>
      <span style={{ display: "none" }}>{seed}</span>
    </AbsoluteFill>
  );
};

const DataGrid: React.FC<BgProps> = ({ theme }) => {
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.bgAlt} 0%, ${p.bg} 100%)` }}>
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.25 }}>
        <defs>
          <pattern id="dg" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M60 0 L0 0 0 60" fill="none" stroke={p.textMuted} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#dg)" />
      </svg>
    </AbsoluteFill>
  );
};

const Trails: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, ${p.bgAlt}, ${p.bg} 70%)` }}>
      {new Array(16).fill(0).map((_, i) => {
        const y = random(`${seed}-ty-${i}`) * height;
        const len = 300 + random(`${seed}-tl-${i}`) * 700;
        const sp = 18 + random(`${seed}-ts-${i}`) * 30;
        const x = width - (((f * sp + random(`${seed}-tx-${i}`) * width * 2) % (width + len * 2)) - len);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: len,
              height: 2 + (i % 3),
              background: `linear-gradient(90deg, ${hexA(i % 2 ? p.accent : p.primary, 0.7)}, transparent)`,
              borderRadius: 4,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const FlatShapes: React.FC<BgProps> = ({ theme, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const shapes = new Array(8).fill(0).map((_, i) => ({
    x: random(`${seed}-fx-${i}`) * width,
    y: random(`${seed}-fy-${i}`) * height,
    s: 40 + random(`${seed}-fs-${i}`) * 120,
    k: Math.floor(random(`${seed}-fk-${i}`) * 3),
  }));
  return (
    <AbsoluteFill style={{ background: p.bgAlt }}>
      {shapes.map((s, i) => {
        const rot = f * (i % 2 ? 0.3 : -0.25);
        const bob = Math.sin(f / 40 + i) * 12;
        const c = [p.accent, p.accent2 ?? p.primary, p.primary][i % 3]!;
        const common: React.CSSProperties = { position: "absolute", left: s.x, top: s.y + bob, width: s.s, height: s.s, opacity: 0.22, transform: `rotate(${rot}deg)` };
        if (s.k === 0) return <div key={i} style={{ ...common, borderRadius: "50%", background: c }} />;
        if (s.k === 1) return <div key={i} style={{ ...common, borderRadius: s.s * 0.2, background: c }} />;
        return <div key={i} style={{ ...common, background: c, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />;
      })}
    </AbsoluteFill>
  );
};

const MAP: Record<MotionStyle["background"], React.FC<BgProps>> = {
  gradient: Gradient,
  bokeh: Bokeh,
  isoGrid: IsoGrid,
  parallaxLayers: ParallaxLayers,
  glass: Glass,
  neonGrid: NeonGrid,
  paper: Paper,
  swissGrid: SwissGrid,
  spectrum: Spectrum,
  film: Film,
  noise: Noise,
  studio3d: Studio3d,
  newsroom: Newsroom,
  dataGrid: DataGrid,
  trails: Trails,
  flatShapes: FlatShapes,
};

export const StyleBackground: React.FC<BgProps> = (props) => {
  const C = MAP[props.style.background];
  return <C {...props} />;
};

export { hexA };
