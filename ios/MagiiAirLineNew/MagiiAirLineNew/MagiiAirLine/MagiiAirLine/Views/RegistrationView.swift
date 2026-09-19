import SwiftUI

struct RegistrationView: View {
    @EnvironmentObject var appState: AppState
    @State private var name: String = ""
    @State private var phone: String = ""
    @State private var partySize: Int = 1
    @State private var showConfirmation: Bool = false
    @FocusState private var focusedField: Field?

    private let themeColor = Color(hex: "0B63CE")

    enum Field {
        case name, phone
    }

    private var isFormValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        phone.count >= 10
    }

    var body: some View {
        ZStack {
            Color.white
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
                            .foregroundColor(.black)
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
                        .foregroundColor(.black)

                    Text("順番をお取りするための情報を入力してください")
                        .font(.system(size: 15))
                        .foregroundColor(.black.opacity(0.5))
                        .multilineTextAlignment(.center)
                }

                Spacer()
                    .frame(height: 40)

                // Form
                VStack(spacing: 16) {
                    // Name field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("お名前")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(themeColor)
                            .padding(.leading, 4)

                        TextField("山田 太郎", text: $name)
                            .font(.system(size: 17))
                            .foregroundColor(.black)
                            .focused($focusedField, equals: .name)
                            .textContentType(.name)
                            .padding(16)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(focusedField == .name ? themeColor : Color.black.opacity(0.15), lineWidth: focusedField == .name ? 2 : 1)
                            )
                    }

                    // Phone field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("電話番号")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(themeColor)
                            .padding(.leading, 4)

                        TextField("090-1234-5678", text: $phone)
                            .font(.system(size: 17))
                            .foregroundColor(.black)
                            .focused($focusedField, equals: .phone)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .padding(16)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(focusedField == .phone ? themeColor : Color.black.opacity(0.15), lineWidth: focusedField == .phone ? 2 : 1)
                            )
                    }

                    // Party size
                    HStack {
                        Text("人数")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(.black)

                        Spacer()

                        HStack(spacing: 24) {
                            Button {
                                if partySize > 1 {
                                    partySize -= 1
                                }
                            } label: {
                                Image(systemName: "minus.circle")
                                    .font(.system(size: 28, weight: .light))
                                    .foregroundColor(partySize > 1 ? themeColor : Color.black.opacity(0.2))
                            }
                            .disabled(partySize <= 1)

                            Text("\(partySize)")
                                .font(.system(size: 24, weight: .semibold, design: .rounded))
                                .foregroundColor(.black)
                                .frame(minWidth: 32)

                            Button {
                                if partySize < 10 {
                                    partySize += 1
                                }
                            } label: {
                                Image(systemName: "plus.circle")
                                    .font(.system(size: 28, weight: .light))
                                    .foregroundColor(partySize < 10 ? themeColor : Color.black.opacity(0.2))
                            }
                            .disabled(partySize >= 10)
                        }
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color.black.opacity(0.15), lineWidth: 1)
                    )
                }
                .padding(.horizontal, 20)

                Spacer()

                // Submit button
                PrimaryButton(title: "次へ", isEnabled: isFormValid) {
                    showConfirmation = true
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .sheet(isPresented: $showConfirmation) {
            ConfirmationSheet(
                name: name,
                phone: phone,
                partySize: partySize,
                onRegister: {
                    appState.userName = name
                    appState.userPhone = phone
                    appState.partySize = partySize
                    appState.isFirstTimeUser = false
                    appState.currentScreen = .waiting
                },
                onOneTime: {
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

    private let themeColor = Color(hex: "0B63CE")

    var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()
                    .frame(height: 16)

                Text("この内容で発券しますか？")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.black)

                // Info summary
                VStack(spacing: 0) {
                    HStack {
                        Text("お名前")
                            .font(.system(size: 14))
                            .foregroundColor(.black.opacity(0.5))
                        Spacer()
                        Text(name)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.black)
                    }
                    .padding(.vertical, 16)

                    Divider()

                    HStack {
                        Text("電話番号")
                            .font(.system(size: 14))
                            .foregroundColor(.black.opacity(0.5))
                        Spacer()
                        Text(phone)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.black)
                    }
                    .padding(.vertical, 16)

                    Divider()

                    HStack {
                        Text("人数")
                            .font(.system(size: 14))
                            .foregroundColor(.black.opacity(0.5))
                        Spacer()
                        Text("\(partySize)名")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.black)
                    }
                    .padding(.vertical, 16)
                }
                .padding(.horizontal, 20)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(themeColor.opacity(0.05))
                )
                .padding(.horizontal, 20)

                Text("登録すると、次回から入力が不要になります")
                    .font(.system(size: 13))
                    .foregroundColor(.black.opacity(0.5))
                    .multilineTextAlignment(.center)

                Spacer()

                VStack(spacing: 12) {
                    PrimaryButton(title: "発券する") {
                        dismiss()
                        onRegister()
                    }

                    SecondaryButton(title: "今回だけ使う") {
                        dismiss()
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
