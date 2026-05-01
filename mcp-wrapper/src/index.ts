import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";

dotenv.config();

const app = express();
const logger = pino({ name: "mcp-wrapper" });
const port = Number(process.env.PORT ?? process.env.port ?? 8080);

app.use(cors());
app.use(express.json());
app.use(
  pinoHttp({
    logger
  })
);

app.get("/health", (_req, res) => {
  res.status(200).json({
    service: "mcp-wrapper",
    status: "ok"
  });
});

app.listen(port, () => {
  logger.info({ port }, "mcp-wrapper listening");
});
