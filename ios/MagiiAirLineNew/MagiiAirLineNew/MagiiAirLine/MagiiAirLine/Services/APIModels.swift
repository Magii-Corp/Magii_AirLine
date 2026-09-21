import Foundation

// MARK: - Common

struct Account: Codable {
    let id: String
    let phone_number: String
}

struct CustomerStore: Codable {
    let id: String
    let name: String
    let openTime: String
    let closeTime: String
    let avgMinutesPerParty: Int
    let status: StoreStatus
}

enum StoreStatus: String, Codable {
    case open
    case closed
}

enum TicketStatus: String, Codable {
    case waiting
    case called
    case done
    case cancelled
}

struct CustomerTicket: Codable {
    let id: String
    let account: Account
    let store: CustomerStore
    let business_date: String
    let waitingNumber: Int
    let name: String
    let partySize: Int
    let status: TicketStatus
    let called_at: String?
    let updated_at: String
}

// MARK: - API Responses

struct APIErrorResponse: Codable {
    let success: Bool
    let code: String
    let message: String
}

struct StoreResponse: Codable {
    let success: Bool
    let store: CustomerStore
    let businessDate: String
    let serverTime: String
}

struct PhoneAuthResponse: Codable {
    let success: Bool
    let account: Account
    let isNewAccount: Bool
}

struct CreateTicketResponse: Codable {
    let success: Bool
    let ticket: CustomerTicket
    let groupsAhead: Int
    let estimatedMinutes: Int
    let serverTime: String
}

struct MyTicketResponse: Codable {
    let success: Bool
    let ticket: CustomerTicket?
    let groupsAhead: Int
    let estimatedMinutes: Int
    let serverTime: String
}

struct TicketDetailResponse: Codable {
    let success: Bool
    let ticket: CustomerTicket
    let groupsAhead: Int
    let estimatedMinutes: Int
    let serverTime: String
}

struct CancelTicketResponse: Codable {
    let success: Bool
    let ticket: CustomerTicket
    let serverTime: String
}

struct ArriveTicketResponse: Codable {
    let success: Bool
    let ticket: CustomerTicket
    let serverTime: String
}

struct DeviceResponse: Codable {
    let success: Bool
}

// MARK: - SSE Events

struct TicketUpdatedEvent: Codable {
    let type: String
    let ticket: CustomerTicket
    let groupsAhead: Int
    let estimatedMinutes: Int
    let serverTime: String
}

struct QueueUpdatedEvent: Codable {
    let type: String
    let ticketID: String
    let groupsAhead: Int
    let estimatedMinutes: Int
    let serverTime: String
}

struct StoreUpdatedEvent: Codable {
    let type: String
    let store: CustomerStore
    let serverTime: String
}
