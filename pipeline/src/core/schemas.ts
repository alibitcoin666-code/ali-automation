import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const Channel = z.enum(["pianova", "musicradio69", "onehandonedream", "neutral"]);
export type Channel = z.infer<typeof Channel>;

export const VideoType = z.enum(["EDUCATIONAL", "PROMO", "NEWS"]);
export type VideoType = z.infer<typeof VideoType>;

export const Format = z.enum(["landscape_16x9", "shorts_9x16"]);
export type Format = z.infer<typeof Format>;

export const MotionStyleId = z.enum([
  "cinematicLuxury",
  "kineticTypography",
  "flat2dExplainer",
  "isometric25d",
  "parallaxDepth",
  "liquidGlass",
  "neonGlow",
  "dataViz",
  "broadcastNews",
  "paperCollage",
  "minimalSwiss",
  "audioReactive",
  "motionTrails",
  "lightLeakFilm",
  "hero3d",
  "noiseFields",
]);
export type MotionStyleId = z.infer<typeof MotionStyleId>;

export const TransitionId = z.enum([
  "fade",
  "slide",
  "maskWipeRtl",
  "clockWipe",
  "lightSweep",
  "glitch",
  "whipPan",
  "filmBurn",
  "hardCut",
  "zoomBlur",
]);
export type TransitionId = z.infer<typeof TransitionId>;

export const SceneType = z.enum([
  "hook",
  "problem",
  "step",
  "recap",
  "cta",
  "pain",
  "benefit",
  "proof",
  "offer",
  "headline",
  "fact",
  "context",
  "whatNext",
  "intro",
  "outro",
  "chapter",
  "quote",
]);
export type SceneType = z.infer<typeof SceneType>;

export const TextRole = z.enum([
  "title",
  "keyword",
  "number",
  "lowerThird",
  "label",
  "quote",
  "cta",
  "sourceBadge",
  "ticker",
  "chapter",
]);

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const Rect = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type Rect = z.infer<typeof Rect>;
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const SourceRef = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  accessedAt: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* ------------------------------------------------------------------ */
/* Fonts and brand                                                     */
/* ------------------------------------------------------------------ */

export const FontRef = z.object({
  family: z.string(),
  woff2: z.string(),
  ttf: z.string(),
  sha256: Sha256,
  weights: z.tuple([z.number(), z.number()]),
  license: z.literal("OFL-1.1"),
  version: z.string(),
});

export const BrandTheme = z.object({
  id: Channel,
  displayName: z.string(),
  wordmark: z.object({ primary: z.string(), secondary: z.string() }),
  palette: z.object({
    bg: Hex,
    bgAlt: Hex,
    primary: Hex,
    accent: Hex,
    accent2: Hex.optional(),
    text: Hex,
    textMuted: Hex,
    captionText: Hex,
    captionHighlight: Hex,
    captionStroke: Hex,
    captionBox: z.string(),
  }),
  fonts: z.object({
    captionFa: z.string(),
    bodyFa: z.string(),
    headingFa: z.string(),
    displayFa: z.string().optional(),
    titleLatin: z.string(),
    bodyLatin: z.string(),
  }),
  allowedStyles: z.array(MotionStyleId).min(1),
  allowedFps: z.array(z.union([z.literal(30), z.literal(60)])).min(1),
  allow4k: z.boolean(),
  voice: z.object({
    gemini: z.string(),
    edge: z.string(),
    stylePrompt: z.string(),
  }),
  music: z.object({ ledger: z.string(), mood: z.string() }),
  dictionary: z.string(),
  blockedTargets: z.array(z.string()),
  handle: z.string().optional(),
});
export type BrandTheme = z.infer<typeof BrandTheme>;

/* ------------------------------------------------------------------ */
/* Motion style                                                        */
/* ------------------------------------------------------------------ */

