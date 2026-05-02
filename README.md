# Weather Agent

A small full-stack system for **weather and air-quality Q&A**: a TypeScript **REST wrapper** around OpenWeather, a **FastAPI + LangChain + Google Gemini** agent that decides when to call the wrapper, and a **React + Vite** chat UI. This repo is set up for **local development** and **local Docker Compose** (no cloud deployment assumed).

---

## Prerequisites

### Tooling (local development)

Use versions **at or near** what the Dockerfiles use so your machine matches the images.

| Runtime / tool | Version | Notes |
|----------------|---------|--------|
| **Node.js** | **20.x** (LTS) | Builds and runs **mcp-wrapper** and **frontend**; base image is `node:20-alpine` in both `Dockerfile`s. |
| **Python** | **3.11.x** | **backend-agent**; base image is `python:3.11-slim` in `backend-agent/Dockerfile`. A virtual environment is recommended. |
| **Package manager** | **npm** or **pnpm** | Install per service (`npm install` / `pnpm install`). Exact lockfiles may differ. |
| **TypeScript** | **5.x** (devDependency) | Declared as `"latest"` in service `package.json`; run `npm ls typescript` after install if you need the exact patch. |

### Tooling (Docker path)

| Tool | Version | Notes |
|------|---------|--------|
| **Docker Engine** | **24+** recommended | Needs multi-stage builds and a modern BuildKit experience. |
| **Docker Compose** | **V2** (`docker compose` plugin) | This repo uses Compose **spec v2** syntax (not legacy standalone `docker-compose` v1). |

### Container base images (reference)

| Image | Used for |
|-------|----------|
| `node:20-alpine` | **mcp-wrapper** build + runtime; **frontend** build stage. |
| `nginx:alpine` | **frontend** runtime (static files + SPA fallback). |
| `python:3.11-slim` | **backend-agent** (Uvicorn). |

Application **libraries** (FastAPI, Vite, React, LangChain, etc.) resolve from `requirements.txt` / `package.json` at install time; the **Node / Python** versions above are the supported runtime contract.

### Accounts / secrets

- **OpenWeather** API key (required by **mcp-wrapper**).
- **Google Gemini** API key (required by **backend-agent**, or `GOOGLE_API_KEY` per integration docs).

---

## What’s in the repo

| Component | Tech | Responsibility |
|-----------|------|----------------|
| **mcp-wrapper** | Node.js 20, Express, TypeScript | Thin REST facade over OpenWeather: current weather, forecast (collapsed by day), air quality (geo + pollution). |
| **backend-agent** | Python 3.11, FastAPI, LangChain, Gemini | `/chat` endpoint: LLM + tools that HTTP-call the wrapper. |
| **frontend** | React, TypeScript, Vite, Tailwind | Single-page chat: thread, input, loading state, tool hints. |

---

## End-to-end workflows

### 1. Local development (no Docker)

Typical flow: run **three processes** (wrapper → agent → UI), each with its own `.env` (or a single mental model: wrapper `8080`, agent `8000`, UI `3000`).

1. **mcp-wrapper** — serves OpenWeather-backed routes and `/health`.
2. **backend-agent** — loads `MCP_WRAPPER_URL` pointing at the wrapper (e.g. `http://localhost:8080`), loads Gemini key, exposes `/health` and `POST /chat`.
3. **frontend** — `VITE_AGENT_BACKEND_URL` must be where the **browser** reaches the API (e.g. `http://localhost:8000`), then `pnpm dev` (or `npm run dev`).

See service READMEs under `mcp-wrapper/`, `backend-agent/`, and `frontend/` for exact commands.

### 2. Local Docker Compose

From the **repository root**:

```bash
cp .env.example .env
# Edit .env: OPENWEATHER_API_KEY, GEMINI_API_KEY, VITE_AGENT_BACKEND_URL
docker compose up --build
```

- **Browser → frontend** at `http://localhost:3000` (nginx serves the built SPA).
- **Browser → backend** at `http://localhost:8000` (must match `VITE_AGENT_BACKEND_URL` baked into the frontend **at image build time**).
- **Backend → wrapper** inside Docker network: `http://mcp-wrapper:8080` (set in `docker-compose.yml`, not what the browser uses).

Rebuild the **frontend** image after changing `VITE_AGENT_BACKEND_URL`.

### 3. Example: “What’s the weather in Austin?”

This walks through **one successful path** (current conditions).

1. **User** types e.g. *“What’s the weather in Austin?”* in the UI and sends.
2. **Frontend** `POST`s to `{VITE_AGENT_BACKEND_URL}/chat` with JSON `{ "message": "...", "history": [...] }` (history optional).
3. **backend-agent** validates the body, logs a **truncated** preview of the message (no secrets), and runs the **LangGraph agent** (Gemini + tools).
4. **Gemini** chooses the **`get_current_weather`** tool with an argument like `city="Austin"` (or “Austin, TX” depending on the model).
5. That tool performs **`GET {MCP_WRAPPER_URL}/weather/current?city=...`** (HTTP client with timeout).
6. **mcp-wrapper** calls OpenWeather **`/data/2.5/weather`** with `units=imperial`, maps the JSON to a **small stable shape** (temperature, conditions, wind, etc.), returns **200** + JSON.
7. The tool result string goes back into the agent loop; **Gemini** turns it into a short natural-language answer.
8. **backend-agent** returns `{ "reply": "...", "toolCalls": [...], "toolOutputs": [...] }` (tool metadata for UI/debug).
9. **Frontend** shows the assistant message; optional console logs for tools if enabled in `src/api/chat.ts`.

