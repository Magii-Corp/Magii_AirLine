import SwiftUI

// MARK: - Primary Button (テーマカラー)
struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var isEnabled: Bool = true

    private let themeColor = Color(hex: "0B63CE")

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    Capsule()
                        .fill(isEnabled ? themeColor : themeColor.opacity(0.3))
                )
        }
        .disabled(!isEnabled)
    }
}

// MARK: - Secondary Button (線のみ)
struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .overlay(
                    Capsule()
                        .strokeBorder(Color.black.opacity(0.15), lineWidth: 1)
                )
        }
    }
}

// MARK: - Ghost Button (テキストのみ)
struct GhostButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.black.opacity(0.5))
        }
    }
}

// MARK: - Called Button (呼び出し時)
struct CalledButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    Capsule()
                        .fill(Color.orange)
                )
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        PrimaryButton(title: "順番を取る", action: {})
        SecondaryButton(title: "キャンセル", action: {})
        GhostButton(title: "スキップ", action: {})
        CalledButton(title: "到着しました", action: {})
    }
    .padding()
    .background(Color.white)
}
