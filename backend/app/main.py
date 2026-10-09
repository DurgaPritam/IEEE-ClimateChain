"""FastAPI entry point: `uvicorn app.main:app --reload` from backend/."""

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from app import demo  # noqa: E402
from app.api.routes import router  # noqa: E402
from app.service import ServiceError, VerdantService  # noqa: E402

STATUS = {"not_found": 404, "already_anchored": 409, "bad_state": 409}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.service = demo.seed(VerdantService())
    yield


app = FastAPI(title="VERDANT-X API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api")


@app.exception_handler(ServiceError)
async def service_error(_: Request, e: ServiceError):
    code = 409 if e.code.startswith("chain:") else STATUS.get(e.code, 400)
    return JSONResponse(status_code=code, content={"code": e.code, "message": str(e), "detail": e.detail})
