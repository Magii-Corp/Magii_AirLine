/**
 * Supabase Database Types
 * supabase gen types typescript で生成した型を配置
 *
 * NOTE: 本番スキーマは CHECK 制約で値を絞っており Postgres ENUM は使っていない。
 * そのため Row の status 系は TS 側のユニオン型で表現する。
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
      accounts: {
        Row: {
          id: string;
          phone_number: string | null;
          password: string | null;
        };
        Insert: {
          id?: string;
          phone_number?: string | null;
          password?: string | null;
        };
        Update: {
          id?: string;
          phone_number?: string | null;
          password?: string | null;
        };
        Relationships: [];
      };
      staff_accounts: {
        Row: {
          id: string;
          email: string | null;
          password: string | null;
        };
        Insert: {
          id?: string;
          email?: string | null;
          password?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          password?: string | null;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          /** time without time zone ("HH:MM:SS") */
          open_time: string;
          /** time without time zone ("HH:MM:SS") */
          close_time: string;
          avg_minutes_per_party: number;
          /** 採番カウンタの対象営業日 (date) */
          counter_date: string | null;
          /** counter_date 時点で発行済みの最終番号 */
          last_number: number;
          status: StoreStatus | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          open_time?: string;
          close_time?: string;
          avg_minutes_per_party?: number;
          counter_date?: string | null;
          last_number?: number;
          status?: StoreStatus | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          open_time?: string;
          close_time?: string;
          avg_minutes_per_party?: number;
          counter_date?: string | null;
          last_number?: number;
          status?: StoreStatus | null;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          store_id: string;
          account_id: string;
          /** date */
          business_date: string;
          waiting_number: number;
          name: string;
          party_size: number | null;
          status: TicketStatus;
          created_at: string;
          called_at: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          account_id: string;
          business_date: string;
          waiting_number: number;
          name: string;
          party_size?: number | null;
          status?: TicketStatus;
          created_at?: string;
          called_at?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          account_id?: string;
          business_date?: string;
          waiting_number?: number;
          name?: string;
          party_size?: number | null;
          status?: TicketStatus;
          created_at?: string;
          called_at?: string | null;
        };
        Relationships: [];
      };
      ticket_history: {
        Row: {
          /** 確定元の tickets.id をそのまま引き継ぐ (DEFAULT なし) */
          id: string;
          store_id: string;
          account_id: string;
          /** date */
          business_date: string;
          name: string;
          party_size: number | null;
          final_status: FinalStatus;
          /** tickets.created_at を引き継ぐ */
          created_at: string;
          finished_at: string;
        };
        Insert: {
          id: string;
          store_id: string;
          account_id: string;
          business_date: string;
          name: string;
          party_size?: number | null;
          final_status: FinalStatus;
          created_at: string;
          finished_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          account_id?: string;
          business_date?: string;
          name?: string;
          party_size?: number | null;
          final_status?: FinalStatus;
          created_at?: string;
          finished_at?: string;
        };
        Relationships: [];
      };
      store_events: {
        Row: {
          store_id: string;
          has_add: boolean;
          has_remove: boolean;
          has_update: boolean;
        };
        Insert: {
          store_id: string;
          has_add?: boolean;
          has_remove?: boolean;
          has_update?: boolean;
        };
        Update: {
          store_id?: string;
          has_add?: boolean;
          has_remove?: boolean;
          has_update?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** tickets.status — 進行中の組のみ。CHECK 制約でこの2値に限定されている */
export type TicketStatus = "waiting" | "called";

/** ticket_history.final_status — 決着した組。CHECK 制約でこの3値に限定されている */
export type FinalStatus = "seated" | "no_show" | "cancelled";

/** stores.status — 発券を受け付けるのは "open" のときのみ */
export type StoreStatus = "open" | "paused" | "closed";

// Helper types
// NOTE: API 側 (types/api.ts) の Account / Store / Ticket は camelCase の
// レスポンス型。混同を避けるため DB の行型は Row 接尾辞で統一する。
export type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
export type StaffAccountRow =
  Database["public"]["Tables"]["staff_accounts"]["Row"];
export type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
export type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];
export type TicketHistoryRow =
  Database["public"]["Tables"]["ticket_history"]["Row"];
export type StoreEventsRow =
  Database["public"]["Tables"]["store_events"]["Row"];

export type AccountInsert = Database["public"]["Tables"]["accounts"]["Insert"];
export type StaffAccountInsert =
  Database["public"]["Tables"]["staff_accounts"]["Insert"];
export type StoreInsert = Database["public"]["Tables"]["stores"]["Insert"];
export type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"];
export type TicketHistoryInsert =
  Database["public"]["Tables"]["ticket_history"]["Insert"];

export type AccountUpdate = Database["public"]["Tables"]["accounts"]["Update"];
export type StaffAccountUpdate =
  Database["public"]["Tables"]["staff_accounts"]["Update"];
export type StoreUpdate = Database["public"]["Tables"]["stores"]["Update"];
export type TicketUpdate = Database["public"]["Tables"]["tickets"]["Update"];
export type TicketHistoryUpdate =
  Database["public"]["Tables"]["ticket_history"]["Update"];
