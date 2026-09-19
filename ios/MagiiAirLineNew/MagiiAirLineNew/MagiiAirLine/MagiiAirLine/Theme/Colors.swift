import SwiftUI

extension Color {
    // MARK: - Theme Color
    static let theme = Color(hex: "0B63CE")
    static let themeLight = Color(hex: "0B63CE").opacity(0.1)

    // MARK: - Background
    static let appBackground = Color.white

    // MARK: - Text
    static let textPrimary = Color.black
    static let textSecondary = Color.black.opacity(0.5)

    // MARK: - Border
    static let border = Color.black.opacity(0.12)

    // MARK: - Status
    static let success = Color(hex: "34C759")
    static let warning = Color(hex: "FF9500")
    static let called = Color(hex: "FF9500")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
