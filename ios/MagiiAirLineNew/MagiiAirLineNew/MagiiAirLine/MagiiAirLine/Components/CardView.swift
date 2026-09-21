import SwiftUI

// MARK: - Glass Card (リキッドグラス効果)
struct GlassCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(24)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .strokeBorder(Color.black.opacity(0.1), lineWidth: 1)
            )
    }
}

// MARK: - Simple Card (白背景 + 線)
struct CardView<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .strokeBorder(Color.black.opacity(0.1), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.03), radius: 10, x: 0, y: 4)
    }
}

// MARK: - Outlined Card (線のみ)
struct OutlinedCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .strokeBorder(Color.black.opacity(0.1), lineWidth: 1)
            )
    }
}

#Preview {
    VStack(spacing: 20) {
        GlassCard {
            Text("Glass Card")
                .foregroundColor(.black)
        }

        CardView {
            Text("Simple Card")
                .foregroundColor(.black)
        }

        OutlinedCard {
            Text("Outlined Card")
                .foregroundColor(.black)
        }
    }
    .padding()
    .background(Color.white)
}
