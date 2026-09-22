import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case networkError(Error)
    case decodingError(Error)
    case serverError(code: String, message: String)
    case unknownError

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "無効なURLです"
        case .networkError(let error):
            return "ネットワークエラー: \(error.localizedDescription)"
        case .decodingError:
            return "データの解析に失敗しました"
        case .serverError(_, let message):
            return message
        case .unknownError:
            return "予期しないエラーが発生しました"
        }
    }
}

actor APIService {
    static let shared = APIService()

    // TODO: 本番環境では適切なURLに変更
    // 実機テスト時はMacのローカルIPを使用
    #if DEBUG
    private let baseURL = "http://192.168.10.102:8787/customer"
    #else
    private let baseURL = "http://localhost:8787/customer"
    #endif

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()

    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        return encoder
    }()

    private init() {}

    // MARK: - Store

    func getStore(storeID: String) async throws -> StoreResponse {
        return try await get("/stores/\(storeID)")
    }

    // MARK: - Auth

    func authenticatePhone(phoneNumber: String) async throws -> PhoneAuthResponse {
        return try await post("/auth/phone", body: ["phone_number": phoneNumber])
    }

    // MARK: - Tickets

    func createTicket(
        storeID: String,
        accountID: String,
        name: String,
        phoneNumber: String,
        partySize: Int
    ) async throws -> CreateTicketResponse {
        let body: [String: Any] = [
            "storeID": storeID,
            "accountID": accountID,
            "name": name,
            "phone_number": phoneNumber,
            "partySize": partySize
        ]
        return try await post("/tickets", body: body)
    }

    func getMyTicket(accountID: String, storeID: String) async throws -> MyTicketResponse {
        return try await get("/tickets/mine?accountID=\(accountID)&storeID=\(storeID)")
    }

    func getTicket(ticketID: String) async throws -> TicketDetailResponse {
        return try await get("/tickets/\(ticketID)")
    }

    func cancelTicket(ticketID: String, accountID: String) async throws -> CancelTicketResponse {
        return try await post("/tickets/\(ticketID)/cancel", body: ["accountID": accountID])
    }

    func updateTicket(ticketID: String, accountID: String, name: String, partySize: Int) async throws -> TicketDetailResponse {
        let body: [String: Any] = [
            "accountID": accountID,
            "name": name,
            "partySize": partySize
        ]
        return try await patch("/tickets/\(ticketID)", body: body)
    }

    // MARK: - Devices

    func registerDevice(accountID: String, deviceToken: String) async throws -> DeviceResponse {
        let body: [String: Any] = [
            "accountID": accountID,
            "deviceToken": deviceToken,
            "platform": "ios"
        ]
        return try await post("/devices", body: body)
    }

    func deleteDevice(deviceToken: String) async throws -> DeviceResponse {
        return try await delete("/devices/\(deviceToken)")
    }

    // MARK: - Private Methods

    private func get<T: Decodable>(_ path: String) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        return try await perform(request)
    }

    private func post<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await perform(request)
    }

    private func patch<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await perform(request)
    }

    private func delete<T: Decodable>(_ path: String) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        return try await perform(request)
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknownError
        }

        // エラーレスポンスのチェック
        if httpResponse.statusCode >= 400 {
            if let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data) {
                throw APIError.serverError(code: errorResponse.code, message: errorResponse.message)
            }
            throw APIError.unknownError
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}
