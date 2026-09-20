/**
 * accounts へのアクセス
 */

import type { Tx } from "../db/tx.js";
import type { AccountRow } from "../types/rows.js";

/**
 * 電話番号で検索し、無ければ作る。これを1文でやるのが重要で、
 * SELECT してから INSERT すると初回同時ログインで二重作成される。
 *
 * DO NOTHING ではなく DO UPDATE にしているのは、衝突時にも RETURNING で
 * 行を得るため。xmax = 0 で「今回 INSERT されたか」を判定でき、
 * isNewAccount をレース無しで返せる。
 *
 * なお DO UPDATE は既存行を書き直すので accounts の更新トリガが走るが、
 * notify_account は電話番号が変わっていなければ黙るようにしてある。
 */
export async function upsertByPhone(
  tx: Tx,
  phoneNumber: string
): Promise<{ account: AccountRow; isNew: boolean }> {
  const res = await tx.query<AccountRow & { is_new: boolean }>(
    `insert into public.accounts (phone_number)
     values ($1)
     on conflict (phone_number) do update set phone_number = excluded.phone_number
     returning id, phone_number, created_at, (xmax = 0) as is_new`,
    [phoneNumber]
  );

  const row = res.rows[0]!;
  return {
    account: {
      id: row.id,
      phone_number: row.phone_number,
      created_at: row.created_at,
    },
    isNew: row.is_new,
  };
}

export async function getAccountInTx(
  tx: Tx,
  accountId: string
): Promise<AccountRow | null> {
  const res = await tx.query<AccountRow>(
    "select id, phone_number, created_at from public.accounts where id = $1",
    [accountId]
  );
  return res.rows[0] ?? null;
}

/** 指定アカウントが本日券を持っている店舗の一覧（sync.required の配信先） */
export async function storeIdsWithTodayTicket(
  tx: Tx,
  accountId: string,
  businessDate: string
): Promise<string[]> {
  const res = await tx.query<{ store_id: string }>(
    `select distinct store_id from public.tickets
      where account_id = $1 and business_date = $2`,
    [accountId, businessDate]
  );
  return res.rows.map((r) => r.store_id);
}
