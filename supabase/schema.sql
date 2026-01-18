-- Lost & Found - Supabase Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- ENABLE POSTGIS EXTENSION
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- SCAN JOBS (background scanning of regions)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region_type TEXT NOT NULL CHECK (region_type IN ('hot_zone', 'state', 'county', 'custom')),
  region_id TEXT,  -- Reference to hot zone ID or FIPS code
  north DOUBLE PRECISION NOT NULL,
  south DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  west DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'scanning', 'paused', 'complete', 'failed')),
  total_tiles INTEGER DEFAULT 0,
  scanned_tiles INTEGER DEFAULT 0,
  sites_found INTEGER DEFAULT 0,
  current_tile_x INTEGER DEFAULT 0,
  current_tile_y INTEGER DEFAULT 0,
  zoom_level INTEGER DEFAULT 17,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_region ON scan_jobs(region_type, region_id);

-- ============================================
-- SITES TABLE (known + potential sites)
-- ============================================
CREATE TABLE IF NOT EXISTS sites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    -- Status for discovery workflow
    status TEXT NOT NULL CHECK (status IN ('known', 'potential', 'unverified', 'verified', 'rejected')),
    -- Verification tracking
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'verified', 'rejected', 'skipped')),
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,
    -- Basic info
    description TEXT,
    date_discovered DATE,
    culture TEXT,
    time_period TEXT,
    features TEXT[],
    image_url TEXT,
    source_url TEXT,
    -- ML detection fields
    feature_type TEXT,
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    size_meters REAL,
    ml_model TEXT,
    ml_reasoning TEXT,  -- Why the ML thinks this is archaeological
    ml_response JSONB,
    -- Tile reference for imagery
    tile_z INTEGER,
    tile_x INTEGER,
    tile_y INTEGER,
    -- Scan job reference
    scan_job_id UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for discovery queue
CREATE INDEX IF NOT EXISTS sites_coordinates_idx ON sites (lat, lng);
CREATE INDEX IF NOT EXISTS sites_status_idx ON sites (status);
CREATE INDEX IF NOT EXISTS sites_review_status_idx ON sites (review_status) WHERE status = 'potential';
CREATE INDEX IF NOT EXISTS sites_confidence_idx ON sites (confidence DESC) WHERE confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS sites_unreviewed_idx ON sites (confidence DESC) WHERE status = 'potential' AND review_status = 'pending';
CREATE INDEX IF NOT EXISTS sites_scan_job_idx ON sites (scan_job_id);

-- ============================================
-- SCAN REGIONS (legacy - user-drawn areas)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  north DOUBLE PRECISION NOT NULL,
  south DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  west DOUBLE PRECISION NOT NULL,
  area_km2 REAL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_regions_status ON scan_regions(status);

-- ============================================
-- ANALYSIS JOBS (legacy - single analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_region_id UUID REFERENCES scan_regions(id) ON DELETE CASCADE,
  north DOUBLE PRECISION NOT NULL,
  south DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  west DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'fetching', 'analyzing', 'complete', 'failed')),
  total_tiles INTEGER DEFAULT 0,
  processed_tiles INTEGER DEFAULT 0,
  results_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);

-- ============================================
-- TILE CACHE METADATA
-- ============================================
CREATE TABLE IF NOT EXISTS tile_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_key TEXT UNIQUE NOT NULL,
  z INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  north DOUBLE PRECISION,
  south DOUBLE PRECISION,
  east DOUBLE PRECISION,
  west DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'naip',
  year INTEGER,
  storage_path TEXT,
  file_size INTEGER,
  analyzed BOOLEAN DEFAULT FALSE,
  analyzed_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tile_cache_key ON tile_cache(tile_key);
CREATE INDEX IF NOT EXISTS idx_tile_cache_zxy ON tile_cache(z, x, y);
CREATE INDEX IF NOT EXISTS idx_tile_cache_unanalyzed ON tile_cache(z, x, y) WHERE analyzed = FALSE;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Find sites within a bounding box
CREATE OR REPLACE FUNCTION sites_in_bbox(
  p_north DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east DOUBLE PRECISION,
  p_west DOUBLE PRECISION
)
RETURNS SETOF sites AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM sites
  WHERE lat >= p_south AND lat <= p_north
    AND lng >= p_west AND lng <= p_east;
END;
$$ LANGUAGE plpgsql;

-- Get discovery statistics
CREATE OR REPLACE FUNCTION get_discovery_stats()
RETURNS TABLE (
  total_potential BIGINT,
  pending_review BIGINT,
  verified BIGINT,
  rejected BIGINT,
  avg_confidence DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'potential') as total_potential,
    COUNT(*) FILTER (WHERE status = 'potential' AND review_status = 'pending') as pending_review,
    COUNT(*) FILTER (WHERE status = 'potential' AND review_status = 'verified') as verified,
    COUNT(*) FILTER (WHERE status = 'potential' AND review_status = 'rejected') as rejected,
    AVG(confidence) FILTER (WHERE status = 'potential') as avg_confidence
  FROM sites;
END;
$$ LANGUAGE plpgsql;

-- Check for nearby existing sites (deduplication)
CREATE OR REPLACE FUNCTION has_nearby_site(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 0.1
)
RETURNS BOOLEAN AS $$
DECLARE
  found BOOLEAN;
  lat_diff DOUBLE PRECISION;
  lng_diff DOUBLE PRECISION;
