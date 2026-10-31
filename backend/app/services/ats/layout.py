"""Layout facts for checks A1, A2, A4 and A11, read from a CV file (the upload, or the generated PDF).

Only these numbers are kept; the file itself is not (uploads are deleted after parsing). Tables and
text boxes can be counted in Word files; in a PDF they cannot be told apart from text, so the PDF
count of such traps is an estimate (labelled as such in the check).
"""
import io
import re
import zipfile
from typing import Any, Dict, Optional

from pypdf import PdfReader

from app.services.ats.lists import STANDARD_HEADINGS
from app.services.contact_patterns import find_contact

SCRAMBLED_SHARE = 0.02  # replacement/private-use characters, as a share of the text
MIN_TEXT_CHARS = 200
BAD_CHARS = re.compile("[�-]")


def text_integrity(text: str) -> str:
    """"ok", "scrambled" (garbled characters, or text broken into fragments) or "unreadable"
    (little or no text layer, e.g. a scanned PDF)."""
    stripped = text.strip()
    if len(stripped) < MIN_TEXT_CHARS:
        return "unreadable"
    if len(BAD_CHARS.findall(stripped)) / len(stripped) > SCRAMBLED_SHARE:
        return "scrambled"
    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    short = [ln for ln in lines if len(ln) <= 2]
    if len(lines) >= 10 and len(short) / len(lines) > 0.4:
        return "scrambled"
    return "ok"


def headings_found(text: str) -> int:
    """How many of Experience, Education and Skills appear as a heading line (0 to 3)."""
    lines = {re.sub(r"[^a-z& ]", "", ln.lower()).strip() for ln in text.splitlines()}
    return sum(1 for variants in STANDARD_HEADINGS.values() if any(v in lines for v in variants))


def _facts(text: str, tables: int, textboxes: int, icons: int, pages: Optional[int],
           header_contact: bool = False) -> Dict[str, Any]:
    return {"text": text_integrity(text), "headings": headings_found(text), "tables": tables,
            "textboxes": textboxes, "icons": icons, "pages": pages, "header_contact": header_contact}


def header_only_contact(body_text: str, header_footer_xml: str) -> bool:
    """True when the email or phone is found in a Word header or footer but not in the page body: many ATS
    parsers skip headers and footers, so such details are lost."""
    if not header_footer_xml:
        return False
    outside = find_contact(re.sub(r"<[^>]+>", " ", header_footer_xml)).get("basics", {})
    inside = find_contact(body_text).get("basics", {})
    return any(outside.get(k) and not inside.get(k) for k in ("email", "phone"))


def from_pdf(data: bytes) -> Optional[Dict[str, Any]]:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            return None
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
        images = sum(len(page.images) for page in reader.pages)
    except Exception:  # noqa: BLE001 - a file that cannot be read has no layout facts
        return None
    return _facts(text, tables=0, textboxes=0, icons=images, pages=len(reader.pages))


def from_docx(data: bytes) -> Optional[Dict[str, Any]]:
    from app.services.text_extraction import ExtractionError, extract_text

    try:
        text = extract_text(data, ".docx")
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            body = zf.read("word/document.xml").decode("utf-8", "ignore")
            names = zf.namelist()
            app_xml = zf.read("docProps/app.xml").decode("utf-8", "ignore") if "docProps/app.xml" in names else ""
            header_footer = " ".join(
                zf.read(n).decode("utf-8", "ignore") for n in names if re.match(r"word/(header|footer)\d*\.xml$", n)
            )
    except (ExtractionError, zipfile.BadZipFile, KeyError):
        return None
    pages = re.search(r"<Pages>(\d+)</Pages>", app_xml)
    return _facts(
        text,
        tables=body.count("<w:tbl>") + body.count("<w:tbl "),
        textboxes=body.count("<w:txbxContent"),
        icons=body.count("<w:drawing") + body.count("<w:pict"),
        pages=int(pages.group(1)) if pages else None,
        header_contact=header_only_contact(text, header_footer),
    )


def from_file(data: bytes, extension: str) -> Optional[Dict[str, Any]]:
    return from_pdf(data) if extension == ".pdf" else from_docx(data) if extension == ".docx" else None
