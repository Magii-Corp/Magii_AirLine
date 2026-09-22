import SwiftUI
import AVFoundation

struct QRScannerView: View {
    @EnvironmentObject var appState: AppState

    @State private var isScanning = true
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var cameraPermissionDenied = false

    var body: some View {
        ZStack {
            // カメラプレビュー（背景全体）
            if isScanning && !cameraPermissionDenied {
                CameraPreviewView(onQRCodeScanned: handleQRScanned)
                    .ignoresSafeArea()
            } else {
                Color.appBackground
                    .ignoresSafeArea()
            }

            // オーバーレイ
            VStack(spacing: 0) {
                Spacer()

                // QR Scanner Frame
                ZStack {
                    // スキャンエリアの枠
                    if !cameraPermissionDenied {
                        ScannerFrameView(color: .white)
                            .frame(width: 240, height: 240)

                        if isScanning && !isLoading {
                            ScanningLineView(color: .white)
                                .frame(width: 200)
                        }
                    } else {
                        // カメラ権限がない場合のプレースホルダー
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color.theme.opacity(0.1))
                            .frame(width: 280, height: 280)

                        VStack(spacing: 16) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 48))
                                .foregroundColor(Color.textSecondary)

                            Text("カメラへのアクセスを\n許可してください")
                                .font(.system(size: 15))
                                .foregroundColor(Color.textSecondary)
                                .multilineTextAlignment(.center)

                            Button("設定を開く") {
                                if let url = URL(string: UIApplication.openSettingsURLString) {
                                    UIApplication.shared.open(url)
                                }
                            }
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color.theme)
                        }
                    }

                    if isLoading {
                        Color.black.opacity(0.5)
                            .frame(width: 240, height: 240)

                        ProgressView()
                            .scaleEffect(1.5)
                            .tint(.white)
                    }
                }

                Spacer()
                    .frame(height: 48)

                // Instructions
                VStack(spacing: 8) {
                    Text(isLoading ? "店舗情報を取得中..." : "QRコードをスキャン")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(isScanning ? .white : Color.textPrimary)

                    Text(isLoading ? "しばらくお待ちください" : "店舗のQRコードを枠内に合わせてください")
                        .font(.system(size: 15))
                        .foregroundColor(isScanning ? .white.opacity(0.8) : Color.textSecondary)
                        .multilineTextAlignment(.center)
                }

                // Error message
                if let error = errorMessage {
                    VStack(spacing: 8) {
                        Text(error)
                            .font(.system(size: 14))
                            .foregroundColor(.red)
                            .padding(.horizontal, 20)
                            .padding(.top, 16)

                        Button("再試行") {
                            errorMessage = nil
                            isScanning = true
                        }
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Color.theme)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 24)
                        .background(Color.white)
                        .cornerRadius(8)
                    }
                }

                Spacer()
            }
        }
        .onAppear {
            checkCameraPermission()
        }
    }

    private func checkCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            cameraPermissionDenied = false
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    cameraPermissionDenied = !granted
                }
            }
        case .denied, .restricted:
            cameraPermissionDenied = true
        @unknown default:
            cameraPermissionDenied = true
        }
    }

    private func handleQRScanned(storeId: String) {
        // 既に処理中なら無視
        guard !isLoading else { return }

        isLoading = true
        isScanning = false
        errorMessage = nil

        // ハプティックフィードバック
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        Task {
            do {
                // 店舗情報を取得
                let response = try await APIService.shared.getStore(storeID: storeId)

                await MainActor.run {
                    appState.storeId = storeId
                    appState.storeName = response.store.name

                    // 店舗が閉まっている場合
                    if response.store.status == .closed {
                        errorMessage = "現在受付を停止しています"
                        isLoading = false
                        isScanning = true
                        return
                    }

                    // 登録画面へ遷移
                    appState.currentScreen = .registration
                }
            } catch let error as APIError {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                    isScanning = true
                }
            } catch {
                await MainActor.run {
                    errorMessage = "店舗情報の取得に失敗しました"
                    isLoading = false
                    isScanning = true
                }
            }
        }
    }
}

// MARK: - Camera Preview (UIViewRepresentable)

struct CameraPreviewView: UIViewRepresentable {
    let onQRCodeScanned: (String) -> Void

    func makeUIView(context: Context) -> CameraPreviewUIView {
        let view = CameraPreviewUIView()
        view.delegate = context.coordinator
        return view
    }

    func updateUIView(_ uiView: CameraPreviewUIView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onQRCodeScanned: onQRCodeScanned)
    }

    class Coordinator: NSObject, CameraPreviewDelegate {
        let onQRCodeScanned: (String) -> Void
        private var lastScannedCode: String?
        private var lastScanTime: Date?

        init(onQRCodeScanned: @escaping (String) -> Void) {
            self.onQRCodeScanned = onQRCodeScanned
        }

        func didScanQRCode(_ code: String) {
            // 同じコードを短時間に複数回スキャンしないようにする
            let now = Date()
            if let lastCode = lastScannedCode,
               let lastTime = lastScanTime,
               lastCode == code,
               now.timeIntervalSince(lastTime) < 3.0 {
                return
            }

            lastScannedCode = code
            lastScanTime = now

            DispatchQueue.main.async {
                self.onQRCodeScanned(code)
            }
        }
    }
}

protocol CameraPreviewDelegate: AnyObject {
    func didScanQRCode(_ code: String)
}

class CameraPreviewUIView: UIView, AVCaptureMetadataOutputObjectsDelegate {
    weak var delegate: CameraPreviewDelegate?

    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupCamera()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCamera()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }

    private func setupCamera() {
        let session = AVCaptureSession()
        captureSession = session

        guard let device = AVCaptureDevice.default(for: .video) else {
            print("カメラデバイスが見つかりません")
            return
        }

        do {
            let input = try AVCaptureDeviceInput(device: device)

            if session.canAddInput(input) {
                session.addInput(input)
            }

            let output = AVCaptureMetadataOutput()
            if session.canAddOutput(output) {
                session.addOutput(output)
                output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
                output.metadataObjectTypes = [.qr]
            }

            let previewLayer = AVCaptureVideoPreviewLayer(session: session)
            previewLayer.videoGravity = .resizeAspectFill
            previewLayer.frame = bounds
            layer.addSublayer(previewLayer)
            self.previewLayer = previewLayer

            DispatchQueue.global(qos: .userInitiated).async {
                session.startRunning()
            }
        } catch {
            print("カメラの設定に失敗: \(error)")
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              metadataObject.type == .qr,
              let stringValue = metadataObject.stringValue else {
            return
        }

        // QRコードの内容から店舗IDを抽出
        // 想定フォーマット: "magii://store/{storeId}" または単純に "{storeId}"
        let storeId: String
        if stringValue.hasPrefix("magii://store/") {
            storeId = String(stringValue.dropFirst("magii://store/".count))
        } else if let url = URL(string: stringValue),
                  url.scheme == "magii",
                  url.host == "store",
                  let id = url.pathComponents.last {
            storeId = id
        } else {
            // UUIDっぽい文字列ならそのまま使う
            storeId = stringValue
        }

        delegate?.didScanQRCode(storeId)
    }

    deinit {
        captureSession?.stopRunning()
    }
}

// MARK: - Scanner Frame

struct ScannerFrameView: View {
    var color: Color = .white
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

// MARK: - Scanning Line Animation

struct ScanningLineView: View {
    var color: Color = .white
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
