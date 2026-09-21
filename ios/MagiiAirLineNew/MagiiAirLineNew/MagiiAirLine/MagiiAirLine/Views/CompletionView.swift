import SwiftUI
import UIKit
import Combine

struct CompletionView: View {
    @EnvironmentObject var appState: AppState
    @State private var countdown: Int = 5
    @State private var checkmarkScale: CGFloat = 0

    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Success content
                VStack(spacing: 32) {
                    // Checkmark circle
                    ZStack {
                        Circle()
                            .strokeBorder(Color.success, lineWidth: 3)
                            .frame(width: 120, height: 120)

                        Image(systemName: "checkmark")
                            .font(.system(size: 56, weight: .medium))
                            .foregroundColor(Color.success)
                            .scaleEffect(checkmarkScale)
                    }

                    // Message
                    VStack(spacing: 12) {
                        Text("ご来店ありがとうございます")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundColor(Color.textPrimary)

                        Text("またのご利用をお待ちしております")
                            .font(.system(size: 15))
                            .foregroundColor(Color.textSecondary)
                    }
                }

                Spacer()

                // Auto-redirect notice
                VStack(spacing: 12) {
                    Text("\(countdown)秒後に最初の画面に戻ります")
                        .font(.system(size: 13))
                        .foregroundColor(Color.textSecondary)

                    // Progress bar
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.border)
                                .frame(height: 4)

                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.success)
                                .frame(width: geometry.size.width * CGFloat(5 - countdown) / 5, height: 4)
                                .animation(.linear(duration: 1), value: countdown)
                        }
                    }
                    .frame(height: 4)
                    .padding(.horizontal, 60)
                }
                .padding(.bottom, 48)

                // Manual button
                SecondaryButton(title: "今すぐ戻る") {
                    resetAndReturn()
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .onAppear {
            // Animate checkmark
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                checkmarkScale = 1.0
            }

            // Haptic feedback
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        }
        .onReceive(timer) { _ in
            if countdown > 0 {
                countdown -= 1
            } else {
                resetAndReturn()
            }
        }
    }

    private func resetAndReturn() {
        // Reset state for next guest
        appState.resetTicketState()
        appState.currentScreen = .qrScanner

        // SSE接続を切断
        SSEService.shared.disconnect()

        // ウィジェットをクリア
        WidgetDataManager.shared.clear()
    }
}

#Preview {
    CompletionView()
        .environmentObject(AppState())
}