export const Bezier = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const MotionStyle = z
  .object({
    id: MotionStyleId,
    label: z.string(),
    labelFa: z.string(),
    easing: z.record(z.string(), Bezier),
    spring: z.object({ damping: z.number(), stiffness: z.number(), mass: z.number() }),
    transitions: z.array(TransitionId).min(1),
    transitionFrames: z.number().int().min(8).max(18),
    textPresets: z
      .array(
        z.enum([
          "wordSpring",
          "lineMaskRtl",
          "weightMorph",
          "scalePunch",
          "fadeUp",
          "blurIn",
          "counter",
          "echo",
          "glitchIn",
          "cutIn",
        ]),
      )
      .min(1),
    background: z.enum([
      "gradient",
      "bokeh",
      "isoGrid",
      "parallaxLayers",
      "glass",
      "neonGrid",
      "paper",
      "swissGrid",
      "spectrum",
      "film",
      "noise",
      "studio3d",
      "newsroom",
      "dataGrid",
      "trails",
      "flatShapes",
    ]),
    effects: z.array(
      z.enum([
        "grain",
        "vignette",
        "lightSweep",
        "bokeh",
        "anamorphicFlare",
        "lightLeak",
        "gateWeave",
        "glow",
        "scanlines",
        "jitter",
        "chromatic",
        "speedLines",
        "dust",
      ]),
    ),
    camera: z.array(z.enum(["static", "pushIn", "dolly", "parallax", "orbit", "drift"])).min(1),
    grade: z.object({
      contrast: z.number(),
      saturation: z.number(),
      brightness: z.number().default(1),
      grain: z.number().min(0).max(1),
      vignette: z.number().min(0).max(1),
      tint: z.string().optional(),
    }),
    allowedFonts: z.array(z.string()).min(1),
    audioReactive: z.boolean(),
  })
  .superRefine((s, ctx) => {
    for (const [name, [a, b, c, d]] of Object.entries(s.easing)) {
      if (name.startsWith("hero") && a === b && c === d) {
        ctx.addIssue({ code: "custom", message: `linear easing forbidden on hero move ${name}` });
      }
    }
  });
export type MotionStyle = z.infer<typeof MotionStyle>;

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

export const ZoneLayer = z.enum([
  "subtitle",
  "typography",
  "logo",
  "lowerThird",
  "face",
  "platformUi",
  "endScreen",
  "visual",
]);
export type ZoneLayer = z.infer<typeof ZoneLayer>;

export const Zone = z.object({ rect: Rect, layer: ZoneLayer });
export type Zone = z.infer<typeof Zone>;

export const TemplateKind = z.enum([
  "intro",
  "outro",
  "lowerThird",
  "chapter",
  "cta",
  "quote",
  "episode",
  "short",
  "thumbnail",
  "series",
  "caption",
  "progress",
  "watermark",
]);

export const Template = z
  .object({
    id: z.string(),
    channel: Channel,
    kind: TemplateKind,
    format: z.union([Format, z.literal("thumb_1280x720"), z.literal("thumb_1080x1920")]),
    width: z.number().int(),
    height: z.number().int(),
    fps: z.union([z.literal(30), z.literal(60)]),
    durationFrames: z.number().int().optional(),
    zones: z.record(z.string(), Zone),
    safeArea: z.object({ top: z.number(), bottom: z.number(), left: z.number(), right: z.number() }),
    slots: z.array(
      z.object({ id: z.string(), accepts: z.array(z.enum(["text", "image", "video", "lottie"])) }),
    ),
    goldenFrames: z.array(z.number().int()),
  })
  .superRefine((t, ctx) => {
    const zs = Object.entries(t.zones);
    for (const [sn, s] of zs.filter(([, z]) => z.layer === "subtitle")) {
      for (const [on, o] of zs.filter(([, z]) => z.layer !== "subtitle" && z.layer !== "visual")) {
        if (rectsOverlap(s.rect, o.rect)) {
          ctx.addIssue({ code: "custom", message: `subtitle zone ${sn} overlaps ${o.layer} zone ${on}` });
        }
      }
    }
  });
