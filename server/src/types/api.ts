/**
 * API Request/Response Types
 */

import type { TicketStatus } from "./database.js";

// ============================================================
// Common
// ============================================================

export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ============================================================
// Guest Endpoints
// ============================================================

/** POST /auth/registerUser */
export interface RegisterUserRequest {
  device_id: string;
  name: string;
  phone?: string;
}

export interface RegisterUserResponse {
  user: {
    id: string;
    device_id: string;
    name: string;
    phone: string | null;
  };
}

/** GET /reservation */
export interface GetReservationRequest {
  shop_id: string;
  user_id: string;
}

export interface GetReservationResponse {
  reservation: {
    id: string;
    waiting_number: number;
    party_size: number;
    status: TicketStatus;
    groups_ahead: number;
    estimated_wait_minutes: number;
    created_at: string;
    called_at: string | null;
  } | null;
}

/** POST /reservation */
export interface CreateReservationRequest {
  store_id: string;
  guest_id: string;
  party_size: number;
}

export interface CreateReservationResponse {
  reservation: {
    id: string;
    waiting_number: number;
    party_size: number;
    status: TicketStatus;
    groups_ahead: number;
    estimated_wait_minutes: number;
    created_at: string;
  };
}

/** PATCH /reservation/:id/cancel */
export interface CancelReservationResponse {
  success: boolean;
}

/** PATCH /reservation/:id/arrive */
export interface ArriveReservationResponse {
  success: boolean;
}

/** GET /waiting */
export interface GetWaitingRequest {
  shop_id: string;
  user_id: string;
}

export interface GetWaitingResponse {
  reservation: {
    id: string;
    waiting_number: number;
    party_size: number;
    status: TicketStatus;
    groups_ahead: number;
    estimated_wait_minutes: number;
  } | null;
}

// ============================================================
// Admin Endpoints
// ============================================================

/** POST /auth/registerShop */
export interface RegisterShopRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterShopResponse {
  shop: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    email: string;
  };
}

/** POST /auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
  };
}

/** GET /admin/dashboard */
export interface DashboardResponse {
  store: {
    id: string;
    name: string;
    is_accepting: boolean;
  };
  stats: {
    waiting_count: number;
    called_count: number;
    seated_count: number;
    no_show_count: number;
    cancelled_count: number;
  };
  queue: Array<{
    id: string;
    waiting_number: number;
    guest_name: string;
    party_size: number;
    status: TicketStatus;
    wait_time_minutes: number;
    created_at: string;
  }>;
}

/** POST /admin/call-next */
export interface CallNextResponse {
  ticket: {
    id: string;
    waiting_number: number;
    guest_name: string;
    party_size: number;
    status: TicketStatus;
  } | null;
}

/** PATCH /admin/tickets/:id/status */
export interface UpdateTicketStatusRequest {
  status: TicketStatus;
}

export interface UpdateTicketStatusResponse {
  ticket: {
    id: string;
    waiting_number: number;
    status: TicketStatus;
  };
}

/** PATCH /admin/store/settings */
export interface UpdateStoreSettingsRequest {
  name?: string;
  estimated_wait_time_per_group?: number;
  is_accepting?: boolean;
}

export interface UpdateStoreSettingsResponse {
  store: {
    id: string;
    name: string;
    estimated_wait_time_per_group: number;
    is_accepting: boolean;
  };
}
