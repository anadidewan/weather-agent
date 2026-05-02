"""FastAPI app: health, CORS, and LangChain /chat backed by Gemini + mcp-wrapper tools."""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agent import assert_gemini_configured, create_weather_agent, run_chat
from app.schemas import ChatRequest, ChatResponse

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("backend-agent")

CHAT_AGENT_TIMEOUT_S = float(os.getenv("CHAT_AGENT_TIMEOUT_S", "90"))


def _truncate_for_log(text: str, max_len: int = 200) -> str:
    text = text.replace("\n", " ").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        assert_gemini_configured()
    except RuntimeError as exc:
        logger.critical("%s", exc)
        sys.exit(1)

    try:
        app.state.weather_agent = create_weather_agent()
    except Exception:
        logger.exception("Failed to compile weather agent at startup")
        sys.exit(1)

    port = os.getenv("PORT") or os.getenv("Port") or "8000"
    logger.info("backend-agent ready on port %s", port)
    yield
    logger.info("backend-agent shutting down")


app = FastAPI(title="backend-agent", version="0.1.0", lifespan=lifespan)

_origins = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Same encoding as FastAPI's built-in handler (422): never pass raw exc.errors()
    # into JSONResponse — Pydantic can embed non-JSON-serializable objects in ctx.
    detail = jsonable_encoder(exc.errors())
    logger.debug(
        "chat_error_400 type=RequestValidationError path=%s error_count=%s",
        request.url.path,
        len(detail),
    )
    return JSONResponse(status_code=400, content={"detail": detail})


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"service": "backend-agent", "status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    agent: Any = getattr(app.state, "weather_agent", None)
    if agent is None:
        logger.error("chat_error_500 type=AgentMissing agent not initialized")
        raise HTTPException(status_code=500, detail="Agent not initialized")

    preview = _truncate_for_log(request.message)
    logger.info("/chat user_message_preview=%r", preview)

    try:
        reply_text, tool_names = await asyncio.wait_for(
            run_chat(
                agent,
                user_message=request.message,
                history=request.history,
            ),
            timeout=CHAT_AGENT_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "chat_error_502 type=AgentTimeout after=%ss",
            CHAT_AGENT_TIMEOUT_S,
        )
        logger.debug(
            "chat_error_502 detail=agent_did_not_finish user_message_preview=%r",
            preview,
        )
        raise HTTPException(
            status_code=502,
            detail="The assistant took too long to respond. Please try again.",
        ) from None
    except HTTPException:
        raise
    except Exception as exc:
        exc_type = type(exc).__name__
        msg = str(exc).lower()
        # Heuristic: model / Google transient failures → 502
        if any(
            s in msg
            for s in (
                "503",
                "502",
                "unavailable",
                "overloaded",
                "deadline",
                "timeout",
                "resource exhausted",
                "429",
            )
        ):
            logger.warning("chat_error_502 type=%s", exc_type)
            logger.debug("chat_error_502 detail=%s", exc_type, exc_info=True)
            raise HTTPException(
                status_code=502,
                detail="Upstream model or weather service is temporarily unavailable.",
            ) from exc

        logger.exception("chat_error_500 type=%s", exc_type)
        logger.debug("chat_error_500 detail=%s", exc_type, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Unexpected error while processing chat.",
        ) from exc

    logger.info("/chat success reply_preview=%r tools=%s", _truncate_for_log(reply_text), tool_names)
    tool_calls = [{"name": name} for name in tool_names]
    return ChatResponse(reply=reply_text, toolCalls=tool_calls)
