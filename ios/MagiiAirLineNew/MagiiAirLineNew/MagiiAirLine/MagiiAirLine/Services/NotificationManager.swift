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
