/**
 * 純粋ロジックの単体テスト
 *
 * 店舗の受付状態ステートマシンは DB 関数が実体なので、
 * TypeScript 側に写しを作らず store-status.test.ts で実DBに対して検証する。
 * ここは DB に依存しないものだけを扱う。
 */

import { describe, expect, it } from "vitest";
import { canCancel, canTransition, shouldSetCalledAt } from "../src/domain/transitions.js";
import { estimatedMinutes, groupsAheadFor } from "../src/domain/queue.js";
import { isValidPhone, normalizePhone } from "../src/domain/phone.js";

describe("チケットの状態遷移", () => {
  it("仕様で許可された遷移だけを通す", () => {
    expect(canTransition("waiting", "called")).toBe(true);
    expect(canTransition("waiting", "cancelled")).toBe(true);
    expect(canTransition("called", "done")).toBe(true);
    expect(canTransition("called", "cancelled")).toBe(true);
  });

  it("終端状態からは動かせない", () => {
    expect(canTransition("done", "called")).toBe(false);
    expect(canTransition("done", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "waiting")).toBe(false);
  });

  it("called を飛ばして done にはできない", () => {
    expect(canTransition("waiting", "done")).toBe(false);
  });

  it("巻き戻しはできない", () => {
    expect(canTransition("called", "waiting")).toBe(false);
  });

  it("called にするときだけ called_at を設定する", () => {
    expect(shouldSetCalledAt("called")).toBe(true);
    expect(shouldSetCalledAt("done")).toBe(false);
    expect(shouldSetCalledAt("cancelled")).toBe(false);
  });

  it("キャンセルできるのは waiting と called のみ", () => {
    expect(canCancel("waiting")).toBe(true);
    expect(canCancel("called")).toBe(true);
    expect(canCancel("done")).toBe(false);
    expect(canCancel("cancelled")).toBe(false);
  });
});

describe("前組数と待ち時間", () => {
  it("waiting なら前の件数がそのまま前組数になる", () => {
    expect(groupsAheadFor("waiting", 3)).toBe(3);
  });

  it("自分が called なら前組数は0", () => {
    expect(groupsAheadFor("called", 3)).toBe(0);
  });

  it("予想待ち時間は 前組数 × 1組あたりの目安時間", () => {
    expect(estimatedMinutes(3, 5)).toBe(15);
    expect(estimatedMinutes(0, 5)).toBe(0);
  });
});

describe("電話番号の正規化", () => {
  it("ハイフンあり/なしが同じ値になる", () => {
    expect(normalizePhone("090-1234-5678")).toBe("09012345678");
    expect(normalizePhone("09012345678")).toBe("09012345678");
  });

  it("括弧や空白も落とす", () => {
    expect(normalizePhone("(090) 1234 5678")).toBe("09012345678");
  });

  it("+81 形式を 0 始まりへ寄せる", () => {
    expect(normalizePhone("+81 90 1234 5678")).toBe("09012345678");
  });

  it("10桁・11桁の 0 始まりだけを通す", () => {
    expect(isValidPhone("09012345678")).toBe(true);
    expect(isValidPhone("0312345678")).toBe(true);
    expect(isValidPhone("9012345678")).toBe(false);
    expect(isValidPhone("090123456789")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});
