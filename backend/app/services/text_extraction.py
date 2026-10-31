"""Plain-text extraction from uploaded CV files (PDF via pypdf, DOCX via python-docx)."""
import io
import re
import zipfile

import docx
from pypdf import PdfReader
from pypdf.errors import PdfReadError


class ExtractionError(Exception):
    """The file could not be read. The message is safe to show to the user."""


def extract_text(data: bytes, extension: str) -> str:
    if extension == ".pdf":
        return _pdf_text(data)
    if extension == ".docx":
        return _docx_text(data)
    raise ExtractionError("Only PDF and DOCX files are supported.")


def _pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ExtractionError("This PDF is password-protected. Please upload an unprotected copy.")
        pages = [page.extract_text() or "" for page in reader.pages]
    except ExtractionError:
        raise
    except (PdfReadError, ValueError, KeyError, TypeError) as exc:
        raise ExtractionError("This PDF could not be read. It may be damaged.") from exc
    return "\n\n".join(p.strip() for p in pages if p.strip())


def _docx_text(data: bytes) -> str:
    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:  # python-docx raises a mix of zip/XML/KeyError types
        raise ExtractionError("This Word file could not be read. It may be damaged.") from exc
    lines = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    # Many CV templates put content in tables (e.g. two-column layouts).
    for table in document.tables:
        for row in table.rows:
            cells = []
            for cell in row.cells:
                text = cell.text.strip()
                if text and text not in cells:  # merged cells repeat their text
                    cells.append(text)
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def docx_header_footer_text(data: bytes) -> str:
    """Text in the headers and footers of a Word file. Many CVs keep the name, email and phone there, where
    the body text does not reach. Used only to find contact details (never sent to the AI). "" on any problem."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            parts = [zf.read(n).decode("utf-8", "ignore") for n in zf.namelist()
                     if re.match(r"word/(header|footer)\d*\.xml$", n)]
    except (zipfile.BadZipFile, KeyError):
        return ""
    return "\n".join(re.sub(r"<[^>]+>", " ", p) for p in parts)
