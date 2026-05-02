# backend-agent

**FastAPI** service: **`POST /chat`** runs a **LangChain** agent (**Google Gemini**) with tools that **HTTP-call** the **mcp-wrapper** (current weather, forecast, air quality).

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| **Python** | **3.11.x** (matches `python:3.11-slim` in `Dockerfile`). |
| **pip** | Latest compatible with your Python (inside a **venv** recommended). |
| **Gemini** | `GEMINI_API_KEY` or `GOOGLE_API_KEY` (see `.env.example`). |
| **mcp-wrapper** | Must be reachable at `MCP_WRAPPER_URL` when the agent runs tools. |
| **Docker** (optional) | Docker Engine **24+**, Compose **V2**, for root `docker compose up`. |

Dependency versions resolve from **`requirements.txt`** at install time (unpinned package names). Full stack prerequisites are in the **[root `README.md`](../README.md)**.

## Stack

- FastAPI, Uvicorn  
- LangChain + `langchain-google-genai`  
- `httpx` for wrapper calls inside tools  
- Pydantic for request/response models  

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | **Yes** (startup) | Gemini API key. |
| `MCP_WRAPPER_URL` | **Yes** (startup) | Base URL of mcp-wrapper, e.g. `http://localhost:8080` or `http://mcp-wrapper:8080` in Docker. |
| `PORT` / `Port` | No | Uvicorn port (default **8000**). |
| `GEMINI_MODEL` | No | Override model name (default `gemini-2.5-flash`). |
| `CHAT_AGENT_TIMEOUT_S` | No | Max seconds for one `/chat` invoke (default **90**). |
| `CORS_ALLOW_ORIGINS` | No | Comma-separated origins; default `*`. |

Copy `.env.example` → `.env`.

## Local run

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Module layout: `app/main.py` (routes, CORS, lifespan), `app/agent.py` (Gemini + graph), `app/tools.py` (wrapper HTTP), `app/schemas.py`.

## API

### `GET /health`

Returns `{ "service": "backend-agent", "status": "ok" }`.

### `POST /chat`

**Body:**

```json
{
  "message": "What is the weather in Austin?",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello — ask me about weather." }
  ]
}
```

**Success (200):**

```json
{
  "reply": "...",
  "toolCalls": [{ "name": "get_current_weather" }],
  "toolOutputs": [{ "name": "get_current_weather", "output": "..." }]
}
```

`toolCalls` / `toolOutputs` may be omitted or empty when no tools ran.

## HTTP status & errors

See **root `README.md`** → *backend-agent (FastAPI)* for **`400`**, **`502`**, **`500`**. Validation errors use `{ "detail": ... }`.

Wrapper failures are usually surfaced **inside the tool result string** so the model can answer politely (e.g. city not found).

## Docker

Built from `backend-agent/Dockerfile`: non-root user, **`uvicorn`** on port **8000**, no `--reload`. Compose publishes **`8000:8000`** and sets `MCP_WRAPPER_URL` to the wrapper service.
