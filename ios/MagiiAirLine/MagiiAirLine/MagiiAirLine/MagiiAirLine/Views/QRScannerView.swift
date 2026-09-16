import SwiftUI
import AVFoundation

struct QRScannerView: View {
    @EnvironmentObject var appState: AppState
    @State private var isScanning = true

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // QR Scanner Frame
                ZStack {
                    // Camera placeholder (実際の実装時はAVCaptureSessionを使用)
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color.cardPrimary)
                        .frame(width: 280, height: 280)

                    // Scanner frame corners
                    ScannerFrameView()
                        .frame(width: 240, height: 240)

                    if isScanning {
                        // Scanning animation line
                        ScanningLineView()
                            .frame(width: 200)
                    }
                }

                Spacer()
                    .frame(height: 48)

                // Instructions
                VStack(spacing: 8) {
                    Text("QRコードをスキャン")
                        .font(.heading)
                        .foregroundColor(.textPrimary)

                    Text("店舗のQRコードを枠内に合わせてください")
                        .font(.bodyText)
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                // Demo button (for development)
                #if DEBUG
                PrimaryButton(title: "デモ: スキャン完了") {
                    handleQRScanned(storeId: "demo_store_001")
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
                #endif
            }
        }
    }

    private func handleQRScanned(storeId: String) {
        appState.storeId = storeId

        // 初回ユーザーの場合は登録画面へ、そうでなければ確認画面へ
        if appState.isFirstTimeUser {
            appState.currentScreen = .registration
        } else {
            // 登録済みの場合は直接待機画面へ（実装時は確認モーダルを表示）
            appState.currentScreen = .waiting
        }
    }
}

// Scanner frame corners
struct ScannerFrameView: View {
    let cornerLength: CGFloat = 30
    let lineWidth: CGFloat = 4

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height

            Path { path in
                // Top-left
                path.move(to: CGPoint(x: 0, y: cornerLength))
                path.addLine(to: CGPoint(x: 0, y: 0))
                path.addLine(to: CGPoint(x: cornerLength, y: 0))

                // Top-right
                path.move(to: CGPoint(x: width - cornerLength, y: 0))
                path.addLine(to: CGPoint(x: width, y: 0))
                path.addLine(to: CGPoint(x: width, y: cornerLength))

                // Bottom-right
                path.move(to: CGPoint(x: width, y: height - cornerLength))
                path.addLine(to: CGPoint(x: width, y: height))
                path.addLine(to: CGPoint(x: width - cornerLength, y: height))

                // Bottom-left
                path.move(to: CGPoint(x: cornerLength, y: height))
                path.addLine(to: CGPoint(x: 0, y: height))
                path.addLine(to: CGPoint(x: 0, y: height - cornerLength))
            }
            .stroke(Color.textPrimary, lineWidth: lineWidth)
        }
    }
}

// Scanning animation line
struct ScanningLineView: View {
    @State private var offset: CGFloat = -100

    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.textPrimary.opacity(0),
                        Color.textPrimary.opacity(0.8),
                        Color.textPrimary.opacity(0)
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(height: 2)
            .offset(y: offset)
            .onAppear {
                withAnimation(
                    Animation.easeInOut(duration: 2.0)
                        .repeatForever(autoreverses: true)
                ) {
                    offset = 100
                }
            }
    }
}

#Preview {
    QRScannerView()
        .environmentObject(AppState())
}
