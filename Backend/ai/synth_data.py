"""Synthetic training data for the text-cleaning network.

Clean prose (public-domain books from Project Gutenberg) is laid out into
simulated book pages exactly the way a PDF/EPUB extractor would see them, and
realistic "junk" is injected with ground-truth labels:

  * page numbers (plain, "- 12 -", "Page 12 of 300", roman numerals ...)
  * running headers / footers (book title, chapter title, author, watermarks)
  * footnotes (small font at the bottom of the page)
  * tables of contents, copyright pages, figure captions, references, indexes
  * chapter / section headings (kept, they are read aloud)

Because we know the label of every generated line, the network can be trained
without any manual annotation.
"""
import random
import re
import urllib.request
from pathlib import Path
from typing import List, Optional

from .document import Document, Line

DATA_DIR = Path(__file__).parent / "data"
CORPUS_DIR = DATA_DIR / "corpus"

# Mix of fiction and non-fiction, all public domain.
GUTENBERG_IDS = [1342, 84, 11, 2701, 1661, 98, 345, 174, 1232, 2009, 3300, 4363,
                 5200, 76, 1400, 43, 1497, 3207, 10615, 25344]

FALLBACK_PARAGRAPHS = [
    "It was a bright cold day in April, and the clocks were striking the hour when the travellers "
    "finally reached the old stone bridge that marked the edge of the valley.",
    "The committee met on 14 March 1887 to discuss the proposal, which had been circulated to all "
    "47 members a week earlier; most of them, however, had not read it.",
    "Science advances not by the accumulation of facts alone but by the patient labour of those who "
    "arrange them, compare them, and draw from them the general laws they conceal.",
    "She walked slowly along the shore, thinking of nothing in particular, while the gulls wheeled "
    "above her and the tide crept in over the flat grey sand.",
    "By the autumn of 1923 the workshop on the northern bank employed more than 320 artisans, each "
    "responsible for a distinct stage in the assembly of precision instruments.",
    "When the messenger arrived at midnight, nobody in the courtyard believed that the garrison had "
    "surrendered without firing a single shot across the river.",
    "In everyday conversation we rarely notice how much meaning is carried by rhythm and pause rather "
    "than by the dictionary definition of individual words.",
    "Between 1850 and 1914 the population of the port nearly quadrupled, rising from 18,400 inhabitants "
    "to just over 73,000 according to the municipal census.",
    "He opened the leather notebook at the third bookmark and read the entry aloud, careful not to "
    "omit the marginal remarks written in faded blue ink.",
    "Temperature measurements taken at depths of 50, 100, and 250 metres confirmed that the warm "
    "current persisted throughout the winter months.",
    "Although the treaty contained 16 separate articles, its practical effect depended almost entirely "
    "on the enforcement clause in the final paragraph.",
    "For three weeks the expedition followed the dry riverbed eastward, covering an average of 22 "
    "kilometres a day despite the heavy supply wagons.",
    "Nothing in the appearance of the house suggested that it had stood empty for forty years; the "
    "shutters were painted, the garden path was swept, and smoke rose from the chimney.",
    "Every neural network learns a mapping from structured inputs to representations that make the "
    "target decision easier to separate in the final layer.",
    "Sabahın erken saatlerinde limandan ayrılan gemi, rüzgarın kuzeyden esmesiyle birlikte üç saat "
    "içinde açık denize ulaştı ve kıyı gözden kayboldu.",
    "Arşivdeki belgeler incelendiğinde, 1936 yılında yapılan düzenlemenin yalnızca merkezdeki okulları "
    "değil, çevre köylerdeki eğitim kurumlarını da kapsadığı görülmektedir.",
    "The captain glanced at his watch—it was already twenty minutes past nine—and ordered the second "
    "company to advance along the ridge.",
    "Modern typography relies on subtle conventions of spacing, margins, and running headers to orient "
    "the reader without interrupting the flow of a sentence.",
    "At first the young physician suspected a simple fever, yet within forty-eight hours the patient "
    "showed every sign of complete recovery.",
    "Music heard at a distance across water has a peculiar clarity, as though the surface of the lake "
    "filtered out every harsh overtone.",
]


