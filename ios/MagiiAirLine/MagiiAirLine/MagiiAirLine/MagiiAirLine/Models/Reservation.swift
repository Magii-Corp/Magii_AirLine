import Foundation

struct Reservation: Identifiable, Codable {
    let id: String
    let storeId: String
    let userId: String
    let waitingNumber: Int
    let partySize: Int
    let status: ReservationStatus
    let createdAt: Date
    let calledAt: Date?
    let seatedAt: Date?

    enum ReservationStatus: String, Codable {
        case waiting
        case called
        case seated
        case noShow = "no_show"
        case cancelled
    }
}

struct User: Identifiable, Codable {
    let id: String
    let name: String
    let phone: String
    let deviceId: String
    let createdAt: Date
}

struct Store: Identifiable, Codable {
    let id: String
    let name: String
    let estimatedWaitTimePerGroup: Int // minutes
}