export type Template = z.infer<typeof Template>;

/* ------------------------------------------------------------------ */
/* Text layers and captions                                            */
/* ------------------------------------------------------------------ */

export const TextLayer = z
  .object({
    id: z.string(),
    role: TextRole,
    text: z.string().min(1),
    lang: z.enum(["fa", "en"]),
    dir: z.enum(["rtl", "ltr"]),
    zone: z.string(),
    font: z.string(),
    sizePx: z.number().min(24).max(220),
    weight: z.number().min(100).max(900),
    lineHeight: z.number().min(1.1).max(1.9),
    maxLines: z.number().int().min(1).max(3),
    letterSpacing: z.literal(0),
    digits: z.enum(["fa", "latin"]).default("fa"),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int(),
    enter: z.string(),
    exit: z.string(),
    duplicatesVoice: z.boolean().default(false),
  })
  .refine((l) => l.endFrame - l.startFrame >= 45, { message: "important text must hold >= 1.5s" });
export type TextLayer = z.infer<typeof TextLayer>;

export const CaptionToken = z.object({
  text: z.string(),
  scriptWordIndex: z.number().int().nonnegative(),
  fromMs: z.number().nonnegative(),
  toMs: z.number(),
  fromFrame: z.number().int(),
  toFrame: z.number().int(),
});
export type CaptionToken = z.infer<typeof CaptionToken>;

export const CAPTION_RULES = {
  leadMinMs: 0,
  leadMaxMs: 80,
  tailMaxMs: 150,
  minPageMs: 900,
  maxLines: 2,
  maxLineChars: 42,
} as const;

export const Caption = z
  .object({
    pageIndex: z.number().int(),
    text: z.string(),
    lines: z.array(z.string().max(CAPTION_RULES.maxLineChars)).min(1).max(CAPTION_RULES.maxLines),
    startMs: z.number(),
    endMs: z.number(),
    tokens: z.array(CaptionToken).min(1),
    hidden: z.boolean().default(false),
  })
  .superRefine((c, ctx) => {
    const first = c.tokens[0]!.fromMs;
    const last = c.tokens[c.tokens.length - 1]!.toMs;
    if (c.endMs - c.startMs < CAPTION_RULES.minPageMs - 0.5)
      ctx.addIssue({ code: "custom", message: `page ${c.pageIndex} visible < 0.9s` });
    const lead = first - c.startMs;
    if (lead < CAPTION_RULES.leadMinMs - 0.5 || lead > CAPTION_RULES.leadMaxMs + 0.5)
      ctx.addIssue({ code: "custom", message: `page ${c.pageIndex} lead-in ${lead}ms out of 0-80ms` });
    if (c.endMs - last > CAPTION_RULES.tailMaxMs + 0.5)
      ctx.addIssue({ code: "custom", message: `page ${c.pageIndex} tail ${c.endMs - last}ms > 150ms` });
  });
export type Caption = z.infer<typeof Caption>;

/* ------------------------------------------------------------------ */
/* Storyboard                                                          */
/* ------------------------------------------------------------------ */

export const ChartData = z.object({
  kind: z.enum(["bar", "line", "pie", "counter", "timeline", "progress"]),
  title: z.string().optional(),
  series: z.array(z.object({ label: z.string(), value: z.number() })).min(1).max(8),
  unit: z.string().optional(),
});
export type ChartData = z.infer<typeof ChartData>;

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const stripForCompare = (x: string) => x.replace(/[^\p{L}\p{N}]/gu, "");

