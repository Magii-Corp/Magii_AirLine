/**
 * POST /auth/registerUser
 * Register a new guest user with device ID
 */

import { supabaseAdmin } from "../utils/supabase.js";
import { registerUserSchema, validate } from "../utils/validation.js";
import type {
  RegisterUserRequest,
  RegisterUserResponse,
  ApiResult,
} from "../types/api.js";

export async function registerUser(
  body: unknown
): Promise<ApiResult<RegisterUserResponse>> {
  // Validate request
  const validation = validate(registerUserSchema, body);
  if (!validation.success) {
    return {
      data: null,
      error: { code: "VALIDATION_ERROR", message: validation.error },
    };
  }

  const { device_id, name, phone } = validation.data as RegisterUserRequest;

  if (!supabaseAdmin) {
    return {
      data: null,
      error: { code: "SERVER_ERROR", message: "Database not configured" },
    };
  }

  // Check if device already registered
  const { data: existingGuest } = await supabaseAdmin
    .from("guests")
    .select("*")
    .eq("device_id", device_id)
    .single();

  if (existingGuest) {
    // Update existing guest
    const { data: updatedGuest, error: updateError } = await supabaseAdmin
      .from("guests")
      .update({ name, phone, updated_at: new Date().toISOString() })
      .eq("id", existingGuest.id)
      .select()
      .single();

    if (updateError) {
      return {
        data: null,
        error: { code: "DATABASE_ERROR", message: updateError.message },
      };
    }

    return {
      data: {
        user: {
          id: updatedGuest.id,
          device_id: updatedGuest.device_id,
          name: updatedGuest.name,
          phone: updatedGuest.phone,
        },
      },
      error: null,
    };
  }

  // Create new guest
  const { data: newGuest, error: insertError } = await supabaseAdmin
    .from("guests")
    .insert({ device_id, name, phone })
    .select()
    .single();

  if (insertError) {
    return {
      data: null,
      error: { code: "DATABASE_ERROR", message: insertError.message },
    };
  }

  return {
    data: {
      user: {
        id: newGuest.id,
        device_id: newGuest.device_id,
        name: newGuest.name,
        phone: newGuest.phone,
      },
    },
    error: null,
  };
}
