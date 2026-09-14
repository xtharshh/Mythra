// Vercel serverless entry: every /api/* route lands here and is handed to
// the same Fastify app that `npm run dev:api` serves locally.
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../server/app.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await app.ready();
    app.server.emit("request", req, res);
  } catch (e) {
    const message = e instanceof Error ? e.message : "API crashed on boot";
    console.error(`API handler failed: ${message}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: message }));
    }
  }
}
