-- Magii AirLine Initial Schema
-- 店舗待ち行列管理システム

-- ============================================================
-- Types
-- ============================================================

CREATE TYPE ticket_status AS ENUM (
  'waiting',
  'called',
  'seated',
  'no_show',
  'cancelled'
);

CREATE TYPE staff_role AS ENUM (
  'owner',
  'manager',
  'staff'
);

-- ============================================================
-- Tables
-- ============================================================

-- 店舗テーブル
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  estimated_wait_time_per_group INTEGER NOT NULL DEFAULT 5,
  is_accepting BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ゲスト（来店客）テーブル
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- チケット（待ち行列）テーブル
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  waiting_number INTEGER NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  status ticket_status NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- 同一店舗・同一日の待機番号はユニーク
  CONSTRAINT unique_waiting_number_per_day UNIQUE (store_id, waiting_number, (created_at::date))
);

-- スタッフテーブル
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role staff_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_staff_per_store UNIQUE (store_id, user_id)
);

-- ============================================================
-- Indexes
-- ============================================================

-- tickets: よく使うクエリ用インデックス
CREATE INDEX idx_tickets_store_status ON tickets(store_id, status);
CREATE INDEX idx_tickets_store_created ON tickets(store_id, created_at);
CREATE INDEX idx_tickets_guest_status ON tickets(guest_id, status);

-- guests: device_idで検索
CREATE INDEX idx_guests_device_id ON guests(device_id);

-- staff: user_idで検索
CREATE INDEX idx_staff_user_id ON staff(user_id);

-- ============================================================
-- Functions
-- ============================================================

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- stores: 誰でも読み取り可、スタッフのみ更新可
CREATE POLICY "stores_select" ON stores
  FOR SELECT USING (true);

CREATE POLICY "stores_update" ON stores
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.store_id = stores.id
        AND staff.user_id = auth.uid()
        AND staff.role IN ('owner', 'manager')
    )
  );

-- guests: service roleのみ操作可（Edge Functionsから操作）
CREATE POLICY "guests_service_role" ON guests
  FOR ALL USING (auth.role() = 'service_role');

-- tickets: 読み取りは誰でも可、操作はservice roleのみ
CREATE POLICY "tickets_select" ON tickets
  FOR SELECT USING (true);

CREATE POLICY "tickets_insert" ON tickets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "tickets_update" ON tickets
  FOR UPDATE USING (auth.role() = 'service_role');

-- staff: 自分のレコードと同じ店舗のスタッフは読み取り可
CREATE POLICY "staff_select" ON staff
  FOR SELECT USING (
    staff.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM staff s2
      WHERE s2.store_id = staff.store_id
        AND s2.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_insert" ON staff
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Realtime
-- ============================================================

-- ticketsテーブルのRealtimeを有効化
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
