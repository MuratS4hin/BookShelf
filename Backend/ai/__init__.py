"""Neural text-cleaning components for Bookshelf.

The cleaner is a small deep neural network (character CNN + layout features +
bidirectional GRU over the lines of a page) that labels every extracted line as
body text, heading, page number, running header/footer, footnote or other noise.
Only body text and headings are kept and sent to the neural TTS (Piper).
"""
