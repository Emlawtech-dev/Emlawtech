import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { HttpError, sendJson } from "./http.js";

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

export function createApp(): Server {
  const routes = new Map<string, Handler>([
    ["GET /health", (_req, res) => sendJson(res, 200, { status: "ok" })],
  ]);

  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      const handler = routes.get(`${req.method} ${path}`);
      if (!handler) {
        throw new HttpError(404, "not_found", "Route not found");
      }
      await handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } });
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: { code: "internal_error", message: "Something went wrong" } });
    }
  });
}
