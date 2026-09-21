import SwiftUI

extension Font {
    // MARK: - Hero Number (waiting count)
    static let heroNumber = Font.system(size: 96, weight: .bold, design: .default)
        .monospacedDigit()

    static let heroNumberMedium = Font.system(size: 72, weight: .bold, design: .default)
        .monospacedDigit()

    // MARK: - Heading
    static let heading = Font.system(size: 20, weight: .semibold, design: .default)

    // MARK: - Body
    static let bodyText = Font.system(size: 15, weight: .regular, design: .default)

    // MARK: - Label
    static let label = Font.system(size: 13, weight: .medium, design: .default)

    // MARK: - Button
    static let button = Font.system(size: 17, weight: .semibold, design: .default)

    // MARK: - Large Title
    static let largeTitle = Font.system(size: 34, weight: .bold, design: .default)

    // MARK: - Waiting Number
    static let waitingNumber = Font.system(size: 48, weight: .bold, design: .default)
        .monospacedDigit()
}

extension View {
    func heroNumberStyle() -> some View {
        self
            .font(.heroNumber)
            .foregroundColor(.textPrimary)
            .tracking(-2)
    }

    func headingStyle() -> some View {
        self
            .font(.heading)
            .foregroundColor(.textPrimary)
    }

    func bodyStyle() -> some View {
        self
            .font(.bodyText)
            .foregroundColor(.textPrimary)
    }

    func labelStyle() -> some View {
        self
            .font(.label)
            .foregroundColor(.textSecondary)
    }
}
