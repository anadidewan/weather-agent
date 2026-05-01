import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import pino from "pino";
import { pinoHttp } from "pino-http";
import weatherRouter from "./routes/weather.js";

dotenv.config();

const app = express();
const logger = pino({
  name: "mcp-wrapper",
  redact: ["req.headers.authorization", "req.headers.x-api-key"]
});
const port = Number(process.env.PORT ?? process.env.port ?? 8080);
const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

if (!openWeatherApiKey) {
  logger.error("Missing OPENWEATHER_API_KEY. Refusing to start.");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    customSuccessMessage: (req: Request) => `${req.method} ${req.url} completed`,
    customErrorMessage: (req: Request) => `${req.method} ${req.url} failed`
  })
);

app.get("/health", (_req, res) => {
  res.status(200).json({
    service: "mcp-wrapper",
    status: "ok"
  });
});

app.use("/weather", weatherRouter);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (typeof err === "object" && err !== null && "status" in err && "message" in err) {
    const status = Number((err as { status: number }).status);
    const message = String((err as { message: string }).message);
    res.status(status).json({ error: message });
    return;
  }

  logger.error({ err }, "Unhandled server error");
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  logger.info({ port }, "mcp-wrapper listening");
});
