import SwiftUI

struct WaitingView: View {
    @EnvironmentObject var appState: AppState
    @State private var showCancelConfirmation = false

    // Demo values
    @State private var groupsAhead: Int = 5
    @State private var estimatedMinutes: Int = 25
    @State private var waitingNumber: Int = 42

    private let themeColor = Color(hex: "0B63CE")
    private let calledColor = Color(hex: "FF9500")

    private var isAlmostReady: Bool {
        groupsAhead <= 1
    }

    var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("待機中")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(themeColor)

                        Text("受付番号 \(waitingNumber)")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.black)
                    }

                    Spacer()

                    // User info badge
                    HStack(spacing: 6) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                        Text("\(appState.partySize)名")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundColor(themeColor)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .fill(themeColor.opacity(0.1))
                    )
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                Spacer()

                // Main content - Groups ahead
                VStack(spacing: 20) {
                    Text("あなたの前に")
                        .font(.system(size: 17))
                        .foregroundColor(.black.opacity(0.5))

                    // Big number
                    HStack(alignment: .lastTextBaseline, spacing: 8) {
                        Text("\(groupsAhead)")
                            .font(.system(size: 120, weight: .bold, design: .rounded))
                            .foregroundColor(isAlmostReady ? calledColor : .black)
                            .contentTransition(.numericText())

                        Text("組")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundColor(.black.opacity(0.4))
                    }
                }
                .frame(maxWidth: .infinity)

                Spacer()
                    .frame(height: 40)

                // Estimated wait time
                VStack(spacing: 8) {
                    Text("予想待ち時間")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(.black.opacity(0.5))

                    if !isAlmostReady {
                        HStack(alignment: .lastTextBaseline, spacing: 4) {
                            Text("約")
                                .font(.system(size: 20))
                                .foregroundColor(.black.opacity(0.6))
                            Text("\(estimatedMinutes)")
                                .font(.system(size: 56, weight: .bold, design: .rounded))
                                .foregroundColor(themeColor)
                            Text("分")
                                .font(.system(size: 20))
                                .foregroundColor(.black.opacity(0.6))
                        }
                    } else {
                        Text("まもなくお呼びします")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(calledColor)
                    }
                }
                .padding(.vertical, 28)
                .padding(.horizontal, 36)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .strokeBorder(isAlmostReady ? calledColor : themeColor, lineWidth: 2)
                )
                .padding(.horizontal, 20)

                Spacer()

                // Info card
                VStack(spacing: 0) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("お名前")
                                .font(.system(size: 12))
                                .foregroundColor(.black.opacity(0.5))
                            Text(appState.userName.isEmpty ? "ゲスト" : appState.userName)
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.black)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("電話番号")
                                .font(.system(size: 12))
                                .foregroundColor(.black.opacity(0.5))
                            Text(formatPhone(appState.userPhone))
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.black)
                        }
                    }
                }
                .padding(20)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Color.black.opacity(0.1), lineWidth: 1)
                )
                .padding(.horizontal, 20)

                Spacer()
                    .frame(height: 24)

                // Cancel button
                Button(action: {
                    showCancelConfirmation = true
                }) {
                    Text("順番をキャンセル")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.black.opacity(0.6))
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(
                            Capsule()
                                .strokeBorder(Color.black.opacity(0.15), lineWidth: 1)
                        )
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 16)

                // Demo buttons
                #if DEBUG
                HStack(spacing: 16) {
                    Button("前の組が進む") {
                        withAnimation {
                            if groupsAhead > 0 {
                                groupsAhead -= 1
                                estimatedMinutes = max(0, estimatedMinutes - 5)
                            }
                        }
                    }
                    .font(.system(size: 13))
                    .foregroundColor(.black.opacity(0.4))

                    Button("呼び出しデモ") {
                        appState.currentScreen = .called
                    }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(themeColor)
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
