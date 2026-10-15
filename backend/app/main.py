import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.routes import auth, cv, suggestions, user
from app.utils.errors import AppError, error_body

logger = logging.getLogger("cvsmith")


def _validation_message(exc: RequestValidationError) -> str:
    # Only field location and rule text; never echo submitted values.
    parts = []
    for err in exc.errors()[:3]:
        loc = ".".join(str(p) for p in err["loc"] if p not in ("body", "query"))
        msg = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
        parts.append(f"{loc}: {msg}" if loc else msg)
    return "; ".join(parts) or "Invalid request."


def create_app() -> FastAPI:
    settings = get_settings()
    settings.validate_for_startup()
    logging.basicConfig(level=settings.LOG_LEVEL)

    # The interactive API docs are for development only.
    docs = settings.is_development
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # The browser may read the download's file name only if it is exposed.
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(
            error_body(exc.code, exc.message), status_code=exc.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        return JSONResponse(
            error_body("VALIDATION_ERROR", _validation_message(exc)), status_code=422
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        codes = {401: "UNAUTHORIZED", 404: "NOT_FOUND", 500: "SERVER_ERROR"}
        code = codes.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(
            error_body(code, str(exc.detail)),
            status_code=exc.status_code,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        logger.error("Unhandled error", exc_info=exc)
        return JSONResponse(
            error_body("SERVER_ERROR", "Something went wrong."), status_code=500
        )

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(user.router)
    app.include_router(cv.router)
    app.include_router(suggestions.router)
    return app


app = create_app()
