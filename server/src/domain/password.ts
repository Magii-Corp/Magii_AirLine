/**
 * パスワードのハッシュ化と検証
 *
 * stores.password は text だが、平文を保存してはならない。
 * 追加依存を増やさないため Node 組み込みの scrypt (RFC 7914) を使う。
 *
 * 保存形式: scrypt$N$r$p$<salt(base64)>$<derivedKey(base64)>
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, PARAMS);

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  plain: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64!, "base64");
  const expected = Buffer.from(keyB64!, "base64");

  const derived = await scryptAsync(plain, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  // 長さが違うと timingSafeEqual が例外を投げるため先に確認する
  if (derived.length !== expected.length) return false;

  return timingSafeEqual(derived, expected);
}
