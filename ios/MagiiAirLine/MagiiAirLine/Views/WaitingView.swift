import SwiftUI

struct WaitingView: View {
    @EnvironmentObject var appState: AppState
    @State private var showCancelConfirmation = false

    // Demo values (実際はSupabase Realtimeで購読)
    @State private var groupsAhead: Int = 5
    @State private var estimatedMinutes: Int = 25
    @State private var waitingNumber: Int = 42

    private var isAlmostReady: Bool {
        groupsAhead <= 1
    }

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("待機中")
                            .font(.label)
                            .foregroundColor(.textSecondary)

                        Text("受付番号 \(waitingNumber)")
                            .font(.heading)
                            .foregroundColor(.textPrimary)
                    }

                    Spacer()

                    // User info badge
                    HStack(spacing: 8) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 14))
                        Text("\(appState.partySize)名")
                            .font(.label)
                    }
                    .foregroundColor(.textSecondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.cardPrimary)
                    .cornerRadius(20)
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)

                Spacer()

                // Main content - Groups ahead
                VStack(spacing: 16) {
                    Text("あなたの前に")
                        .font(.bodyText)
                        .foregroundColor(.textSecondary)

                    // Big number
                    HStack(alignment: .lastTextBaseline, spacing: 8) {
                        Text("\(groupsAhead)")
                            .font(.heroNumber)
                            .foregroundColor(isAlmostReady ? .warning : .textPrimary)
                            .contentTransition(.numericText())

                        Text("組")
                            .font(.heading)
                            .foregroundColor(.textSecondary)
                    }

                    // Progress indicator
                    if !isAlmostReady {
                        Text("予想待ち時間 約\(estimatedMinutes)分")
                            .font(.label)
                            .foregroundColor(.textSecondary)
                    } else {
                        Text("まもなくお呼びします")
                            .font(.bodyText)
                            .foregroundColor(.warning)
                    }
                }

                Spacer()

                // Info cards
                VStack(spacing: 12) {
                    CardView {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("お名前")
                                    .font(.label)
                                    .foregroundColor(.textSecondary)
                                Text(appState.userName.isEmpty ? "ゲスト" : appState.userName)
                                    .font(.bodyText)
                                    .foregroundColor(.textPrimary)
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 4) {
                                Text("電話番号")
                                    .font(.label)
                                    .foregroundColor(.textSecondary)
                                Text(formatPhone(appState.userPhone))
                                    .font(.bodyText)
                                    .foregroundColor(.textPrimary)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)

                Spacer()
                    .frame(height: 24)

                // Cancel button
                SecondaryButton(title: "順番をキャンセル") {
                    showCancelConfirmation = true
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)

                // Demo buttons (for development)
                #if DEBUG
                HStack(spacing: 12) {
                    Button("前の組が進む") {
                        withAnimation {
                            if groupsAhead > 0 {
                                groupsAhead -= 1
                                estimatedMinutes = max(0, estimatedMinutes - 5)
                            }
                        }
                    }
                    .font(.label)
                    .foregroundColor(.textSecondary)

                    Button("呼び出しデモ") {
                        appState.currentScreen = .called
                    }
                    .font(.label)
                    .foregroundColor(.warning)
                }
                .padding(.bottom, 32)
                #endif
            }
        }
        .alert("順番をキャンセルしますか？", isPresented: $showCancelConfirmation) {
            Button("キャンセルする", role: .destructive) {
                appState.currentScreen = .qrScanner
            }
            Button("戻る", role: .cancel) {}
        } message: {
            Text("キャンセルすると、再度QRコードを読み取る必要があります。")
        }
    }

    private func formatPhone(_ phone: String) -> String {
        if phone.isEmpty { return "-" }
        // Simple formatting for demo
        return phone
    }
}

#Preview {
    WaitingView()
        .environmentObject({
            let state = AppState()
            state.userName = "山田 太郎"
            state.userPhone = "090-1234-5678"
            state.partySize = 2
            return state
        }())
}
