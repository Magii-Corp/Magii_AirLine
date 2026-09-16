"use client";

import { useState } from "react";

// Mock data for development
const mockQueue = [
  { id: "1", waiting_number: 1, guest_name: "山田 太郎", party_size: 2, status: "called", wait_time_minutes: 15 },
  { id: "2", waiting_number: 2, guest_name: "鈴木 花子", party_size: 4, status: "waiting", wait_time_minutes: 10 },
  { id: "3", waiting_number: 3, guest_name: "田中 一郎", party_size: 1, status: "waiting", wait_time_minutes: 5 },
];

const mockStats = {
  waiting_count: 2,
  called_count: 1,
  seated_count: 12,
  no_show_count: 2,
  cancelled_count: 1,
};

export default function DashboardPage() {
  const [queue, setQueue] = useState(mockQueue);
  const [stats] = useState(mockStats);
  const [isAccepting, setIsAccepting] = useState(true);

  const handleCallNext = async () => {
    // TODO: Implement API call
    const nextWaiting = queue.find((t) => t.status === "waiting");
    if (nextWaiting) {
      setQueue(
        queue.map((t) =>
          t.id === nextWaiting.id ? { ...t, status: "called" } : t
        )
      );
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    // TODO: Implement API call
    setQueue(
      queue.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="text-text-secondary">サンプル店舗</p>
        </div>
        <button
          onClick={() => setIsAccepting(!isAccepting)}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            isAccepting
              ? "bg-accent-green text-black"
              : "bg-error text-white"
          }`}
        >
          {isAccepting ? "受付中" : "受付停止"}
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <div className="card text-center">
          <p className="text-4xl font-bold">{stats.waiting_count}</p>
          <p className="text-text-secondary text-sm">待機中</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-accent">{stats.called_count}</p>
          <p className="text-text-secondary text-sm">呼び出し中</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-accent-green">{stats.seated_count}</p>
          <p className="text-text-secondary text-sm">着席済み</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-error">{stats.no_show_count}</p>
          <p className="text-text-secondary text-sm">不在</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-text-secondary">{stats.cancelled_count}</p>
          <p className="text-text-secondary text-sm">キャンセル</p>
        </div>
      </div>

      {/* Call Next Button */}
      <button
        onClick={handleCallNext}
        className="w-full h-20 bg-white text-black text-xl font-bold rounded-2xl mb-8 hover:bg-opacity-90 transition-colors"
      >
        次を呼ぶ
      </button>

      {/* Queue */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold mb-4">待ち行列</h2>

        {queue.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-text-secondary">現在待機中のお客様はいません</p>
          </div>
        ) : (
          queue.map((ticket) => (
            <div
              key={ticket.id}
              className={`card flex items-center justify-between ${
                ticket.status === "called" ? "border-2 border-accent" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-card-secondary flex items-center justify-center">
                  <span className="text-xl font-bold">{ticket.waiting_number}</span>
                </div>
                <div>
                  <p className="font-medium">{ticket.guest_name}</p>
                  <p className="text-text-secondary text-sm">
                    {ticket.party_size}名 · {ticket.wait_time_minutes}分待ち
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {ticket.status === "called" && (
                  <>
                    <button
                      onClick={() => handleStatusChange(ticket.id, "seated")}
                      className="px-3 py-1 bg-accent-green text-black rounded-full text-sm"
                    >
                      着席
                    </button>
                    <button
                      onClick={() => handleStatusChange(ticket.id, "no_show")}
                      className="px-3 py-1 bg-error text-white rounded-full text-sm"
                    >
                      不在
                    </button>
                  </>
                )}
                {ticket.status === "waiting" && (
                  <span className="px-3 py-1 bg-card-secondary rounded-full text-sm text-text-secondary">
                    待機中
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
