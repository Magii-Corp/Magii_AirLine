/**
 * エラー → レスポンス
 *
 * 新仕様は業務エラーもHTTPステータスで表す。旧APIの「常に200」規約は廃止。
 */

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { AppError, isAppError } from "../domain/errors.js";

export function toErrorResponse(c: Context, err: unknown): Response {
  if (isAppError(err)) {
    return c.json(err.toBody(), err.status as ContentfulStatusCode);
  }

  if (err instanceof ZodError) {
    const detail = err.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    console.warn("[validation]", detail);
    const e = new AppError("INVALID_INPUT");
    return c.json(e.toBody(), e.status as ContentfulStatusCode);
  }

  // 想定外。理由はログにだけ残す。
  console.error("[unhandled]", err);
  const e = new AppError("SERVER_ERROR");
  return c.json(e.toBody(), e.status as ContentfulStatusCode);
}
