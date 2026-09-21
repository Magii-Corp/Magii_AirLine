import SwiftUI
import UIKit

// MARK: - Haptic Feedback Helper
struct HapticFeedback {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }

    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(type)
    }

    static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }
}

// MARK: - Primary Button (テーマカラー)
struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var isEnabled: Bool = true

    var body: some View {
        Button {
            HapticFeedback.impact(.medium)
            action()
        } label: {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(isEnabled ? .white : .white.opacity(0.6))
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    Capsule()
                        .fill(isEnabled ? Color.theme : Color.gray.opacity(0.3))
                )
        }
        .disabled(!isEnabled)
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Secondary Button (線のみ)
struct SecondaryButton: View {
    let title: String
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button {
            HapticFeedback.impact(.light)
            action()
        } label: {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(isEnabled ? Color.textPrimary : Color.textPrimary.opacity(0.5))
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .overlay(
                    Capsule()
                        .strokeBorder(isEnabled ? Color.border : Color.border.opacity(0.5), lineWidth: 1)
                )
        }
        .disabled(!isEnabled)
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Ghost Button (テキストのみ)
struct GhostButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button {
            HapticFeedback.impact(.light)
            action()
        } label: {
            Text(title)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color.textSecondary)
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Called Button (呼び出し時)
struct CalledButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button {
            HapticFeedback.impact(.medium)
            action()
        } label: {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    Capsule()
                        .fill(Color.called)
                )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Scale Button Style (もわんってなる演出)
struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
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
    .background(Color.appBackground)
}