BEGIN
  lat_diff := p_radius_km / 111.0;
  lng_diff := p_radius_km / (111.0 * COS(RADIANS(p_lat)));

  SELECT EXISTS (
    SELECT 1 FROM sites
    WHERE lat BETWEEN (p_lat - lat_diff) AND (p_lat + lat_diff)
      AND lng BETWEEN (p_lng - lng_diff) AND (p_lng + lng_diff)
      AND status IN ('known', 'verified')
  ) INTO found;

  RETURN found;
END;
$$ LANGUAGE plpgsql;

-- Get nearest known site
CREATE OR REPLACE FUNCTION get_nearest_known_site(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS TABLE (
  site_id UUID,
  site_name TEXT,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    (111.0 * SQRT(
      POWER(s.lat - p_lat, 2) +
      POWER((s.lng - p_lng) * COS(RADIANS(p_lat)), 2)
    )) as distance_km
  FROM sites s
  WHERE s.status = 'known'
  ORDER BY distance_km
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tile_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON sites;
DROP POLICY IF EXISTS "Allow authenticated insert" ON sites;
DROP POLICY IF EXISTS "Allow authenticated update" ON sites;
DROP POLICY IF EXISTS "Public read access for sites" ON sites;
DROP POLICY IF EXISTS "Anon can insert sites" ON sites;
DROP POLICY IF EXISTS "Anon can update sites" ON sites;

-- Sites policies
CREATE POLICY "Public read access for sites"
  ON sites FOR SELECT USING (true);

CREATE POLICY "Anon can insert sites"
  ON sites FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can update sites"
  ON sites FOR UPDATE USING (true);

-- Scan jobs policies
CREATE POLICY "Public read access for scan_jobs"
  ON scan_jobs FOR SELECT USING (true);

CREATE POLICY "Anon can insert scan_jobs"
  ON scan_jobs FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can update scan_jobs"
  ON scan_jobs FOR UPDATE USING (true);

-- Scan regions policies
CREATE POLICY "Public read access for scan_regions"
  ON scan_regions FOR SELECT USING (true);

CREATE POLICY "Anon can insert scan_regions"
  ON scan_regions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can update scan_regions"
  ON scan_regions FOR UPDATE USING (true);

-- Analysis jobs policies
CREATE POLICY "Public read access for analysis_jobs"
  ON analysis_jobs FOR SELECT USING (true);

CREATE POLICY "Anon can insert analysis_jobs"
  ON analysis_jobs FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can update analysis_jobs"
  ON analysis_jobs FOR UPDATE USING (true);

-- Tile cache policies
CREATE POLICY "Anon can manage tile_cache"
  ON tile_cache FOR ALL USING (true);

-- ============================================
-- SAMPLE DATA - Known Archaeological Sites
-- ============================================
INSERT INTO sites (name, lat, lng, status, review_status, description, culture, time_period, features) VALUES
  ('Cahokia Mounds', 38.6545, -90.0615, 'known', 'verified', 'Largest pre-Columbian settlement north of Mexico, featuring Monks Mound', 'Mississippian', '600-1400 CE', ARRAY['platform mound', 'plaza', 'woodhenge']),
  ('Poverty Point', 32.6347, -91.4075, 'known', 'verified', 'UNESCO World Heritage Site with concentric earthen ridges', 'Poverty Point culture', '1700-1100 BCE', ARRAY['ridges', 'mounds', 'plaza']),
  ('Serpent Mound', 39.0252, -83.4302, 'known', 'verified', 'Largest serpent effigy in the world', 'Fort Ancient/Adena', '1000 BCE - 1200 CE', ARRAY['effigy', 'burial mound']),
  ('Moundville', 33.0039, -87.6319, 'known', 'verified', 'Second largest Mississippian site after Cahokia', 'Mississippian', '1000-1450 CE', ARRAY['platform mound', 'plaza', 'palisade']),
  ('Newark Earthworks', 40.0503, -82.4331, 'known', 'verified', 'Largest set of geometric earthen enclosures in the world', 'Hopewell', '100 BCE - 500 CE', ARRAY['octagon', 'circle', 'square']),
  ('Etowah Mounds', 34.1256, -84.8047, 'known', 'verified', 'Political center with platform mounds and plaza', 'Mississippian', '1000-1550 CE', ARRAY['platform mound', 'borrow pit', 'plaza']),
  ('Angel Mounds', 37.9317, -87.4500, 'known', 'verified', 'One of the northernmost Mississippian settlements', 'Mississippian', '1000-1450 CE', ARRAY['platform mound', 'palisade', 'plaza']),
  ('Ocmulgee Mounds', 32.8380, -83.6063, 'known', 'verified', 'Features the famous Earth Lodge with original floor', 'Mississippian', '900-1150 CE', ARRAY['platform mound', 'earth lodge', 'funeral mound']),
  ('Winterville Mounds', 33.4686, -91.0583, 'known', 'verified', 'Major Mississippian ceremonial center', 'Mississippian', '1000-1450 CE', ARRAY['platform mound', 'plaza']),
  ('Kincaid Mounds', 37.1564, -88.5342, 'known', 'verified', 'Southernmost Mississippian mound center in Illinois', 'Mississippian', '1050-1400 CE', ARRAY['platform mound', 'palisade']),
  ('Marksville', 31.1267, -92.0675, 'known', 'verified', 'Hopewell-influenced site in Louisiana', 'Marksville culture', '100-400 CE', ARRAY['burial mound', 'earthwork']),
  ('Pinson Mounds', 35.4883, -88.5933, 'known', 'verified', 'One of the largest Middle Woodland mound complexes', 'Middle Woodland', '1-500 CE', ARRAY['burial mound', 'geometric earthwork'])
ON CONFLICT DO NOTHING;
