import SwiftUI
import UIKit

struct CalledView: View {
    @EnvironmentObject var appState: AppState
    @State private var waitingNumber: Int = 42
    @State private var remainingSeconds: Int = 900 // 15分
    @State private var timer: Timer?
    @State private var isPulsing = false

    private let calledColor = Color(hex: "FF9500")
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
            Color.white
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()
                    .frame(height: 50)

                // 上部ステータス（中央）
                HStack(spacing: 12) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 24))
                        .foregroundColor(calledColor)
                        .rotationEffect(.degrees(isPulsing ? -15 : 15))
                        .animation(
                            Animation.easeInOut(duration: 0.15)
                                .repeatForever(autoreverses: true),
                            value: isPulsing
                        )

                    Text("お呼び出し中")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(calledColor)
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
                            .foregroundColor(.black.opacity(0.5))

                        Text("\(waitingNumber)")
                            .font(.system(size: 140, weight: .bold, design: .rounded))
                            .foregroundColor(.black)
                    }

                    // メッセージ
                    VStack(spacing: 8) {
                        Text("席のご用意ができました")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.black)

                        Text("カウンターまでお越しください")
                            .font(.system(size: 15))
                            .foregroundColor(.black.opacity(0.5))
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
                                .foregroundColor(.black.opacity(0.5))
                            Spacer()
                            Text(remainingTimeText)
                                .font(.system(size: 24, weight: .bold, design: .monospaced))
                                .foregroundColor(calledColor)
                        }

                        // プログレスバー
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color.black.opacity(0.08))
                                    .frame(height: 12)

                                RoundedRectangle(cornerRadius: 6)
                                    .fill(calledColor)
                                    .frame(width: geometry.size.width * progress, height: 12)
                                    .animation(.linear(duration: 1), value: remainingSeconds)
                            }
                        }
                        .frame(height: 12)

                        Text("時間内にお越しにならない場合、自動でキャンセルされます")
                            .font(.system(size: 12))
                            .foregroundColor(.black.opacity(0.4))
                            .multilineTextAlignment(.center)
                    }
                    .padding(24)
                    .background(
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color.black.opacity(0.03))
                    )
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 50)
            }
        }
        .onAppear {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
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
                appState.currentScreen = .qrScanner
            }
        }
    }
}

#Preview {
    CalledView()
        .environmentObject({
            let state = AppState()
            state.userName = "山田 太郎"
            return state
        }())
}
