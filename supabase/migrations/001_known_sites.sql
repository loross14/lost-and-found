-- NRHP Known Sites Schema
-- Run this in Supabase SQL Editor

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create known_sites table for NRHP data
CREATE TABLE IF NOT EXISTS known_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nrhp_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  site_type TEXT,
  category TEXT,
  address TEXT,
  city TEXT,
  county TEXT,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  date_listed DATE,
  description TEXT,
  significance TEXT,
  architect TEXT,
  time_period TEXT,
  culture TEXT,
  nrhp_url TEXT,
  wikipedia_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for bbox queries (critical for performance with 90k+ records)
CREATE INDEX IF NOT EXISTS idx_known_sites_coordinates ON known_sites USING GIST(coordinates);

-- Regular indexes for filtering
CREATE INDEX IF NOT EXISTS idx_known_sites_state ON known_sites(state);
CREATE INDEX IF NOT EXISTS idx_known_sites_site_type ON known_sites(site_type);
CREATE INDEX IF NOT EXISTS idx_known_sites_category ON known_sites(category);
CREATE INDEX IF NOT EXISTS idx_known_sites_nrhp_id ON known_sites(nrhp_id);

-- Lat/lng indexes for non-PostGIS queries
CREATE INDEX IF NOT EXISTS idx_known_sites_lat_lng ON known_sites(lat, lng);

-- Full-text search index
ALTER TABLE known_sites ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(city, '') || ' ' || coalesce(county, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_known_sites_search ON known_sites USING GIN(search_vector);

-- RPC function: Get sites within bounding box with optional filters
CREATE OR REPLACE FUNCTION sites_in_bbox(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  site_types TEXT[] DEFAULT NULL,
  filter_states TEXT[] DEFAULT NULL,
  search_query TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  nrhp_id TEXT,
  name TEXT,
  site_type TEXT,
  category TEXT,
  city TEXT,
  state TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  date_listed DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ks.id, ks.nrhp_id, ks.name, ks.site_type, ks.category,
    ks.city, ks.state, ks.lat, ks.lng, ks.date_listed
  FROM known_sites ks
  WHERE ks.lng BETWEEN min_lng AND max_lng
    AND ks.lat BETWEEN min_lat AND max_lat
    AND (site_types IS NULL OR ks.site_type = ANY(site_types))
    AND (filter_states IS NULL OR ks.state = ANY(filter_states))
    AND (search_query IS NULL OR ks.search_vector @@ plainto_tsquery('english', search_query))
  ORDER BY ks.name
  LIMIT max_results;
END;
$$;

-- RPC function: Get nearby sites using PostGIS
CREATE OR REPLACE FUNCTION known_nearby_sites(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50,
  exclude_id UUID DEFAULT NULL,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  nrhp_id TEXT,
  name TEXT,
  site_type TEXT,
  city TEXT,
  state TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ks.id, ks.nrhp_id, ks.name, ks.site_type, ks.city, ks.state,
    ks.lat, ks.lng,
    (ST_Distance(
      ks.coordinates,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) / 1000)::DOUBLE PRECISION AS distance_km
  FROM known_sites ks
  WHERE (exclude_id IS NULL OR ks.id != exclude_id)
    AND ST_DWithin(
      ks.coordinates,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km
  LIMIT max_results;
END;
$$;

-- RPC function: Get counts by state
CREATE OR REPLACE FUNCTION count_known_sites_by_state()
RETURNS TABLE (state TEXT, count BIGINT)
LANGUAGE SQL
AS $$
  SELECT ks.state, COUNT(*) as count
  FROM known_sites ks
  GROUP BY ks.state
  ORDER BY count DESC;
$$;

-- RPC function: Get counts by type
CREATE OR REPLACE FUNCTION count_known_sites_by_type()
RETURNS TABLE (site_type TEXT, count BIGINT)
LANGUAGE SQL
AS $$
  SELECT ks.site_type, COUNT(*) as count
  FROM known_sites ks
  WHERE ks.site_type IS NOT NULL
  GROUP BY ks.site_type
  ORDER BY count DESC;
$$;

-- Enable Row Level Security
ALTER TABLE known_sites ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required for viewing)
CREATE POLICY "Public read access for known_sites"
  ON known_sites FOR SELECT
  USING (true);

-- Allow inserts (for import script with service role key)
CREATE POLICY "Allow inserts for known_sites"
  ON known_sites FOR INSERT
  WITH CHECK (true);

-- Allow updates (for data enrichment)
CREATE POLICY "Allow updates for known_sites"
  ON known_sites FOR UPDATE
  USING (true);
