"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTicket, callNext, changeTicketState, getTickets, TicketStatus } from "@/lib/admin-api";

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionID, setActionID] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadTickets = useCallback(async () => {
    if (!email) return;
    try {
      const result = await getTickets(email);
      setTickets(result.tickets.filter((ticket) => ticket.status === "waiting" || ticket.status === "called"));
    } catch {
      setError("チケットを取得できませんでした");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    try { setEmail(sessionStorage.getItem("magii-admin-email") || "owner@example.com"); }
    catch { setEmail("owner@example.com"); }
  }, []);
  useEffect(() => { void loadTickets(); }, [loadTickets]);
  const waitingCount = useMemo(() => tickets.filter((ticket) => ticket.status === "waiting").length, [tickets]);
  const calledCount = tickets.length - waitingCount;

  const updateStatus = async (ticketID: string, newState: TicketStatus) => {
    setActionID(ticketID);
    setError("");
    try {
      const result = await changeTicketState(ticketID, newState);
      if (!result.success) throw new Error(result.message);
      setTickets((current) => current.map((ticket) => ticket.id === ticketID ? { ...ticket, status: newState } : ticket));
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "ステータスを変更できませんでした");
    } finally {
      setActionID(null);
    }
  };

  const handleCallNext = async () => {
    const next = tickets.find((ticket) => ticket.status === "waiting");
    if (!next) return;
    setActionID("call-next");
    setError("");
    try {
      const result = await callNext(email);
      if (!result.success) throw new Error(result.message);
      setTickets((current) => current.map((ticket) => ticket.id === next.id ? { ...ticket, status: "called" } : ticket));
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "次のお客様を呼び出せませんでした");
    } finally {
      setActionID(null);
    }
  };

  return (
    <main className="admin-console">
      <aside className="console-sidebar">
        <div className="console-logo"><div className="brand-mark small">M</div><div><b>Magii</b><span>AirLine Admin</span></div></div>
        <nav className="console-nav" aria-label="管理メニュー">
          <Link href="/dashboard" className="active"><span>▦</span>ダッシュボード</Link>
          <Link href="/settings"><span>⚙</span>店舗設定</Link>
        </nav>
        <div className="sidebar-account"><span className="account-avatar">管</span><div><b>店舗管理者</b><small>{email}</small></div><Link href="/auth/login" aria-label="ログアウト">↗</Link></div>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <div><p>店舗オペレーション</p><h1>{tickets[0]?.store.name ?? "店舗ダッシュボード"}</h1></div>
          <div className="console-actions"><div className="store-chip"><span className="live-dot" />受付中</div><button onClick={() => void loadTickets()} className="icon-button" aria-label="データを更新">↻</button></div>
        </header>

        <div className="console-body">
          <section className="db-metrics">
            <article><div><span>WAITING</span><small>待機中</small></div><strong>{waitingCount}</strong><em className="metric-dot amber" /></article>
            <article><div><span>CALLED</span><small>呼び出し中</small></div><strong>{calledCount}</strong><em className="metric-dot green" /></article>
            <article><div><span>TOTAL ACTIVE</span><small>有効なチケット</small></div><strong>{tickets.length}</strong><em className="metric-dot blue" /></article>
            <button className="db-call-button" onClick={handleCallNext} disabled={waitingCount === 0 || actionID !== null}><span>▶</span><div><small>NEXT ACTION</small><b>{actionID === "call-next" ? "呼び出し中…" : "次を呼ぶ"}</b></div></button>
          </section>

          <section className="db-panel">
            <div className="db-panel-header"><div><h2>Tickets</h2><p>現在の待ちチケットを管理</p></div><div className="table-meta"><span>{tickets.length} records</span><button onClick={() => void loadTickets()}>↻ Refresh</button></div></div>
            {error && <p className="form-error queue-error" role="alert">{error}</p>}
            {loading ? <div className="empty-state">データを読み込んでいます…</div> : tickets.length === 0 ? <div className="empty-state"><span>✓</span><b>対象データはありません</b></div> : (
              <div className="db-table-wrap">
                <table className="db-table">
                  <thead><tr><th>待ち番号</th><th>お客様</th><th>人数</th><th>電話番号</th><th>営業日</th><th>ステータス</th><th>操作</th></tr></thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td><span className="waiting-number-badge">{ticket.waitingNumber}</span></td>
                        <td><div className="customer-cell"><span>{ticket.name.slice(0, 1)}</span><div><b>{ticket.name}</b><small>{ticket.id}</small></div></div></td>
                        <td><b>{ticket.partySize}</b><small className="unit-label">名</small></td>
                        <td className="mono-cell">{ticket.account.phone_number}</td>
                        <td className="mono-cell">{ticket.business_date}</td>
                        <td><span className={`db-status ${ticket.status}`}><i />{ticket.status === "called" ? "CALLED" : "WAITING"}</span></td>
                        <td><select className="db-select" value={ticket.status} disabled={actionID !== null} onChange={(event) => void updateStatus(ticket.id, event.target.value as TicketStatus)} aria-label={`${ticket.waitingNumber}番のステータス`}><option value="waiting">待機中</option><option value="called">呼び出し中</option></select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="db-panel-footer"><span>Last synced: just now</span><span>Showing {tickets.length} of {tickets.length}</span></footer>
          </section>
        </div>
      </div>
    </main>
  );
}
