// Vercel serverless entry: every /api/* route lands here and is handed to
// the same Fastify app that `npm run dev:api` serves locally.
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../server/app.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await app.ready();
  app.server.emit("request", req, res);
}
