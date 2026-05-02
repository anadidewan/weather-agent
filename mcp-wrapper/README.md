# mcp-wrapper

Express + TypeScript **REST** service that fronts **OpenWeather** with stable JSON shapes. The LangChain **backend-agent** calls these routes over HTTP.

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| **Node.js** | **20.x** (matches `node:20-alpine` in `Dockerfile`). |
| **Package manager** | **npm** or **pnpm** (`npm install` / `pnpm install`). |
| **TypeScript** | **5.x** (devDependency in `package.json`; patch follows `"latest"` unless you pin). |
| **OpenWeather** | API key (`OPENWEATHER_API_KEY`); required at startup. |
| **Docker** (optional) | Docker Engine **24+**, Compose **V2**, for root `docker compose up`. |

Full cross-repo prerequisites (Docker images, Python for other services) are in the **[root `README.md`](../README.md)**.

## Responsibilities

- **`GET /health`** — Liveness.
- **`GET /weather/current?city=`** — Current conditions (OpenWeather `/data/2.5/weather`, `units=imperial`). Returns a compact DTO (city, country, temperature, wind, etc.).
- **`GET /weather/forecast?city=&days=N`** — Multi-day forecast; `days` default **3**, max **5**. OpenWeather 3-hour steps are **collapsed to one row per calendar day**.
- **`GET /weather/air-quality?city=`** — Geocode city, then **`/data/2.5/air_pollution`**; returns AQI, label, and selected components.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENWEATHER_API_KEY` | **Yes** | Server exits if missing. |
| `PORT` / `port` | No | Listen port (default **8080**). |

Copy `.env.example` → `.env`.

## Local run

```bash
npm install   # or pnpm install
npm run dev   # tsx watch
# or
npm run build && npm start
```

Default URL: `http://localhost:8080`.

## Error codes (HTTP)

See the **root `README.md`** section *mcp-wrapper (Express)* for the status code table (`200`, `303`, `400`, `404`, `500`, `503`).

## Docker

Built from `mcp-wrapper/Dockerfile` (multi-stage, production `node_modules` + `dist/`). Used by root `docker-compose.yml` on port **8080**.
