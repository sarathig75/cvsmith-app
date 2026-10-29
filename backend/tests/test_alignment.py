"""Job alignment: run, quota, preview, apply and the job-only PDF (docs/API_CONTRACT.md, "Job alignment")."""
import pytest
from sqlalchemy import select

from app.models.alignment import AlignmentRun
from app.models.cv import CV
from app.models.unmatched import UnmatchedTerm
from app.services import alignment_service
from app.services.alignment_ai import AlignmentAIError, get_alignment_ai
from app.services.ats.score import Requirements
from app.services.pdf_service import get_pdf_renderer
from tests.test_ats import GOOD_PDF, Renderer, cv_content
from tests.test_save_and_events import events
from tests.test_suggestions import set_plan

SPEC = ("We are hiring an HR Business Partner to lead people programmes across our retail business. "
        "You will use Kubernetes dashboards daily, own workforce planning, and manage a team of five.")


class FakeAI:
    def __init__(self, requirements=None, proposed="Senior Engineer · Monitoring Platform", consider=None, fail=None):
        self.requirements = requirements or Requirements(
            job_title="Lead Engineer", core_skills=["Kubernetes", "Workforce planning"],
            secondary_skills=["Terraform"], years_required=5, needs_management=True, sector="Software")
        self.proposed, self.fail = proposed, fail
        self.consider = ["A short course in workforce analytics."] if consider is None else consider
        self.specs, self.positioning_calls = [], []

    def read_spec(self, job_spec):
        self.specs.append(job_spec)
        if self.fail == "spec":
            raise AlignmentAIError
        return self.requirements

    def write_positioning(self, req, cv_facts, headline, missing):
        self.positioning_calls.append((cv_facts, headline, missing))
        if self.fail == "positioning":
            raise AlignmentAIError
        return self.proposed, self.consider


@pytest.fixture()
def ai(client):
    fake = FakeAI()
    client.app.dependency_overrides[get_alignment_ai] = lambda: fake
    return fake


@pytest.fixture()
def renderer(client):
    r = Renderer(GOOD_PDF)
    client.app.dependency_overrides[get_pdf_renderer] = lambda: r
    return r


@pytest.fixture()
def pro(client, auth, renderer):
    """A Pro user with a saved CV."""
    set_plan(client, "pro")
    assert client.patch("/api/cv", headers=auth[0], json={"content": cv_content()}).status_code == 200
    return auth[0]


def align(client, headers, spec=SPEC):
    return client.post("/api/alignment", headers=headers, json={"job_spec": spec})


def test_login_is_required(client):
    assert client.post("/api/alignment", json={"job_spec": SPEC}).status_code == 401
    assert client.get("/api/alignment/00000000-0000-0000-0000-000000000000").status_code == 401


def test_free_users_are_asked_to_upgrade_and_nothing_is_counted(client, auth, ai, renderer):
    client.patch("/api/cv", headers=auth[0], json={"content": cv_content()})
    r = align(client, auth[0])
    assert r.status_code == 402 and r.json()["error"]["code"] == "PRO_REQUIRED"
    assert ai.specs == []
    assert client.get("/api/suggestions/quota", headers=auth[0]).json()["used"] == 0


def test_a_run_returns_score_gaps_positioning_and_ideas(client, pro, ai):
    r = align(client, pro)
    assert r.status_code == 201
    body = r.json()
    assert body["requirements"]["job_title"] == "Lead Engineer" and body["requirements"]["sector"] == "Software"
    assert body["requirements"]["years_required"] == 5
    assert body["positioning"] == {"current": "Engineer", "proposed": "Senior Engineer · Monitoring Platform"}
    by_skill = {g["skill"]: g for g in body["gaps"]}
    assert by_skill["Kubernetes"]["status"] == "covered"                      # "K8s" is an alias
    assert by_skill["Workforce planning"] == {"skill": "Workforce planning", "importance": "core",
                                              "status": "missing", "by_headline": False}
    assert by_skill["Terraform"]["importance"] == "secondary"
    assert body["consider"] == ["A short course in workforce analytics."]
    assert body["score"]["framework"] == "ats-framework-v1" and 0 < body["score"]["score"] <= 100
    assert {"B1", "B2", "B3", "B5"} <= {c["id"] for c in body["score"]["checks"]}
    assert client.get(f"/api/alignment/{body['id']}", headers=pro).json() == body