export const Scene = z
  .object({
    id: z.string(),
    sceneType: SceneType,
    voiceText: z.string().min(1),
    onScreenText: z
      .array(z.string().min(1).refine((s) => wordCount(s) <= 8, { message: "max 8 words per line" }))
      .max(3),
    style: MotionStyleId,
    visual: z.object({
      prompt: z.string(),
      source: z.enum(["flux", "lottie", "svg", "userClip", "none"]),
      noTextInImage: z.literal(true),
    }),
    icons: z.array(z.string()).max(4).default([]),
    chart: ChartData.optional(),
    sources: z.array(SourceRef).default([]),
    transitionIn: TransitionId,
    emphasis: z.array(z.string()).max(4).default([]),
    /** Optional animated piano keyboard: key indices 0..20 (3 octaves of white keys) to light in order. */
    pianoNotes: z.array(z.number().int().min(0).max(20)).max(16).optional(),
    /** Optional lower-third (name / role) shown in this scene. */
    lowerThird: z.object({ title: z.string().min(1), subtitle: z.string().optional() }).optional(),
    /** Optional quote for quote scenes. */
    quote: z.object({ text: z.string().min(1), author: z.string().optional() }).optional(),
  })
  .superRefine((s, ctx) => {
    const v = stripForCompare(s.voiceText);
    for (const t of s.onScreenText) {
      const st = stripForCompare(t);
      if (st.length > 12 && (st === v || (v.includes(st) && st.length / v.length > 0.8))) {
        ctx.addIssue({ code: "custom", message: `scene ${s.id}: onScreenText copies voiceText` });
      }
    }
    if (s.sceneType === "fact" && s.sources.length === 0) {
      ctx.addIssue({ code: "custom", message: `scene ${s.id}: NEWS fact without source` });
    }
  });
export type Scene = z.infer<typeof Scene>;

export const STRUCTURE: Record<z.infer<typeof VideoType>, z.infer<typeof SceneType>[][]> = {
  // Allowed ordered groups; each inner array is a set of acceptable types for that slot.
  EDUCATIONAL: [["hook"], ["problem"], ["step"], ["step"], ["step"], ["recap"], ["cta"]],
  PROMO: [["hook"], ["pain"], ["benefit"], ["proof"], ["offer"], ["cta"]],
  NEWS: [["headline"], ["fact"], ["fact"], ["fact"], ["context"], ["whatNext"]],
};

export const Storyboard = z
  .object({
    version: z.literal(1),
    jobId: z.string(),
    type: VideoType,
    channel: Channel,
    format: Format,
    language: z.literal("fa-IR"),
    title: z.string().min(2),
    mainStyle: MotionStyleId,
    accentStyles: z.array(MotionStyleId).max(2),
    scenes: z.array(Scene).min(3).max(24),
    youtube: z.object({
      title: z.string().min(5).max(100),
      description: z.string().max(5000),
      hashtags: z.array(z.string()).max(15),
    }),
    scriptHash: Sha256.optional(),
    factCheckConfirmed: z.boolean().default(false),
  })
  .superRefine((sb, ctx) => {
    const types = sb.scenes.map((s) => s.sceneType);
    const first = STRUCTURE[sb.type][0]![0]!;
    if (types[0] !== first) ctx.addIssue({ code: "custom", message: `${sb.type} must start with ${first}` });
    if (sb.type === "EDUCATIONAL") {
      const steps = types.filter((t) => t === "step").length;
      if (steps < 3 || steps > 5) ctx.addIssue({ code: "custom", message: "EDUCATIONAL needs 3-5 steps" });
      for (const t of ["problem", "recap", "cta"] as const)
        if (!types.includes(t)) ctx.addIssue({ code: "custom", message: `EDUCATIONAL missing ${t}` });
    }
    if (sb.type === "PROMO") {
      for (const t of ["pain", "benefit", "proof", "offer", "cta"] as const)
        if (!types.includes(t)) ctx.addIssue({ code: "custom", message: `PROMO missing ${t}` });
    }
    if (sb.type === "NEWS") {
      if (types.filter((t) => t === "fact").length !== 3)
        ctx.addIssue({ code: "custom", message: "NEWS needs exactly 3 facts" });
      for (const t of ["context", "whatNext"] as const)
        if (!types.includes(t)) ctx.addIssue({ code: "custom", message: `NEWS missing ${t}` });
    }
    const allowed = new Set([sb.mainStyle, ...sb.accentStyles]);
    for (const s of sb.scenes)
      if (!allowed.has(s.style))
        ctx.addIssue({ code: "custom", message: `scene ${s.id} uses style ${s.style} not in main/accent styles` });
  });
