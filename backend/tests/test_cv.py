from app.models.cv import CV
from tests.conftest import DOCX_MIME, PDF_MIME, make_docx, make_pdf, signup


def upload(client, headers, name, data, mime):
    return client.post(
        "/api/cv/upload", headers=headers, files={"file": (name, data, mime)}
    )


def test_cv_endpoints_require_auth(client):
    assert client.get("/api/cv").status_code == 401
    r = client.post("/api/cv/upload", files={"file": ("a.pdf", make_pdf(), PDF_MIME)})
    assert r.status_code == 401


def test_get_cv_404_then_200_after_upload(client, auth):
    headers, _ = auth
    r = client.get("/api/cv", headers=headers)
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"

    up = upload(client, headers, "My Resume.pdf", make_pdf(), PDF_MIME)
    assert up.status_code == 201
    got = client.get("/api/cv", headers=headers)
    assert got.status_code == 200
    body = got.json()
    assert body == up.json()
    assert set(body) == {
        "id", "title", "privacy", "parsing_status", "parsing_error", "parsing_parts", "json_resume", "created_at"
    }
    assert body["parsing_error"] is None and body["json_resume"] == {}
    assert body["parsing_status"] == "pending"
    assert body["privacy"] == "public"
    assert body["title"] == "My Resume"


def test_upload_valid_docx(client, auth):
    r = upload(client, auth[0], "cv.docx", make_docx(), DOCX_MIME)
    assert r.status_code == 201 and r.json()["parsing_status"] == "pending"


def test_upload_stores_file_with_server_generated_name(client, auth):
    headers, body = auth
    r = upload(client, headers, "../../etc/evil name.pdf", make_pdf(), PDF_MIME)
    assert r.status_code == 201
    user_dir = client.upload_dir / body["user"]["id"]
    files = list(user_dir.iterdir())
    assert len(files) == 1
    assert files[0].suffix == ".pdf" and "evil" not in files[0].name
    assert "/" not in r.json()["title"] and ".." not in r.json()["title"]


def test_upload_replaces_existing_cv_and_removes_old_file(client, auth):
    headers, body = auth
    first = upload(client, headers, "a.pdf", make_pdf(), PDF_MIME).json()
    second = upload(client, headers, "b.docx", make_docx(), DOCX_MIME).json()
    assert first["id"] == second["id"]
    with client.session_factory() as db:
        assert db.query(CV).count() == 1
    files = list((client.upload_dir / body["user"]["id"]).iterdir())
    assert len(files) == 1 and files[0].suffix == ".docx"


def test_upload_wrong_extension(client, auth):
    r = upload(client, auth[0], "notes.txt", b"hello", "text/plain")
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


def test_upload_wrong_content_type(client, auth):
    r = upload(client, auth[0], "cv.pdf", make_pdf(), "text/plain")
    assert r.status_code == 415


def test_upload_magic_bytes_mismatch(client, auth):
    r = upload(client, auth[0], "fake.pdf", b"MZ not a pdf at all", PDF_MIME)
    assert r.status_code == 415
    # a PDF renamed .docx, and a zip that is not a docx
    assert upload(client, auth[0], "x.docx", make_pdf(), DOCX_MIME).status_code == 415
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("other.txt", "x")
    assert upload(client, auth[0], "y.docx", buf.getvalue(), DOCX_MIME).status_code == 415


def test_upload_oversize(client, auth):
    big = make_pdf(10 * 1024 * 1024)
    r = upload(client, auth[0], "big.pdf", big, PDF_MIME)
    assert r.status_code == 413 and r.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_upload_at_limit_is_accepted(client, auth):
    data = make_pdf()
    data = data + b"0" * (10 * 1024 * 1024 - len(data))
    assert len(data) == 10 * 1024 * 1024
    assert upload(client, auth[0], "edge.pdf", data, PDF_MIME).status_code == 201


def test_cvs_are_isolated_between_users(client, auth):
    upload(client, auth[0], "a.pdf", make_pdf(), PDF_MIME)
    other = signup(client, "other@example.com").json()
    h2 = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get("/api/cv", headers=h2).status_code == 404
