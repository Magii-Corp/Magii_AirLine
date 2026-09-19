"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTicket, callNext, changeTicketState, getDashboard, subscribeTicketUpdates, TicketStatus } from "@/lib/admin-api";

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
      const result = await getDashboard(email);
      setNow(new Date(result.serverTime).getTime());
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
  useEffect(() => {
    if (!email) return;
    return subscribeTicketUpdates(email, ({ ticket, serverTime }) => {
      setNow(new Date(serverTime).getTime());
      setTickets((current) => {
        const exists = current.some((currentTicket) => currentTicket.id === ticket.id);
        return exists
          ? current.map((currentTicket) => currentTicket.id === ticket.id ? ticket : currentTicket)
          : [...current, ticket];
      });
    });
  }, [email]);
  const waitingCount = useMemo(() => tickets.filter((ticket) => ticket.status === "waiting").length, [tickets]);
  const calledCount = useMemo(() => tickets.filter((ticket) => ticket.status === "called").length, [tickets]);
  const doneCount = useMemo(() => tickets.filter((ticket) => ticket.status === "done").length, [tickets]);
  const nextTicket = useMemo(() => tickets.find((ticket) => ticket.status === "waiting") ?? null, [tickets]);
  const calledTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "called"), [tickets]);
  const calledPeople = useMemo(() => calledTickets.reduce((total, ticket) => total + ticket.partySize, 0), [calledTickets]);
  const nextPartySize = nextTicket?.partySize ?? 0;
  const canCallNext = waitingCount > 0 && actionID === null;
  const getRemainingSeconds = useCallback((ticket: AdminTicket) => ticket.called_at
    ? Math.max(0, Math.ceil((new Date(ticket.called_at).getTime() + CALLED_TIMEOUT_MS - now) / 1000))
    : 0, [now]);
  const formatRemaining = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const statusLabels: Record<TicketStatus, string> = {
    waiting: "待機中",
    called: "呼び出し中",
    done: "完了",
    cancelled: "キャンセル",
  };

  useEffect(() => {
    if (!calledTickets.length) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [calledTickets.length]);

  const updateStatus = async (ticketID: string, newState: TicketStatus) => {
    setActionID(ticketID);
    setError("");
    try {
      const result = await changeTicketState(ticketID, newState);
      if (!result.success) throw new Error(result.message);
      setTickets((current) => current.map((ticket) => ticket.id === ticketID ? {
        ...ticket,
        status: newState,
        called_at: newState === "called" ? (ticket.called_at ?? new Date().toISOString()) : ticket.called_at,
      } : ticket));
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
      setTickets((current) => current.map((ticket) => ticket.id === next.id ? { ...ticket, status: "called", called_at: new Date().toISOString() } : ticket));
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "次のお客様を呼び出せませんでした");
    } finally {
      setActionID(null);
    }
  };

  return (
    <main className="admin-console dashboard-console">
      <aside className="console-sidebar">
        <div className="console-logo"><div className="brand-mark small">M</div><div><b>Magii AirLine</b><span>管理画面</span></div></div>
        <nav className="console-nav" aria-label="管理メニュー">
          <Link href="/dashboard" className="active"><span>▦</span>ダッシュボード</Link>
          <Link href="/settings"><span>⚙</span>店舗設定</Link>
        </nav>
        <button className="sidebar-call-button" onClick={handleCallNext} disabled={!canCallNext}><b>{actionID === "call-next" ? "呼出中…" : waitingCount === 0 ? "待機なし" : "次を呼ぶ"}</b>{calledCount > 0 && <small className="call-countdown">{calledCount}組呼出中</small>}</button>
        <div className="sidebar-account"><span className="account-avatar">管</span><div><b>店舗管理者</b><small>{email}</small></div><Link href="/auth/login" aria-label="ログアウト">↗</Link></div>
      </aside>

      <div className="console-main">
        <div className="console-body">
          <section className="call-workspace">
            <section className="db-metrics">
              <article><div><span>待機状況</span><small>待機中</small></div><strong>{waitingCount}</strong><em className="metric-dot amber" /></article>
              <article><div><span>呼び出し状況</span><small>呼び出し中</small></div><strong>{calledCount}</strong><em className="metric-dot green" /></article>
              <article><div><span>本日の完了</span><small>完了</small></div><strong>{doneCount}</strong><em className="metric-dot blue" /></article>
            </section>

            <section className="next-customer-panel" aria-label="次に呼ばれるお客様">
              <div className="next-customer-label"><span>▶</span><div><small>次のお客様</small><b>次に呼ばれるお客様</b></div></div>
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
              <button className="db-call-button" onClick={handleCallNext} disabled={!canCallNext}><div><small>{nextTicket ? `次は${nextPartySize}名様` : "次のお客様はいません"}</small><b>{actionID === "call-next" ? "呼び出し中…" : nextTicket ? "次を呼ぶ" : "待機中なし"}</b>{calledCount > 0 && <em className="countdown-note">{calledCount}組呼び出し中</em>}</div></button>
            </div>
          </section>

          <section className="active-customer-screen called-customer-screen">
            <article className="active-list called-list">
              <header><div><span className="active-list-dot called" /><h2>現在呼び出し中のお客様</h2></div><strong>{calledPeople}名・{calledCount}組</strong></header>
              <div className="active-list-body">
                {calledTickets.length ? calledTickets.map((ticket) => <div className="active-customer-row" key={ticket.id}><span className="active-number">{ticket.waitingNumber}</span><b>{ticket.name}</b><span>{ticket.partySize}名様</span><strong>{formatRemaining(getRemainingSeconds(ticket))}</strong><button onClick={() => void updateStatus(ticket.id, "done")} disabled={actionID !== null}>到着</button></div>) : <p>現在呼び出し中のお客様はいません</p>}
              </div>
            </article>
          </section>

          <section className="db-panel">
            <div className="db-panel-header"><div><h2>チケット一覧</h2><p>現在の待ちチケットを管理</p></div><div className="table-meta"><span>{tickets.length}件</span><button onClick={() => void loadTickets()}>↻ 更新</button></div></div>
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
                        <td><span className={`db-status ${ticket.status}`}><i />{statusLabels[ticket.status]}{ticket.status === "called" && <strong className="ticket-countdown"> {formatRemaining(getRemainingSeconds(ticket))}</strong>}</span></td>
                        <td><select className="db-select" value={ticket.status} disabled={actionID !== null} onChange={(event) => void updateStatus(ticket.id, event.target.value as TicketStatus)} aria-label={`${ticket.waitingNumber}番のステータス`}><option value="waiting">待機中</option><option value="called">呼び出し中</option><option value="done">完了</option><option value="cancelled">キャンセル</option></select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="db-panel-footer"><span>最終更新：たった今</span><span>全{tickets.length}件を表示中</span></footer>
          </section>
        </div>
      </div>
    </main>
  );
}
