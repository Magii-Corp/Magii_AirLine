import SwiftUI
import UIKit

struct CalledView: View {
    @EnvironmentObject var appState: AppState
    @State private var remainingSeconds: Int = 900 // 15分
    @State private var timer: Timer?
    @State private var isPulsing = false
    @State private var isArriving = false
    @State private var errorMessage: String?

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

                // エラーメッセージ
                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 16)
                }

                // 到着ボタン
                PrimaryButton(
                    title: isArriving ? "処理中..." : "到着しました",
                    isEnabled: !isArriving
                ) {
                    reportArrival()
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)

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

                    // Demo button
                    #if DEBUG
                    Button("デモ: 完了画面へ") {
                        timer?.invalidate()
                        appState.currentScreen = .completion
                    }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.called)
                    #endif
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 50)
            }
        }
        .onAppear {
            // ハプティックフィードバック
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

            // 通知を送信（バックグラウンド用）
            NotificationManager.shared.sendCalledNotification(waitingNumber: appState.waitingNumber)

            // ウィジェットを更新
            WidgetDataManager.shared.setCalled(waitingNumber: appState.waitingNumber)

            startCountdown()
        }
        .onDisappear {
            timer?.invalidate()
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

    private func reportArrival() {
        guard !appState.ticketId.isEmpty, !appState.accountId.isEmpty else {
            appState.currentScreen = .completion
            return
        }

        isArriving = true
        errorMessage = nil

        Task {
            do {
                _ = try await APIService.shared.arriveTicket(
                    ticketID: appState.ticketId,
                    accountID: appState.accountId
                )

                await MainActor.run {
                    timer?.invalidate()
                    WidgetDataManager.shared.clear()
                    appState.currentScreen = .completion
                }
            } catch let error as APIError {
                await MainActor.run {
                    // NOT_CALLEDエラーの場合は待機画面に戻す
                    if case .serverError(let code, _) = error, code == "NOT_CALLED" {
                        appState.currentScreen = .waiting
                    } else {
                        errorMessage = error.localizedDescription
                    }
                    isArriving = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "エラーが発生しました"
                    isArriving = false
                }
            }
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
