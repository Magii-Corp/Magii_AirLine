/**
 * 店舗の受付状態ステートマシンの統合テスト
 *
 * 境界計算と追いつきの実体は Postgres 関数なので、TypeScript 側に
 * 写しを作らず実DBに対して検証する。写しを作るとロジックが二重化し、
 * 片方だけ直して食い違う事故が起きる。
 *
 * DATABASE_URL が無い環境では丸ごとスキップする。
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb("境界計算 (store_next_boundary / store_prev_boundary)", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  /** JST の時刻を渡して、返ってきた境界を JST の文字列で受け取る */
  async function nextBoundary(open: string, close: string, afterJst: string) {
    const res = await client.query<{ at: string; st: string }>(
      `select to_char(switch_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI') as at,
              switch_status as st
         from public.store_next_boundary($1, $2, $3::timestamptz)`,
      [open, close, afterJst]
    );
    return res.rows[0]!;
  }

  async function prevBoundary(open: string, close: string, atJst: string) {
    const res = await client.query<{ at: string; st: string }>(
      `select to_char(switch_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI') as at,
              switch_status as st
         from public.store_prev_boundary($1, $2, $3::timestamptz)`,
      [open, close, atJst]
    );
    return res.rows[0]!;
  }

  // 仕様の worked example（openTime=10:00、closeTime=18:00）
  describe("仕様の例: openTime=10:00 closeTime=18:00", () => {
    it("08:00に手動変更 -> 次の境界は当日10:00のopen", async () => {
      const b = await nextBoundary("10:00", "18:00", "2026-09-20 08:00:00+09");
      expect(b).toEqual({ at: "2026-09-20 10:00", st: "open" });
    });

    it("12:00に手動変更 -> 次の境界は当日18:00のclosed", async () => {
      const b = await nextBoundary("10:00", "18:00", "2026-09-20 12:00:00+09");
      expect(b).toEqual({ at: "2026-09-20 18:00", st: "closed" });
    });

    it("19:00に手動変更 -> 当日に残りが無いので翌日10:00のopen", async () => {
      const b = await nextBoundary("10:00", "18:00", "2026-09-20 19:00:00+09");
      expect(b).toEqual({ at: "2026-09-21 10:00", st: "open" });
    });

    it("境界ちょうどの変更はその境界をスキップする(厳密な>)", async () => {
      // 仕様「次の時刻とは、変更が確定したサーバー時刻より後に最初に来る時刻」
      const b = await nextBoundary("10:00", "18:00", "2026-09-20 10:00:00+09");
      expect(b).toEqual({ at: "2026-09-20 18:00", st: "closed" });
    });
  });

  describe("日をまたぐ営業時間 (22:00開店 / 翌02:00閉店)", () => {
    it("23:00時点の直前境界は当日22:00のopen", async () => {
      const b = await prevBoundary("22:00", "02:00", "2026-09-20 23:00:00+09");
      expect(b).toEqual({ at: "2026-09-20 22:00", st: "open" });
    });

    it("23:00時点の次の境界は翌日02:00のclosed", async () => {
      const b = await nextBoundary("22:00", "02:00", "2026-09-20 23:00:00+09");
      expect(b).toEqual({ at: "2026-09-21 02:00", st: "closed" });
    });

    it("01:00時点(営業中)の次の境界は当日02:00のclosed", async () => {
      const b = await nextBoundary("22:00", "02:00", "2026-09-21 01:00:00+09");
      expect(b).toEqual({ at: "2026-09-21 02:00", st: "closed" });
    });
  });

  describe("複数の境界を跨いで停止していた場合", () => {
    it("最後に到来した境界の状態へ一度で追いつく", async () => {
      // 営業時間中(15:00)なら直前境界は当日10:00のopen
      const b = await prevBoundary("10:00", "18:00", "2026-09-20 15:00:00+09");
      expect(b).toEqual({ at: "2026-09-20 10:00", st: "open" });
    });

    it("閉店後(20:00)なら直前境界は当日18:00のclosed", async () => {
      const b = await prevBoundary("10:00", "18:00", "2026-09-20 20:00:00+09");
      expect(b).toEqual({ at: "2026-09-20 18:00", st: "closed" });
    });

    it("開店前(08:00)なら直前境界は前日18:00のclosed", async () => {
      const b = await prevBoundary("10:00", "18:00", "2026-09-20 08:00:00+09");
      expect(b).toEqual({ at: "2026-09-19 18:00", st: "closed" });
    });
  });
});

describeDb("store_apply_auto_switch", () => {
  let client: pg.Client;
  let storeId: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    const res = await client.query<{ id: string }>(
      `insert into public.stores (email, password, name, open_time, close_time, status)
       values ($1, 'x', 'テスト店', '10:00', '18:00', 'closed')
       returning id`,
      [`test-${Date.now()}@example.com`]
    );
    storeId = res.rows[0]!.id;
  });

  afterAll(async () => {
    await client.query("delete from public.stores where id = $1", [storeId]);
    await client.end();
  });

  async function state() {
    const res = await client.query<{
      status: string;
      future: boolean;
      source: string;
    }>(
      `select status, next_switch_at > now() as future, status_source as source
         from public.stores where id = $1`,
      [storeId]
    );
    return res.rows[0]!;
  }

  it("境界が未到来なら何もしない(手動指定を上書きしない)", async () => {
    await client.query(
      `update public.stores
          set status = 'open', status_source = 'manual',
              next_switch_at = now() + interval '3 hours', next_switch_status = 'closed'
        where id = $1`,
      [storeId]
    );

    await client.query("select public.store_apply_auto_switch($1)", [storeId]);

    const s = await state();
    expect(s.status).toBe("open");
    expect(s.source).toBe("manual");
    expect(s.future).toBe(true);
  });

  it("境界が到来済みなら直前境界の状態へ追いつき、カーソルが未来へ進む", async () => {
    await client.query(
      `update public.stores
          set open_time = '10:00', close_time = '18:00',
              status = 'open', status_source = 'manual',
              next_switch_at = now() - interval '1 minute', next_switch_status = 'closed'
        where id = $1`,
      [storeId]
    );

    await client.query("select public.store_apply_auto_switch($1)", [storeId]);

    const s = await state();
    expect(s.source).toBe("auto");
    // カーソルが必ず未来へ進むことが、遅延したジョブが古い境界を
    // 適用し直さないことの担保になる
    expect(s.future).toBe(true);
  });

  it("存在しない店舗では空の行が返る", async () => {
    const res = await client.query<{ id: string | null }>(
      "select id from public.store_apply_auto_switch($1)",
      ["00000000-0000-0000-0000-000000000000"]
    );
    expect(res.rows[0]?.id ?? null).toBeNull();
  });
});
