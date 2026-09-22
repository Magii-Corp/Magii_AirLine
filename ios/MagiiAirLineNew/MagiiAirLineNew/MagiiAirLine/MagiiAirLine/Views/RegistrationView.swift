import SwiftUI

struct RegistrationView: View {
    @EnvironmentObject var appState: AppState
    @State private var name: String = ""
    @State private var phone: String = ""
    @State private var partySize: Int = 1
    @State private var showConfirmation: Bool = false
    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    enum Field {
        case name, phone
    }

    private var isFormValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        phone.count >= 10
    }

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()
                .onTapGesture {
                    focusedField = nil
                }

            VStack(spacing: 0) {
                // Header
                HStack {
                    Button {
                        appState.currentScreen = .qrScanner
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(Color.textPrimary)
                    }
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)

                Spacer()
                    .frame(height: 40)

                // Title
                VStack(spacing: 8) {
                    Text("情報を入力")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(Color.textPrimary)

                    Text(appState.storeName.isEmpty ? "順番をお取りするための情報を入力してください" : appState.storeName)
                        .font(.system(size: 15))
                        .foregroundColor(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()
                    .frame(height: 40)

                // Error message
                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 16)
                }

                // Form
                VStack(spacing: 16) {
                    // Name field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("お名前")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color.theme)
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
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color.theme)
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

                    // Party size
                    HStack {
                        Text("人数")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color.textPrimary)

                        Spacer()

                        HStack(spacing: 24) {
                            Button {
                                if partySize > 1 {
                                    partySize -= 1
                                }
                            } label: {
                                Image(systemName: "minus.circle")
                                    .font(.system(size: 28, weight: .light))
                                    .foregroundColor(partySize > 1 ? Color.theme : Color.textTertiary)
                            }
                            .disabled(partySize <= 1)

                            Text("\(partySize)")
                                .font(.system(size: 24, weight: .semibold, design: .rounded))
                                .foregroundColor(Color.textPrimary)
                                .frame(minWidth: 32)

                            Button {
                                if partySize < 10 {
                                    partySize += 1
                                }
                            } label: {
                                Image(systemName: "plus.circle")
                                    .font(.system(size: 28, weight: .light))
                                    .foregroundColor(partySize < 10 ? Color.theme : Color.textTertiary)
                            }
                            .disabled(partySize >= 10)
                        }
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color.border, lineWidth: 1)
                    )
                }
                .padding(.horizontal, 20)

                Spacer()

                // Submit button
                PrimaryButton(
                    title: isSubmitting ? "処理中..." : "次へ",
                    isEnabled: isFormValid && !isSubmitting
                ) {
                    // 既に情報が保存されている場合は確認をスキップ
                    if !appState.userName.isEmpty && !appState.userPhone.isEmpty {
                        submitRegistration(saveInfo: true)
                    } else {
                        showConfirmation = true
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .onAppear {
            // 保存された情報があれば復元
            if !appState.userName.isEmpty {
                name = appState.userName
            }
            if !appState.userPhone.isEmpty {
                phone = appState.userPhone
            }
        }
        .sheet(isPresented: $showConfirmation, content: {
            ConfirmationSheet(
                name: name,
                phone: phone,
                partySize: partySize,
                isSubmitting: $isSubmitting,
                errorMessage: $errorMessage,
                onRegister: {
                    submitRegistration(saveInfo: true)
                },
                onOneTime: {
                    submitRegistration(saveInfo: false)
                }
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        })
    }

    private func submitRegistration(saveInfo: Bool) {
        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                // 1. 電話番号認証
                let authResponse = try await APIService.shared.authenticatePhone(phoneNumber: phone)
                let accountId = authResponse.account.id

                // 2. アカウントIDを保存
                appState.saveAccountId(accountId)

                // 3. ユーザー情報を保存（オプション）
                if saveInfo {
                    appState.saveUserInfo(name: name, phone: phone)
                }

                // 4. チケット作成
                let ticketResponse = try await APIService.shared.createTicket(
                    storeID: appState.storeId,
                    accountID: accountId,
                    name: name,
                    phoneNumber: phone,
                    partySize: partySize
                )

                // 5. 状態を更新
                await MainActor.run {
                    appState.userName = name
                    appState.userPhone = phone
                    appState.partySize = partySize
                    appState.ticketId = ticketResponse.ticket.id
                    appState.waitingNumber = ticketResponse.ticket.waitingNumber
                    appState.groupsAhead = ticketResponse.groupsAhead
                    appState.estimatedMinutes = ticketResponse.estimatedMinutes

                    // ウィジェットを更新
                    WidgetDataManager.shared.setWaiting(
                        waitingNumber: ticketResponse.ticket.waitingNumber,
                        groupsAhead: ticketResponse.groupsAhead
                    )

                    showConfirmation = false
                    isSubmitting = false
                    appState.currentScreen = .waiting
                }
            } catch let error as APIError {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSubmitting = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "エラーが発生しました"
                    isSubmitting = false
                }
            }
        }
    }
}

// Confirmation sheet
struct ConfirmationSheet: View {
    let name: String
    let phone: String
    let partySize: Int
    @Binding var isSubmitting: Bool
    @Binding var errorMessage: String?
    let onRegister: () -> Void
    let onOneTime: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()
                    .frame(height: 16)

                Text("この内容で発券しますか？")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(Color.textPrimary)

                // Error message
                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .padding(.horizontal, 20)
                }

                // Info summary
                VStack(spacing: 0) {
                    HStack {
                        Text("お名前")
                            .font(.system(size: 14))
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        Text(name)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(Color.textPrimary)
                    }
                    .padding(.vertical, 16)

                    Divider()

                    HStack {
                        Text("電話番号")
                            .font(.system(size: 14))
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        Text(phone)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(Color.textPrimary)
                    }
                    .padding(.vertical, 16)

                    Divider()

                    HStack {
                        Text("人数")
                            .font(.system(size: 14))
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        Text("\(partySize)名")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(Color.textPrimary)
                    }
                    .padding(.vertical, 16)
                }
                .padding(.horizontal, 20)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.cardBackground)
                )
                .padding(.horizontal, 20)

                Text("登録すると、次回から入力が不要になります")
                    .font(.system(size: 13))
                    .foregroundColor(Color.textSecondary)
                    .multilineTextAlignment(.center)

                Spacer()

                VStack(spacing: 12) {
                    PrimaryButton(
                        title: isSubmitting ? "処理中..." : "発券する",
                        isEnabled: !isSubmitting
                    ) {
                        onRegister()
                    }

                    SecondaryButton(title: "今回だけ使う", isEnabled: !isSubmitting) {
                        onOneTime()
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
    }
}

#Preview {
    RegistrationView()
        .environmentObject(AppState())
}
