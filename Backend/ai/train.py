"""Train the text-cleaning network on synthetic book pages.

Usage (from the Backend folder):
    venv/bin/python -m ai.train --docs 1200 --epochs 6

The trained weights are written to ``Backend/models/text_cleaner.pt`` and are
picked up automatically by the API server.
"""
import argparse
import random
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from .document import LABELS, LABEL_TO_ID
from .features import encode_document
from .model import LineClassifier, load_model, save_model
from .synth_data import TextSource, download_corpus, load_paragraphs, make_document

DEFAULT_OUT = Path(__file__).resolve().parent.parent / "models" / "text_cleaner.pt"
MAX_SEQ = 96  # lines per training sequence


def get_best_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def build_dataset(n_docs: int, seed: int, books):
    rng = random.Random(seed)
    src = TextSource(books, rng)
    samples = []
    for _ in range(n_docs):
        doc = make_document(rng, src)
        encoded = encode_document(doc)
        pages = [p for p in doc.pages if p]
        for (chars, feats), page in zip(encoded, pages):
            labels = np.array([LABEL_TO_ID[l.label] for l in page], dtype=np.int64)
            for s in range(0, len(page), MAX_SEQ):
                samples.append((chars[s:s + MAX_SEQ], feats[s:s + MAX_SEQ], labels[s:s + MAX_SEQ]))
    return samples


def collate(batch, device: torch.device):
    lengths = torch.tensor([len(b[2]) for b in batch], dtype=torch.long)
    L = int(lengths.max())
    C = batch[0][0].shape[1]
    F = batch[0][1].shape[1]
    chars = torch.zeros(len(batch), L, C, dtype=torch.long)
    feats = torch.zeros(len(batch), L, F)
    labels = torch.full((len(batch), L), -100, dtype=torch.long)
    for i, (c, f, y) in enumerate(batch):
        n = len(y)
        chars[i, :n] = torch.from_numpy(c)
        feats[i, :n] = torch.from_numpy(f)
        labels[i, :n] = torch.from_numpy(y)
    return chars.to(device), feats.to(device), labels.to(device), lengths


def evaluate(model, data, device: torch.device, batch_size=64):
    model.eval()
    n = len(LABELS)
    conf = np.zeros((n, n), dtype=np.int64)
    with torch.no_grad():
        for i in range(0, len(data), batch_size):
            chars, feats, labels, lengths = collate(data[i:i + batch_size], device)
            pred = model(chars, feats, lengths).argmax(-1)
            m = labels != -100
            for t, p in zip(labels[m].cpu().tolist(), pred[m].cpu().tolist()):
                conf[t, p] += 1
    metrics = {}
    for k, name in enumerate(LABELS):
        tp = conf[k, k]
        prec = tp / max(conf[:, k].sum(), 1)
        rec = tp / max(conf[k, :].sum(), 1)
        f1 = 2 * prec * rec / max(prec + rec, 1e-9)
        metrics[name] = {"precision": round(float(prec), 4), "recall": round(float(rec), 4),
                         "f1": round(float(f1), 4), "support": int(conf[k, :].sum())}
    metrics["accuracy"] = round(float(np.trace(conf) / max(conf.sum(), 1)), 4)
    metrics["macro_f1"] = round(float(np.mean([metrics[l]["f1"] for l in LABELS])), 4)
    keep = [LABEL_TO_ID["body"], LABEL_TO_ID["heading"]]
    tk = conf[np.ix_(keep, keep)].sum()
    td = np.delete(np.delete(conf, keep, 0), keep, 1).sum()
    metrics["keep_drop_accuracy"] = round(float((tk + td) / max(conf.sum(), 1)), 4)
    return metrics, conf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", type=int, default=800)
    ap.add_argument("--val-docs", type=int, default=150)
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-3)
    ap.add_argument("--seed", type=int, default=13)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--no-download", action="store_true")
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    random.seed(args.seed)
    device = get_best_device()
    print(f"Using training device: {device}")

    if not args.no_download:
        download_corpus()
    books = load_paragraphs()
    print(f"Corpus: {len(books)} books, {sum(len(b) for b in books)} paragraphs")

    t0 = time.time()
    train = build_dataset(args.docs, args.seed, books)
    val = build_dataset(args.val_docs, args.seed + 1000, books)
    print(f"Generated {len(train)} train / {len(val)} val sequences in {time.time() - t0:.1f}s")

    counts = np.bincount(np.concatenate([s[2] for s in train]), minlength=len(LABELS)).astype(np.float64)
    print("Label counts:", dict(zip(LABELS, counts.astype(int).tolist())))
    weights = torch.tensor((counts.sum() / np.maximum(counts, 1)) ** 0.5, dtype=torch.float32, device=device)
    weights = weights / weights.mean()

    model = LineClassifier().to(device)
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    steps = args.epochs * ((len(train) + args.batch - 1) // args.batch)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.1)
    loss_fn = nn.CrossEntropyLoss(weight=weights, ignore_index=-100)

    best = -1.0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    for epoch in range(1, args.epochs + 1):
        model.train()
        random.shuffle(train)
        total, t0 = 0.0, time.time()
        for i in range(0, len(train), args.batch):
            chars, feats, labels, lengths = collate(train[i:i + args.batch], device)
            logits = model(chars, feats, lengths)
            loss = loss_fn(logits.reshape(-1, logits.size(-1)), labels.reshape(-1))
            opt.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            total += loss.item() * len(lengths)
        metrics, _ = evaluate(model, val, device)
        print(f"epoch {epoch}: loss={total / len(train):.4f} val_acc={metrics['accuracy']:.4f} "
              f"macro_f1={metrics['macro_f1']:.4f} keep/drop={metrics['keep_drop_accuracy']:.4f} "
              f"({time.time() - t0:.1f}s)")
        if metrics["macro_f1"] > best:
            best = metrics["macro_f1"]
            save_model(model, args.out, metrics)

    print(f"\nBest model saved to {args.out}")
    best_model = load_model(args.out, device=device)
    metrics, conf = evaluate(best_model, val, device)
    print("Per-class validation metrics:")
    for name in LABELS:
        m = metrics[name]
        print(f"  {name:14s} P={m['precision']:.3f} R={m['recall']:.3f} F1={m['f1']:.3f} (n={m['support']})")
    print("Confusion matrix (rows = truth):")
    print("               " + " ".join(f"{l[:6]:>7s}" for l in LABELS))
    for name, row in zip(LABELS, conf):
        print(f"  {name:12s} " + " ".join(f"{v:7d}" for v in row))


if __name__ == "__main__":
    main()