def test_the_job_spec_text_is_not_stored(client, pro, ai):
    align(client, pro)
    with client.session_factory() as db:
        row = db.scalar(select(AlignmentRun))
        stored = str(row.requirements) + str(row.result)
    assert "HR Business Partner to lead" not in stored and "manage a team of five" not in stored
    assert ai.specs == [SPEC]


def test_each_run_counts_as_one_suggestion(client, pro, ai):
    before = client.get("/api/suggestions/quota", headers=pro).json()
    assert (before["plan"], before["limit"], before["used"]) == ("pro", 50, 0)
    align(client, pro)
    assert client.get("/api/suggestions/quota", headers=pro).json()["used"] == 1


def test_a_failed_ai_step_is_not_counted_or_stored(client, pro, ai):
    for step in ("spec", "positioning"):
        ai.fail = step
        r = align(client, pro)
        assert r.status_code == 503 and r.json()["error"]["code"] == "ALIGNMENT_FAILED"
    assert client.get("/api/suggestions/quota", headers=pro).json()["used"] == 0
    with client.session_factory() as db:
        assert db.scalar(select(AlignmentRun)) is None


def test_the_monthly_limit_stops_a_run_before_any_ai_call(client, pro, ai):
    with client.session_factory() as db:
        cv = db.scalar(select(CV))
        for _ in range(50):
            db.add(AlignmentRun(user_id=cv.user_id, cv_id=cv.id, requirements={}, result={}))
        db.commit()
    r = align(client, pro)
    assert r.status_code == 402 and r.json()["error"]["code"] == "QUOTA_EXCEEDED"
    assert "50" in r.json()["error"]["message"] and ai.specs == []


def test_a_job_spec_that_is_too_short_or_too_long_is_refused(client, pro, ai):
    assert align(client, pro, "Engineer wanted").status_code == 422
    assert align(client, pro, "x" * 20001).status_code == 422
    assert ai.specs == []


def test_a_user_without_a_saved_cv_is_told_to_open_the_canvas(client, auth, ai, renderer):
    set_plan(client, "pro")
    r = align(client, auth[0])
    assert r.status_code == 404 and "Canvas" in r.json()["error"]["message"]


def test_a_headline_that_names_something_not_in_the_cv_is_dropped(client, pro, ai):
    ai.proposed = "Staff Engineer at Acme Corporation"
    body = align(client, pro).json()
    assert body["positioning"] is None


def test_an_unchanged_headline_is_not_a_proposal(client, pro, ai):
    ai.proposed = "Engineer"
    assert align(client, pro).json()["positioning"] is None


def test_a_skill_in_the_proposed_headline_is_marked_addressed(client, pro, ai):
    ai.proposed = "Senior Engineer focused on workforce planning"
    body = align(client, pro).json()
    gap = next(g for g in body["gaps"] if g["skill"] == "Workforce planning")
    assert gap["status"] == "missing" and gap["by_headline"] is True


def test_unmatched_terms_are_recorded_once_per_run_without_the_user(client, pro, ai):
    ai.requirements = Requirements(job_title="Zookeeper", core_skills=["Lion taming"])
    align(client, pro)
    with client.session_factory() as db:
        terms = {(t.kind, t.term) for t in db.scalars(select(UnmatchedTerm))}
    assert ("title", "zookeeper") in terms and ("skill", "lion taming") in terms


def test_preview_scores_the_ticked_changes_without_changing_the_cv(client, pro, ai):
    run = align(client, pro).json()
    base = client.post(f"/api/alignment/{run['id']}/preview", headers=pro, json={}).json()
    assert base["score"] == run["score"]["score"]
    ticked = client.post(f"/api/alignment/{run['id']}/preview", headers=pro,
                         json={"use_headline": True, "skills": ["Workforce planning"]})
    assert ticked.status_code == 200 and ticked.json()["score"] > base["score"]
    saved = client.get("/api/cv", headers=pro).json()["content"]
    assert saved["personal"]["headline"] == "Engineer" and "Workforce planning" not in saved["skills"]


def test_preview_refuses_a_skill_that_is_not_a_gap(client, pro, ai):
    run = align(client, pro).json()
    for skills in (["Kubernetes"], ["Basket weaving"]):        # covered, and not asked for at all
        r = client.post(f"/api/alignment/{run['id']}/preview", headers=pro, json={"skills": skills})
        assert r.status_code == 422


