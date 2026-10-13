import io
from types import SimpleNamespace

import docx
import pytest

from app.models.cv import CV
from app.services import parsing_service
from app.services.cv_parser import ClaudeCvParser, ParsedResume, ParseError
from app.services.storage_service import LocalStorage
from app.services.text_extraction import ExtractionError, extract_text
from tests.conftest import DOCX_MIME, PDF_MIME, make_pdf

CV_TEXT = (
    "Jane Doe - Senior Data Analyst - jane@example.com\n"
    "Experience: Acme Ltd, Data Analyst, 2019-03 to Present. Built weekly sales dashboards.\n"
    "Education: University of Leeds, BSc Mathematics, 2015 - 2018.\n"
    "Skills: Python, SQL, Tableau, statistics, stakeholder communication."
)
PARSED = {"basics": {"name": "Jane Doe"}, "work": [{"name": "Acme Ltd", "position": "Data Analyst"}]}


def make_text_pdf(text: str) -> bytes:
    """A minimal, valid one-page PDF whose text layer contains `text`."""
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    lines = escaped.split("\n")
    ops = "BT /F1 10 Tf 40 800 Td 12 TL " + " ".join(f"({line}) Tj T*" for line in lines) + " ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(ops)} >>\nstream\n{ops}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return out.getvalue()


def make_text_docx(paragraphs, table_rows=()) -> bytes:
    document = docx.Document()
    for p in paragraphs:
        document.add_paragraph(p)
    if table_rows:
        table = document.add_table(rows=len(table_rows), cols=len(table_rows[0]))
        for r, row in enumerate(table_rows):
            for c, value in enumerate(row):
                table.cell(r, c).text = value
    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()


class FakeParser:
    def __init__(self, result=None, error=None):
        self.result, self.error = result or PARSED, error
        self.calls = []

    def parse_text(self, text):
        self.calls.append(("text", text))
        if self.error:
            raise self.error
        return self.result

    def parse_pdf(self, data):
        self.calls.append(("pdf", data))
        if self.error:
            raise self.error
        return self.result


# --- text extraction -------------------------------------------------------------

def test_extract_text_from_pdf_and_docx():
    assert "Senior Data Analyst" in extract_text(make_text_pdf(CV_TEXT), ".pdf")
    text = extract_text(make_text_docx(["Jane Doe", "Data Analyst"], [("Python", "SQL")]), ".docx")
    assert "Jane Doe" in text and "Python | SQL" in text


def test_extract_text_rejects_broken_files():
    with pytest.raises(ExtractionError):
        extract_text(b"%PDF-1.4 garbage", ".pdf")
    with pytest.raises(ExtractionError):
        extract_text(b"PK\x03\x04 not really a zip", ".docx")


# --- pipeline ----------------------------------------------------------------------

@pytest.fixture()
def stored_cv(client, auth):
    """Upload a file through the API and return a helper to run the queued parse job."""
    storage = LocalStorage(str(client.upload_dir))

    def upload_and_run(data, name="cv.pdf", mime=PDF_MIME, parser=None):
        r = client.post("/api/cv/upload", headers=auth[0], files={"file": (name, data, mime)})
        assert r.status_code == 201
        cv_id, key = client.queued_parse_jobs[-1]
        parser = parser or FakeParser()
        with client.session_factory() as db:
            parsing_service.run_parsing(db, storage, parser, cv_id, key)
        return client.get("/api/cv", headers=auth[0]).json(), parser

    return upload_and_run


def test_upload_queues_a_parse_job_without_waiting(client, auth):
    r = client.post("/api/cv/upload", headers=auth[0], files={"file": ("cv.pdf", make_pdf(), PDF_MIME)})
    assert r.status_code == 201 and r.json()["parsing_status"] == "pending"
    assert len(client.queued_parse_jobs) == 1
    cv_id, key = client.queued_parse_jobs[0]
    assert str(cv_id) == r.json()["id"] and key.endswith(".pdf")


