/**
 * Supabase Database Types
 * supabase gen types typescript で生成した型を配置
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          estimated_wait_time_per_group: number;
          is_accepting: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          estimated_wait_time_per_group?: number;
          is_accepting?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          estimated_wait_time_per_group?: number;
          is_accepting?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      guests: {
        Row: {
          id: string;
          device_id: string;
          name: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          name: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          name?: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          store_id: string;
          guest_id: string;
          waiting_number: number;
          party_size: number;
          status: TicketStatus;
          created_at: string;
          called_at: string | null;
          seated_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          guest_id: string;
          waiting_number: number;
          party_size?: number;
          status?: TicketStatus;
          created_at?: string;
          called_at?: string | null;
          seated_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          guest_id?: string;
          waiting_number?: number;
          party_size?: number;
          status?: TicketStatus;
          created_at?: string;
          called_at?: string | null;
          seated_at?: string | null;
          cancelled_at?: string | null;
        };
      };
      staff: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          role: StaffRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          role?: StaffRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          role?: StaffRole;
          created_at?: string;
        };
      };
    };
    Enums: {
      ticket_status: TicketStatus;
      staff_role: StaffRole;
    };
  };
};

export type TicketStatus =
  | "waiting"
  | "called"
  | "seated"
  | "no_show"
  | "cancelled";

export type StaffRole = "owner" | "manager" | "staff";

// Helper types
export type Store = Database["public"]["Tables"]["stores"]["Row"];
export type Guest = Database["public"]["Tables"]["guests"]["Row"];
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type Staff = Database["public"]["Tables"]["staff"]["Row"];

export type StoreInsert = Database["public"]["Tables"]["stores"]["Insert"];
export type GuestInsert = Database["public"]["Tables"]["guests"]["Insert"];
export type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"];
export type StaffInsert = Database["public"]["Tables"]["staff"]["Insert"];

export type StoreUpdate = Database["public"]["Tables"]["stores"]["Update"];
export type GuestUpdate = Database["public"]["Tables"]["guests"]["Update"];
export type TicketUpdate = Database["public"]["Tables"]["tickets"]["Update"];
export type StaffUpdate = Database["public"]["Tables"]["staff"]["Update"];
