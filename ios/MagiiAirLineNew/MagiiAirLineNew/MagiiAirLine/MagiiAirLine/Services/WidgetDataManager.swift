import Foundation
import WidgetKit

class WidgetDataManager {
    static let shared = WidgetDataManager()
    private let suiteName = "group.com.magii.airline"

    private var defaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    // MARK: - 状態を更新
    func updateWaitingStatus(waitingNumber: Int, groupsAhead: Int, status: String) {
        defaults?.set(waitingNumber, forKey: "waitingNumber")
        defaults?.set(groupsAhead, forKey: "groupsAhead")
        defaults?.set(status, forKey: "status")

        // ウィジェットを更新
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: - 待機中に更新
    func setWaiting(waitingNumber: Int, groupsAhead: Int) {
        updateWaitingStatus(waitingNumber: waitingNumber, groupsAhead: groupsAhead, status: "待機中")
    }

    // MARK: - 呼び出し中に更新
    func setCalled(waitingNumber: Int) {
        updateWaitingStatus(waitingNumber: waitingNumber, groupsAhead: 0, status: "お呼び出し中")
    }

    // MARK: - クリア
    func clear() {
        updateWaitingStatus(waitingNumber: 0, groupsAhead: 0, status: "予約なし")
    }
}