def test_apply_updates_the_saved_cv_with_only_what_was_ticked(client, pro, ai):
    run = align(client, pro).json()
    r = client.post(f"/api/alignment/{run['id']}/apply", headers=pro,
                    json={"use_headline": True, "skills": ["Workforce planning"]})
    assert r.status_code == 200
    saved = client.get("/api/cv", headers=pro).json()["content"]
    assert saved["personal"]["headline"] == "Senior Engineer · Monitoring Platform"
    assert saved["skills"][-1] == "Workforce planning" and "Terraform" not in saved["skills"]
    assert saved["summary"] == "Engineer."                       # everything else untouched


def test_apply_with_nothing_ticked_changes_nothing(client, pro, ai):
    run = align(client, pro).json()
    before = client.get("/api/cv", headers=pro).json()["content"]
    assert client.post(f"/api/alignment/{run['id']}/apply", headers=pro, json={}).status_code == 200
    assert client.get("/api/cv", headers=pro).json()["content"] == before


def test_apply_does_not_add_a_skill_twice(client, pro, ai):
    run = align(client, pro).json()
    for _ in range(2):
        client.post(f"/api/alignment/{run['id']}/apply", headers=pro, json={"skills": ["workforce planning"]})
    skills = client.get("/api/cv", headers=pro).json()["content"]["skills"]
    assert [s.lower() for s in skills].count("workforce planning") == 1


def test_a_headline_cannot_be_applied_when_none_was_proposed(client, pro, ai):
    ai.proposed = "Engineer"
    run = align(client, pro).json()
    assert client.post(f"/api/alignment/{run['id']}/apply", headers=pro, json={"use_headline": True}).status_code == 422


def test_download_is_a_pdf_with_the_changes_and_leaves_the_base_cv_alone(client, pro, ai, renderer):
    run = align(client, pro).json()
    renderer.calls = 0
    r = client.post(f"/api/alignment/{run['id']}/download", headers=pro,
                    json={"use_headline": True, "skills": ["Workforce planning"]})
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert "Lead Engineer" in r.headers["content-disposition"] and "A B CV" in r.headers["content-disposition"]
    saved = client.get("/api/cv", headers=pro).json()["content"]
    assert saved["personal"]["headline"] == "Engineer"
    assert events(client, "pdf_downloaded") == [("pdf_downloaded", {"job_version": True})]


def test_a_failed_pdf_is_a_friendly_error_and_not_recorded(client, pro, ai):
    run = align(client, pro).json()
    client.app.dependency_overrides[get_pdf_renderer] = lambda: Renderer(fail=True)
    r = client.post(f"/api/alignment/{run['id']}/download", headers=pro, json={})
    assert r.status_code == 503 and r.json()["error"]["code"] == "PDF_FAILED"
    assert events(client, "pdf_downloaded") == []


def test_another_users_alignment_is_not_found(client, pro, ai):
    run = align(client, pro).json()
    other = {"Authorization": "Bearer " + __import__("tests.conftest", fromlist=["signup"]).signup(
        client, "other@example.com").json()["access_token"]}
    for call in (lambda: client.get(f"/api/alignment/{run['id']}", headers=other),
                 lambda: client.post(f"/api/alignment/{run['id']}/preview", headers=other, json={}),
                 lambda: client.post(f"/api/alignment/{run['id']}/apply", headers=other, json={}),
                 lambda: client.post(f"/api/alignment/{run['id']}/download", headers=other, json={})):
        assert call().status_code == 404


def test_the_run_is_funnel_tracked_and_deleting_the_cv_keeps_the_count(client, pro, ai):
    align(client, pro)
    assert events(client, "alignment_run") == [("alignment_run", {})]
    assert client.delete("/api/cv", headers=pro).status_code == 204
    assert client.get("/api/suggestions/quota", headers=pro).json()["used"] == 1


def test_deleting_the_account_deletes_the_runs(client, pro, ai):
    align(client, pro)
    assert client.request("DELETE", "/api/user", headers=pro, json={"confirm": "DELETE"}).status_code == 204
    with client.session_factory() as db:
        assert db.scalar(select(AlignmentRun)) is None


def test_job_file_names_are_safe():
    assert alignment_service.job_file_name({"personal": {"name": "Jane Doe"}}, "HR Business Partner") == \
        "Jane Doe CV - HR Business Partner.pdf"
    assert alignment_service.job_file_name({}, "") == "CV.pdf"
    assert "/" not in alignment_service.job_file_name({"personal": {"name": "A/B"}}, "../../etc")
