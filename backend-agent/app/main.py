import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("backend-agent")

app = FastAPI(title="backend-agent", version="0.1.0")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"service": "backend-agent", "status": "ok"}


@app.on_event("startup")
async def on_startup() -> None:
    port = os.getenv("PORT") or os.getenv("Port") or "8000"
    logger.info("backend-agent starting on port %s", port)
