import Foundation
import Combine

enum SSEEvent {
    case ticketCalled(CustomerTicket)
    case ticketUpdated(ticket: CustomerTicket, groupsAhead: Int, estimatedMinutes: Int)
    case ticketDone(CustomerTicket)
    case ticketCancelled(CustomerTicket)
    case queueUpdated(groupsAhead: Int, estimatedMinutes: Int)
    case storeUpdated(CustomerStore)
    case connected
    case disconnected
    case error(Error)
}

@MainActor
class SSEService: NSObject, ObservableObject, URLSessionDataDelegate {
    static let shared = SSEService()

    // 実機テスト時はMacのローカルIPを使用
    #if DEBUG
    private let baseURL = "http://192.168.10.102:8787/customer"
    #else
    private let baseURL = "http://localhost:8787/customer"
    #endif
    private var session: URLSession?
    private var task: URLSessionDataTask?
    private var buffer = ""

    @Published private(set) var isConnected = false

    var onEvent: ((SSEEvent) -> Void)?

    private override init() {
        super.init()
    }

    func connect(ticketID: String) {
        disconnect()

        let urlString = "\(baseURL)/tickets/events?ticketID=\(ticketID)"
        print("[SSE] Connecting to: \(urlString)")

        guard let url = URL(string: urlString) else {
            print("[SSE] Invalid URL")
            onEvent?(.error(APIError.invalidURL))
            return
        }

        var request = URLRequest(url: url)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        request.timeoutInterval = TimeInterval.infinity

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = TimeInterval.infinity
        config.timeoutIntervalForResource = TimeInterval.infinity

        session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
        task = session?.dataTask(with: request)
        task?.resume()

        print("[SSE] Connection started")
    }

    // MARK: - URLSessionDataDelegate

    nonisolated func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        print("[SSE] Connected! Response: \(response)")
        Task { @MainActor in
            self.isConnected = true
            self.onEvent?(.connected)
        }
        completionHandler(.allow)
    }

    func disconnect() {
        task?.cancel()
        task = nil
        session?.invalidateAndCancel()
        session = nil
        buffer = ""
        isConnected = false
    }

    nonisolated func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let text = String(data: data, encoding: .utf8) else { return }

        Task { @MainActor in
            self.buffer += text
            self.processBuffer()
        }
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        print("[SSE] Connection completed with error: \(String(describing: error))")
        Task { @MainActor in
            self.isConnected = false
            if let error = error {
                // キャンセルエラーは無視
                if (error as NSError).code != NSURLErrorCancelled {
                    print("[SSE] Error: \(error.localizedDescription)")
                    self.onEvent?(.error(error))
                }
            }
            self.onEvent?(.disconnected)
        }
    }

    // MARK: - Private

    private func processBuffer() {
        let lines = buffer.components(separatedBy: "\n\n")

        // 最後の要素は不完全な可能性があるので保持
        if lines.count > 1 {
            buffer = lines.last ?? ""

            for i in 0..<(lines.count - 1) {
                parseEvent(lines[i])
            }
        }
    }

    private func parseEvent(_ eventString: String) {
        var eventType = ""
        var eventData = ""

        for line in eventString.components(separatedBy: "\n") {
            if line.hasPrefix("event:") {
                eventType = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("data:") {
                eventData = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix(":") {
                // コメント（heartbeat）は無視
                continue
            }
        }

        guard !eventData.isEmpty else { return }
        guard let data = eventData.data(using: .utf8) else { return }

        print("[SSE] Received event: \(eventType), data: \(eventData)")

        let decoder = JSONDecoder()

        switch eventType {
        case "ticket.called":
            if let event = try? decoder.decode(TicketUpdatedEvent.self, from: data) {
                onEvent?(.ticketCalled(event.ticket))
            }

        case "ticket.updated":
            if let event = try? decoder.decode(TicketUpdatedEvent.self, from: data) {
                onEvent?(.ticketUpdated(
                    ticket: event.ticket,
                    groupsAhead: event.groupsAhead,
                    estimatedMinutes: event.estimatedMinutes
                ))
            }

        case "ticket.done":
            if let event = try? decoder.decode(TicketUpdatedEvent.self, from: data) {
                print("[SSE] ticket.done decoded successfully")
                onEvent?(.ticketDone(event.ticket))
            } else {
                print("[SSE] Failed to decode ticket.done event")
            }

        case "ticket.cancelled":
            if let event = try? decoder.decode(TicketUpdatedEvent.self, from: data) {
                onEvent?(.ticketCancelled(event.ticket))
            }

        case "queue.updated":
            if let event = try? decoder.decode(QueueUpdatedEvent.self, from: data) {
                onEvent?(.queueUpdated(
                    groupsAhead: event.groupsAhead,
                    estimatedMinutes: event.estimatedMinutes
                ))
            }

        case "store.updated":
            if let event = try? decoder.decode(StoreUpdatedEvent.self, from: data) {
                onEvent?(.storeUpdated(event.store))
            }

        default:
            // 未知のイベントタイプは無視
            break
        }
    }
}
