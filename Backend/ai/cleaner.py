"""Neural text cleaner: classify lines with the DNN and rebuild readable text."""
import logging
import re
import threading
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from statistics import median
from typing import Dict, List, Optional, Tuple

import numpy as np

from .document import KEEP_LABELS, LABELS, Document, Line
from .features import _BOILERPLATE_RE, _DOT_LEADER_RE, _PAGE_NUM_RE, _ROMAN_RE, encode_document, normalise_for_repeat

log = logging.getLogger("bookshelf.cleaner")

DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "text_cleaner.pt"
WINDOW = 96


@dataclass
class Paragraph:
    kind: str  # "body" | "heading"
    text: str


@dataclass
class CleanResult:
    paragraphs: List[Paragraph]
    label_counts: Dict[str, int] = field(default_factory=dict)
    removed_examples: Dict[str, List[str]] = field(default_factory=dict)
    used_model: bool = False

    @property
    def text(self) -> str:
        return "\n\n".join(p.text for p in self.paragraphs)


class TextCleaner:
    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = Path(model_path or DEFAULT_MODEL_PATH)
        self.model = None
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if not self.model_path.exists():
            log.warning("Cleaner model not found at %s - falling back to heuristic rules. "
                        "Train it with: python -m ai.train", self.model_path)
            return
        try:
            import torch  # noqa: F401
            from .model import load_model
            self.model = load_model(self.model_path)
            log.info("Loaded text-cleaner DNN from %s", self.model_path)
        except Exception as exc:  # pragma: no cover
            log.error("Could not load cleaner model (%s); using heuristics", exc)
            self.model = None

    @property
    def available(self) -> bool:
        return self.model is not None

    # ------------------------------------------------------------------
    def classify(self, doc: Document) -> None:
        """Set ``line.label`` for every line in the document."""
        if self.model is None:
            heuristic_classify(doc)
            return
        import torch

        encoded = encode_document(doc)
        pages = [p for p in doc.pages if p]
        seqs: List[Tuple[np.ndarray, np.ndarray, List[Line]]] = []
        for (chars, feats), page in zip(encoded, pages):
            for s in range(0, len(page), WINDOW):
                seqs.append((chars[s:s + WINDOW], feats[s:s + WINDOW], page[s:s + WINDOW]))

        with self._lock, torch.no_grad():
            for i in range(0, len(seqs), 64):
                batch = seqs[i:i + 64]
                lengths = torch.tensor([len(b[2]) for b in batch])
                L = int(lengths.max())
                chars = torch.zeros(len(batch), L, batch[0][0].shape[1], dtype=torch.long)
                feats = torch.zeros(len(batch), L, batch[0][1].shape[1])
                for j, (c, f, _) in enumerate(batch):
                    chars[j, :len(c)] = torch.from_numpy(c)
                    feats[j, :len(f)] = torch.from_numpy(f)
                pred = self.model(chars, feats, lengths).argmax(-1)
                for j, (_, _, lines) in enumerate(batch):
                    for k, line in enumerate(lines):
                        line.label = LABELS[int(pred[j, k])]
        _refine_predictions(doc)

    def clean(self, doc: Document) -> CleanResult:
        self.classify(doc)
        counts = Counter(l.label for p in doc.pages for l in p)
        removed: Dict[str, List[str]] = {}
        for p in doc.pages:
            for l in p:
                if l.label not in KEEP_LABELS and len(removed.setdefault(l.label, [])) < 8:
                    removed[l.label].append(l.text)
        paragraphs = assemble_paragraphs(doc)
        return CleanResult(paragraphs=paragraphs, label_counts=dict(counts),
                           removed_examples=removed, used_model=self.available)


# ---------------------------------------------------------------------------
# Paragraph reconstruction
# ---------------------------------------------------------------------------

_TERMINAL = tuple('.!?:;"”’»…)')


