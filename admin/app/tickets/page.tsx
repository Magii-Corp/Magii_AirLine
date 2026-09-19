"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTicket, changeTicketState, getDashboard, subscribeTicketUpdates, TicketStatus } from "@/lib/admin-api";

const statusLabels: Record<TicketStatus, string> = { waiting: "待機中", called: "呼び出し中", done: "完了", cancelled: "キャンセル" };
const calledTimeout = 15 * 60 * 1000;

export default function TicketsPage() {
  const [email, setEmail] = useState("");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [actionID, setActionID] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const loadTickets = useCallback(async () => {
    if (!email) return;
    try { const result = await getDashboard(email); setTickets(result.tickets); setNow(new Date(result.serverTime).getTime()); }
    catch { setError("受付を取得できませんでした"); }
    finally { setLoading(false); }
  }, [email]);
  useEffect(() => { try { setEmail(sessionStorage.getItem("magii-admin-email") || "owner@example.com"); } catch { setEmail("owner@example.com"); } }, []);
  useEffect(() => { void loadTickets(); }, [loadTickets]);
  useEffect(() => { if (!email) return; return subscribeTicketUpdates(email, ({ ticket, serverTime }) => { setNow(new Date(serverTime).getTime()); setTickets((current) => current.some((item) => item.id === ticket.id) ? current.map((item) => item.id === ticket.id ? ticket : item) : [...current, ticket]); }); }, [email]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const getRemaining = (ticket: AdminTicket) => ticket.called_at ? Math.max(0, Math.ceil((new Date(ticket.called_at).getTime() + calledTimeout - now) / 1000)) : 0;
  const formatRemaining = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const updateStatus = async (ticketID: string, newState: TicketStatus) => {
    setActionID(ticketID); setError("");
    try { const result = await changeTicketState(ticketID, newState); if (!result.success) throw new Error(result.message); setTickets((current) => current.map((ticket) => ticket.id === ticketID ? { ...ticket, status: newState } : ticket)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ステータスを変更できませんでした"); }
    finally { setActionID(null); }
  };
  const waitingCount = useMemo(() => tickets.filter((ticket) => ticket.status === "waiting").length, [tickets]);
  return <main className="admin-console ticket-console">
    <aside className="console-sidebar"><div className="console-logo"><div className="brand-mark small">M</div><div><b>Magii AirLine</b><span>管理画面</span></div></div><nav className="console-nav" aria-label="管理メニュー"><Link href="/dashboard"><span>▦</span>ダッシュボード</Link><Link href="/tickets" className="active"><span>▤</span>受付一覧</Link><Link href="/settings"><span>⚙</span>店舗設定</Link></nav><div className="sidebar-account"><span className="account-avatar">管</span><div><b>店舗管理者</b><small>{email}</small></div><Link href="/auth/login" aria-label="ログアウト">↗</Link></div></aside>
    <div className="console-main"><div className="console-body ticket-page-body"><section className="db-panel"><div className="db-panel-header"><div><h1>受付一覧</h1><p>本日の受付を管理</p></div><div className="table-meta"><span>待機中 {waitingCount}件</span><button onClick={() => void loadTickets()}>↻ 更新</button></div></div>{error && <p className="form-error queue-error" role="alert">{error}</p>}{loading ? <div className="empty-state">読み込み中…</div> : tickets.length === 0 ? <div className="empty-state">対象データはありません</div> : <div className="db-table-wrap"><table className="db-table"><thead><tr><th>番号</th><th>お客様</th><th>人数</th><th>電話番号</th><th>営業日</th><th>状態</th><th>変更</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><span className="waiting-number-badge">{ticket.waitingNumber}</span></td><td><div className="customer-cell"><span>{ticket.name.slice(0, 1)}</span><div><b>{ticket.name}</b></div></div></td><td><b>{ticket.partySize}</b><small className="unit-label">名</small></td><td className="mono-cell">{ticket.account.phone_number}</td><td className="mono-cell">{ticket.business_date}</td><td><span className={`db-status ${ticket.status}`}><i />{statusLabels[ticket.status]}{ticket.status === "called" && <strong className="ticket-countdown"> {formatRemaining(getRemaining(ticket))}</strong>}</span></td><td><select className="db-select" value={ticket.status} disabled={actionID !== null} onChange={(event) => void updateStatus(ticket.id, event.target.value as TicketStatus)} aria-label={`${ticket.waitingNumber}番のステータス`}><option value="waiting">待機中</option><option value="called">呼び出し中</option><option value="done">完了</option><option value="cancelled">キャンセル</option></select></td></tr>)}</tbody></table></div>}<footer className="db-panel-footer"><span>最終更新：たった今</span><span>全{tickets.length}件を表示中</span></footer></section></div></div>
  </main>;
}
