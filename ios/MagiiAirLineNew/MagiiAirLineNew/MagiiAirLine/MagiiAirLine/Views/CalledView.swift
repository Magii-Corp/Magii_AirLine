import SwiftUI
import UIKit
import AudioToolbox

struct CalledView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject private var sseService = SSEService.shared
    @State private var remainingSeconds: Int = 900 // 15分
    @State private var timer: Timer?
    @State private var isPulsing = false

    private let totalSeconds: Double = 900.0

    private var remainingTimeText: String {
        let minutes = remainingSeconds / 60
        let seconds = remainingSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    private var progress: Double {
        Double(remainingSeconds) / totalSeconds
    }

    var body: some View {
        ZStack {
            // 背景
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()
                    .frame(height: 50)

                // 上部ステータス（中央）
                HStack(spacing: 12) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 24))
                        .foregroundColor(Color.called)
                        .rotationEffect(.degrees(isPulsing ? -15 : 15))
                        .animation(
                            Animation.easeInOut(duration: 0.15)
                                .repeatForever(autoreverses: true),
                            value: isPulsing
                        )

                    Text("お呼び出し中")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(Color.called)
                }
                .frame(maxWidth: .infinity)
                .onAppear { isPulsing = true }

                Spacer()

                // メインコンテンツ
                VStack(spacing: 40) {
                    // 受付番号（メインフォーカス）
                    VStack(spacing: 12) {
                        Text("受付番号")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(Color.textSecondary)

                        Text("\(appState.waitingNumber)")
                            .font(.system(size: 140, weight: .bold, design: .rounded))
                            .foregroundColor(Color.textPrimary)
                    }

                    // メッセージ
                    VStack(spacing: 8) {
                        Text("席のご用意ができました")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(Color.textPrimary)

                        Text("カウンターまでお越しください")
                            .font(.system(size: 15))
                            .foregroundColor(Color.textSecondary)
                    }
                }

                Spacer()

                // タイマーセクション
                VStack(spacing: 20) {
                    // プログレスバー（横型）
                    VStack(spacing: 12) {
                        HStack {
                            Text("自動キャンセルまで")
                                .font(.system(size: 13))
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            Text(remainingTimeText)
                                .font(.system(size: 24, weight: .bold, design: .monospaced))
                                .foregroundColor(Color.called)
                        }

                        // プログレスバー
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color.border)
                                    .frame(height: 12)

                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color.called)
                                    .frame(width: geometry.size.width * progress, height: 12)
                                    .animation(.linear(duration: 1), value: remainingSeconds)
                            }
                        }
                        .frame(height: 12)

                        Text("時間内にお越しにならない場合、自動でキャンセルされます")
                            .font(.system(size: 12))
                            .foregroundColor(Color.textTertiary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(24)
                    .background(
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color.cardBackground)
                    )

                }
                .padding(.horizontal, 20)
                .padding(.bottom, 50)
            }
        }
        .onAppear {
            // 強いバイブレーション（3回連続）
            triggerStrongVibration()

            // 通知を送信（バックグラウンド用）
            NotificationManager.shared.sendCalledNotification(waitingNumber: appState.waitingNumber)

            // 自動キャンセル前の通知をスケジュール（10分前、5分前、1分前）
            NotificationManager.shared.scheduleAutoCancelReminders(
                waitingNumber: appState.waitingNumber,
                calledAt: Date()
            )

            // ウィジェットを更新
            WidgetDataManager.shared.setCalled(waitingNumber: appState.waitingNumber)

            // SSEイベントを監視（管理者が完了処理したら完了画面へ）
            startSSE()

            startCountdown()
        }
        .onDisappear {
            timer?.invalidate()
            // リマインダー通知をキャンセル
            NotificationManager.shared.cancelAutoCancelReminders()
        }
    }

    private func startCountdown() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { t in
            if remainingSeconds > 0 {
                remainingSeconds -= 1
            } else {
                t.invalidate()
                // 自動完了（サーバー側でもdoneになっているはず）
                appState.currentScreen = .completion
            }
        }
    }

    private func startSSE() {
        guard !appState.ticketId.isEmpty else { return }

        sseService.onEvent = { event in
            handleSSEEvent(event)
        }

        // WaitingViewから接続済みの場合は再接続不要
        if !sseService.isConnected {
            sseService.connect(ticketID: appState.ticketId)
        }
    }

    private func handleSSEEvent(_ event: SSEEvent) {
        switch event {
        case .ticketDone:
            // 管理者が完了処理した
            print("[CalledView] Received ticketDone event")
            timer?.invalidate()
            sseService.disconnect()
            WidgetDataManager.shared.clear()
            NotificationManager.shared.cancelAutoCancelReminders()
            appState.currentScreen = .completion

        case .ticketCancelled:
            // キャンセルされた
            print("[CalledView] Received ticketCancelled event")
            timer?.invalidate()
            sseService.disconnect()
            WidgetDataManager.shared.clear()
            NotificationManager.shared.cancelAutoCancelReminders()
            appState.resetTicketState()
            appState.currentScreen = .qrScanner

        default:
            break
        }
    }

    private func triggerStrongVibration() {
        // 強いインパクトフィードバックを3回連続
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.prepare()

        generator.impactOccurred()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            generator.impactOccurred()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            generator.impactOccurred()
        }

        // システムバイブレーション（さらに強い）
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        }
    }
}

#Preview {
    CalledView()
        .environmentObject({
            let state = AppState()
            state.userName = "山田 太郎"
            state.waitingNumber = 42
            return state
        }())
}