def _build_synthetic_books(seed: int = 42, n_books: int = 8, paras_per_book: int = 250) -> List[List[str]]:
    """Build a diverse multi-genre prose corpus offline so training never depends on external servers."""
    rng = random.Random(seed)
    clauses_a = [
        "During the first months of the voyage", "Whenever the council assembled in the upper chamber",
        "According to the records preserved in the provincial archive", "Long before the railway reached the valley",
        "In the second chapter of his treatise on optics", "After three days of uninterrupted rain",
        "Observers who witnessed the experiment in 1894", "Despite the warnings issued by the harbour master",
        "As soon as the lanterns were lit along the avenue", "Throughout the seventeenth and eighteenth centuries",
        "When the laboratory published its preliminary findings", "On the morning of 12 October",
        "In contrast to the earlier theory proposed by his colleagues", "Beneath the surface of the calm lagoon",
        "Within less than fifteen minutes of the announcement", "From the balcony overlooking the market square",
    ]
    clauses_b = [
        "the investigators discovered that several crucial pages had been copied by a different hand",
        "every merchant in the district agreed to reduce the price of grain by twelve percent",
        "a faint signal was detected on the lower frequency band and recorded on the paper drum",
        "the water level rose by nearly four feet, flooding the cellars along the quay",
        "she realised that the letter had been posted from Vienna almost two weeks earlier",
        "the temperature inside the furnace remained steady at 640 degrees for six hours",
        "the older inhabitants still remembered the winter when the river froze from bank to bank",
        "no fewer than 140 delegates signed the petition before the session was adjourned",
        "the architect altered the design of the dome to distribute the weight across eight stone piers",
        "two independent measurements confirmed that the error was smaller than 0.05 millimetres",
        "the travellers rested beside the fountain and shared what remained of their provisions",
        "the orchestra repeated the final movement twice to the delight of the crowded hall",
    ]
    books = []
    for _ in range(n_books):
        paras = []
        for _ in range(paras_per_book):
            n_sents = rng.choices([1, 2, 3, 4], weights=[0.35, 0.30, 0.20, 0.15])[0]
            sents = []
            for _ in range(n_sents):
                if rng.random() < 0.55:
                    sents.append(rng.choice(FALLBACK_PARAGRAPHS))
                else:
                    sents.append(f"{rng.choice(clauses_a)}, {rng.choice(clauses_b)}.")
            paras.append(" ".join(sents))
        books.append(paras)
    return books


# ---------------------------------------------------------------------------
# Corpus
# ---------------------------------------------------------------------------

def download_corpus(ids=GUTENBERG_IDS, dest: Path = CORPUS_DIR, verbose=True) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    if any(dest.glob("*.txt")):
        return
    for i, book_id in enumerate(ids[:5]):
        out = dest / f"pg{book_id}.txt"
        if out.exists():
            continue
        url = f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Bookshelf-trainer/1.0"})
            raw = urllib.request.urlopen(req, timeout=5).read().decode("utf-8", errors="ignore")
        except Exception as exc:  # pragma: no cover - network
            if verbose:
                print(f"  ! Gutenberg mirror unavailable ({exc}); using built-in multi-genre corpus.")
            break
        start = re.search(r"\*\*\* ?START OF.*?\*\*\*", raw)
        end = re.search(r"\*\*\* ?END OF", raw)
        body = raw[start.end() if start else 0: end.start() if end else len(raw)]
        out.write_text(body, encoding="utf-8")
        if verbose:
            print(f"  downloaded {out.name} ({len(body) // 1024} KB)")


