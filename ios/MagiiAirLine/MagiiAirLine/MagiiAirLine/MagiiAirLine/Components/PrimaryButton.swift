import SwiftUI

struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var isEnabled: Bool = true

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.button)
                .foregroundColor(.buttonText)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(isEnabled ? Color.buttonBackground : Color.buttonBackground.opacity(0.5))
                .clipShape(Capsule())
        }
        .disabled(!isEnabled)
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.button)
                .foregroundColor(.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(Color.cardPrimary)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(Color.border, lineWidth: 1)
                )
        }
    }
}

struct CalledButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.button)
                .foregroundColor(.calledBackground)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(Color.calledText)
                .clipShape(Capsule())
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        PrimaryButton(title: "順番を取る", action: {})
        SecondaryButton(title: "キャンセル", action: {})
        CalledButton(title: "到着しました", action: {})
    }
    .padding()
    .background(Color.appBackground)
}
