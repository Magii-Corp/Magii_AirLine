"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AdminTicket,
  callNext,
  getTickets,
  setStoreSettings,
  subscribeTicketUpdates,
} from "@/lib/admin-api";

type SettingsForm = {
  name: string;
  openTime: string;
  closeTime: string;
  avgMinutesPerParty: number;
  status: "open" | "closed";
};

const initialSettings: SettingsForm = {
  name: "",
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
  const [storeID, setStoreID] = useState("");
  const [qrDataURL, setQrDataURL] = useState("");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);

  useEffect(() => {
    try {
      setEmail(sessionStorage.getItem("magii-admin-email") || "owner@example.com");
    } catch {
      setEmail("owner@example.com");
    }
  }, []);

  useEffect(() => {
    if (!email) return;
    void getTickets(email).then(({ tickets }) => {
      setTickets(tickets);
      if (tickets[0]?.store.id) {
        const store = tickets[0].store;
        setStoreID(store.id);
        setForm({
          name: store.name,
          openTime: store.openTime,
          closeTime: store.closeTime,
          avgMinutesPerParty: store.avgMinutesPerParty,
          status: store.status === "closed" ? "closed" : "open",
        });
      }
    }).catch(() => setError("店舗IDを自動取得できませんでした。手動で入力してください"));
  }, [email]);

  useEffect(() => {
    if (!email) return;
    return subscribeTicketUpdates(email, ({ ticket }) => {
      setTickets((current) => {
        const exists = current.some((currentTicket) => currentTicket.id === ticket.id);
        return exists
          ? current.map((currentTicket) => currentTicket.id === ticket.id ? ticket : currentTicket)
          : [...current, ticket];
      });
    });
  }, [email]);

  useEffect(() => {
    if (!storeID.trim()) {
      setQrDataURL("");
      return;
    }
    void QRCode.toDataURL(storeID.trim(), { width: 640, margin: 3, errorCorrectionLevel: "H", color: { dark: "#102a43", light: "#ffffff" } })
      .then(setQrDataURL)
      .catch(() => setError("QRコードを生成できませんでした"));
  }, [storeID]);

  const downloadQRCode = () => {
    if (!qrDataURL) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataURL;
    anchor.download = `magii-airline-${storeID || "store"}-qr.png`;
    anchor.click();
  };

  const runChange = async (action: string, request: () => Promise<{ success: boolean; message?: string }>) => {
    setMessage("");
    setError("");
    setLoadingAction(action);
    try {
      const result = await request();
      if (!result.success) throw new Error(result.message || "設定を変更できませんでした");
      setMessage(action === "callNext" ? "次のお客様を呼び出しました" : "設定を保存しました");
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "設定を変更できませんでした");
      return false;
    } finally {
      setLoadingAction(null);
    }
  };

  const saveSettings = async () => {
    if (!form.name.trim()) {
      setError("店舗名を入力してください");
      return;
    }
    if (!form.openTime || !form.closeTime) {
      setError("開店時間と閉店時間を入力してください");
      return;
    }
    if (!Number.isFinite(form.avgMinutesPerParty) || form.avgMinutesPerParty < 1 || form.avgMinutesPerParty > 120) {
      setError("平均待ち時間は1〜120分で入力してください");
      return;
    }
    await runChange("settings", () => setStoreSettings({ email, ...form, name: form.name.trim() }));
  };

  const nextTicket = tickets.find((ticket) => ticket.status === "waiting") ?? null;
  const canCallNext = Boolean(nextTicket);

  const handleCallNext = async () => {
    if (!email || loadingAction || !canCallNext) return;
    setMessage("");
    setError("");
    setLoadingAction("callNext");
    try {
      const result = await callNext(email);
      if (!result.success) throw new Error(result.message || "呼び出しに失敗しました");
      if (result.ticket) {
        setTickets((current) => current.map((ticket) => ticket.id === result.ticket?.id ? result.ticket : ticket));
      }
      setMessage("次のお客様を呼び出しました");
    } catch (error) {
      setError(error instanceof Error ? error.message : "呼び出しに失敗しました");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <main className="admin-console">
      <aside className="console-sidebar settings-sidebar">
        <div className="console-logo"><div className="brand-mark small">M</div><div><b>Magii AirLine</b><span>管理画面</span></div></div>
        <nav className="console-nav" aria-label="管理メニュー">
          <Link href="/dashboard">ダッシュボード</Link>
          <Link href="/tickets">受付一覧</Link>
          <Link href="/settings" className="active">店舗設定</Link>
        </nav>
        <div className="sidebar-account"><span className="account-avatar">管</span><div><b>店舗管理者</b><small>{email}</small></div><Link className="sidebar-logout" href="/auth/login" aria-label="ログアウト">↗</Link></div>
      </aside>
      <div className="console-main">
        <div className="settings-content console-settings">
        <section className="settings-heading">
          <p className="eyebrow">店舗情報と受付設定</p>
          <h1>店舗設定</h1>
          <p>営業時間や待ち時間の計算方法を設定します。</p>
        </section>

        <div className="settings-form">
          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon">店</span><div><h2>店舗情報</h2><p>管理画面やお客様向け画面に表示する店舗名です。</p></div></div>
            <div className="settings-fields">
              <label className="field-label">店舗名<input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="店舗名を入力" maxLength={100} /></label>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon">◷</span><div><h2>営業時間</h2><p>お客様に表示する受付時間を設定します。</p></div></div>
            <div className="field-grid settings-fields">
              <label className="field-label">開店時間<input className="input" type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} /></label>
              <label className="field-label">閉店時間<input className="input" type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} /></label>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon">⌛</span><div><h2>待ち時間</h2><p>1組を案内するまでの平均時間です。</p></div></div>
            <label className="field-label number-field">1組あたりの平均待ち時間<div className="input-with-unit"><input className="input" type="number" min="1" max="120" value={form.avgMinutesPerParty} onChange={(e) => setForm({ ...form, avgMinutesPerParty: Number(e.target.value) })} /><span>分</span></div></label>
            <p className="field-help">待ち組数 × 平均待ち時間で、お客様の予想待ち時間を計算します。</p>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon">●</span><div><h2>受付ステータス</h2><p>新しい受付の状態を変更します。</p></div></div>
            <div className="status-options">
              <button type="button" disabled={loadingAction !== null} className={form.status === "open" ? "status-option selected" : "status-option"} onClick={() => setForm({ ...form, status: "open" })}><span className="live-dot" /><b>受付中</b><small>新規受付を受け付ける</small></button>
              <button type="button" disabled={loadingAction !== null} className={form.status === "closed" ? "status-option selected closed" : "status-option closed"} onClick={() => setForm({ ...form, status: "closed" })}><span className="closed-dot" /><b>受付停止</b><small>新規受付を一時停止する</small></button>
            </div>
          </section>

          <section className="settings-card qr-settings-card">
            <div className="settings-card-heading"><span className="settings-icon" aria-hidden="true" /><div><h2>店舗QRコード</h2><p>来店客が受付を発行するためのQRコードです。</p></div></div>
            <div className="qr-settings-grid">
              <div className="qr-fields">
                <label className="field-label">店舗ID<input className="input" value={storeID} onChange={(event) => setStoreID(event.target.value)} placeholder="店舗IDを入力" /></label>
                {storeID && <div className="qr-url-preview"><b>QRに含まれる店舗ID</b><code>{storeID.trim()}</code></div>}
              </div>
              <div className="qr-preview">
                {qrDataURL ? <img src={qrDataURL} alt={`店舗ID ${storeID} のQRコード`} /> : <div className="qr-placeholder">店舗IDを入力してください</div>}
                <button type="button" onClick={downloadQRCode} disabled={!qrDataURL}>PNGでダウンロード</button>
              </div>
            </div>
          </section>

          <div className="settings-save-bar"><div><b>設定をまとめて保存</b><span>店舗名、営業時間、待ち時間、受付状態を一括更新します。</span></div><button type="button" onClick={() => void saveSettings()} disabled={!email || loadingAction !== null}>{loadingAction === "settings" ? "保存中…" : "設定を保存"}</button></div>

          {error && <p className="form-error settings-message error" role="alert">{error}</p>}
          {message && <p className="settings-message success" role="status">{message}</p>}
        </div>
        </div>
      </div>
    </main>
  );
}
