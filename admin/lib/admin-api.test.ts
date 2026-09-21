import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("管理API接続", () => {
  it("中継パスからログイン・登録・取得・設定保存を送信する", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API_BASE_URL", "/api/backend/");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("./admin-api");
    await api.login({ email: "store@example.test", password: "password" });
    const settings = { name: "店舗", openTime: "10:00", closeTime: "18:00", avgMinutesPerParty: 10, status: "open" as const };
    await api.storeRegister({ ...settings, email: "store@example.test", password: "password", counterDate: "2026-09-21", lastNumber: 0 });
    await api.getDashboard("store/id");
    await api.setStoreSettings({ ...settings, storeID: "store/id" });
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      ["/api/backend/admin/auth/login", "POST"],
      ["/api/backend/admin/stores", "POST"],
      ["/api/backend/admin/dashboard?storeID=store%2Fid", "GET"],
      ["/api/backend/admin/store/settings", "PATCH"],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ ...settings, storeID: "store/id" });
  });

  it("APIエラーの日本語メッセージを表示に渡す", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API_BASE_URL", "/api/backend");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401,
      json: async () => ({ success: false, code: "INVALID_CREDENTIALS", message: "メールアドレスまたはパスワードが違います" }) }));
    const api = await import("./admin-api");
    await expect(api.login({ email: "a@example.test", password: "test" })).rejects.toThrow("メールアドレスまたはパスワードが違います");
  });

  it("中継先停止による非JSON応答を接続エラーとして伝える", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API_BASE_URL", "/api/backend");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError(); } }));
    const api = await import("./admin-api");
    await expect(api.getDashboard("store-1")).rejects.toThrow("HTTP 502");
  });

  it("ネットワーク切断を接続エラーとして伝える", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API_BASE_URL", "/api/backend");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const api = await import("./admin-api");
    await expect(api.getDashboard("store-1")).rejects.toThrow("管理APIに接続できません");
  });

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
