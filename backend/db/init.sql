CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_key text UNIQUE NOT NULL,
  name text,
  address text NOT NULL,
  locality text,
  administrative_area text,
  country text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  total_scans integer NOT NULL DEFAULT 0,
  suspicious_scans integer NOT NULL DEFAULT 0,
  confirmed_flags integer NOT NULL DEFAULT 0,
  first_reported timestamptz NOT NULL DEFAULT now(),
  last_reported timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_lat_lng_idx ON properties(lat, lng);

CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  anonymous_id text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  network_devices jsonb NOT NULL DEFAULT '[]'::jsonb,
  ble_devices jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_label text NOT NULL,
  sweep_completed boolean NOT NULL DEFAULT false,
  notes text
);

CREATE INDEX IF NOT EXISTS scans_property_id_idx ON scans(property_id);
CREATE INDEX IF NOT EXISTS scans_scanned_at_idx ON scans(scanned_at DESC);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  stored_name text NOT NULL,
  original_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  scan_id uuid REFERENCES scans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'suspected' CHECK (status IN ('suspected','under_review','confirmed','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS reports_property_id_idx ON reports(property_id);
