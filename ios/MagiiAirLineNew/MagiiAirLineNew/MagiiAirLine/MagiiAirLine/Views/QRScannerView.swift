import SwiftUI
import AVFoundation

struct QRScannerView: View {
    @EnvironmentObject var appState: AppState
    @State private var isScanning = true

    private let themeColor = Color(hex: "0B63CE")

    var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // QR Scanner Frame
                ZStack {
                    // Camera placeholder with theme tint
                    RoundedRectangle(cornerRadius: 24)
                        .fill(themeColor.opacity(0.03))
                        .frame(width: 280, height: 280)

                    // Scanner frame corners with theme color
                    ScannerFrameView(color: themeColor)
                        .frame(width: 240, height: 240)

                    if isScanning {
                        ScanningLineView(color: themeColor)
                            .frame(width: 200)
                    }
                }

                Spacer()
                    .frame(height: 48)

                // Instructions
                VStack(spacing: 8) {
                    Text("QRコードをスキャン")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(.black)

                    Text("店舗のQRコードを枠内に合わせてください")
                        .font(.system(size: 15))
                        .foregroundColor(.black.opacity(0.5))
                        .multilineTextAlignment(.center)
                }

                Spacer()

                // Demo button
                #if DEBUG
                PrimaryButton(title: "デモ: スキャン完了") {
                    handleQRScanned(storeId: "demo_store_001")
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
                #endif
            }
        }
    }

    private func handleQRScanned(storeId: String) {
        appState.storeId = storeId

        if appState.isFirstTimeUser {
            appState.currentScreen = .registration
        } else {
            appState.currentScreen = .waiting
        }
    }
}

// Scanner frame corners
struct ScannerFrameView: View {
    var color: Color = .black
    let cornerLength: CGFloat = 30
    let lineWidth: CGFloat = 3

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
            .stroke(color, lineWidth: lineWidth)
        }
    }
}

// Scanning animation line
struct ScanningLineView: View {
    var color: Color = .black
    @State private var offset: CGFloat = -100

    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    gradient: Gradient(colors: [
                        color.opacity(0),
                        color.opacity(0.8),
                        color.opacity(0)
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
