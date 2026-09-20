import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("管理API接続", () => {
  it("店舗IDとサーバー応答をそのまま扱う", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API_BASE_URL", "https://example.test");
    const response = { success: true, ticket: { id: "actual-ticket" }, serverTime: "2026-09-19T00:00:00Z" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("./admin-api");
    expect(await api.callNext("store-2")).toEqual(response);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ storeID: "store-2" });
    await api.changeTicketState("store-2", "ticket/1", "done");
    expect(fetchMock.mock.calls[1][0]).toBe("https://example.test/admin/tickets/ticket%2F1/status");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ storeID: "store-2", newState: "done" });
  });

  it("接続先未設定では架空の成功を返さない", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API_BASE_URL", "");
    const api = await import("./admin-api");
    await expect(api.login({ email: "a@example.test", password: "test" })).rejects.toThrow("接続先");
  });

  it("店舗変更と再接続でも同期し、解除時に接続を閉じる", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API_BASE_URL", "https://example.test");
    const listeners = new Map<string, () => void>();
    const close = vi.fn();
    let connection: { onopen?: () => void };
    vi.stubGlobal("EventSource", class {
      onopen?: () => void;
      constructor(public url: string) { connection = this; }
      addEventListener(name: string, fn: () => void) { listeners.set(name, fn); }
      close = close;
    });
    const api = await import("./admin-api");
    const sync = vi.fn();
    const stop = api.subscribeTicketUpdates("store-1", sync);
    connection!.onopen!();
    listeners.get("store.updated")!();
    listeners.get("business-date.changed")!();
    listeners.get("ticket.created")!();
    expect(sync).toHaveBeenCalledTimes(4);
    stop();
    expect(close).toHaveBeenCalledOnce();
  });
});
