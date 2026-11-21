"""Independent ASR check with Whisper (faster-whisper). QA only — never used for subtitle text.

usage: asr_check.py --audio final.wav --out asr.json [--model large-v3-turbo]
Outputs {"text": ..., "words": [{"w","s","e"}]} in ms.
"""
import argparse, json, os, subprocess
import numpy as np
from faster_whisper import WhisperModel


def load_pcm16k(path: str) -> "np.ndarray":
    """Decode with ffmpeg (avoids PyAV API drift between faster-whisper/av versions)."""
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

ap = argparse.ArgumentParser()
ap.add_argument("--audio", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--model", default=os.environ.get("AMF_WHISPER_MODEL", "large-v3-turbo"))
a = ap.parse_args()
m = WhisperModel(a.model, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 2)
segs, info = m.transcribe(load_pcm16k(a.audio), language="fa", word_timestamps=True, vad_filter=True, beam_size=1)
words, text = [], []
for s in segs:
    text.append(s.text)
    for w in s.words or []:
        words.append({"w": w.word.strip(), "s": round(w.start * 1000), "e": round(w.end * 1000)})
json.dump({"model": a.model, "text": " ".join(t.strip() for t in text), "words": words}, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
