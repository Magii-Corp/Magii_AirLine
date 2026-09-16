import SwiftUI

struct CardView<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .background(Color.cardPrimary)
            .cornerRadius(20)
    }
}

struct SecondaryCardView<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .background(Color.cardSecondary)
            .cornerRadius(20)
    }
}

#Preview {
    VStack(spacing: 12) {
        CardView {
            Text("Primary Card")
                .foregroundColor(.textPrimary)
        }

        SecondaryCardView {
            Text("Secondary Card")
                .foregroundColor(.textPrimary)
        }
    }
    .padding()
    .background(Color.appBackground)
}
