import Foundation
import UserNotifications
import UIKit
import Combine

final class NotificationManager: NSObject, ObservableObject, @unchecked Sendable {
    static let shared = NotificationManager()

    @Published var isAuthorized = false

    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
        checkAuthorizationStatus()
    }

    // MARK: - 権限確認
    func checkAuthorizationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                self?.isAuthorized = settings.authorizationStatus == .authorized
            }
        }
    }

    // MARK: - 権限リクエスト
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, error in
            DispatchQueue.main.async {
                self?.isAuthorized = granted
                if let error = error {
                    print("Notification authorization error: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - 残り3組通知
    func sendAlmostReadyNotification(waitingNumber: Int) {
        let content = UNMutableNotificationContent()
        content.title = "もうすぐです"
        content.body = "受付番号 \(waitingNumber) 番のお客様、あと3組でお呼びします。店舗の近くでお待ちください。"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "almost_ready_\(waitingNumber)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to send notification: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - 残り1組通知
    func sendNextUpNotification(waitingNumber: Int) {
        let content = UNMutableNotificationContent()
        content.title = "次はあなたです"
        content.body = "受付番号 \(waitingNumber) 番のお客様、次にお呼びします。カウンター付近でお待ちください。"
        content.sound = .default
        content.badge = 1

        let request = UNNotificationRequest(
            identifier: "next_up_\(waitingNumber)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to send notification: \(error.localizedDescription)")
            }
        }

        // 軽いバイブレーション
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    // MARK: - 呼び出し通知を送信
    func sendCalledNotification(waitingNumber: Int) {
        let content = UNMutableNotificationContent()
        content.title = "お呼び出し"
        content.body = "受付番号 \(waitingNumber) 番のお客様、席のご用意ができました。カウンターまでお越しください。"
        content.sound = .default
        content.badge = 1

        // 即時配信
        let request = UNNotificationRequest(
            identifier: "called_\(waitingNumber)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to send notification: \(error.localizedDescription)")
            }
        }

        // バイブレーション
        triggerVibration()
    }

    // MARK: - 自動キャンセルタイマー通知をスケジュール
    func scheduleAutoCancelReminders(waitingNumber: Int, calledAt: Date) {
        // 既存のリマインダーをキャンセル
        cancelAutoCancelReminders()

        let reminders: [(minutes: Int, title: String, body: String)] = [
            (10, "残り10分", "受付番号 \(waitingNumber) 番のお客様、あと10分で自動キャンセルになります。お早めにお越しください。"),
            (5, "残り5分", "受付番号 \(waitingNumber) 番のお客様、あと5分で自動キャンセルになります。"),
            (1, "残り1分", "受付番号 \(waitingNumber) 番のお客様、あと1分で自動キャンセルになります！すぐにお越しください。")
        ]

        let autoCompleteMinutes = 15.0  // 15分で自動完了

        for reminder in reminders {
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.body
            content.sound = .default

            // 通知を送るタイミング（呼び出しから何秒後か）
            let triggerSeconds = (autoCompleteMinutes - Double(reminder.minutes)) * 60
            let triggerDate = calledAt.addingTimeInterval(triggerSeconds)

            // 過去の時間ならスキップ
            guard triggerDate > Date() else { continue }

            let timeInterval = triggerDate.timeIntervalSinceNow
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: timeInterval, repeats: false)

            let request = UNNotificationRequest(
                identifier: "auto_cancel_\(reminder.minutes)min",
                content: content,
                trigger: trigger
            )

            UNUserNotificationCenter.current().add(request) { error in
                if let error = error {
                    print("Failed to schedule reminder: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - 自動キャンセルリマインダーをキャンセル
    func cancelAutoCancelReminders() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["auto_cancel_10min", "auto_cancel_5min", "auto_cancel_1min"]
        )
    }

    // MARK: - バイブレーション
    func triggerVibration() {
        // 強いバイブレーション（繰り返し）
        for i in 0..<3 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.5) {
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.warning)
            }
        }
    }

    // MARK: - バッジをクリア
    func clearBadge() {
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(0) { error in
                if let error = error {
                    print("Failed to clear badge: \(error.localizedDescription)")
                }
            }
        } else {
            DispatchQueue.main.async {
                UIApplication.shared.applicationIconBadgeNumber = 0
            }
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension NotificationManager: UNUserNotificationCenterDelegate {
    // フォアグラウンドで通知を表示
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    // 通知タップ時の処理
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // 通知をタップしたらバッジをクリア
        clearBadge()
        completionHandler()
    }
}
