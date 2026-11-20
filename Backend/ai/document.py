"""Shared data structures for extracted documents."""
from dataclasses import dataclass, field
from typing import List, Optional


# Line classes predicted by the cleaner network.
LABELS = ["body", "heading", "page_number", "header_footer", "footnote", "noise"]
LABEL_TO_ID = {name: i for i, name in enumerate(LABELS)}
KEEP_LABELS = {"body", "heading"}


@dataclass
class Line:
    """A single line (PDF) or block element (EPUB) of extracted text.

    Coordinates are normalised to the page size (0..1). They are ``None`` when
    the source has no physical layout (EPUB / HTML).
    """

    text: str
    page: int = 0
    block: int = 0
    x0: Optional[float] = None
    y0: Optional[float] = None
    x1: Optional[float] = None
    y1: Optional[float] = None
    font_size: Optional[float] = None
    bold: bool = False
    tag: str = ""  # HTML tag for EPUB sources (p, h1, li, ...)
    label: Optional[str] = None  # ground truth (training) or prediction


@dataclass
class Document:
    pages: List[List[Line]] = field(default_factory=list)
    title: Optional[str] = None
    author: Optional[str] = None
    has_layout: bool = True

    @property
    def num_lines(self) -> int:
        return sum(len(p) for p in self.pages)
