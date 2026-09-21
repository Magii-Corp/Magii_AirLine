/**
 * 前組数と予想待ち時間
 *
 * 仕様:
 *   groupsAhead      : 自分より前の waiting 件数。自分が called なら 0
 *   estimatedMinutes : groupsAhead × store.avgMinutesPerParty
 *   該当なしの場合は両方 0
 */

import type { TicketStatus } from "./transitions.js";

export function estimatedMinutes(
  groupsAhead: number,
  avgMinutesPerParty: number
): number {
  return groupsAhead * avgMinutesPerParty;
}

/** called 済みなら前に並んでいる組は無い */
export function groupsAheadFor(
  status: TicketStatus,
  waitingCountBefore: number
): number {
  return status === "waiting" ? waitingCountBefore : 0;
}
