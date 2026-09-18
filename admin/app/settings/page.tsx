"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  callNext,
  changeAvgMinutesPerParty,
  changeCloseTime,
  changeOpenTime,
  changeStoreState,
} from "@/lib/admin-api";

type SettingsForm = {
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  status: "open" | "closed";
};

const initialSettings: SettingsForm = {
  openTime: "10:00",
  closeTime: "20:00",
  avgMinutesPerParty: 10,
  status: "open",
};

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [form, setForm] = useState(initialSettings);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try { setEmail(sessionStorage.getItem("magii-admin-email") || "owner@example.com"); }
    catch { setEmail("owner@example.com"); }
  }, []);

  const runChange = async (action: string, request: () => Promise<{ success: boolean; message?: string }>) => {
    setMessage("");
    setError("");
    setLoadingAction(action);
    try {
      const result = await request();
      if (!result.success) throw new Error(result.message || "設定を変更できませんでした");
      setMessage("設定を変更しました");
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "設定を変更できませんでした");
      return false;
    } finally {
      setLoadingAction(null);
    }
  };

  const updateOpenTime = () => {
    if (!form.openTime) return setError("開店時間を入力してください");
    void runChange("openTime", () => changeOpenTime(email, form.openTime));
  };

  const updateCloseTime = () => {
    if (!form.closeTime) return setError("閉店時間を入力してください");
    void runChange("closeTime", () => changeCloseTime(email, form.closeTime));
  };

  const updateAverageTime = () => {
    if (!Number.isFinite(form.avgMinutesPerParty) || form.avgMinutesPerParty < 1 || form.avgMinutesPerParty > 120) {
      setError("平均待ち時間は1〜120分で入力してください");
      return;
    }
    void runChange("average", () => changeAvgMinutesPerParty(email, form.avgMinutesPerParty));
  };

  const updateStatus = async (status: SettingsForm["status"]) => {
    if (loadingAction) return;
    const previousStatus = form.status;
    setForm({ ...form, status });
    const success = await runChange("status", () => changeStoreState(email, status));
    if (!success) setForm((current) => ({ ...current, status: previousStatus }));
  };

  const handleCallNext = () => {
    if (!email || loadingAction) return;
    void runChange("callNext", () => callNext(email));
  };

  return (
    <main className="admin-console">
      <aside className="console-sidebar settings-sidebar">
        <div className="console-logo"><div className="brand-mark small">M</div><div><b>Magii</b><span>AirLine Admin</span></div></div>
        <nav className="console-nav" aria-label="管理メニュー">
          <Link href="/dashboard"><span>▦</span>ダッシュボード</Link>
          <Link href="/settings" className="active"><span>⚙</span>店舗設定</Link>
        </nav>
        <button className="sidebar-call-button" onClick={handleCallNext} disabled={!email || loadingAction !== null}><span>▶</span><b>{loadingAction === "callNext" ? "呼出中…" : "次を呼ぶ"}</b></button>
        <div className="sidebar-account"><span className="account-avatar">管</span><div><b>店舗管理者</b><small>{email}</small></div><Link href="/auth/login" aria-label="ログアウト">↗</Link></div>
      </aside>
      <div className="console-main">
        <div className="settings-content console-settings">
        <section className="settings-heading">
          <p className="eyebrow">STORE SETTINGS</p>
          <h1>店舗設定</h1>
          <p>営業時間や待ち時間の計算方法を設定します。</p>
        </section>

        <div className="settings-form">
          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon">◷</span><div><h2>営業時間</h2><p>お客様に表示する受付時間を設定します。</p></div></div>
            <div className="field-grid settings-fields">
              <label className="field-label">開店時間<div className="setting-control"><input className="input" type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} /><button type="button" onClick={updateOpenTime} disabled={!email || loadingAction !== null}>{loadingAction === "openTime" ? "変更中…" : "変更"}</button></div></label>
              <label className="field-label">閉店時間<div className="setting-control"><input className="input" type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} /><button type="button" onClick={updateCloseTime} disabled={!email || loadingAction !== null}>{loadingAction === "closeTime" ? "変更中…" : "変更"}</button></div></label>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon">⌛</span><div><h2>待ち時間</h2><p>1組を案内するまでの平均時間です。</p></div></div>
            <label className="field-label number-field">1組あたりの平均待ち時間<div className="setting-control"><div className="input-with-unit"><input className="input" type="number" min="1" max="120" value={form.avgMinutesPerParty} onChange={(e) => setForm({ ...form, avgMinutesPerParty: Number(e.target.value) })} /><span>分</span></div><button type="button" onClick={updateAverageTime} disabled={!email || loadingAction !== null}>{loadingAction === "average" ? "変更中…" : "変更"}</button></div></label>
            <p className="field-help">待ち組数 × 平均待ち時間で、お客様の予想待ち時間を計算します。</p>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon">●</span><div><h2>受付ステータス</h2><p>新しい待ちチケットの受付状態を変更します。</p></div></div>
            <div className="status-options">
              <button type="button" disabled={!email || loadingAction !== null} className={form.status === "open" ? "status-option selected" : "status-option"} onClick={() => void updateStatus("open")}><span className="live-dot" /><b>受付中</b><small>新規チケットを受け付ける</small></button>
              <button type="button" disabled={!email || loadingAction !== null} className={form.status === "closed" ? "status-option selected closed" : "status-option closed"} onClick={() => void updateStatus("closed")}><span className="closed-dot" /><b>受付停止</b><small>新規受付を一時停止する</small></button>
            </div>
          </section>

          {error && <p className="form-error settings-message error" role="alert">{error}</p>}
          {message && <p className="settings-message success" role="status">✓ {message}</p>}
        </div>
        </div>
      </div>
    </main>
  );
}