def test_text_pdf_is_parsed_and_stored(stored_cv):
    body, parser = stored_cv(make_text_pdf(CV_TEXT))
    assert body["parsing_status"] == "complete" and body["parsing_error"] is None
    assert body["json_resume"] == PARSED
    assert parser.calls[0][0] == "text" and "Acme Ltd" in parser.calls[0][1]


def test_docx_is_parsed(stored_cv):
    body, parser = stored_cv(make_text_docx(CV_TEXT.split("\n")), "cv.docx", DOCX_MIME)
    assert body["parsing_status"] == "complete" and parser.calls[0][0] == "text"


def test_scanned_pdf_is_sent_to_claude_as_a_file(stored_cv):
    data = make_text_pdf("")  # valid PDF with no text layer, like a scan
    body, parser = stored_cv(data)
    assert body["parsing_status"] == "complete"
    assert parser.calls == [("pdf", data)]


def test_unreadable_pdf_fails_with_message(stored_cv):
    body, parser = stored_cv(make_pdf())  # passes the upload check but is not a real PDF
    assert body["parsing_status"] == "failed" and "could not be read" in body["parsing_error"]
    assert parser.calls == []


def test_docx_without_text_fails_with_message(stored_cv):
    body, parser = stored_cv(make_text_docx([]), "cv.docx", DOCX_MIME)
    assert body["parsing_status"] == "failed" and "No text" in body["parsing_error"]
    assert parser.calls == []


def test_parser_error_message_is_shown(stored_cv):
    body, _ = stored_cv(make_text_pdf(CV_TEXT), parser=FakeParser(error=ParseError("Service down.")))
    assert body["parsing_status"] == "failed" and body["parsing_error"] == "Service down."
    assert body["json_resume"] == {}


def test_unexpected_error_shows_generic_message(stored_cv):
    body, _ = stored_cv(make_text_pdf(CV_TEXT), parser=FakeParser(error=RuntimeError("secret detail")))
    assert body["parsing_status"] == "failed"
    assert body["parsing_error"] == parsing_service.GENERIC_FAILURE


def test_job_for_replaced_upload_is_discarded(client, auth):
    storage = LocalStorage(str(client.upload_dir))
    files = {"file": ("a.pdf", make_text_pdf(CV_TEXT), PDF_MIME)}
    client.post("/api/cv/upload", headers=auth[0], files=files)
    old_id, old_key = client.queued_parse_jobs[0]
    client.post("/api/cv/upload", headers=auth[0], files={"file": ("b.pdf", make_text_pdf(CV_TEXT), PDF_MIME)})
    parser = FakeParser()
    with client.session_factory() as db:
        parsing_service.run_parsing(db, storage, parser, old_id, old_key)
    assert parser.calls == []
    assert client.get("/api/cv", headers=auth[0]).json()["parsing_status"] == "pending"


def test_result_discarded_if_cv_replaced_while_parsing(client, auth):
    storage = LocalStorage(str(client.upload_dir))
    client.post("/api/cv/upload", headers=auth[0], files={"file": ("a.pdf", make_text_pdf(CV_TEXT), PDF_MIME)})
    cv_id, key = client.queued_parse_jobs[0]

    class ReplacingParser(FakeParser):
        def parse_text(self, text):
            # Simulate the user uploading a new CV while Claude is working.
            new_file = {"file": ("b.docx", make_text_docx(["x"]), DOCX_MIME)}
            r = client.post("/api/cv/upload", headers=auth[0], files=new_file)
            assert r.status_code == 201, r.text
            return super().parse_text(text)

    with client.session_factory() as db:
        parsing_service.run_parsing(db, storage, ReplacingParser(), cv_id, key)
    body = client.get("/api/cv", headers=auth[0]).json()
    assert body["parsing_status"] == "pending" and body["json_resume"] == {}


