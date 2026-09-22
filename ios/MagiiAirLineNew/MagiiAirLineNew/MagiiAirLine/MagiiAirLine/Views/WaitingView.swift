import SwiftUI
import UIKit

struct WaitingView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject private var sseService = SSEService.shared
    @State private var showCancelConfirmation = false
    @State private var showEditSheet = false
    @State private var isCancelling = false
    @State private var errorMessage: String?

    private var isAlmostReady: Bool {
        appState.groupsAhead <= 1
    }

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text("待機中")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(Color.theme)

                            // Connection status
                            Circle()
                                .fill(sseService.isConnected ? Color.green : Color.red)
                                .frame(width: 6, height: 6)
                        }

                        Text("受付番号 \(appState.waitingNumber)")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(Color.textPrimary)
                    }

                    Spacer()

                    // User info badge
                    HStack(spacing: 6) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                        Text("\(appState.partySize)名")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundColor(Color.theme)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .fill(Color.theme.opacity(0.1))
                    )
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                // Error message
                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                }

                Spacer()

                // Main content - Groups ahead
                VStack(spacing: 20) {
                    Text("あなたの前に")
                        .font(.system(size: 17))
                        .foregroundColor(Color.textSecondary)

                    // Big number
                    HStack(alignment: .lastTextBaseline, spacing: 8) {
                        Text("\(appState.groupsAhead)")
                            .font(.system(size: 120, weight: .bold, design: .rounded))
                            .foregroundColor(isAlmostReady ? Color.called : Color.textPrimary)
                            .contentTransition(.numericText())

                        Text("組")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundColor(Color.textTertiary)
                    }
                }
                .frame(maxWidth: .infinity)

                Spacer()
                    .frame(height: 40)

                // Estimated wait time
                VStack(spacing: 8) {
                    Text("予想待ち時間")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Color.textSecondary)

                    if !isAlmostReady {
                        HStack(alignment: .lastTextBaseline, spacing: 4) {
                            Text("約")
                                .font(.system(size: 20))
                                .foregroundColor(Color.textSecondary)
                            Text("\(appState.estimatedMinutes)")
                                .font(.system(size: 56, weight: .bold, design: .rounded))
                                .foregroundColor(Color.theme)
                            Text("分")
                                .font(.system(size: 20))
                                .foregroundColor(Color.textSecondary)
                        }
                    } else {
                        Text("まもなくお呼びします")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(Color.called)
                    }
                }
                .padding(.vertical, 28)
                .padding(.horizontal, 36)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .strokeBorder(isAlmostReady ? Color.called : Color.theme, lineWidth: 2)
                )
                .padding(.horizontal, 20)

                Spacer()

                // Info card
                VStack(spacing: 0) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("お名前")
                                .font(.system(size: 12))
                                .foregroundColor(Color.textSecondary)
                            Text(appState.userName.isEmpty ? "ゲスト" : appState.userName)
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(Color.textPrimary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("電話番号")
                                .font(.system(size: 12))
                                .foregroundColor(Color.textSecondary)
                            Text(formatPhone(appState.userPhone))
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(Color.textPrimary)
                        }

                        // 編集ボタン
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            showEditSheet = true
                        } label: {
                            Image(systemName: "pencil.circle.fill")
                                .font(.system(size: 28))
                                .foregroundColor(Color.theme)
                        }
                        .buttonStyle(ScaleButtonStyle())
                        .padding(.leading, 12)
                    }
                }
                .padding(20)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Color.border, lineWidth: 1)
                )
                .padding(.horizontal, 20)

                Spacer()
                    .frame(height: 24)

                // Cancel button
                Button(action: {
                    showCancelConfirmation = true
                }) {
                    Text(isCancelling ? "キャンセル中..." : "順番をキャンセル")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Color.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(
                            Capsule()
                                .strokeBorder(Color.border, lineWidth: 1)
                        )
                }
                .disabled(isCancelling)
                .padding(.horizontal, 20)
                .padding(.bottom, 16)

            }
        }
        .alert("順番をキャンセルしますか？", isPresented: $showCancelConfirmation) {
            Button("キャンセルする", role: .destructive) {
                cancelTicket()
            }
            Button("戻る", role: .cancel) {}
        } message: {
            Text("キャンセルすると、再度QRコードを読み取る必要があります。")
        }
        .sheet(isPresented: $showEditSheet, content: {
            EditInfoSheet()
                .environmentObject(appState)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        })
        .onAppear {
            startSSE()
            // ウィジェットを更新
            WidgetDataManager.shared.setWaiting(
                waitingNumber: appState.waitingNumber,
                groupsAhead: appState.groupsAhead
            )
        }
        .onDisappear {
            sseService.disconnect()
        }
        .onChange(of: appState.groupsAhead) { _, newValue in
            // グループ数が変わったらウィジェットを更新
            WidgetDataManager.shared.setWaiting(
                waitingNumber: appState.waitingNumber,
                groupsAhead: newValue
            )
        }
    }

    private func startSSE() {
        guard !appState.ticketId.isEmpty else { return }

        sseService.onEvent = { event in
            handleSSEEvent(event)
        }

        sseService.connect(ticketID: appState.ticketId)
    }

    private func handleSSEEvent(_ event: SSEEvent) {
        switch event {
        case .ticketCalled(let ticket):
            // 呼び出された
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
            NotificationManager.shared.sendCalledNotification(waitingNumber: ticket.waitingNumber)
            appState.currentScreen = .called

        case .ticketUpdated(let ticket, let groupsAhead, let estimatedMinutes):
            withAnimation {
                appState.groupsAhead = groupsAhead
                appState.estimatedMinutes = estimatedMinutes
            }
            // ステータスが called になったら呼び出し画面へ
            if ticket.status == .called {
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)
                appState.currentScreen = .called
            }

        case .ticketDone:
            // 完了
            appState.currentScreen = .completion

        case .ticketCancelled:
            // キャンセルされた
            appState.resetTicketState()
            appState.currentScreen = .qrScanner

        case .queueUpdated(let groupsAhead, let estimatedMinutes):
            withAnimation {
                appState.groupsAhead = groupsAhead
                appState.estimatedMinutes = estimatedMinutes
            }

        case .storeUpdated(let store):
            appState.storeName = store.name
            if store.status == .closed {
                errorMessage = "店舗が受付を停止しました"
            }

        case .connected:
            errorMessage = nil

        case .disconnected:
            // 再接続を試みる
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                if appState.currentScreen == .waiting {
                    startSSE()
                }
            }

        case .error(let error):
            errorMessage = error.localizedDescription
        }
    }

    private func cancelTicket() {
        guard !appState.ticketId.isEmpty, !appState.accountId.isEmpty else {
            appState.currentScreen = .qrScanner
            return
        }

        isCancelling = true
        errorMessage = nil

        Task {
            do {
                _ = try await APIService.shared.cancelTicket(
                    ticketID: appState.ticketId,
                    accountID: appState.accountId
                )

                await MainActor.run {
                    sseService.disconnect()
                    WidgetDataManager.shared.clear()
                    appState.resetTicketState()
                    appState.currentScreen = .qrScanner
                }
            } catch let error as APIError {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isCancelling = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "キャンセルに失敗しました"
                    isCancelling = false
                }
            }
        }
    }

    private func formatPhone(_ phone: String) -> String {
        if phone.isEmpty { return "-" }
        return phone
    }
}