def assemble_paragraphs(doc: Document) -> List[Paragraph]:
    gaps = [b.y0 - a.y1 for p in doc.pages for a, b in zip(p, p[1:])
            if a.y1 is not None and b.y0 is not None and b.y0 > a.y1]
    med_gap = median(gaps) if gaps else None
    lefts = [l.x0 for p in doc.pages for l in p if l.x0 is not None and l.label == "body"]
    base_left = median(lefts) if lefts else None

    paras: List[Paragraph] = []
    cur: List[str] = []
    cur_kind: Optional[str] = None
    prev: Optional[Line] = None

    def flush():
        nonlocal cur, cur_kind
        if cur:
            text = normalise_text(join_lines(cur))
            if text and re.search(r"\w", text):
                paras.append(Paragraph(kind=cur_kind or "body", text=text))
        cur, cur_kind = [], None

    for page in doc.pages:
        for line in page:
            if line.label not in KEEP_LABELS:
                continue
            kind = line.label
            new_para = False
            if cur_kind != kind or kind == "heading" and prev is not None and prev.block != line.block:
                new_para = True
            elif not doc.has_layout:
                new_para = True  # EPUB: every block element is its own paragraph
            elif prev is not None:
                same_page = prev.page == line.page
                ends_sentence = cur[-1].rstrip().endswith(_TERMINAL) if cur else True
                if same_page:
                    gap = (line.y0 - prev.y1) if (line.y0 is not None and prev.y1 is not None) else 0
                    big_gap = med_gap is not None and gap > max(med_gap * 2.2, 0.004)
                    indented = (base_left is not None and line.x0 is not None
                                and line.x0 - base_left > 0.02 and ends_sentence)
                    short_prev = (prev.x1 is not None and line.x1 is not None
                                  and prev.x1 < line.x1 - 0.08 and ends_sentence)
                    new_para = big_gap or indented or short_prev or (line.x0 is not None and line.x0 < prev.x0 - 0.15)
                else:
                    # Page break: continue the paragraph unless the sentence had ended
                    # and the new line looks like a paragraph start.
                    starts_upper = line.text[:1].isupper() or line.text[:1] in '"“‘«'
                    new_para = ends_sentence and starts_upper and (
                        base_left is None or line.x0 is None or line.x0 - base_left > 0.02)
            if new_para:
                flush()
                cur_kind = kind
            cur.append(line.text)
            prev = line
    flush()
    return paras


def join_lines(lines: List[str]) -> str:
    out = ""
    for ln in lines:
        ln = ln.strip()
        if not out:
            out = ln
        elif re.search(r"[A-Za-zÀ-ÿĞğİıŞşÇçÖöÜü]-$", out) and ln[:1].islower():
            out = out[:-1] + ln  # de-hyphenate "exam-" + "ple"
        elif out.endswith("\u00ad"):
            out = out[:-1] + ln
        else:
            out = out + " " + ln
    return out


_SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾"


def normalise_text(text: str) -> str:
    """Inline cleanup that makes the text pleasant for TTS."""
    text = re.sub(f"[{_SUPERSCRIPTS}]+", "", text)            # footnote markers ¹²
    text = unicodedata.normalize("NFKC", text)                # ligatures ﬁ → fi
    text = text.replace("\u00ad", "")
    text = re.sub(r"\[\s*\d+(?:\s*[,–\-]\s*\d+)*\s*\]", "", text)  # [12], [3, 4-6]
    text = re.sub(r"\[(?:citation needed|clarification needed|note \d+)\]", "", text, flags=re.I)
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    # footnote numbers glued to words / punctuation: "word.12 Next" -> "word. Next"
    text = re.sub(r"(?<=[a-zA-ZçğıöşüÇĞİÖŞÜ][.,;:!?\"”’)])\d{1,3}(?=\s|$)", "", text)
    text = re.sub(r"(?<=[a-zçğıöşü]{3})[*†‡]+(?=[\s.,;:]|$)", "", text)
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Rule-based fallback (used only when the network has not been trained yet)
# ---------------------------------------------------------------------------

