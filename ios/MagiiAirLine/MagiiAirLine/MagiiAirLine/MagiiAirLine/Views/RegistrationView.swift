import SwiftUI

struct RegistrationView: View {
    @EnvironmentObject var appState: AppState
    @State private var name: String = ""
    @State private var phone: String = ""
    @State private var partySize: Int = 1
    @State private var showConfirmation: Bool = false
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
                            .foregroundColor(.textPrimary)
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)

                Spacer()
                    .frame(height: 32)

                // Title
                VStack(spacing: 8) {
                    Text("情報を入力")
                        .font(.largeTitle)
                        .foregroundColor(.textPrimary)

                    Text("順番をお取りするための情報を入力してください")
                        .font(.bodyText)
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()
                    .frame(height: 40)

                // Form
                VStack(spacing: 16) {
                    // Name field
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("お名前")
                                .font(.label)
                                .foregroundColor(.textSecondary)

                            TextField("", text: $name)
                                .font(.bodyText)
                                .foregroundColor(.textPrimary)
                                .placeholder(when: name.isEmpty) {
                                    Text("山田 太郎")
                                        .foregroundColor(.textSecondary.opacity(0.5))
                                }
                                .focused($focusedField, equals: .name)
                                .textContentType(.name)
                        }
                    }

                    // Phone field
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("電話番号")
                                .font(.label)
                                .foregroundColor(.textSecondary)

                            TextField("", text: $phone)
                                .font(.bodyText)
                                .foregroundColor(.textPrimary)
                                .placeholder(when: phone.isEmpty) {
                                    Text("090-1234-5678")
                                        .foregroundColor(.textSecondary.opacity(0.5))
                                }
                                .focused($focusedField, equals: .phone)
                                .keyboardType(.phonePad)
                                .textContentType(.telephoneNumber)
                        }
                    }

                    // Party size
                    CardView {
                        HStack {
                            Text("人数")
                                .font(.label)
                                .foregroundColor(.textSecondary)

                            Spacer()

                            HStack(spacing: 20) {
                                Button {
                                    if partySize > 1 {
                                        partySize -= 1
                                    }
                                } label: {
                                    Image(systemName: "minus.circle.fill")
                                        .font(.system(size: 28))
                                        .foregroundColor(partySize > 1 ? .textPrimary : .textSecondary)
                                }
                                .disabled(partySize <= 1)

                                Text("\(partySize)")
                                    .font(.waitingNumber)
                                    .foregroundColor(.textPrimary)
                                    .frame(minWidth: 40)

                                Button {
                                    if partySize < 10 {
                                        partySize += 1
                                    }
                                } label: {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 28))
                                        .foregroundColor(partySize < 10 ? .textPrimary : .textSecondary)
                                }
                                .disabled(partySize >= 10)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)

                Spacer()

                // Submit button
                PrimaryButton(title: "次へ", isEnabled: isFormValid) {
                    showConfirmation = true
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
        .sheet(isPresented: $showConfirmation) {
            ConfirmationSheet(
                name: name,
                phone: phone,
                partySize: partySize,
                onRegister: {
                    // Save user info
                    appState.userName = name
                    appState.userPhone = phone
                    appState.partySize = partySize
                    appState.isFirstTimeUser = false
                    appState.currentScreen = .waiting
                },
                onOneTime: {
                    // Use without saving
                    appState.userName = name
                    appState.userPhone = phone
                    appState.partySize = partySize
                    appState.currentScreen = .waiting
                }
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
    }
}

// Confirmation sheet
struct ConfirmationSheet: View {
    let name: String
    let phone: String
    let partySize: Int
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

                Text("この情報を登録しますか？")
                    .font(.heading)
                    .foregroundColor(.textPrimary)

                // Info summary
                CardView {
                    VStack(spacing: 16) {
                        HStack {
                            Text("お名前")
                                .font(.label)
                                .foregroundColor(.textSecondary)
                            Spacer()
                            Text(name)
                                .font(.bodyText)
                                .foregroundColor(.textPrimary)
                        }

                        Divider()
                            .background(Color.border)

                        HStack {
                            Text("電話番号")
                                .font(.label)
                                .foregroundColor(.textSecondary)
                            Spacer()
                            Text(phone)
                                .font(.bodyText)
                                .foregroundColor(.textPrimary)
                        }

                        Divider()
                            .background(Color.border)

                        HStack {
                            Text("人数")
                                .font(.label)
                                .foregroundColor(.textSecondary)
                            Spacer()
                            Text("\(partySize)名")
                                .font(.bodyText)
                                .foregroundColor(.textPrimary)
                        }
                    }
                }
                .padding(.horizontal, 16)

                Text("登録すると、次回から入力が不要になります")
                    .font(.label)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)

                Spacer()

                VStack(spacing: 12) {
                    PrimaryButton(title: "はい、登録する") {
                        dismiss()
                        onRegister()
                    }

                    SecondaryButton(title: "今回だけ使う") {
                        dismiss()
                        onOneTime()
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
    }
}

// Placeholder modifier
extension View {
    func placeholder<Content: View>(
        when shouldShow: Bool,
        @ViewBuilder placeholder: () -> Content
    ) -> some View {
        ZStack(alignment: .leading) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

#Preview {
    RegistrationView()
        .environmentObject(AppState())
}