If the city is unknown upstream, the wrapper signals **not found**; tools translate that into guidance so the model can tell the user to fix spelling or try another city (see error tables below).

---

## Ports (defaults)

| Port | Service | Notes |
|------|---------|--------|
| `8080` | mcp-wrapper | HTTP API |
| `8000` | backend-agent | FastAPI |
| `3000` | frontend (Docker) | Maps to nginx **80** inside the container |

---

## Environment variables (conceptual)

| Variable | Where | Purpose |
|----------|--------|---------|
| `OPENWEATHER_API_KEY` | mcp-wrapper | Required to start; OpenWeather API auth. |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | backend-agent | Gemini API auth. |
| `MCP_WRAPPER_URL` | backend-agent | Base URL for the wrapper (localhost in dev, `http://mcp-wrapper:8080` in Compose). |
| `VITE_AGENT_BACKEND_URL` | frontend **build** | Browser-facing backend URL (e.g. `http://localhost:8000`). |

Root **`.env.example`** is intended for **Docker Compose** at the repo root. Per-service `.env.example` files still document dev-only overrides.

---

## HTTP status & error behavior (reference)

### mcp-wrapper (Express)

| Status | When | Response shape |
|--------|------|----------------|
| **200** | Success for `/health` or weather routes | JSON payload (clean DTOs, not raw OpenWeather). |
| **303** | City not resolved by OpenWeather (mapped from upstream 404 / not found) | `{ "error": "City not found" }` (message text may vary slightly). |
| **400** | Missing/invalid `city`, or invalid `days` on forecast | `{ "error": "<message>" }`. |
| **404** | Unknown Express route | `{ "error": "Route not found" }`. |
| **500** | Unhandled error | `{ "error": "Internal server error" }`. |
| **503** | OpenWeather returned **5xx** (treated as upstream outage) | `{ "error": "OpenWeather service unavailable" }` (via `AppError` mapping). |

If `OPENWEATHER_API_KEY` is missing at startup, the process **exits** (no HTTP).

### backend-agent (FastAPI)

| Status | When | Notes |
|--------|------|--------|
| **200** | `GET /health`, successful `POST /chat` | Chat body includes `reply`; may include `toolCalls` / `toolOutputs`. |
| **400** | Request validation failed (e.g. empty/whitespace `message`) | `{ "detail": [ ... ] }` (Pydantic validation errors; encoded safely for JSON). |
| **502** | Agent invoke **timeout** (`CHAT_AGENT_TIMEOUT_S`), or heuristic match on transient upstream/Gemini errors | Human-readable `detail` string. |
| **500** | Unexpected failure, or agent missing from app state | Human-readable `detail` string. |

Tools map wrapper HTTP failures into **text** returned to the model (so the user often sees a polite explanation instead of a raw stack trace).

### frontend (browser)

The UI catches failed `fetch` / non-OK responses and shows a **generic apology** in-thread; open **DevTools → Console** if you enabled logging in `src/api/chat.ts` for tool debugging.

---

## Docker Compose quick reference

```bash
docker compose up --build    # start
docker compose down          # stop
```

- **Depends on**: `backend-agent` starts after `mcp-wrapper`; `frontend` after `backend-agent` (order only—wait for health in production if you extend this).
- **Network**: services resolve each other by **service name** on `app-network`.

---

## Project layout (high level)

```
mcp-wrapper/     # Express TS service + OpenWeather client
backend-agent/   # FastAPI + LangChain agent + httpx tools
frontend/        # Vite React SPA
docker-compose.yml
.env.example
```

---

## Further reading

- **`mcp-wrapper/README.md`** — wrapper routes and local run.
- **`backend-agent/README.md`** — `/chat`, tools, env, uvicorn.
- **`frontend/README.md`** — build, env, UI behavior.

---

## Submission note — InMarket (AI Builder role)

This project was built as a **portfolio submission** for the **InMarket AI Builder** role.

**Time invested:** approximately **20–25 hours** end-to-end, including initial scaffolding, OpenWeather integration, LangChain + Gemini tooling, the chat frontend, error-handling passes, Docker packaging, and documentation. (Your mileage may vary; treat this as an honest order-of-magnitude.)

**Why this project stands out**

- **Full vertical slice:** three independently runnable services with clear boundaries (data API vs LLM orchestration vs UX), not a single monolithic script.
- **Real external APIs:** OpenWeather and Gemini, with explicit env contracts and failure modes documented above.
- **Agent design:** LangChain **tools** map 1:1 to REST operations the backend can explain and observe (`toolCalls` / `toolOutputs` for transparency).
- **Operational realism:** Docker Compose for **local** deployment, non-root backend container, multi-stage frontend build, and a single root `.env.example` story for contributors.

---

*Questions or improvements welcome—this README is the living overview; service READMEs carry component-specific detail.*