_FOOTNOTE_START_RE = re.compile(
    r"^\s*(?:\[\d{1,3}\]|\d{1,3}[\.\)]|[*†‡§¶¹²³⁴⁵⁶⁷⁸⁹])\s+\S|(?:\bpp?\.\s*\d|\bibid\.|\bop\.\s*cit\.)",
    re.I,
)
_HEADING_TEXT_RE = re.compile(
    r"^\s*(?:chapter|bölüm|part|kısım|section|book|prologue|epilogue)\b",
    re.I,
)
_CAPTION_START_RE = re.compile(r"^\s*(?:figure|fig\.|table|şekil|plate|tablo)\s+\d", re.I)


def _refine_predictions(doc: Document) -> None:
    """Apply high-precision structural invariants on top of the DNN sequence predictions."""
    sizes = [l.font_size for p in doc.pages for l in p if l.font_size and len(l.text) > 20]
    body_size = median(sizes) if sizes else None

    for page in doc.pages:
        for i, line in enumerate(page):
            t = line.text.strip()
            if not t:
                line.label = "noise"
                continue
            tag = (line.tag or "").lower()

            # 1. Explicit HTML footnote container or obvious boilerplate / TOC dot leader
            if tag == "aside":
                line.label = "footnote"
                continue
            if _DOT_LEADER_RE.search(t) or _BOILERPLATE_RE.search(t):
                line.label = "noise"
                continue
            if (_PAGE_NUM_RE.match(t) or _ROMAN_RE.match(t)) and (
                not doc.has_layout or i == 0 or i == len(page) - 1 or (line.y0 is not None and (line.y0 < 0.12 or line.y0 > 0.88))
            ):
                line.label = "page_number"
                continue

            # 2. Clear chapter headings (large font or h1-h6 tag)
            if (re.fullmatch(r"h[1-6]", tag) or (body_size and line.font_size and line.font_size >= body_size * 1.25)) and len(t) < 90:
                if _HEADING_TEXT_RE.match(t) or line.label == "noise":
                    line.label = "heading"
                    continue

            # 3. Guard against false-positive drops of clean prose sentences
            if line.label in ("noise", "footnote"):
                is_small_bottom = (
                    body_size is not None
                    and line.font_size is not None
                    and line.font_size < body_size * 0.88
                    and (line.y0 is not None and line.y0 > 0.65)
                )
                letters = sum(c.isalpha() for c in t)
                looks_like_prose = (
                    len(t) >= 35
                    and letters / max(len(t), 1) >= 0.70
                    and t[0].isupper()
                    and t[-1] in ".!?\"”’)"
                    and not is_small_bottom
                    and not _FOOTNOTE_START_RE.search(t)
                    and not _CAPTION_START_RE.match(t)
                )
                if looks_like_prose:
                    line.label = "body"


def heuristic_classify(doc: Document) -> None:
    n_pages = len(doc.pages)
    rep = Counter()
    for p in doc.pages:
        rep.update({normalise_for_repeat(l.text) for l in p})
    sizes = [l.font_size for p in doc.pages for l in p if l.font_size and len(l.text) > 20]
    body = median(sizes) if sizes else None
    for p in doc.pages:
        for i, l in enumerate(p):
            t = l.text.strip()
            edge = i < 2 or i >= len(p) - 2
            if _PAGE_NUM_RE.match(t) or _ROMAN_RE.match(t):
                l.label = "page_number"
            elif edge and n_pages >= 4 and rep[normalise_for_repeat(t)] >= max(3, 0.3 * n_pages):
                l.label = "header_footer"
            elif _DOT_LEADER_RE.search(t):
                l.label = "noise"
            elif re.match(r"^h[1-6]$", l.tag or "") or (body and l.font_size and l.font_size > 1.25 * body and len(t) < 80):
                l.label = "heading"
            elif body and l.font_size and l.font_size < 0.85 * body and i >= len(p) * 0.6:
                l.label = "footnote"
            elif l.tag == "aside":
                l.label = "footnote"
            else:
                l.label = "body"


_cleaner: Optional[TextCleaner] = None
_cleaner_lock = threading.Lock()


def get_cleaner() -> TextCleaner:
    global _cleaner
    with _cleaner_lock:
        if _cleaner is None:
            _cleaner = TextCleaner()
        return _cleaner
