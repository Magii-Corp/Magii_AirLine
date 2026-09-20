/**
 * Hono アプリ
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import { env } from "./config/env.js";
import { toErrorResponse } from "./http/error-handler.js";
import { adminRoutes } from "./routes/admin/index.js";
import { customerRoutes } from "./routes/customer/index.js";
import { pool } from "./db/pool.js";
import { isListening } from "./db/listen.js";
import { stats } from "./realtime/registry.js";

/**
 * 管理APIの認証フック。
 *
 * 仕様どおり現状は素通しにしている。ただし storeID は顧客向けQRコードの
 * 中身そのもので、更新系エンドポイントは storeID しか要求しないため、
 * QRを読んだ客が call-next を直接叩いて待ち列を空にできる。
 * 公開前にここでトークン検証を行うこと。
 */
const adminAuth: MiddlewareHandler = async (_c, next) => {
  await next();
};

export function createApp(): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: env.corsOrigins,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  app.onError((err, c) => toErrorResponse(c, err));

  app.notFound((c) =>
    c.json(
      {
        success: false as const,
        code: "NOT_FOUND",
        message: "エンドポイントが見つかりません",
      },
      404
    )
  );

  app.get("/health", async (c) => {
    let db: "up" | "down" = "down";
    try {
      await pool.query("select 1");
      db = "up";
    } catch {
      db = "down";
    }

    return c.json({
      ok: db === "up",
      db,
      listen: isListening() ? "up" : "down",
      sse: stats(),
    });
  });

  app.use("/admin/*", adminAuth);
  app.route("/admin", adminRoutes);
  app.route("/customer", customerRoutes);

  return app;
}
