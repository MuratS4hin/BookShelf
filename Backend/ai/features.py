"""Feature extraction shared by training and inference.

Every line is turned into
  * a sequence of character ids (fed to the character CNN), and
  * a vector of numeric layout / statistics features.
"""
import math
import re
from collections import Counter
from statistics import median
from typing import List, Tuple

import numpy as np

from .document import Document, Line

MAX_CHARS = 128
CHAR_VOCAB = 258  # 0 = padding, 1..256 = byte-ish code points, 257 = other


_ROMAN_RE = re.compile(r"^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$", re.I)
_PAGE_NUM_RE = re.compile(
    r"^\s*(?:[-–—|•·\[\(]\s*)?(?:page|pg\.?|p\.|sayfa|s\.)?\s*(\d{1,4}|[ivxlcdm]{1,7})"
    r"(?:\s*(?:of|/|von|de)\s*\d{1,4})?\s*(?:[-–—|•·\]\)]\s*)?$",
    re.I,
)
_DOT_LEADER_RE = re.compile(r"(\.\s?){4,}|…{2,}|(_\s?){4,}|\s{3,}\d{1,4}\s*$")
_BOILERPLATE_RE = re.compile(
    r"(https?://|www\.|\.com\b|\.org\b|isbn|©|\(c\)|copyright|all rights reserved|doi:|"
    r"printed in|telif|tüm hakları)",
    re.I,
)
_SENT_END = set('.!?:;"\'”’»)')


def char_ids(text: str) -> List[int]:
    ids = []
    for ch in text[:MAX_CHARS]:
        o = ord(ch)
        ids.append(o + 1 if o < 256 else 257)
    return ids


def normalise_for_repeat(text: str) -> str:
    """Normalise a line so that running headers with changing page numbers match."""
    t = re.sub(r"\d+", "#", text.lower())
    t = re.sub(r"\b[ivxlcdm]{1,7}\b", "#", t)
    return re.sub(r"\s+", " ", t).strip()


def _doc_stats(doc: Document):
    sizes = [l.font_size for p in doc.pages for l in p if l.font_size and len(l.text) > 20]
    body_size = median(sizes) if sizes else None

    # How many pages does each normalised line appear on?
    counter: Counter = Counter()
    for page in doc.pages:
        seen = {normalise_for_repeat(l.text) for l in page if l.text.strip()}
        counter.update(seen)

    gaps = []
    for page in doc.pages:
        for a, b in zip(page, page[1:]):
            if a.y1 is not None and b.y0 is not None and b.y0 >= a.y1:
                gaps.append(b.y0 - a.y1)
    med_gap = median(gaps) if gaps else 0.01
    return body_size, counter, max(med_gap, 1e-3)


NUM_FEATURES = 26


def line_features(doc: Document) -> List[List[np.ndarray]]:
    """Return ``[page][line] -> feature vector`` for a whole document."""
    body_size, repeat_counter, med_gap = _doc_stats(doc)
    n_pages = max(len(doc.pages), 1)
    out: List[List[np.ndarray]] = []

    for p_idx, page in enumerate(doc.pages):
        n = len(page)
        page_feats = []
        for i, line in enumerate(page):
            t = line.text.strip()
            length = max(len(t), 1)
            letters = [c for c in t if c.isalpha()]
            n_letters = max(len(letters), 1)
            has_layout = line.y0 is not None
            words = t.split()

            f = np.zeros(NUM_FEATURES, dtype=np.float32)
            f[0] = 1.0 if has_layout else 0.0
            if has_layout:
                yc = (line.y0 + line.y1) / 2
                f[1] = yc
                f[2] = 1.0 if yc < 0.09 else 0.0
                f[3] = 1.0 if yc > 0.91 else 0.0
                xc = (line.x0 + line.x1) / 2
                f[4] = abs(xc - 0.5) * 2
                f[5] = line.x1 - line.x0
                f[6] = line.x0
                if i > 0 and page[i - 1].y1 is not None:
                    f[7] = min(max((line.y0 - page[i - 1].y1) / med_gap, -2.0), 10.0) / 5.0
                else:
                    f[7] = 1.0
                if i < n - 1 and page[i + 1].y0 is not None:
                    f[8] = min(max((page[i + 1].y0 - line.y1) / med_gap, -2.0), 10.0) / 5.0
                else:
                    f[8] = 1.0
            else:
                f[1] = 0.5
                f[4] = 0.0
                f[5] = 0.8
            if line.font_size and body_size:
                f[9] = float(np.clip(line.font_size / body_size - 1.0, -1.0, 2.0))
            f[10] = 1.0 if line.bold else 0.0
            f[11] = i / max(n - 1, 1)
            f[12] = 1.0 if i == 0 else 0.0
            f[13] = 1.0 if i == n - 1 else 0.0
            f[14] = math.log1p(length) / 6.0
            f[15] = min(len(words), 40) / 40.0
            f[16] = sum(c.isdigit() for c in t) / length
            f[17] = len(letters) / length
            f[18] = sum(c.isupper() for c in letters) / n_letters
            f[19] = 1.0 if t and t[-1] in _SENT_END else 0.0
            f[20] = 1.0 if t and t[0].islower() else 0.0
            reps = repeat_counter.get(normalise_for_repeat(t), 1)
            f[21] = min(reps / n_pages, 1.0) if n_pages >= 3 and reps >= 2 else 0.0
            f[22] = 1.0 if (_PAGE_NUM_RE.match(t) or _ROMAN_RE.match(t)) else 0.0
            f[23] = 1.0 if _DOT_LEADER_RE.search(t) else 0.0
            f[24] = 1.0 if _BOILERPLATE_RE.search(t) else 0.0
            tag = line.tag.lower()
            f[25] = 1.0 if re.fullmatch(r"h[1-6]", tag) else (0.5 if tag in ("li", "td", "th", "figcaption", "aside") else 0.0)
            page_feats.append(f)
        out.append(page_feats)
    # Mild document-position signal is folded into the "first pages" behaviour
    # through repetition + boilerplate features; no explicit page index needed.
    return out


def encode_document(doc: Document) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Encode a document into per-page (chars[L, C], feats[L, F]) arrays."""
    feats = line_features(doc)
    pages = []
    for page, page_feats in zip(doc.pages, feats):
        if not page:
            continue
        chars = np.zeros((len(page), MAX_CHARS), dtype=np.int64)
        for i, line in enumerate(page):
            ids = char_ids(line.text.strip())
            chars[i, : len(ids)] = ids
        pages.append((chars, np.stack(page_feats)))
    return pages
