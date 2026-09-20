/**
 * 開発用 HTTP エントリポイント
 *
 * functions/ の各関数を HTTP に配線するだけの薄い層。
 * 追加依存を増やさないため Node 組み込みの http を使う。
 *
 * NOTE: 設計メモの方針で操作系は成否をボディの success で表すため、
 * 業務的な失敗でも HTTP は 200 を返す。500 はサーバ側の想定外エラーのみ。
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  getTickets,
  login,
  adminRegister,
  callNext,
  getEvent,
  resetEvent,
  changeTicketState,
  finishTicket,
  changeAvgMinutesPerParty,
  changeOpenTime,
  changeCloseTime,
  changeStoreState,
  register,
  guestLogin,
  createTicket,
  getMyTicket,
  cancelTicket,
  arrive,
  getStore,
} from "./functions/index.js";

const PORT = Number(process.env.PORT ?? 8787);

function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};

  return JSON.parse(raw);
}

/** クエリはそのまま渡す。検証は各関数の zod に任せる */
function queryOf(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

/** GET 系: クエリを渡して結果をそのまま返す */
type GetHandler = (query: Record<string, string>) => Promise<unknown>;

const GET_ROUTES: Record<string, GetHandler> = {
  "/admin/getTickets": getTickets,
  "/admin/getEvent": getEvent,
  "/guest/getMyTicket": getMyTicket,
  "/guest/getStore": getStore,
};

/** POST 系: ボディを読んで関数に渡し、結果をそのまま返す */
type PostHandler = (body: unknown) => Promise<unknown>;

const POST_ROUTES: Record<string, PostHandler> = {
  "/admin/login": login,
  "/admin/register": adminRegister,
  "/admin/callNext": callNext,
  "/admin/resetEvent": resetEvent,
  "/admin/changeTicketState": changeTicketState,
  "/admin/finishTicket": finishTicket,
  "/admin/changeAvgMinutesPerParty": changeAvgMinutesPerParty,
  "/admin/changeOpenTime": changeOpenTime,
  "/admin/changeCloseTime": changeCloseTime,
  "/admin/changeStoreState": changeStoreState,
  "/guest/register": register,
  "/guest/login": guestLogin,
  "/guest/createTicket": createTicket,
  "/guest/cancelTicket": cancelTicket,
  "/guest/arrive": arrive,
};

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`
  );
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method ?? "GET";

  // ヘルスチェック（DB に触らないので疎通確認に使える）
  if (method === "GET" && path === "/health") {
    send(res, 200, { ok: true });
    return;
  }

  if (method === "GET") {
    const handler = GET_ROUTES[path];
    if (handler) {
      send(res, 200, await handler(queryOf(url)));
      return;
    }
  }

  if (method === "POST") {
    const handler = POST_ROUTES[path];
    if (handler) {
      send(res, 200, await handler(await readJsonBody(req)));
      return;
    }
  }

  send(res, 404, { success: false });
}

const server = createServer((req, res) => {
  route(req, res).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[server] ${message}`);
    // JSON パース失敗は入力不正なので success:false の 200 に寄せる
    send(res, err instanceof SyntaxError ? 200 : 500, { success: false });
  });
});

server.listen(PORT, () => {
  console.log(`listening on http://127.0.0.1:${PORT}`);
  if (!process.env.SUPABASE_SECRET_KEY) {
    console.warn(
      "WARNING: SUPABASE_SECRET_KEY が未設定です。全エンドポイントが success:false を返します。"
    );
  }
});
