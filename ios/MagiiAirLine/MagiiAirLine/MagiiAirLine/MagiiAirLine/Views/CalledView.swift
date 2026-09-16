import SwiftUI
import UIKit

struct CalledView: View {
    @EnvironmentObject var appState: AppState
    @State private var isPulsing = false
    @State private var waitingNumber: Int = 42

    var body: some View {
        ZStack {
            // Orange background
            Color.calledBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Main content
                VStack(spacing: 24) {
                    // Icon
                    Image(systemName: "bell.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.calledText)
                        .scaleEffect(isPulsing ? 1.1 : 1.0)
                        .animation(
                            Animation.easeInOut(duration: 0.8)
                                .repeatForever(autoreverses: true),
                            value: isPulsing
                        )

                    // Message
                    VStack(spacing: 8) {
                        Text("\(appState.userName.isEmpty ? "お客" : appState.userName)様")
                            .font(.heading)
                            .foregroundColor(.calledText)

                        Text("席のご用意ができました")
                            .font(.largeTitle)
                            .foregroundColor(.calledText)
                    }

                    // Waiting number
                    VStack(spacing: 4) {
                        Text("受付番号")
                            .font(.label)
                            .foregroundColor(.calledText.opacity(0.7))

                        Text("\(waitingNumber)")
                            .font(.heroNumberMedium)
                            .foregroundColor(.calledText)
                    }
                    .padding(.top, 16)
                }

                Spacer()

                // Instructions
                Text("カウンターまでお越しください")
                    .font(.bodyText)
                    .foregroundColor(.calledText.opacity(0.8))
                    .padding(.bottom, 32)

                // Arrive button
                CalledButton(title: "到着しました") {
                    appState.currentScreen = .completion
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 48)
            }
        }
        .onAppear {
            isPulsing = true
            // Haptic feedback
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
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
