import json

import pytest

from app.models.user import User
from app.services import export_service, suggestion_service
from app.services.pdf_service import ChromiumPdfRenderer, PdfError, get_pdf_renderer
from app.services.suggestion_service import get_writer
from tests.conftest import signup
from tests.test_save_and_events import events
from tests.test_suggestions import FakeWriter

CONTENT = {
    "personal": {"name": "Jane Ångström", "headline": "Data Analyst", "email": "jane@example.com",
                 "phone": "+44 1", "location": "Leeds, UK", "linkedin": "linkedin.com/in/jane", "portfolio": ""},
    "summary": "Analyst with 5 years in retail data.",
    "experience": [
        {"id": "e1", "title": "Analyst", "company": "Acme", "start": "2021-04", "end": "",
         "current": "true",
         "description": "Owned weekly sales reporting.\n• Cut report time by 40%\n• Trained 6 colleagues"},
        {"id": "e2", "title": "", "company": "", "start": "", "end": "", "description": ""},
    ],
    "projects": [{"id": "p1", "name": "Churn model", "url": "", "start": "2022", "end": "",
                  "description": "• 81% recall"}],
    "education": [{"id": "d1", "degree": "BSc Statistics", "school": "Leeds", "start": "2014", "end": "2017",
                   "score": ""}],
    "skills": ["SQL", " ", "Python"],
    "certifications": [{"id": "c1", "name": "Tableau Desktop", "issuer": "Tableau", "date": "2020-05"}],
    "others": [
        {"id": "o1", "kind": "language", "title": "French", "detail": "B2"},
        {"id": "o2", "kind": "award", "title": "Analyst of the Year", "detail": "Acme", "start": "2023"},
        {"id": "o3", "kind": "interest", "title": "Chess", "detail": "club, online"},
        {"id": "o4", "kind": "custom", "section": "Publications", "title": "Retail paper", "detail": "",
         "start": "2019"},
    ],
}


class FakeRenderer:
    def __init__(self, fail=False):
        self.fail, self.drafts = fail, []

    def render(self, draft):
        self.drafts.append(draft)
        if self.fail:
            raise PdfError
        return b"%PDF-1.7 fake"


@pytest.fixture()
def renderer(client):
    r = FakeRenderer()
    client.app.dependency_overrides[get_pdf_renderer] = lambda: r
    return r


def save(client, headers, content=CONTENT):
    assert client.patch("/api/cv", headers=headers, json={"content": content}).status_code == 200


def set_plan(client, plan):
    with client.session_factory() as db:
        db.query(User).update({"plan": plan})
        db.commit()


# --- privacy ---------------------------------------------------------------------

def test_privacy_is_saved_and_defaults_to_public(client, auth):
    h = auth[0]
    r = client.patch("/api/cv/privacy", headers=h, json={"privacy": "private"})
    assert r.status_code == 200 and r.json()["privacy"] == "private"
    assert r.json()["parsing_status"] == "not_uploaded"  # created like a first save
    assert client.get("/api/cv", headers=h).json()["privacy"] == "private"
    save(client, h)  # saving the canvas keeps the setting
    assert client.get("/api/cv", headers=h).json()["privacy"] == "private"
    other = signup(client, "o@example.com").json()
    oh = {"Authorization": f"Bearer {other['access_token']}"}
    save(client, oh)
    assert client.get("/api/cv", headers=oh).json()["privacy"] == "public"


def test_privacy_rejects_other_values_and_needs_auth(client, auth):
    assert client.patch("/api/cv/privacy", json={"privacy": "private"}).status_code == 401
    r = client.patch("/api/cv/privacy", headers=auth[0], json={"privacy": "friends"})
    assert r.status_code == 422


# --- PDF download ----------------------------------------------------------------

def test_download_renders_the_saved_canvas_for_free_users(client, auth, renderer):
    save(client, auth[0])
    r = client.get("/api/cv/download", headers=auth[0])
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf" and r.content == b"%PDF-1.7 fake"
    cd = r.headers["content-disposition"]
    assert cd.startswith('attachment; filename="Jane ngstrm CV.pdf"') and "Jane%20%C3%85ngstr%C3%B6m%20CV.pdf" in cd
    assert renderer.drafts == [CONTENT]
    assert events(client, "pdf_downloaded") == [("pdf_downloaded", {})]