def load_paragraphs(corpus_dir: Path = CORPUS_DIR) -> List[List[str]]:
    """Return a list of books, each a list of clean paragraphs."""
    books = []
    for path in sorted(corpus_dir.glob("*.txt")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        text = re.sub(r"\[(Illustration|Footnote|Sidenote)[^\]]*\]", " ", text, flags=re.S)
        text = text.replace("_", "")
        paras = []
        for block in re.split(r"\n\s*\n", text):
            p = " ".join(block.split())
            if len(p) < 60 or len(p) > 4000:
                continue
            letters = [c for c in p if c.isalpha()]
            if len(letters) < 0.6 * len(p) or sum(c.isupper() for c in letters) > 0.5 * len(letters):
                continue
            paras.append(p)
        if len(paras) > 50:
            books.append(paras)
    if not books:
        books = _build_synthetic_books()
    return books


# ---------------------------------------------------------------------------
# Random text helpers
# ---------------------------------------------------------------------------

FIRST = ["James", "Mary", "Ahmet", "Elif", "John", "Sarah", "Mehmet", "Anna", "Peter", "Laura",
         "David", "Zeynep", "Thomas", "Emma", "Can", "Ayşe", "Robert", "Julia", "Ali", "Clara"]
LAST = ["Smith", "Johnson", "Yılmaz", "Kaya", "Brown", "Miller", "Demir", "Wilson", "Taylor",
        "Anderson", "Şahin", "Thompson", "Moore", "Clark", "Öztürk", "Lewis", "Walker", "Hall"]
PUBLISHERS = ["Penguin Books", "Oxford University Press", "Vintage", "HarperCollins",
              "Cambridge University Press", "Yapı Kredi Yayınları", "Random House", "Springer",
              "Macmillan", "İş Bankası Kültür Yayınları", "Faber & Faber", "MIT Press"]
CITIES = ["London", "New York", "Oxford", "İstanbul", "Boston", "Berlin", "Toronto", "Ankara"]


def roman(n: int) -> str:
    vals = [(1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"),
            (50, "l"), (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out


NUM_WORDS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
             "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen"]


class TextSource:
    def __init__(self, books: List[List[str]], rng: random.Random):
        self.books = books
        self.rng = rng
        words = set()
        for book in books[:10]:
            for p in book[:300]:
                for w in re.findall(r"[A-Za-z]{4,11}", p):
                    words.add(w.lower())
        self.words = sorted(words) or ["shadow", "river", "garden", "letter", "winter"]

    def paragraphs(self, n: int) -> List[str]:
        book = self.rng.choice(self.books)
        start = self.rng.randrange(0, max(1, len(book) - n))
        return [sprinkle_numbers(self.rng, p) for p in book[start:start + n]]

    def title(self, lo=2, hi=5) -> str:
        words = [self.rng.choice(self.words) for _ in range(self.rng.randint(lo, hi))]
        small = {"of", "the", "and", "in", "a"}
        out = []
        for i, w in enumerate(words):
            out.append(w.capitalize())
            if i < len(words) - 1 and self.rng.random() < 0.25:
                out.append(self.rng.choice(sorted(small)))
        return " ".join(out)

    def sentence(self, lo=6, hi=25) -> str:
        p = self.rng.choice(self.rng.choice(self.books))
        sents = re.split(r"(?<=[.!?])\s+", p)
        s = self.rng.choice(sents)
        words = s.split()
        if len(words) > hi:
            s = " ".join(words[:hi]) + "."
        return s

    def person(self) -> str:
        return f"{self.rng.choice(FIRST)} {self.rng.choice(LAST)}"


def sprinkle_numbers(rng: random.Random, para: str) -> str:
    """Put meaningful numbers inside body text so the model doesn't learn 'digits = junk'."""
    if rng.random() > 0.18:
        return para
    phrases = [f"in {rng.randint(1500, 2024)}", f"about {rng.randint(2, 99)} percent",
               f"{rng.randint(2, 500)} miles", f"on {rng.randint(1, 28)} May {rng.randint(1700, 2020)}",
               f"No. {rng.randint(1, 40)}", f"{rng.randint(1, 9)}.{rng.randint(0, 99)} metres",
               f"some {rng.randint(10, 9000):,} people", f"chapter {rng.randint(1, 30)}"]
    words = para.split()
    pos = rng.randrange(0, len(words))
    words.insert(pos, rng.choice(phrases))
    return " ".join(words)


# ---------------------------------------------------------------------------
# Page layout simulation
# ---------------------------------------------------------------------------

class Style:
    def __init__(self, rng: random.Random):
        self.epub = rng.random() < 0.25
        self.width = rng.randint(45, 95)  # characters per line
        self.lines_per_page = rng.randint(26, 48)
        self.body_size = rng.uniform(8.5, 12.5)
        self.left = rng.uniform(0.08, 0.17)
        self.right = 1.0 - rng.uniform(0.08, 0.17)
        self.top = rng.uniform(0.06, 0.12)
        self.bottom = 1.0 - rng.uniform(0.06, 0.12)
        self.header_mode = rng.choice(["none", "title", "alternating", "chapter", "author_title"])
        self.pagenum_mode = rng.choice(["none", "bottom_center", "bottom_outer", "top_outer",
                                        "top_outer", "bottom_center", "top_center"])
        self.pagenum_fmt = rng.choice(["plain"] * 5 + ["dashes", "page", "of_total", "pipe", "brackets"])
        self.watermark = rng.random() < 0.08
        self.indent = rng.random() < 0.7
        self.para_gap = (not self.indent) or rng.random() < 0.2
        self.justified = rng.random() < 0.7
        self.hyphenate = rng.random() < 0.6
        self.heading_style = rng.choice(["chapter_num", "chapter_word", "bare_num", "roman", "title_only", "numbered_title"])
        self.footnote_rate = rng.choice([0.0, 0.1, 0.25, 0.4])
        self.section_rate = rng.choice([0.0, 0.0, 0.03, 0.08])
        self.caption_rate = rng.choice([0.0, 0.0, 0.05, 0.12])


class DocBuilder:
    def __init__(self, rng: random.Random, style: Style, src: TextSource):
        self.rng, self.s, self.src = rng, style, src
        self.doc = Document(has_layout=not style.epub)
        self.page: List[Line] = []
        self.page_no = rng.randint(1, 250)
        self.total_pages = self.page_no + rng.randint(50, 400)
        self.front = False
        self.block = 0
        self.book_title = src.title(1, 4)
        self.author = src.person()
        self.chapter_title = ""
        self.body_top = style.top + 0.04
        self.body_bottom = style.bottom - 0.04
        self.lh = (self.body_bottom - self.body_top) / style.lines_per_page
        self.y = self.body_top
        self.reserved_bottom = 0.0
        self.suppress_header = False

    # -- primitives -----------------------------------------------------
    def j(self, v, scale=0.002):
        return v + self.rng.gauss(0, scale)

    def emit(self, text, label, x0=None, x1=None, y=None, size=None, bold=False, tag="p", h=None):
        text = text.strip()
        if not text:
            return
        if self.s.epub:
            self.page.append(Line(text=text, page=len(self.doc.pages), block=self.block, tag=tag, label=label))
            return
        size = size or self.s.body_size
        h = h or self.lh * (size / self.s.body_size)
        y = self.y if y is None else y
        if x0 is None:
            x0 = self.s.left
        if x1 is None:
            x1 = min(self.s.right, x0 + (len(text) / self.s.width) * (self.s.right - self.s.left))
        self.page.append(Line(
            text=text, page=len(self.doc.pages), block=self.block,
            x0=self.j(x0), x1=self.j(x1), y0=self.j(y), y1=self.j(y + h * 0.8),
            font_size=max(4.0, self.rng.gauss(size, 0.08)), bold=bold, tag="", label=label,
        ))

    def centered(self, text, label, y, size=None, bold=False):
        size = size or self.s.body_size
        w = (len(text) / self.s.width) * (self.s.right - self.s.left) * (size / self.s.body_size)
        w = min(w, self.s.right - self.s.left)
        mid = (self.s.left + self.s.right) / 2
        self.emit(text, label, x0=mid - w / 2, x1=mid + w / 2, y=y, size=size, bold=bold)

    def page_number_text(self):
        n = roman(self.page_no) if self.front else str(self.page_no)
        f = self.s.pagenum_fmt
        if f == "dashes":
            return f"- {n} -"
        if f == "page":
            return self.rng.choice(["Page", "page", "Sayfa", "p."]) + f" {n}"
        if f == "of_total":
            return f"{n} of {self.total_pages}" if self.rng.random() < 0.7 else f"{n} / {self.total_pages}"
        if f == "pipe":
            return f"| {n}"
        if f == "brackets":
            return f"[{n}]"
        return n

    def header_text(self):
        m = self.s.header_mode
        even = self.page_no % 2 == 0
        if m == "title":
            return self.book_title.upper() if self.rng.random() < 0.5 else self.book_title
        if m == "alternating":
            return self.book_title if even else (self.chapter_title or self.book_title)
        if m == "chapter":
            return self.chapter_title or self.book_title
        if m == "author_title":
            return self.author if even else self.book_title
        return ""

    # -- page lifecycle -------------------------------------------------
    def start_page(self):
        self.page = []
        self.y = self.body_top
        self.reserved_bottom = 0.0
        if self.s.epub:
            return
        if self.s.watermark:
            self.centered(f"Downloaded from www.{self.rng.choice(['ebooks', 'pdfdrive', 'archive'])}.org", "header_footer",
                          y=0.015, size=self.s.body_size * 0.7)
        header = "" if self.suppress_header else self.header_text()
        pn = self.page_number_text()
        outer_left = self.page_no % 2 == 0
        if self.s.pagenum_mode == "top_outer" and not self.suppress_header:
            if header:
                if self.rng.random() < 0.5:
                    # extractor merges page number + header on one line
                    text = f"{pn}    {header}" if outer_left else f"{header}    {pn}"
                    self.emit(text, "header_footer", x0=self.s.left, x1=self.s.right, y=self.s.top, size=self.s.body_size * 0.85)
                else:
                    self.centered(header, "header_footer", y=self.s.top, size=self.s.body_size * 0.85)
                    x0 = self.s.left if outer_left else self.s.right - 0.03
                    self.emit(pn, "page_number", x0=x0, x1=x0 + 0.03, y=self.s.top, size=self.s.body_size * 0.85)
            else:
                x0 = self.s.left if outer_left else self.s.right - 0.03
                self.emit(pn, "page_number", x0=x0, x1=x0 + 0.03, y=self.s.top, size=self.s.body_size * 0.85)
        else:
            if header:
                self.centered(header, "header_footer", y=self.s.top, size=self.s.body_size * self.rng.uniform(0.75, 0.95))
            if self.s.pagenum_mode == "top_center" and not self.suppress_header:
                self.centered(pn, "page_number", y=self.s.top - 0.025)

    def end_page(self):
        if not self.s.epub:
            pn = self.page_number_text()
            if self.s.pagenum_mode == "bottom_center" or (self.suppress_header and self.s.pagenum_mode != "none"):
                self.centered(pn, "page_number", y=self.s.bottom, size=self.s.body_size * 0.9)
            elif self.s.pagenum_mode == "bottom_outer":
                x0 = self.s.left if self.page_no % 2 == 0 else self.s.right - 0.04
                self.emit(pn, "page_number", x0=x0, x1=x0 + 0.04, y=self.s.bottom, size=self.s.body_size * 0.9)
        elif self.rng.random() < 0.08:
            # print-derived EPUBs often contain stray page-break numbers
            self.emit(str(self.page_no), "page_number", tag=self.rng.choice(["p", "span", "div"]))
        if self.page:
            self.doc.pages.append(self.page)
        self.page_no += 1
        self.suppress_header = False
        self.start_page()

    def room(self, n_lines=1, size=None):
        size = size or self.s.body_size
        need = n_lines * self.lh * (size / self.s.body_size)
        return self.y + need <= self.body_bottom - self.reserved_bottom

    def ensure_room(self, n_lines=1, size=None):
        if self.s.epub:
            if len(self.page) > self.rng.randint(40, 90):
                self.end_page()
            return
        if not self.room(n_lines, size):
            self.end_page()

    # -- content --------------------------------------------------------
    def wrap(self, text: str, width: int) -> List[str]:
        words, lines, cur = text.split(), [], ""
        for w in words:
            if not cur:
                cur = w
            elif len(cur) + 1 + len(w) <= width:
                cur += " " + w
            else:
                if (self.s.hyphenate and len(w) >= 7 and w.isalpha() and self.rng.random() < 0.35):
                    k = self.rng.randint(3, len(w) - 3)
                    if len(cur) + 1 + k + 1 <= width:
                        lines.append(cur + " " + w[:k] + "-")
                        cur = w[k:]
                        continue
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    def paragraph(self, text: str):
        self.block += 1
        if self.rng.random() < self.s.footnote_rate * 0.5:
            text = add_footnote_marker(self.rng, text)
        if self.s.epub:
            self.ensure_room()
            self.emit(text, "body", tag=self.rng.choice(["p"] * 8 + ["div", "blockquote"]))
            return
        if self.s.para_gap:
            self.y += self.lh * self.rng.uniform(0.3, 1.0)
        lines = self.wrap(text, self.s.width)
        span = self.s.right - self.s.left
        for i, ln in enumerate(lines):
            self.ensure_room()
            indent = span * 0.05 if (i == 0 and self.s.indent) else 0.0
            last = i == len(lines) - 1
            x0 = self.s.left + indent
            x1 = self.s.right if (self.s.justified and not last) else min(self.s.right, x0 + len(ln) / self.s.width * span)
            self.emit(ln, "body", x0=x0, x1=x1)
            self.y += self.lh
            if self.rng.random() < self.s.footnote_rate / 12 and not self.s.epub:
                self.reserve_footnotes()

    def reserve_footnotes(self):
        if self.reserved_bottom > 0:
            return
        notes = []
        for k in range(self.rng.randint(1, 3)):
            marker = self.rng.choice([str(self.rng.randint(1, 60)), "*", "†", "¹", "²", str(k + 1) + "."])
            body = self.rng.choice([
                self.src.sentence(5, 30),
                f"See {self.rng.choice(LAST)}, {self.src.title(2, 4)}, p. {self.rng.randint(2, 400)}.",
                f"{self.rng.choice(LAST)} ({self.rng.randint(1850, 2020)}), pp. {self.rng.randint(1, 200)}–{self.rng.randint(201, 400)}.",
                "Ibid., " + str(self.rng.randint(1, 300)) + ".",
            ])
            notes.append(f"{marker} {body}")
        size = self.s.body_size * self.rng.uniform(0.72, 0.85)
        width = int(self.s.width * self.s.body_size / size)
        wrapped = [self.wrap(n, width) for n in notes]
        n_lines = sum(len(w) for w in wrapped)
        fh = self.lh * size / self.s.body_size
        start = self.body_bottom - n_lines * fh
        if start < self.y + 3 * self.lh:
            return
        self.reserved_bottom = n_lines * fh + self.lh
        y = start
        for w in wrapped:
            self.block += 1
            for ln in w:
                self.emit(ln, "footnote", y=y, size=size)
                y += fh

    def heading(self, lines: List[str], size_mult: float, top_gap: int):
        self.block += 1
        if self.s.epub:
            self.ensure_room()
            for t in lines:
                tag = self.rng.choice(["h1", "h2", "h3"]) if self.rng.random() < 0.8 else "p"
                self.emit(t, "heading", tag=tag)
            return
        self.y += self.lh * top_gap
        size = self.s.body_size * size_mult
        bold = self.rng.random() < 0.6
        center = self.rng.random() < 0.6
        for t in lines:
            self.ensure_room(2, size)
            if center:
                self.centered(t, "heading", y=self.y, size=size, bold=bold)
            else:
                self.emit(t, "heading", y=self.y, size=size, bold=bold)
            self.y += self.lh * size / self.s.body_size * 1.3
        self.y += self.lh * self.rng.uniform(0.5, 2.0)

    def chapter(self, number: int, n_paras: int):
        if any(l.label not in ("header_footer", "page_number") for l in self.page):
            self.end_page()
        self.suppress_header = self.rng.random() < 0.7
        self.start_page()
        title = self.src.title(1, 5)
        self.chapter_title = title
        style = self.s.heading_style
        if style == "chapter_num":
            lines = [f"{self.rng.choice(['CHAPTER', 'Chapter', 'BÖLÜM'])} {number}"] + ([title] if self.rng.random() < 0.6 else [])
        elif style == "chapter_word":
            lines = [f"Chapter {NUM_WORDS[(number - 1) % len(NUM_WORDS)]}"] + ([title] if self.rng.random() < 0.5 else [])
        elif style == "bare_num":
            lines = [str(number)] + ([title] if self.rng.random() < 0.7 else [])
        elif style == "roman":
            lines = [roman(number).upper()] + ([title] if self.rng.random() < 0.5 else [])
        elif style == "numbered_title":
            lines = [f"{number}. {title}"]
        else:
            lines = [title]
        self.heading(lines, self.rng.uniform(1.3, 2.4), top_gap=self.rng.randint(2, 10))
        for para in self.src.paragraphs(n_paras):
            if self.rng.random() < self.s.section_rate:
                sec = self.src.title(1, 4)
                if self.rng.random() < 0.5:
                    sec = f"{number}.{self.rng.randint(1, 9)} {sec}"
                self.heading([sec], self.rng.uniform(1.0, 1.35), top_gap=1)
            if self.rng.random() < self.s.caption_rate:
                self.figure()
            self.paragraph(para)

    def figure(self):
        self.block += 1
        kind = self.rng.choice(["Figure", "Fig.", "Table", "Şekil", "Plate"])
        caption = f"{kind} {self.rng.randint(1, 12)}.{self.rng.randint(1, 9)} {self.src.sentence(4, 14)}"
        if self.s.epub:
            self.emit(caption, "noise", tag=self.rng.choice(["figcaption", "p"]))
            return
        gap = self.rng.randint(4, 12)
        self.ensure_room(gap + 2)
        if self.rng.random() < 0.4:
            ticks = " ".join(str(v) for v in range(0, self.rng.randint(5, 11) * 10, 10))
            self.centered(ticks, "noise", y=self.y + self.lh * (gap - 1), size=self.s.body_size * 0.7)
        self.y += self.lh * gap
        for ln in self.wrap(caption, int(self.s.width * 1.1)):
            self.centered(ln, "noise", y=self.y, size=self.s.body_size * 0.85)
            self.y += self.lh * 0.9
        self.y += self.lh

    # -- front & back matter -------------------------------------------
    def front_matter(self):
        self.front = True
        self.page_no = 1
        self.suppress_header = True
        self.start_page()
        mid = (self.body_top + self.body_bottom) / 2
        if self.s.epub:
            self.emit(self.book_title, "heading", tag="h1")
            self.emit(self.author, "heading", tag="h2")
            self.emit(self.rng.choice(PUBLISHERS), "noise")
        else:
            self.centered(self.book_title, "heading", y=mid - 0.2, size=self.s.body_size * 2.4, bold=True)
            self.centered(self.author, "heading", y=mid - 0.1, size=self.s.body_size * 1.4)
            self.centered(self.rng.choice(PUBLISHERS), "noise", y=self.body_bottom - 0.05)
            self.centered(self.rng.choice(CITIES), "noise", y=self.body_bottom - 0.02)
        self.end_page()
        # copyright page
        self.suppress_header = True
        cp = [f"Copyright © {self.rng.randint(1950, 2023)} by {self.author}",
              "All rights reserved.",
              f"ISBN 978-{self.rng.randint(0, 9)}-{self.rng.randint(100, 999)}-{self.rng.randint(10000, 99999)}-{self.rng.randint(0, 9)}",
              f"First published in {self.rng.randint(1900, 2023)} by {self.rng.choice(PUBLISHERS)}",
              f"Printed in {self.rng.choice(['the United States of America', 'Great Britain', 'Türkiye', 'Germany'])}",
              f"www.{self.rng.choice(['penguin', 'harpercollins', 'ykykultur', 'vintage'])}.com",
              "No part of this publication may be reproduced, stored in a retrieval system, or transmitted, "
              "in any form or by any means, without the prior permission of the publisher.",
              f"{self.rng.randint(1, 3)} {self.rng.randint(4, 6)} {self.rng.randint(7, 9)} 10 9 8 7 6 5 4"]
        self.rng.shuffle(cp)
        self.y = self.body_bottom - len(cp) * self.lh * 1.6
        for t in cp:
            if self.s.epub:
                self.emit(t, "noise", tag="p")
                continue
            for ln in self.wrap(t, int(self.s.width * 1.15)):
                self.emit(ln, "noise", size=self.s.body_size * 0.8)
                self.y += self.lh * 0.85
        self.end_page()
        # table of contents
        if self.rng.random() < 0.8:
            self.start_page()
            self.heading([self.rng.choice(["Contents", "CONTENTS", "Table of Contents", "İçindekiler"])], 1.5, 2)
            # the title of the TOC itself is not worth reading
            for l in self.page:
                if l.label == "heading":
                    l.label = "noise"
            page = self.rng.randint(1, 15)
            span = self.s.right - self.s.left
            for i in range(self.rng.randint(6, 30)):
                self.ensure_room()
                t = self.src.title(1, 5)
                page += self.rng.randint(5, 40)
                fmt = self.rng.random()
                if fmt < 0.4:
                    entry = f"{i + 1}. {t} " + "." * self.rng.randint(5, 40) + f" {page}"
                elif fmt < 0.7:
                    entry = f"Chapter {i + 1}: {t}    {page}"
                else:
                    entry = f"{t} {page}"
                self.emit(entry, "noise", x0=self.s.left, x1=self.s.right if fmt < 0.7 else self.s.left + span * 0.6, tag="li")
                self.y += self.lh
            self.end_page()
        self.front = False
        self.page_no = self.rng.randint(1, 15)

    def back_matter(self):
        self.suppress_header = self.rng.random() < 0.5
        self.start_page()
        kind = self.rng.choice(["references", "index", "notes"])
        title = {"references": self.rng.choice(["References", "Bibliography", "Kaynakça"]),
                 "index": self.rng.choice(["Index", "INDEX", "Dizin"]),
                 "notes": self.rng.choice(["Notes", "NOTES", "Endnotes"])}[kind]
        self.heading([title], 1.5, 2)
        for l in self.page:
            if l.label == "heading":
                l.label = "noise"
        for i in range(self.rng.randint(15, 60)):
            if kind == "references":
                t = (f"[{i + 1}] {self.rng.choice(LAST)}, {self.rng.choice(FIRST)[0]}. ({self.rng.randint(1850, 2023)}). "
                     f"{self.src.title(2, 6)}. {self.rng.choice(PUBLISHERS)}, pp. {self.rng.randint(1, 200)}–{self.rng.randint(201, 500)}.")
            elif kind == "index":
                pages = ", ".join(str(self.rng.randint(1, 400)) for _ in range(self.rng.randint(1, 5)))
                t = f"{self.rng.choice(self.src.words)}, {pages}"
            else:
                t = f"{i + 1}. {self.src.sentence(4, 30)}"
            self.block += 1
            if self.s.epub:
                self.ensure_room()
                self.emit(t, "noise", tag="li" if kind != "notes" else "p")
                continue
            for ln in self.wrap(t, self.s.width):
                self.ensure_room()
                self.emit(ln, "noise", size=self.s.body_size * 0.9)
                self.y += self.lh * 0.95
        self.end_page()


def add_footnote_marker(rng: random.Random, text: str) -> str:
    words = text.split()
    if len(words) < 4:
        return text
    i = rng.randrange(1, len(words))
    marker = rng.choice(["¹", "²", "³", "*", "†", str(rng.randint(1, 40)), f"[{rng.randint(1, 80)}]"])
    words[i] = words[i] + marker
    return " ".join(words)


def make_document(rng: random.Random, src: TextSource, max_pages: Optional[int] = None) -> Document:
    style = Style(rng)
    b = DocBuilder(rng, style, src)
    if rng.random() < 0.3:
        b.front_matter()
    else:
        b.start_page()
    first_chapter = rng.randint(1, 20)
    for c in range(rng.randint(1, 4)):
        if c == 0 and rng.random() < 0.4:
            # start in the middle of a chapter (book excerpt)
            for para in src.paragraphs(rng.randint(10, 40)):
                b.paragraph(para)
            continue
        b.chapter(first_chapter + c, rng.randint(8, 45))
    if rng.random() < 0.2:
        b.back_matter()
    if b.page:
        b.end_page()
    pages = [p for p in b.doc.pages if p]
    if max_pages:
        pages = pages[:max_pages]
    b.doc.pages = pages
    return b.doc
