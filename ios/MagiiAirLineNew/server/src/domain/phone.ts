/**
 * 電話番号の正規化と検証
 *
 * 仕様「ハイフンあり/なし両方を受け付け、内部で正規化して保存する」。
 * accounts.phone_number は UNIQUE なので、正規化を1箇所に集約しないと
 * "090-1234-5678" と "09012345678" が別アカウントになってしまう。
 */

/** 数字以外を落とす。+81 形式は 0 始まりへ寄せる。 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();

  // +81 90 1234 5678 → 09012345678
  const international = trimmed.replace(/[^\d+]/g, "");
  if (international.startsWith("+81")) {
    return `0${international.slice(3)}`;
  }

  return trimmed.replace(/\D/g, "");
}

/**
 * 国内の携帯・固定番号として妥当か。
 * 0 始まりの10桁または11桁のみ通す。
 */
export function isValidPhone(normalized: string): boolean {
  return /^0\d{9,10}$/.test(normalized);
}