export type Storyboard = z.infer<typeof Storyboard>;

/* ------------------------------------------------------------------ */
/* Job                                                                 */
/* ------------------------------------------------------------------ */

export const StageName = z.enum([
  "guard",
  "script",
  "voice",
  "align",
  "assets",
  "preview",
  "final",
  "qa",
  "deliver",
]);
export type StageName = z.infer<typeof StageName>;

export const StageState = z.object({
  status: z.enum(["pending", "running", "ok", "failed", "skipped"]),
  attempts: z.number().int().default(0),
  provider: z.string().optional(),
  r2Keys: z.array(z.string()).default([]),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});
export type StageState = z.infer<typeof StageState>;

export const JobRequest = z.object({
  type: VideoType,
  channel: Channel,
  format: Format,
  style: MotionStyleId.optional(),
  durationSec: z.number().min(10).max(600),
  topic: z.string().min(3),
  points: z.array(z.string()).default([]),
  sources: z.array(SourceRef).default([]),
  fps: z.union([z.literal(30), z.literal(60)]).default(30),
  quality: z.enum(["1080p", "4k"]).default("1080p"),
  target: z.string().optional(),
});
export type JobRequest = z.infer<typeof JobRequest>;

export const JobStatus = z.enum([
  "queued",
  "running",
  "awaiting_script_approval",
  "awaiting_factcheck",
  "awaiting_preview_approval",
  "done",
  "failed",
  "dead_letter",
  "cancelled",
]);

export const Job = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
  origin: z.enum(["telegram", "web", "mcp", "cli"]),
  ownerTelegramId: z.number().int(),
  request: JobRequest,
  status: JobStatus,
  currentStage: StageName,
  stages: z.partialRecord(StageName, StageState),
  approvals: z.array(
    z.object({
      gate: z.enum(["script", "factcheck", "preview"]),
      decision: z.enum(["approve", "edit", "reject"]),
      note: z.string().optional(),
      at: z.string(),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof Job>;

/* ------------------------------------------------------------------ */
/* Render plan: everything the engine needs, fully resolved           */
/* ------------------------------------------------------------------ */

export const PlannedScene = z.object({
  scene: Scene,
  fromFrame: z.number().int(),
  durationFrames: z.number().int().positive(),
  voiceFromMs: z.number(),
  voiceToMs: z.number(),
  imageSrc: z.string().optional(),
  chapterTitle: z.string().optional(),
});
export type PlannedScene = z.infer<typeof PlannedScene>;

export const RenderPlan = z.object({
  jobId: z.string(),
  storyboard: Storyboard,
  fps: z.union([z.literal(30), z.literal(60)]),
  width: z.number().int(),
  height: z.number().int(),
  durationInFrames: z.number().int(),
  introFrames: z.number().int(),
  outroFrames: z.number().int(),
  scenes: z.array(PlannedScene),
  captions: z.array(Caption),
  /** Final mixed audio (voice + music + sfx), placed at frame 0. */
  audioSrc: z.string().optional(),
  /** Music stem used only for audio-reactive analysis (never played). */
  musicSrc: z.string().optional(),
  /** Where the voice track starts on the absolute timeline. Captions are already absolute. */
  voiceOffsetMs: z.number(),
  chapters: z.array(z.object({ atMs: z.number(), title: z.string() })),
  preview: z.boolean().default(false),
  seriesTitle: z.string().optional(),
  episode: z.number().int().optional(),
  /** Emit DOM boxes of every text layer for the collision QA. */
  qaProbe: z.boolean().default(false),
  /** Hide subtitles (e.g. for clean golden frames of templates). */
  burnCaptions: z.boolean().default(true),
});
export type RenderPlan = z.infer<typeof RenderPlan>;
