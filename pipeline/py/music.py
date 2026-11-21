"""Original procedural music + SFX generator (no samples, no third-party audio).

Every track is synthesised from scratch with numpy, so the rights are ours
("original-procedural", CC0 dedication). Deterministic for a given seed.

usage: music.py --mood piano-ambient --seconds 75 --out bed.wav [--seed 7] [--bpm 72]
       music.py --sfx whoosh --out whoosh.wav
moods: piano-ambient | electronic | cinematic | corporate
"""
import argparse, json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    sus = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sus, s), np.linspace(s, 0, max(r, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def reverb_ir(seconds=2.6, decay=3.2, seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-decay * t)[:, None]
    ir = lp(ir, 7000)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def add_reverb(x, wet=0.28, seconds=2.6, decay=3.2):
    ir = reverb_ir(seconds, decay)
    out = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return (1 - wet) * x + wet * out


def piano_note(m, dur, vel=0.7):
    """Additive piano-like tone: inharmonic partials, per-partial decay, hammer noise."""
    f0 = midi_hz(m)
    n = int((dur + 1.8) * SR)
    t = np.arange(n) / SR
    B = 0.0004
    y = np.zeros(n)
    for k in range(1, 12):
        fk = f0 * k * np.sqrt(1 + B * k * k)
        if fk > 16000:
            break
        amp = vel * (1 / k ** 1.25) * (1 + 0.3 * np.sin(k))
        dec = 1.1 + 0.55 * k + f0 / 400
        y += amp * np.sin(2 * np.pi * fk * t + k) * np.exp(-dec * t)
    y += 0.06 * vel * np.random.default_rng(m).standard_normal(n) * np.exp(-60 * t)  # hammer
    rel = np.ones(n)
    off = int(dur * SR)
    if off < n:
        rel[off:] = np.exp(-6 * (t[off:] - t[off]))
    y *= rel * np.minimum(1, t / 0.003)
    return y


def pad_chord(notes, dur, bright=1800):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros((n, 2))
    for i, m in enumerate(notes):
        for det, pan in ((-0.07, 0.25), (0.07, 0.75)):
            f = midi_hz(m + det)
            saw = 2 * ((f * t + i * 0.13) % 1) - 1
            y[:, 0] += saw * (1 - pan)
            y[:, 1] += saw * pan
    y = lp(y, bright, 2) * env_adsr(n, min(1.2, dur / 3), 0.5, 0.8, min(1.5, dur / 3))[:, None]
    return y / (len(notes) * 2)


def place(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    x = x if x.ndim == 2 else np.stack([x, x], axis=1)
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i]


def kick(vel=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-28 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return vel * np.sin(ph) * np.exp(-7 * t) + vel * 0.15 * np.random.default_rng(3).standard_normal(n) * np.exp(-200 * t)


def hat(vel=0.3, open_=False):
    n = int((0.25 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    x = hp(np.random.default_rng(int(vel * 100)).standard_normal(n), 7000)
    return vel * x * np.exp(-(12 if open_ else 70) * t)


def clap(vel=0.5):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    x = bp(np.random.default_rng(5).standard_normal(n), 900, 4000)
    e = np.exp(-18 * t) * (1 + 0.8 * np.sin(2 * np.pi * 90 * t).clip(0))
    return vel * x * e


def bass(m, dur, vel=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    y = 0.7 * np.sin(2 * np.pi * f * t) + 0.3 * np.tanh(3 * np.sin(2 * np.pi * f * t))
    return vel * lp(y, 900) * env_adsr(n, 0.005, 0.1, 0.7, 0.06)


def pluck(m, dur, vel=0.4):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    y = (2 * ((f * t) % 1) - 1) * np.exp(-5 * t)
    return vel * lp(y, 2600) * np.minimum(1, t / 0.002)


# --- progressions (MIDI root-position voicings) ---
PROG = {
    "piano-ambient": [[48, 55, 60, 64, 71], [45, 52, 57, 60, 67], [41, 48, 53, 57, 64], [43, 50, 55, 59, 62]],  # Cmaj7 Am7 Fmaj7 G
    "electronic": [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]],  # Am F C G
    "cinematic": [[38, 50, 57, 62], [34, 46, 53, 58], [41, 53, 57, 60], [36, 48, 55, 60]],  # Dm Bb F C
    "corporate": [[48, 60, 64, 67], [43, 55, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60]],  # C G Am F
}


def gen(mood, seconds, seed, bpm=None):
    rng = np.random.default_rng(seed)
    bpm = bpm or {"piano-ambient": 72, "electronic": 120, "cinematic": 80, "corporate": 104}[mood]
    beat = 60 / bpm
    bar = 4 * beat
    n = int((seconds + 3) * SR)
    mus = np.zeros((n, 2))
    drums = np.zeros((n, 2))
    prog = PROG[mood]
    bars = int(np.ceil(seconds / bar))
    for b in range(bars):
        ch = prog[b % len(prog)]
        t0 = b * bar
        section = (b // 4) % 2  # A / B variation every 4 bars
        if mood == "piano-ambient":
            place(mus, pad_chord([m + 12 for m in ch[1:4]], bar + 0.6, 1200) * 0.35, t0)
            arp = ch[1:] + [ch[2] + 12]
            for i in range(8):
                m = arp[(i * (3 if section else 2)) % len(arp)] + 12
                v = 0.32 + 0.12 * rng.random() - (0.06 if i % 2 else 0)
                tt = t0 + i * beat / 2 + rng.normal(0, 0.006)
                x = piano_note(m, beat * 0.9, v)
                pan = 0.5 + 0.25 * np.sin(m)
                place(mus, np.stack([x * (1 - pan) * 1.4, x * pan * 1.4], axis=1), max(0, tt))
            place(mus, piano_note(ch[0], bar, 0.45) * 0.8, t0)
        elif mood == "electronic":
            place(mus, pad_chord([m + 12 for m in ch[1:]], bar, 2400 if section else 1400) * 0.45, t0)
            for i in range(8):
                place(mus, bass(ch[0] - 12 + (12 if i % 4 == 3 else 0), beat / 2 * 0.9, 0.55), t0 + i * beat / 2)
            for i in range(16):
                m = ch[1 + (i * 2) % (len(ch) - 1)] + 24
                place(mus, pluck(m, beat / 4, 0.18 + 0.06 * (i % 4 == 0)), t0 + i * beat / 4)
            for i in range(4):
                place(drums, kick(0.9), t0 + i * beat)
                if i % 2:
                    place(drums, clap(0.45), t0 + i * beat)
            for i in range(8):
                place(drums, hat(0.16 if i % 2 == 0 else 0.26, open_=(i % 2 == 1 and section == 1)), t0 + i * beat / 2)
        elif mood == "cinematic":
            place(mus, pad_chord(ch, bar + 1.0, 900 + 600 * section) * 0.8, t0)
            place(mus, pad_chord([ch[0] - 12], bar + 1.0, 400) * 0.9, t0)
            if b % 2 == 0:
                k = kick(0.7)
                place(drums, lp(k, 300) * 1.3, t0)
                place(drums, lp(kick(0.45), 300), t0 + 2.5 * beat)
            for i in range(4):
                place(mus, piano_note(ch[1 + i % (len(ch) - 1)] + 24, beat, 0.18), t0 + i * beat)
        else:  # corporate
            place(mus, pad_chord([m + 12 for m in ch[1:]], bar, 1600) * 0.25, t0)
            for i in range(8):
                m = ch[1 + (i * (2 if section else 1)) % (len(ch) - 1)] + 12
                place(mus, pluck(m, beat / 2, 0.3), t0 + i * beat / 2)
            for i in range(4):
                place(drums, kick(0.55), t0 + i * beat)
                place(drums, hat(0.12), t0 + i * beat + beat / 2)
                if i % 2:
                    place(drums, clap(0.25), t0 + i * beat)
            place(mus, bass(ch[0] - 12, bar * 0.95, 0.4), t0)
    mus = add_reverb(mus, wet={"piano-ambient": 0.38, "cinematic": 0.42}.get(mood, 0.2), seconds=3.2 if mood in ("piano-ambient", "cinematic") else 1.6)
    drums = add_reverb(drums, wet=0.08, seconds=0.8, decay=8)
    y = mus + drums
    y = y[: int(seconds * SR)]
    # gentle fades
    fi, fo = int(1.5 * SR), int(3.0 * SR)
    y[:fi] *= np.linspace(0, 1, fi)[:, None]
    y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    y = np.tanh(1.2 * y / (np.abs(y).max() + 1e-9)) / np.tanh(1.2)
    return (0.89 * y).astype(np.float32), bpm


def sfx(kind):
    rng = np.random.default_rng(11)
    if kind == "whoosh":
        d = 0.9
        n = int(d * SR)
        t = np.arange(n) / SR
        x = rng.standard_normal((n, 2))
        out = np.zeros_like(x)
        # sweeping band-pass in blocks
        blk = 1024
        for i in range(0, n, blk):
            p = i / n
            fc = 300 + 5000 * np.sin(np.pi * p) ** 2
            out[i : i + blk] = bp(x[i : i + blk], max(80, fc * 0.6), min(20000, fc * 1.6), 1)
        e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
        pan = np.stack([1 - 0.6 * t / d, 0.4 + 0.6 * t / d], axis=1)
        y = out * e[:, None] * pan
    elif kind == "impact":
        d = 2.5
        n = int(d * SR)
        t = np.arange(n) / SR
        k = np.sin(2 * np.pi * np.cumsum(38 + 80 * np.exp(-12 * t)) / SR) * np.exp(-2.2 * t)
        nz = lp(rng.standard_normal(n), 2500) * np.exp(-6 * t) * 0.4
        y = np.stack([k + nz, k + nz], axis=1)
        y = add_reverb(y, 0.35, 2.5, 2.5)
    elif kind == "riser":
        d = 2.0
        n = int(d * SR)
        t = np.arange(n) / SR
        f = 200 * 2 ** (3 * t / d)
        tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3
        nz = hp(rng.standard_normal(n), 2000) * 0.25
        e = (t / d) ** 2
        y = np.stack([tone + nz, tone + nz], axis=1) * e[:, None]
    elif kind == "chime":
        y = np.zeros((int(2.5 * SR), 2))
        for i, m in enumerate([84, 88, 91, 96]):
            place(y, piano_note(m, 0.4, 0.35), i * 0.07)
        y = add_reverb(y, 0.4, 2.0, 3)
    else:
        raise SystemExit(f"unknown sfx {kind}")
    y = y / (np.abs(y).max() + 1e-9) * 0.7
    return y.astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mood")
    ap.add_argument("--sfx")
    ap.add_argument("--seconds", type=float, default=60)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--bpm", type=float)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.sfx:
        sf.write(a.out, sfx(a.sfx), SR, subtype="PCM_24")
        print(json.dumps({"file": a.out, "kind": a.sfx}))
        return
    y, bpm = gen(a.mood, a.seconds, a.seed, a.bpm)
    sf.write(a.out, y, SR, subtype="PCM_24")
    print(json.dumps({"file": a.out, "mood": a.mood, "bpm": bpm, "seconds": a.seconds, "seed": a.seed,
                      "rights": "original-procedural (generated by ALI MOTION FACTORY, CC0)", "license": "CC0-1.0"}))


if __name__ == "__main__":
    main()
