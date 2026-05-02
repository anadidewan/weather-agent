# frontend

React + TypeScript + **Vite** single-page **chat** UI (Tailwind). The browser calls **`POST /chat`** on the **backend-agent**; no API keys are stored in the client bundle except what you bake into **build-time** `import.meta.env` (see below).

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| **Node.js** | **20.x** (matches `node:20-alpine` in `Dockerfile` build stage). |
| **Package manager** | **npm** or **pnpm** (`npm install` / `pnpm install`). |
| **TypeScript** | **5.x** (devDependency; patch from `"latest"` in `package.json` unless pinned). |
| **Backend URL** | Set **`VITE_AGENT_BACKEND_URL`** to where the **browser** reaches FastAPI (e.g. `http://localhost:8000`). |
| **Docker** (optional) | Build uses Node **20** + **nginx:alpine** runtime; Docker Engine **24+**, Compose **V2**. |

Full stack prerequisites are in the **[root `README.md`](../README.md)**.

## Configuration

| Variable | When | Description |
|----------|------|-------------|
| `VITE_AGENT_BACKEND_URL` | **Build time** (Vite) | Full origin the **browser** uses to reach FastAPI, e.g. `http://localhost:8000`. Must be **reachable from the user’s machine**, not a Docker-only hostname like `backend-agent` unless you publish DNS that resolves it. |

Copy `.env.example` → `.env` in this folder for local dev. For **Docker**, the same variable is passed as a **build arg** from root `docker-compose.yml` (rebuild the image after changes).

## Local run

```bash
npm install   # or pnpm install
npm run dev   # http://localhost:3000
```

## Behavior (summary)

- **Chat thread** scrolls; **user** messages align right, **assistant** left.
- **Send:** button or **Ctrl/Cmd + Enter**.
- **Loading:** “thinking” style indicator while waiting for `/chat`.
- **Errors:** non-OK responses show a short apology in the thread; optional **`console.log`** for tool metadata in `src/api/chat.ts` (see source).

## Error handling (client)

The UI does not decode every HTTP status separately; failed requests show a generic sorry message. For exact codes (`400`, `502`, `500`), see **root `README.md`** → *backend-agent (FastAPI)*.

## Docker

Built from `frontend/Dockerfile`: Vite build stage + **nginx** serving `dist/` with SPA fallback (`nginx.conf`). Published at **`http://localhost:3000`** in Compose (container port **80**).
