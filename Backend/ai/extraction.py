"""Book text extraction with layout information (PDF via PyMuPDF, EPUB via ebooklib)."""
import re
from pathlib import Path
from typing import Optional, Tuple

from .document import Document, Line

_BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre",
               "figcaption", "caption", "td", "th", "dt", "dd", "aside", "section", "article",
               "header", "footer", "table", "ul", "ol", "dl", "figure", "nav", "body"}
_SUPERSCRIPT_FLAG = 1
_BOLD_FLAG = 16


class ExtractionError(Exception):
    pass


def extract_document(path: str) -> Document:
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        return extract_pdf(path)
    if suffix == ".epub":
        return extract_epub(path)
    raise ExtractionError(f"Unsupported file type: {suffix}")


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

def extract_pdf(path: str) -> Document:
    import pymupdf as fitz  # PyMuPDF

    try:
        pdf = fitz.open(path)
    except Exception as exc:
        raise ExtractionError(f"Could not open PDF: {exc}") from exc

    doc = Document(has_layout=True)
    meta = pdf.metadata or {}
    doc.title = (meta.get("title") or "").strip() or None
    doc.author = (meta.get("author") or "").strip() or None

    block_id = 0
    for p_idx, page in enumerate(pdf):
        w, h = page.rect.width or 1.0, page.rect.height or 1.0
        lines = []
        data = page.get_text("dict", sort=True)
        for block in data.get("blocks", []):
            if block.get("type") != 0:
                continue
            block_id += 1
            for ln in block.get("lines", []):
                spans = ln.get("spans", [])
                if not spans:
                    continue
                sizes = [s["size"] for s in spans if s["text"].strip()]
                main_size = max(sizes) if sizes else spans[0]["size"]
                parts = []
                for s in spans:
                    txt = s["text"]
                    # Drop footnote reference markers: tiny superscript digits / symbols.
                    if (s["flags"] & _SUPERSCRIPT_FLAG or s["size"] < 0.75 * main_size) and \
                            re.fullmatch(r"\s*[\d*†‡§¶,\-–]{1,6}\s*", txt) and len(spans) > 1:
                        continue
                    parts.append(txt)
                text = re.sub(r"\s+", " ", "".join(parts)).strip()
                if not text:
                    continue
                x0, y0, x1, y1 = ln["bbox"]
                bold = any(s["flags"] & _BOLD_FLAG or "bold" in s.get("font", "").lower()
                           for s in spans if s["text"].strip())
                lines.append(Line(text=text, page=p_idx, block=block_id,
                                  x0=x0 / w, y0=y0 / h, x1=x1 / w, y1=y1 / h,
                                  font_size=main_size, bold=bold))
        doc.pages.append(lines)

    if doc.num_lines == 0:
        raise ExtractionError(
            "This PDF has no extractable text layer (it is probably a scanned image). "
            "Run OCR on it first (e.g. `ocrmypdf input.pdf output.pdf`) and upload again."
        )
    return doc


def render_pdf_cover(path: str, out_path: str, width: int = 400) -> bool:
    try:
        import pymupdf as fitz
        pdf = fitz.open(path)
        page = pdf[0]
        zoom = width / max(page.rect.width, 1)
        page.get_pixmap(matrix=fitz.Matrix(zoom, zoom)).save(out_path)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# EPUB
# ---------------------------------------------------------------------------

def _epub_meta(book, field) -> Optional[str]:
    try:
        vals = book.get_metadata("DC", field)
        return vals[0][0].strip() if vals else None
    except Exception:
        return None


def extract_epub(path: str) -> Document:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    try:
        book = epub.read_epub(path, options={"ignore_ncx": True})
    except TypeError:
        book = epub.read_epub(path)
    except Exception as exc:
        raise ExtractionError(f"Could not open EPUB: {exc}") from exc

    doc = Document(has_layout=False, title=_epub_meta(book, "title"), author=_epub_meta(book, "creator"))

    # Read chapters in *reading order* (the spine), not manifest order.
    items = []
    for idref, _linear in book.spine:
        item = book.get_item_with_id(idref)
        if item is not None and item.get_type() == ebooklib.ITEM_DOCUMENT:
            items.append(item)
    if not items:
        items = [i for i in book.get_items() if i.get_type() == ebooklib.ITEM_DOCUMENT]

    block_id = 0
    for item in items:
        if "nav" in (getattr(item, "properties", None) or []):
            continue
        item_name = (item.get_name() or "").lower()
        if Path(item_name).stem in ("nav", "toc", "contents"):
            continue
        soup = BeautifulSoup(item.get_content(), "lxml")
        for bad in soup(["script", "style", "head", "svg", "math", "nav"]):
            bad.decompose()
        # Footnote reference markers inside the text (<sup>1</sup>, noteref links).
        for sup in soup.find_all(["sup"]):
            if re.fullmatch(r"\s*[\[\(]?[\d*†‡§a-z]{1,4}[\]\)]?\s*", sup.get_text()):
                sup.decompose()
        for a in soup.find_all("a"):
            et = (a.get("epub:type") or a.get("role") or "")
            if "noteref" in et and len(a.get_text(strip=True)) <= 4:
                a.decompose()
        for br in soup.find_all("br"):
            br.replace_with(" ")

        body = soup.body or soup
        lines = []
        for el in body.find_all(True):
            if el.name not in _BLOCK_TAGS:
                continue
            # leaf blocks only (avoid duplicating nested text)
            if any(child.name in _BLOCK_TAGS for child in el.find_all(True)):
                # but keep text sitting directly inside a container
                direct = " ".join(t.strip() for t in el.find_all(string=True, recursive=False) if t.strip())
                if len(direct) > 1:
                    block_id += 1
                    lines.append(Line(text=re.sub(r"\s+", " ", direct), page=len(doc.pages),
                                      block=block_id, tag=el.name))
                continue
            text = re.sub(r"\s+", " ", el.get_text(" ")).strip()
            if not text:
                continue
            tag = el.name
            et = " ".join(filter(None, [el.get("epub:type", ""), " ".join(el.get("class", []) or [])])).lower()
            if any(k in et for k in ("footnote", "endnote", "rearnote")):
                tag = "aside"
            block_id += 1
            lines.append(Line(text=text, page=len(doc.pages), block=block_id, tag=tag))
        if lines:
            doc.pages.append(lines)

    if doc.num_lines == 0:
        raise ExtractionError("No readable text found in this EPUB.")
    return doc


def extract_epub_cover(path: str, out_path: str) -> bool:
    try:
        import ebooklib
        from ebooklib import epub
        book = epub.read_epub(path)
        cover = None
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_COVER:
                cover = item
                break
        if cover is None:
            for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                if "cover" in item.get_name().lower() or "cover" in (item.get_id() or "").lower():
                    cover = item
                    break
        if cover is None:
            return False
        Path(out_path).write_bytes(cover.get_content())
        return True
    except Exception:
        return False


def extract_cover(path: str, out_path: str) -> bool:
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        return render_pdf_cover(path, out_path)
    if suffix == ".epub":
        return extract_epub_cover(path, out_path)
    return False
