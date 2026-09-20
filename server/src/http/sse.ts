/**
 * SSE のストリーム処理
 *
 * ヘッダの X-Accel-Buffering: no は nginx 等のリバースプロキシが
 * レスポンスをバッファして SSE が届かなくなるのを防ぐため。
 *
 * retry: を最初に送ることで EventSource の再接続間隔を指定する。
 * イベントの再送（Last-Event-ID）は実装しない。仕様がフロントに
 * 「updated_atの大小だけでイベントをマージせず、整合したスナップショットを
 * 再取得する」と指示しているため、イベントログを持つ価値がない。
 */

import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { SSEStreamingApi } from "hono/streaming";
import { env } from "../config/env.js";
import type { SseConn } from "../realtime/registry.js";
import { register, unregister } from "../realtime/registry.js";

let seq = 0;

export interface SseOptions {
  kind: SseConn["kind"];
  storeID: string;
  ticketID?: string | undefined;
  accountID?: string | undefined;
  businessDate?: string | undefined;
  /** 接続直後に送るイベント */
  onOpen?: (conn: SseConn) => Promise<void> | void;
}

export function openSseStream(c: Context, options: SseOptions): Response {
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    const conn = createConn(stream, options);
    register(conn);

    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      unregister(conn);
    };
    stream.onAbort(finish);

    try {
      await stream.write("retry: 3000\n\n");
      await options.onOpen?.(conn);

      // ハートビート。コメント行なので EventSource のイベントにはならない。
      while (!closed && !stream.aborted && !stream.closed) {
        await stream.sleep(env.SSE_HEARTBEAT_MS);
        if (closed || stream.aborted || stream.closed) break;
        await stream.write(": hb\n\n");
      }
    } catch {
      // 切断は正常系。ログを汚さない。
    } finally {
      finish();
    }
  });
}

function createConn(stream: SSEStreamingApi, options: SseOptions): SseConn {
  // 書き込みが重ならないように直列化する
  let chain: Promise<void> = Promise.resolve();

  return {
    id: `sse-${++seq}`,
    kind: options.kind,
    storeID: options.storeID,
    ticketID: options.ticketID,
    accountID: options.accountID,
    businessDate: options.businessDate,
    send(event: string, data: unknown) {
      chain = chain
        .then(async () => {
          if (stream.aborted || stream.closed) return;
          await stream.writeSSE({ event, data: JSON.stringify(data) });
        })
        .catch(() => {
          // 切断済みの接続への書き込み失敗は無視する
        });
    },
  };
}