// MARK: - 情報編集シート
struct EditInfoSheet: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var phone: String = ""
    @FocusState private var focusedField: Field?

    enum Field {
        case name, phone
    }

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()
                .onTapGesture {
                    focusedField = nil
                }

            VStack(spacing: 24) {
                // Header
                HStack {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        dismiss()
                    } label: {
                        Text("キャンセル")
                            .font(.system(size: 16))
                            .foregroundColor(Color.textSecondary)
                    }

                    Spacer()

                    Text("情報を編集")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(Color.textPrimary)

                    Spacer()

                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        appState.saveUserInfo(name: name, phone: phone)
                        dismiss()
                    } label: {
                        Text("保存")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color.theme)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                // Form
                VStack(spacing: 16) {
                    // Name field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("お名前")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(Color.textSecondary)
                            .padding(.leading, 4)

                        TextField("山田 太郎", text: $name)
                            .font(.system(size: 17))
                            .foregroundColor(Color.textPrimary)
                            .focused($focusedField, equals: .name)
                            .textContentType(.name)
                            .padding(16)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(focusedField == .name ? Color.theme : Color.border, lineWidth: focusedField == .name ? 2 : 1)
                            )
                    }

                    // Phone field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("電話番号")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(Color.textSecondary)
                            .padding(.leading, 4)

                        TextField("090-1234-5678", text: $phone)
                            .font(.system(size: 17))
                            .foregroundColor(Color.textPrimary)
                            .focused($focusedField, equals: .phone)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .padding(16)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(focusedField == .phone ? Color.theme : Color.border, lineWidth: focusedField == .phone ? 2 : 1)
                            )
                    }
                }
                .padding(.horizontal, 20)

                Spacer()
            }
        }
        .onAppear {
            name = appState.userName
            phone = appState.userPhone
        }
    }
}

#Preview {
    WaitingView()
        .environmentObject({
            let state = AppState()
            state.userName = "山田 太郎"
            state.userPhone = "090-1234-5678"
            state.partySize = 2
            state.waitingNumber = 42
            state.groupsAhead = 5
            state.estimatedMinutes = 25
            return state
        }())
}
