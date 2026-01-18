-- Sites table for archaeological site data
CREATE TABLE IF NOT EXISTS sites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('known', 'potential', 'unverified')),
    description TEXT,
    date_discovered DATE,
    culture TEXT,
    time_period TEXT,
    features TEXT[], -- Array of feature strings
    image_url TEXT,
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster geo queries
CREATE INDEX IF NOT EXISTS sites_coordinates_idx ON sites (lat, lng);
CREATE INDEX IF NOT EXISTS sites_status_idx ON sites (status);

-- Enable Row Level Security (RLS)
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON sites
    FOR SELECT
    USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated insert" ON sites
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update
CREATE POLICY "Allow authenticated update" ON sites
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Insert sample data
INSERT INTO sites (name, lat, lng, status, description, culture, time_period, features) VALUES
    ('Norton Mounds', 42.9634, -85.6681, 'known', 'Hopewell burial mounds complex dating to 100 BCE - 400 CE', 'Hopewell', '100 BCE - 400 CE', ARRAY['Burial mounds', 'Ceremonial artifacts']),
    ('Sanilac Petroglyphs', 43.5317, -82.9253, 'known', 'Ancient rock carvings created by Indigenous peoples', 'Algonquian', '300-1000 CE', ARRAY['Petroglyphs', 'Rock art']),
    ('Potential Site Alpha', 44.2, -84.5, 'potential', 'Anomaly detected via satellite imagery analysis', NULL, NULL, ARRAY['Geometric patterns', 'Soil discoloration']),
    ('Potential Site Beta', 43.8, -86.1, 'potential', 'Possible earthwork formation near river confluence', NULL, NULL, ARRAY['Linear features', 'Elevated terrain']),
    ('Unverified Location C', 45.1, -84.8, 'unverified', 'Reported anomaly requiring field verification', NULL, NULL, NULL);
