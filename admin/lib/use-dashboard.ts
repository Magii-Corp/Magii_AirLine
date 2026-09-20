"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardResult, getDashboard, subscribeTicketUpdates } from "./admin-api";

export function useDashboard() {
  const router = useRouter();
  const [storeID, setStoreID] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState<DashboardResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now);
  const clock = useRef({ server: Date.now(), local: 0 });
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    try {
      const id = sessionStorage.getItem("magii-admin-store-id");
      if (!id) { router.replace("/auth/login"); return; }
      setStoreID(id);
      setEmail(sessionStorage.getItem("magii-admin-email") || "");
    } catch { setError("店舗IDを保存できません。ブラウザの保存設定を確認してください"); setLoading(false); }
  }, [router]);

  useEffect(() => {
    if (!storeID) return;
    let active = true;
    let running: Promise<void> | null = null;
    let dirty = false;
    const refreshData = (): Promise<void> => {
      dirty = true;
      if (running) return running;
      running = (async () => {
        while (dirty && active) {
          dirty = false;
          try {
            const snapshot = await getDashboard(storeID);
            if (!active) return;
            // 同時取得を直列化し、常にDBの整合したスナップショットで置き換える。
            snapshot.tickets = snapshot.tickets.filter(t => t.business_date === snapshot.businessDate)
              .sort((a, b) => a.waitingNumber - b.waitingNumber || a.id.localeCompare(b.id));
            clock.current = { server: Date.parse(snapshot.serverTime), local: performance.now() };
            setNow(clock.current.server);
            setData(snapshot);
            setError("");
          } catch (cause) {
            if (active) setError(cause instanceof Error ? cause.message : "受付を取得できませんでした");
          } finally { if (active) setLoading(false); }
        }
      })().finally(() => { running = null; });
      return running;
    };
    refreshRef.current = refreshData;
    const unsubscribe = subscribeTicketUpdates(storeID, () => { void refreshData(); });
    void refreshData();
    // 通知取りこぼし・日付変更・接続断の補完。
    const fallback = window.setInterval(() => { void refreshData(); }, 30000);
    const tick = window.setInterval(() => setNow(clock.current.server + performance.now() - clock.current.local), 1000);
    const visible = () => { if (!document.hidden) void refreshData(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false; unsubscribe(); clearInterval(fallback); clearInterval(tick);
      document.removeEventListener("visibilitychange", visible);
      refreshRef.current = async () => {};
    };
  }, [storeID]);
  return { storeID, email, data, tickets: data?.tickets ?? [], loading, error, now, refresh };
}
