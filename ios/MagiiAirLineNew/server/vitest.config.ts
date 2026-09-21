/**
 * vitest の設定
 *
 * store-status.test.ts は実DBに対して検証するため DATABASE_URL が要る。
 * vitest は node の --env-file を受け取れないので、ここで .env.local を
 * 読み込む。ファイルが無ければ何もせず、テスト側がスキップする。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

function loadEnvFile(path: string): void {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // 既に設定されている環境変数を上書きしない（CI の設定を尊重する）
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(__dirname, ".env.local"));

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
