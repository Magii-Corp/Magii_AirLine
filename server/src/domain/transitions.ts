/**
 * チケットの状態遷移
 *
 * 仕様「可能な遷移: waiting→called/cancelled、called→done/cancelled」。
 * done / cancelled は終端で、そこからは動かせない。
 */

export const TICKET_STATUSES = ["waiting", "called", "done", "cancelled"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STORE_STATUSES = ["open", "closed"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

const ALLOWED: Record<TicketStatus, readonly TicketStatus[]> = {
  waiting: ["called", "cancelled"],
  called: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * called にする場合だけ called_at を DB 時刻で更新する。
 * 他の状態では既存値を保持する（仕様「他状態では既存値を保持する」）。
 */
export function shouldSetCalledAt(to: TicketStatus): boolean {
  return to === "called";
}

/** お客様がキャンセルできるのは waiting / called のみ */
export function canCancel(from: TicketStatus): boolean {
  return from === "waiting" || from === "called";
}