def test_queue_failure_marks_cv_failed_but_upload_succeeds(client, auth):
    from app.main import app
    from app.services.parse_queue import get_parse_queue

    def broken(cv_id, key):
        raise ConnectionError("redis down")

    app.dependency_overrides[get_parse_queue] = lambda: broken
    r = client.post("/api/cv/upload", headers=auth[0], files={"file": ("cv.pdf", make_pdf(), PDF_MIME)})
    assert r.status_code == 201
    assert r.json()["parsing_status"] == "failed" and "try uploading it again" in r.json()["parsing_error"]


def test_new_upload_resets_previous_result(stored_cv, client, auth):
    stored_cv(make_text_pdf(CV_TEXT))
    r = client.post("/api/cv/upload", headers=auth[0], files={"file": ("cv.pdf", make_pdf(), PDF_MIME)})
    assert r.json()["parsing_status"] == "pending" and r.json()["json_resume"] == {}


# --- Claude parser (API client faked; no network) ------------------------------------

class FakeMessages:
    def __init__(self, response):
        self.response, self.kwargs = response, None

    def parse(self, **kwargs):
        self.kwargs = kwargs
        return self.response


def fake_client(response):
    messages = FakeMessages(response)
    return SimpleNamespace(beta=SimpleNamespace(messages=messages)), messages


def test_claude_parser_request_and_result():
    output = ParsedResume.model_validate({"basics": {"name": "Jane Doe", "email": None}, "skills": [{"name": "SQL"}]})
    client, messages = fake_client(SimpleNamespace(stop_reason="end_turn", parsed_output=output, _request_id="r1"))
    result = ClaudeCvParser(client=client, model="claude-sonnet-5-5").parse_text("Jane Doe CV")
    assert result["basics"] == {"name": "Jane Doe", "profiles": []}
    assert result["skills"] == [{"name": "SQL", "keywords": []}]
    kw = messages.kwargs
    assert kw["model"] == "claude-sonnet-5-5" and kw["output_format"] is ParsedResume
    assert kw["fallbacks"] == "default" and kw["betas"] == ["server-side-fallback-2026-07-01"]
    assert "Jane Doe CV" in kw["messages"][0]["content"][0]["text"]
    assert "Never invent" in kw["system"]


def test_claude_parser_sends_scanned_pdf_as_document():
    output = ParsedResume.model_validate({"basics": {}})
    client, messages = fake_client(SimpleNamespace(stop_reason="end_turn", parsed_output=output, _request_id="r"))
    ClaudeCvParser(client=client, model="m").parse_pdf(b"%PDF-1.4")
    block = messages.kwargs["messages"][0]["content"][0]
    assert block["type"] == "document" and block["source"]["media_type"] == "application/pdf"


@pytest.mark.parametrize("stop_reason,parsed", [("refusal", None), ("max_tokens", None), ("end_turn", None)])
def test_claude_parser_unusable_responses_raise(stop_reason, parsed):
    client, _ = fake_client(SimpleNamespace(stop_reason=stop_reason, parsed_output=parsed, _request_id="r"))
    with pytest.raises(ParseError):
        ClaudeCvParser(client=client, model="m").parse_text("x")


def test_cv_row_defaults(client, auth):
    client.post("/api/cv/upload", headers=auth[0], files={"file": ("cv.pdf", make_pdf(), PDF_MIME)})
    with client.session_factory() as db:
        cv = db.query(CV).one()
        assert cv.json_resume == {} and cv.parsing_error is None


def test_current_role_is_explicit_in_schema_and_prompt():
    from app.services.cv_parser import SYSTEM_PROMPT

    work = ParsedResume.model_validate({"basics": {}, "work": [{"name": "Acme"}]}).work[0]
    assert work.current is False  # a missing end date alone does not mean "current"
    assert "current to true" in SYSTEM_PROMPT


def test_parser_client_uses_cvsmith_key_and_pinned_base_url(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("CVSMITH_CLAUDE_KEY", "sk-test-cvsmith")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://host-internal.invalid")
    get_settings.cache_clear()
    try:
        client = ClaudeCvParser().client
        assert client.api_key == "sk-test-cvsmith"
        assert str(client.base_url).rstrip("/") == "https://api.anthropic.com"
    finally:
        get_settings.cache_clear()
