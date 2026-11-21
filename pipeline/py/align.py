"""CTC forced alignment of the exact script words to the voice audio (Persian wav2vec2).

Input JSON (stdin or --in):  {"audio": "scene.wav", "words": ["spoken", "form", ...]}
  or a batch: {"items": [{"id": "s1", "audio": "...", "words": [...]}, ...]}
Output JSON: {"items": [{"id", "words": [{"i", "startMs", "endMs", "score"}], "durationMs"}]}

Words must be the *spoken form* (digits expanded, Latin brand names transliterated).
Whisper is never used for text; this only measures timing.
"""
import argparse, json, sys, os
import numpy as np
import soundfile as sf
import torch, torchaudio
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

MODEL = os.environ.get("AMF_ALIGN_MODEL", "m3hrdadfi/wav2vec2-large-xlsr-persian-v3")
MAP = {"ي": "ی", "ك": "ک", "ى": "ی", "ؤ": "و", "أ": "ا", "إ": "ا", "ة": "ه", "ۀ": "ه", "ٱ": "ا"}
torch.set_num_threads(max(1, os.cpu_count() or 1))


def load_audio(path):
    wav, sr = sf.read(path, dtype="float32", always_2d=True)
    wav = wav.mean(axis=1)
    if sr != 16000:
        wav = torchaudio.functional.resample(torch.from_numpy(wav), sr, 16000).numpy()
    return wav


def clean_word(w, vocab):
    w = "".join(MAP.get(c, c) for c in w)
    out = "".join(c for c in w if c in vocab and c not in ("|", "<pad>"))
    return out.strip("\u200c")


def align_one(model, proc, vocab, audio_path, words):
    wav = load_audio(audio_path)
    dur_ms = len(wav) / 16.0
    inputs = proc(wav, sampling_rate=16000, return_tensors="pt")
    with torch.inference_mode():
        logits = model(inputs.input_values).logits  # (1, T, V)
    emission = torch.log_softmax(logits, dim=-1)
    T = emission.shape[1]
    frame_ms = dur_ms / T
    cleaned = [clean_word(w, vocab) for w in words]
    keep = [i for i, c in enumerate(cleaned) if c]
    tokens, lens = [], []
    for i in keep:
        ids = [vocab[c] for c in cleaned[i]]
        tokens.extend(ids)
        lens.append(len(ids))
    if not tokens:
        return {"words": [], "durationMs": dur_ms}
    targets = torch.tensor([tokens], dtype=torch.int32)
    blank = vocab.get("<pad>", 0)
    ali, scores = torchaudio.functional.forced_align(emission, targets, blank=blank)
    ali, scores = ali[0], scores[0].exp()
    spans = torchaudio.functional.merge_tokens(ali, scores, blank=blank)
    # group token spans into words
    res, k = [], 0
    for wi, n in zip(keep, lens):
        sp = spans[k : k + n]
        k += n
        start = sp[0].start * frame_ms
        end = sp[-1].end * frame_ms
        score = float(np.mean([s.score for s in sp]))
        res.append({"i": wi, "startMs": round(start, 1), "endMs": round(end, 1), "score": round(score, 3)})
    return {"words": res, "durationMs": round(dur_ms, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp")
    ap.add_argument("--out")
    a = ap.parse_args()
    data = json.load(open(a.inp, encoding="utf-8")) if a.inp else json.load(sys.stdin)
    items = data.get("items") or [{"id": "0", **data}]
    proc = Wav2Vec2Processor.from_pretrained(MODEL)
    model = Wav2Vec2ForCTC.from_pretrained(MODEL).eval()
    vocab = proc.tokenizer.get_vocab()
    out = {"model": MODEL, "items": []}
    for it in items:
        r = align_one(model, proc, vocab, it["audio"], it["words"])
        out["items"].append({"id": it.get("id"), **r})
    s = json.dumps(out, ensure_ascii=False)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(s)
    else:
        print(s)


if __name__ == "__main__":
    main()
