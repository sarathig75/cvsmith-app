"""PDF download: the Classic template rendered by headless Chromium.

The template exists once, in the frontend (CvTemplate.tsx/.css). The frontend's `print.html`
page renders it for one CV passed in `window.__CVSMITH_DRAFT__`; Chromium opens that page and
prints it to A4. The PDF keeps real, selectable text in one column (ATS-readable).
"""
import json
import logging
from typing import Any, Dict, Optional, Protocol
from urllib.parse import urlsplit

from app.config import get_settings

logger = logging.getLogger("cvsmith.pdf")

RENDER_TIMEOUT_MS = 20000


class PdfError(Exception):
    """The PDF could not be made; nothing was recorded."""


class PdfRenderer(Protocol):
    def render(self, draft: Dict[str, Any]) -> bytes: ...


class ChromiumPdfRenderer:
    def __init__(self, template_url: Optional[str] = None, chromium_path: Optional[str] = None):
        settings = get_settings()
        base = (template_url or settings.PDF_TEMPLATE_URL or settings.FRONTEND_URL).rstrip("/")
        self.url = f"{base}/print.html"
        self.origin = "{0.scheme}://{0.netloc}".format(urlsplit(self.url))
        self.chromium_path = chromium_path or settings.PDF_CHROMIUM_PATH or None

    def render(self, draft: Dict[str, Any]) -> bytes:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright

        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(executable_path=self.chromium_path)
                try:
                    page = browser.new_page()
                    # Only the template's own files may load: CV text must not reach any other host.
                    page.route("**/*", lambda route: route.continue_()
                               if route.request.url.startswith(self.origin) else route.abort())
                    page.add_init_script(f"window.__CVSMITH_DRAFT__ = {json.dumps(draft)};")
                    page.goto(self.url, timeout=RENDER_TIMEOUT_MS)
                    page.wait_for_selector("[data-print-ready]", state="attached", timeout=RENDER_TIMEOUT_MS)
                    return page.pdf(format="A4", print_background=True, prefer_css_page_size=True)
                finally:
                    browser.close()
        except PlaywrightError as exc:
            logger.error("PDF rendering failed (%s): %s", self.url, str(exc).splitlines()[0])
            raise PdfError from exc


def get_pdf_renderer() -> PdfRenderer:
    return ChromiumPdfRenderer()
