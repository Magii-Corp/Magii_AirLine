"use client";

import Link from "next/link";
import { useDashboard } from "@/lib/use-dashboard";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTicket, callNext, changeTicketState, getDashboard, subscribeTicketUpdates, TicketStatus } from "@/lib/admin-api";

const CALLED_TIMEOUT_MS = 15 * 60 * 1000;

export default function DashboardPage() {
  const { storeID, email, tickets, data, loading, error: syncError, now, refresh } = useDashboard();
  const [actionID, setActionID] = useState<string | null>(null);
  const [error, setError] = useState("");
  const storeStatus = data?.store.status;
  const waitingCount = useMemo(() => tickets.filter((ticket) => ticket.status === "waiting").length, [tickets]);
  const calledCount = useMemo(() => tickets.filter((ticket) => ticket.status === "called").length, [tickets]);
  const doneCount = useMemo(() => tickets.filter((ticket) => ticket.status === "done").length, [tickets]);
  const nextTicket = useMemo(() => tickets.find((ticket) => ticket.status === "waiting") ?? null, [tickets]);
  const calledTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "called"), [tickets]);
  const calledPeople = useMemo(() => calledTickets.reduce((total, ticket) => total + ticket.partySize, 0), [calledTickets]);
  const nextPartySize = nextTicket?.partySize ?? 0;
  const canCallNext = !loading && waitingCount > 0 && actionID === null;
  const getRemainingSeconds = useCallback((ticket: AdminTicket) => ticket.called_at
    ? Math.max(0, Math.ceil((new Date(ticket.called_at).getTime() + CALLED_TIMEOUT_MS - now) / 1000))
    : 0, [now]);
  const formatRemaining = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const formatElapsed = (ticket: AdminTicket) => {
    const seconds = ticket.called_at ? Math.max(0, Math.floor((now - new Date(ticket.called_at).getTime()) / 1000)) : 0;
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}経過`;
  };
  const statusLabels: Record<TicketStatus, string> = {
    waiting: "待機中",
    called: "呼び出し中",
    done: "完了",
    cancelled: "キャンセル",
  };

  const updateStatus = async (ticketID: string, newState: TicketStatus) => {
    setActionID(ticketID);
    setError("");
    try {
      const result = await changeTicketState(storeID, ticketID, newState);
      if (!result.success) throw new Error(result.message);
      await refresh();
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
      const result = await callNext(storeID);
      if (!result.success) throw new Error(result.message);
      await refresh();
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "次のお客様を呼び出せませんでした");
    } finally {
      setActionID(null);
    }
  };

  return (
    <main className="admin-console dashboard-console">
      <aside className="console-sidebar">
        <div className="console-logo"><img src="/logo.png" alt="Magii AirLine" className="brand-logo" /><div><b>Magii AirLine</b><span>管理画面</span></div></div>
        <nav className="console-nav" aria-label="管理メニュー">
          <Link href="/dashboard" className="active">ダッシュボード</Link>
          <Link href="/tickets">受付一覧</Link>
          <Link href="/settings">店舗設定</Link>
        </nav>
        <div className="sidebar-account"><span className="account-avatar">管</span><div><b>店舗管理者</b><small>{email}</small></div><Link className="sidebar-logout" href="/auth/login" aria-label="ログアウト">↗</Link></div>
      </aside>

      <div className="console-main">
        <div className="console-body">
          <header className="dashboard-page-header"><div className="dashboard-title-line"><h1>ダッシュボード</h1><time suppressHydrationWarning>{new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date())}</time></div><span className={`dashboard-store-status ${storeStatus === "open" ? "open" : "closed"}`}>{storeStatus === "open" ? "受付中" : "受付停止"}</span></header>
          {(error || syncError) && <p role="alert" className="form-error">{error || syncError}</p>}
          <section className="call-workspace">
            <section className="db-metrics">
              <article><div><span>待機中</span></div><strong>{waitingCount}<small>組</small></strong><em className="metric-dot amber" /></article>
              <article><div><span>呼び出し中</span></div><strong>{calledCount}<small>組</small></strong><em className="metric-dot green" /></article>
              <article><div><span>本日の完了</span></div><strong>{doneCount}<small>組</small></strong><em className="metric-dot blue" /></article>
            </section>
            <section className="next-customer-panel" aria-label="次に呼ばれるお客様">
              {nextTicket ? (
                <div className="next-customer-data">
                  <span className="next-number">{nextTicket.waitingNumber}</span>
                  <div className="next-customer-main"><small>次のお客様</small><b className="next-name">{nextTicket.name} 様</b></div>
                  <div className="next-customer-meta"><strong className="next-party">{nextTicket.partySize}名様</strong><span className="next-phone">{nextTicket.account.phone_number}</span></div>
                </div>
              ) : <p className="next-customer-empty">現在、呼び出し待ちのお客様はいません</p>}
            </section>

            <div className="primary-call-area">
              <button className="db-call-button" onClick={handleCallNext} disabled={!canCallNext}><div><small>{nextTicket ? `${nextTicket.waitingNumber}番 ${nextTicket.name}様を呼び出します` : "待機中のお客様はいません"}</small><b>{actionID === "call-next" ? "呼び出し中…" : "次を呼ぶ"}</b></div></button>
            </div>
            <section className="active-customer-screen called-customer-screen">
              <article className="active-list called-list">
                <header><div><h2>現在呼び出し中</h2></div><strong>{calledPeople}名・{calledCount}組</strong></header>
                <div className="active-list-columns"><span>番号</span><span>お客様</span><span>操作</span></div>
                <div className="active-list-body">
                  {calledTickets.length ? calledTickets.map((ticket) => <div className="active-customer-row" key={ticket.id}><span className="active-number">{ticket.waitingNumber}</span><div className="active-customer-info"><b>{ticket.name}</b><div><span>{ticket.partySize}名様</span><small>{formatElapsed(ticket)}</small></div></div><button onClick={() => void updateStatus(ticket.id, "done")} disabled={actionID !== null}>到着</button></div>) : <p>現在呼び出し中のお客様はいません</p>}
                </div>
              </article>
            </section>
          </section>

        </div>
      </div>
    </main>
  );
}
