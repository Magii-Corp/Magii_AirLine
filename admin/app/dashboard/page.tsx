"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTicket, callNext, changeTicketState, getTickets, TicketStatus } from "@/lib/admin-api";

const CALLED_TIMEOUT_MS = 15 * 60 * 1000;

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionID, setActionID] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const loadTickets = useCallback(async () => {
    if (!email) return;
    try {
      const result = await getTickets(email);
      setTickets(result.tickets);
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
  const waitingCount = useMemo(() => tickets.filter((ticket) => ticket.status === "Waiting").length, [tickets]);
  const calledCount = useMemo(() => tickets.filter((ticket) => ticket.status === "Called").length, [tickets]);
  const doneCount = useMemo(() => tickets.filter((ticket) => ticket.status === "Done").length, [tickets]);
  const nextTicket = useMemo(() => tickets.find((ticket) => ticket.status === "Waiting") ?? null, [tickets]);
  const calledTicket = useMemo(() => tickets.find((ticket) => ticket.status === "Called") ?? null, [tickets]);
  const remainingSeconds = calledTicket?.called_at
    ? Math.max(0, Math.ceil((new Date(calledTicket.called_at).getTime() + CALLED_TIMEOUT_MS - now) / 1000))
    : 0;
  const remainingLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!calledTicket) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [calledTicket]);

  useEffect(() => {
    if (!calledTicket?.called_at) return;
    const remaining = new Date(calledTicket.called_at).getTime() + CALLED_TIMEOUT_MS - Date.now();
    const finishCalledTicket = async () => {
      try {
        const result = await changeTicketState(calledTicket.id, "Done");
        if (!result.success) throw new Error(result.message);
        setTickets((current) => current.map((ticket) => ticket.id === calledTicket.id ? { ...ticket, status: "Done" } : ticket));
      } catch (error) {
        setError(error instanceof Error && error.message ? error.message : "15分経過したチケットを完了にできませんでした");
      }
    };
    if (remaining <= 0) {
      void finishCalledTicket();
      return;
    }
    const timer = window.setTimeout(() => void finishCalledTicket(), remaining);
    return () => window.clearTimeout(timer);
  }, [calledTicket]);

  const updateStatus = async (ticketID: string, newState: TicketStatus) => {
    if (newState === "Called" && calledTicket && calledTicket.id !== ticketID) {
      setError(`${calledTicket.waitingNumber}番のお客様を先に完了してください`);
      return;
    }
    setActionID(ticketID);
    setError("");
    try {
      const result = await changeTicketState(ticketID, newState);
      if (!result.success) throw new Error(result.message);
      setTickets((current) => current.map((ticket) => ticket.id === ticketID ? {
        ...ticket,
        status: newState,
        called_at: newState === "Called" ? (ticket.called_at ?? new Date().toISOString()) : null,
      } : ticket));
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "ステータスを変更できませんでした");
    } finally {
      setActionID(null);
    }
  };

  const handleCallNext = async () => {
    const next = tickets.find((ticket) => ticket.status === "Waiting");
    if (!next || calledTicket) return;
    setActionID("call-next");
    setError("");
    try {
      const result = await callNext(email);
      if (!result.success) throw new Error(result.message);
      setTickets((current) => current.map((ticket) => ticket.id === next.id ? { ...ticket, status: "Called", called_at: new Date().toISOString() } : ticket));
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "次のお客様を呼び出せませんでした");
    } finally {
      setActionID(null);
    }
  };

  return (
    <main className="admin-console dashboard-console">
      <aside className="console-sidebar">
        <div className="console-logo"><div className="brand-mark small">M</div><div><b>Magii</b><span>AirLine Admin</span></div></div>
        <nav className="console-nav" aria-label="管理メニュー">
          <Link href="/dashboard" className="active"><span>▦</span>ダッシュボード</Link>
          <Link href="/settings"><span>⚙</span>店舗設定</Link>
        </nav>
        <button className="sidebar-call-button" onClick={handleCallNext} disabled={waitingCount === 0 || calledTicket !== null || actionID !== null}><span>▶</span><b>{actionID === "call-next" ? "呼出中…" : calledTicket ? "案内待ち" : "次を呼ぶ"}</b>{calledTicket && <small className="call-countdown">残り {remainingLabel}</small>}</button>
        <div className="sidebar-account"><span className="account-avatar">管</span><div><b>店舗管理者</b><small>{email}</small></div><Link href="/auth/login" aria-label="ログアウト">↗</Link></div>
      </aside>

      <div className="console-main">
        <div className="console-body">
          <section className="call-workspace">
            <section className="db-metrics">
              <article><div><span>WAITING</span><small>待機中</small></div><strong>{waitingCount}</strong><em className="metric-dot amber" /></article>
              <article><div><span>CALLED</span><small>呼び出し中</small></div><strong>{calledCount}</strong><em className="metric-dot green" /></article>
              <article><div><span>DONE</span><small>完了</small></div><strong>{doneCount}</strong><em className="metric-dot blue" /></article>
            </section>

            <section className="next-customer-panel" aria-label="次に呼ばれるお客様">
              <div className="next-customer-label"><span>▶</span><div><small>UP NEXT</small><b>次に呼ばれるお客様</b></div></div>
              {nextTicket ? (
                <div className="next-customer-data">
                  <span className="next-number">{nextTicket.waitingNumber}</span>
                  <b className="next-name">{nextTicket.name}</b>
                  <span className="next-party">{nextTicket.partySize}名様</span>
                  <span className="next-phone">{nextTicket.account.phone_number}</span>
                </div>
              ) : <p className="next-customer-empty">現在、呼び出し待ちのお客様はいません</p>}
            </section>

            <div className="primary-call-area">
              <button className="db-call-button" onClick={handleCallNext} disabled={waitingCount === 0 || calledTicket !== null || actionID !== null}><span>▶</span><div><small>{calledTicket ? `${calledTicket.waitingNumber}番を案内中` : "NEXT ACTION"}</small><b>{actionID === "call-next" ? "呼び出し中…" : calledTicket ? `残り ${remainingLabel}` : "次を呼ぶ"}</b>{calledTicket && <em className="countdown-note">15分経過後に自動で完了します</em>}</div></button>
            </div>
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
                        <td><div className="customer-cell"><span>{ticket.name.slice(0, 1)}</span><div><b>{ticket.name}</b></div></div></td>
                        <td><b>{ticket.partySize}</b><small className="unit-label">名</small></td>
                        <td className="mono-cell">{ticket.account.phone_number}</td>
                        <td className="mono-cell">{ticket.business_date}</td>
                        <td><span className={`db-status ${ticket.status.toLowerCase()}`}><i />{ticket.status.toUpperCase()}</span></td>
                        <td><select className="db-select" value={ticket.status} disabled={actionID !== null} onChange={(event) => void updateStatus(ticket.id, event.target.value as TicketStatus)} aria-label={`${ticket.waitingNumber}番のステータス`}><option value="Waiting">待機中</option><option value="Called">呼び出し中</option><option value="Done">完了</option></select></td>
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
