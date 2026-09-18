"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login } from "@/lib/admin-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    setLoading(true);
    try {
      const result = await login({ email: email.trim(), password });
      if (!result.success) throw new Error(result.message);
      try {
        sessionStorage.setItem("magii-admin-email", email.trim());
      } catch {
        // Storageが無効でもログイン後の画面遷移は止めない。
      }
      router.replace("/dashboard");
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "店舗IDまたはパスワードをご確認ください");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark" aria-hidden="true">M</div>
        <p className="eyebrow">MAGII AIRLINE</p>
        <h1 className="auth-title">おかえりなさい</h1>
        <p className="auth-copy">店舗の待ち列を、ここからスマートに管理。</p>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label className="field-label">メールアドレス<input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" inputMode="email" autoComplete="email" autoCapitalize="none" /></label>
          <label className="field-label">パスワード<input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワードを入力" autoComplete="current-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "ログイン中…" : "ログイン"}</button>
        </form>
        <p className="auth-switch">はじめてご利用ですか？ <Link href="/auth/register">新規登録</Link></p>
      </section>
    </main>
  );
}
