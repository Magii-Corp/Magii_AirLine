import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            switch appState.currentScreen {
            case .qrScanner:
                QRScannerView()
                    .id("qrScanner")

            case .registration:
                RegistrationView()
                    .id("registration")

            case .waiting:
                WaitingView()
                    .id("waiting")

            case .called:
                CalledView()
                    .id("called")

            case .completion:
                CompletionView()
                    .id("completion")
            }
        }
        .animation(.easeInOut(duration: 0.25), value: appState.currentScreen)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
