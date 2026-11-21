# Ali Motion Factory — کارخانه‌ی موشن علی

A free pipeline that turns a short Persian request into a YouTube-ready motion-graphics video
(EDUCATIONAL / PROMO / NEWS) with natural Persian voice-over, frame-accurate Persian subtitles,
separate on-screen typography and per-channel branded templates.

```
Telegram bot / web panel (Cloudflare Worker + D1 + R2)
   └─ workflow_dispatch → GitHub Actions (public repo, free runners)
        guard → script (Gemini + zod) → voice (Gemini TTS → edge-tts) → CTC align (wav2vec2)
        → assets (flux-1-schnell, no text) → mix (−14 LUFS) → Remotion render → QA gate → deliver (R2 / Drive)
```

| Folder | Purpose |
|---|---|
| `pipeline/` | CLI and stages (`src/stages/*`), Persian normalisation, caption pagination, QA |
| `engine/` | Remotion compositions (MotionVideo, FontProof, BrandProof, galleries) |
| `styles/` | 16 motion-style presets, easing, transitions |
| `templates/` | Per-channel templates and layout zones (16:9 and Shorts 9:16) |
| `brands/` | Brand themes, fonts (OFL), music ledger |
| `worker/` | Telegram bot (grammY), API, magic-link auth, web panel (Remotion Player) |
| `scripts/` | CI helpers: fonts, callbacks, flux assets, Drive upload |
| `docs/` | Persian docs: SETUP, USAGE, COSTS, TYPOGRAPHY, TEMPLATES, STYLES |

Hard rules enforced in code: never targets `youtube.com/@Alibaghbani1hand`; One Hand One Dream is left-hand only;
NEWS needs owner fact-check approval; nothing is final without Approve.

Start with [docs/SETUP.md](docs/SETUP.md).

Fonts are SIL OFL (see `brands/_fonts/LICENSES.md`). Remotion is used under its [license](https://www.remotion.dev/license).