def test_download_needs_a_saved_canvas(client, auth, renderer):
    assert client.get("/api/cv/download").status_code == 401
    r = client.get("/api/cv/download", headers=auth[0])
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
    assert renderer.drafts == []


def test_failed_render_is_a_friendly_error_and_not_recorded(client, auth, renderer):
    renderer.fail = True
    save(client, auth[0])
    r = client.get("/api/cv/download", headers=auth[0])
    assert r.status_code == 503 and r.json()["error"]["code"] == "PDF_FAILED"
    assert events(client, "pdf_downloaded") == []


def test_renderer_only_loads_the_template_origin(monkeypatch):
    r = ChromiumPdfRenderer(template_url="http://frontend:5173/")
    assert r.url == "http://frontend:5173/print.html" and r.origin == "http://frontend:5173"


# --- JSON export -----------------------------------------------------------------

def test_export_is_pro_only(client, auth):
    save(client, auth[0])
    r = client.get("/api/cv/export", headers=auth[0])
    assert r.status_code == 402 and r.json()["error"]["code"] == "PRO_REQUIRED"
    assert "Upgrade to Pro" in r.json()["error"]["message"]
    assert events(client, "upgrade_prompt_shown") == [("upgrade_prompt_shown", {"feature": "json_export"})]


def test_pro_export_is_json_resume_with_privacy(client, auth):
    set_plan(client, "pro")
    save(client, auth[0])
    client.patch("/api/cv/privacy", headers=auth[0], json={"privacy": "private"})
    r = client.get("/api/cv/export", headers=auth[0])
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/json")
    assert "CV.json" in r.headers["content-disposition"]
    doc = json.loads(r.content)
    assert doc["basics"] == {
        "name": "Jane Ångström", "label": "Data Analyst", "email": "jane@example.com", "phone": "+44 1",
        "summary": "Analyst with 5 years in retail data.", "location": {"address": "Leeds, UK"},
        "profiles": [{"network": "LinkedIn", "url": "linkedin.com/in/jane"}],
    }
    assert doc["work"] == [{"name": "Acme", "position": "Analyst", "startDate": "2021-04",
                            "summary": "Owned weekly sales reporting.",
                            "highlights": ["Cut report time by 40%", "Trained 6 colleagues"]}]
    assert doc["projects"] == [{"name": "Churn model", "startDate": "2022", "highlights": ["81% recall"]}]
    assert doc["education"] == [{"institution": "Leeds", "studyType": "BSc Statistics",
                                 "startDate": "2014", "endDate": "2017"}]
    assert doc["skills"] == [{"name": "SQL"}, {"name": "Python"}]
    assert doc["languages"] == [{"language": "French", "fluency": "B2"}]
    assert doc["awards"] == [{"title": "Analyst of the Year", "awarder": "Acme", "date": "2023"}]
    assert doc["interests"] == [{"name": "Chess", "keywords": ["club", "online"]}]
    assert "volunteer" not in doc
    assert doc["meta"]["cvsmith"] == {
        "privacy": "private",
        "customSections": [{"section": "Publications", "title": "Retail paper", "startDate": "2019"}],
    }
    assert events(client, "json_exported") == [("json_exported", {})]


def test_download_name_is_safe():
    assert export_service.download_name({"personal": {"name": '../Evil"<>Name'}}, "pdf") == "EvilName CV.pdf"
    assert export_service.download_name({}, "json") == "CV.json"


# --- summary suggestions use facts from the rest of the CV -------------------------

def test_new_summary_suggestion_gets_cv_facts_without_contact_details(client, auth):
    w = FakeWriter()
    client.app.dependency_overrides[get_writer] = lambda: w
    save(client, auth[0])
    client.post("/api/suggestions", headers=auth[0], json={"field": "summary", "text": ""})
    facts = w.calls[0][2]["cv_facts"]
    assert "Role (current): Analyst, Acme, 2021-04–present" in facts
    assert "Education: BSc Statistics, Leeds, 2014–2017" in facts
    assert "Skills: SQL, Python" in facts and "Certification: Tableau Desktop" in facts
    for private in ("jane@example.com", "+44 1", "linkedin"):
        assert private not in facts


def test_only_summaries_get_cv_facts():
    assert suggestion_service.cv_facts(None) == ""
    assert "Role" not in suggestion_service.cv_facts({"experience": [{"title": ""}]})
