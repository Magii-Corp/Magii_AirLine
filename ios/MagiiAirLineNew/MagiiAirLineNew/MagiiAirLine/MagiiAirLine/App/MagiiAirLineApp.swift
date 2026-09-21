import SwiftUI
import Combine

@main
struct MagiiAirLineApp: App {
    @StateObject private var appState = AppState()

    init() {
        // アプリ起動時に通知許可をリクエスト
        NotificationManager.shared.requestAuthorization()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear {
                    // バッジをクリア
                    NotificationManager.shared.clearBadge()
                }
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

    // MARK: - UI State
    @Published var currentScreen: Screen = .qrScanner
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    // MARK: - User Input
    @Published var userName: String = ""
    @Published var userPhone: String = ""
    @Published var partySize: Int = 1

    // MARK: - Ticket State
    @Published var waitingNumber: Int = 0
    @Published var groupsAhead: Int = 0
    @Published var estimatedMinutes: Int = 0

    // MARK: - API State
    @Published var storeId: String = ""
    @Published var storeName: String = ""
    @Published var accountId: String = ""
    @Published var ticketId: String = ""

    // MARK: - Persistence Keys
    private let accountIdKey = "accountId"
    private let userNameKey = "userName"
    private let userPhoneKey = "userPhone"

    init() {
        loadSavedData()
    }

    // MARK: - Persistence

    private func loadSavedData() {
        accountId = UserDefaults.standard.string(forKey: accountIdKey) ?? ""
        userName = UserDefaults.standard.string(forKey: userNameKey) ?? ""
        userPhone = UserDefaults.standard.string(forKey: userPhoneKey) ?? ""
    }

    func saveAccountId(_ id: String) {
        accountId = id
        UserDefaults.standard.set(id, forKey: accountIdKey)
    }

    func saveUserInfo(name: String, phone: String) {
        userName = name
        userPhone = phone
        UserDefaults.standard.set(name, forKey: userNameKey)
        UserDefaults.standard.set(phone, forKey: userPhoneKey)
    }

    // MARK: - State Reset

    func resetTicketState() {
        waitingNumber = 0
        groupsAhead = 0
        estimatedMinutes = 0
        ticketId = ""
        storeId = ""
        storeName = ""
    }

    var isFirstTimeUser: Bool {
        accountId.isEmpty
    }
}
