import SwiftUI
import Combine

@main
struct MagiiAirLineApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .preferredColorScheme(.dark)
        }
    }
}

class AppState: ObservableObject {
    enum Screen {
        case qrScanner
        case registration
        case waiting
        case called
        case completion
    }

    @Published var currentScreen: Screen = .qrScanner
    @Published var isFirstTimeUser: Bool = true
    @Published var userName: String = ""
    @Published var userPhone: String = ""
    @Published var partySize: Int = 1
    @Published var waitingNumber: Int = 0
    @Published var groupsAhead: Int = 0
    @Published var storeId: String = ""
}
