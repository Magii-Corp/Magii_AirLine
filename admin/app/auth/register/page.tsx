"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { storeRegister } from "@/lib/admin-api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", passwordConfirmation: "", openTime: "10:00", closeTime: "20:00", avgMinutesPerParty: 10 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.passwordConfirmation) {
      setError("パスワードが一致していません");
      return;
    }
    setLoading(true);
    try {
      if (!form.name.trim() || !form.email.trim() || !form.password) {
        setError("すべての項目を入力してください");
        return;
      }
      if (form.password.length < 8) {
        setError("パスワードは8文字以上で入力してください");
        return;
      }
      const result = await storeRegister({
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        openTime: form.openTime, closeTime: form.closeTime,
        avgMinutesPerParty: form.avgMinutesPerParty,
        counterDate: new Date().toISOString().slice(0, 10), lastNumber: 0, status: "open",
      });
      if (!result.success) throw new Error(result.message);
      router.replace("/auth/login?registered=1");
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link href="/auth/login" className="back-link">← ログインへ戻る</Link>
        <img src="/icon-192.png" alt="Magii AirLine" className="brand-logo-large" />
        <p className="eyebrow">新規店舗登録</p>
        <h1 className="auth-title">店舗アカウントを作成</h1>
        <p className="auth-copy">待ち時間を、もっと心地よい時間へ。</p>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label className="field-label">店舗名<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Magii Coffee 渋谷店" autoComplete="organization" /></label>
          <label className="field-label">メールアドレス<input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" inputMode="email" autoComplete="email" autoCapitalize="none" /></label>
          <div className="field-grid">
            <label className="field-label">開店時間<input className="input" type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} /></label>
            <label className="field-label">閉店時間<input className="input" type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} /></label>
          </div>
          <label className="field-label">1組あたりの平均待ち時間（分）<input className="input" type="number" min="1" max="120" value={form.avgMinutesPerParty} onChange={(e) => setForm({ ...form, avgMinutesPerParty: Number(e.target.value) })} /></label>
          <label className="field-label">パスワード<input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8文字以上" autoComplete="new-password" /></label>
          <label className="field-label">パスワード（確認）<input className="input" type="password" value={form.passwordConfirmation} onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })} placeholder="もう一度入力" autoComplete="new-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "作成中…" : "アカウントを作成"}</button>
        </form>
        <p className="auth-switch">すでにアカウントをお持ちですか？ <Link href="/auth/login">ログイン</Link></p>
      </section>
    </main>
  );
}
