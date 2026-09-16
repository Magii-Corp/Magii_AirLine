import SwiftUI

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
                            .stroke(Color.textPrimary, lineWidth: 3)
                            .frame(width: 120, height: 120)

                        Image(systemName: "checkmark")
                            .font(.system(size: 56, weight: .medium))
                            .foregroundColor(.textPrimary)
                            .scaleEffect(checkmarkScale)
                    }

                    // Message
                    VStack(spacing: 12) {
                        Text("ご来店ありがとうございます")
                            .font(.heading)
                            .foregroundColor(.textPrimary)

                        Text("またのご利用をお待ちしております")
                            .font(.bodyText)
                            .foregroundColor(.textSecondary)
                    }
                }

                Spacer()

                // Auto-redirect notice
                VStack(spacing: 8) {
                    Text("\(countdown)秒後に最初の画面に戻ります")
                        .font(.label)
                        .foregroundColor(.textSecondary)

                    // Progress bar
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.cardPrimary)
                                .frame(height: 4)
                                .cornerRadius(2)

                            Rectangle()
                                .fill(Color.textPrimary)
                                .frame(width: geometry.size.width * CGFloat(5 - countdown) / 5, height: 4)
                                .cornerRadius(2)
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
                .padding(.horizontal, 16)
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
        // Reset state for next customer
        appState.waitingNumber = 0
        appState.groupsAhead = 0
        appState.currentScreen = .qrScanner
    }
}

#Preview {
    CompletionView()
        .environmentObject(AppState())
}
