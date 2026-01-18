# Lost & Found - System Architecture

## Overview

Lost & Found is an AI-powered archaeological site discovery tool that analyzes satellite imagery to detect undocumented archaeological features (mounds, earthworks, geometric patterns) across the United States.

## System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SvelteKit Application                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │  Leaflet Map │  │   Controls   │  │      Results Panel       │  │   │
│  │  │ (ESRI/OSM)   │  │    Panel     │  │  (Site list, details)    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (SvelteKit)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ /api/analyze│  │ /api/sites  │  │ /api/regions│  │ /api/tiles      │   │
│  │             │  │             │  │             │  │ (NAIP proxy)    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│    IMAGE FETCHER      │ │   ML ANALYZER   │ │         SUPABASE            │
│  ┌─────────────────┐  │ │ ┌─────────────┐ │ │  ┌───────────────────────┐  │
│  │  NAIP Service   │  │ │ │Claude Vision│ │ │  │      PostgreSQL       │  │
│  │  (AWS/USDA)     │  │ │ │   API       │ │ │  │  ┌─────────────────┐  │  │
│  └─────────────────┘  │ │ └─────────────┘ │ │  │  │  known_sites    │  │  │
│  ┌─────────────────┐  │ │ ┌─────────────┐ │ │  │  │  potential_sites│  │  │
│  │  Tile Cache     │  │ │ │  Custom ML  │ │ │  │  │  scan_regions   │  │  │
│  │  (Supabase)     │  │ │ │  (Future)   │ │ │  │  │  analysis_jobs  │  │  │
│  └─────────────────┘  │ │ └─────────────┘ │ │  │  └─────────────────┘  │  │
└───────────────────────┘ └─────────────────┘ │  │  ┌─────────────────┐  │  │
                                              │  │  │    PostGIS      │  │  │
                                              │  │  │  (spatial ext)  │  │  │
                                              │  │  └─────────────────┘  │  │
                                              │  ├───────────────────────┤  │
                                              │  │       Storage         │  │
                                              │  │  (tile cache bucket)  │  │
                                              └──┴───────────────────────┴──┘
```

## Data Flow

### 1. Region Selection & Analysis Request

```
User draws region on map
         │
         ▼
┌─────────────────────────────────────┐
│  Frontend validates region size     │
│  (max 100 km² per request)          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  POST /api/analyze                  │
│  { bbox: {n, s, e, w} }            │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Create analysis_job record         │
│  status: 'queued'                   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Return job_id to frontend          │
│  (async processing begins)          │
└─────────────────────────────────────┘
```

### 2. Image Fetching Pipeline

```
┌─────────────────────────────────────┐
│  Tile Calculator                    │
│  - Split bbox into 256x256 tiles    │
│  - Calculate tile indices for       │
│    NAIP at zoom level 16-18         │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  For each tile:                     │
│  1. Check Supabase tile_cache       │
│  2. If miss → fetch from NAIP       │
│  3. Store in Supabase Storage       │
│  4. Update tile_cache record        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Composite tiles into analysis      │
│  regions (512x512 or 1024x1024)     │
└─────────────────────────────────────┘
```

### 3. ML Analysis Pipeline

```
┌─────────────────────────────────────┐
│  For each composite tile:           │
│                                     │
│  1. Send to Claude Vision API       │
│     with archaeological prompt      │
│                                     │
│  2. Parse response for:             │
│     - Detected features             │
│     - Confidence scores             │
│     - Bounding boxes                │
│     - Feature classifications       │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Post-processing:                   │
│  - Deduplicate overlapping detects  │
│  - Convert pixel coords → lat/lng   │
│  - Filter by confidence threshold   │
│  - Cross-reference known_sites      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Store results:                     │
│  - Insert potential_sites records   │
│  - Update analysis_job status       │
│  - Notify frontend via polling      │
└─────────────────────────────────────┘
```

## NAIP Imagery Source

### Why NAIP?

- **Public Domain**: No TOS restrictions (unlike Google Maps)
- **High Resolution**: 30-60cm GSD (Ground Sample Distance)
- **Coverage**: Continental USA, updated every 2-3 years
- **Free Access**: Available via AWS Open Data Program

### NAIP Access Methods

#### Option 1: AWS Open Data (Recommended)

```
Bucket: s3://naip-analytic (COG format)
Bucket: s3://naip-visualization (RGB tiles)

URL Pattern:
https://naip-analytic.s3.amazonaws.com/{state}/{year}/{resolution}/rgbir_cog/{filename}.tif
```

**Pros**: Fast, reliable, Cloud-Optimized GeoTIFFs (COG), free egress
**Cons**: Requires understanding of NAIP file naming conventions

#### Option 2: USDA NAIP Web Map Service

```
WMS Endpoint: https://gis.apfo.usda.gov/arcgis/services/NAIP/USDA_CONUS_PRIME/ImageServer/WMSServer

Tile Request:
GET ?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap
    &LAYERS=0
    &BBOX={west},{south},{east},{north}
    &WIDTH=256&HEIGHT=256
    &SRS=EPSG:4326
    &FORMAT=image/jpeg
```

**Pros**: Simple WMS interface, no file management
**Cons**: Slower, rate limits, less reliable

#### Option 3: Microsoft Planetary Computer

```
STAC API: https://planetarycomputer.microsoft.com/api/stac/v1
Collection: naip

import pystac_client
catalog = pystac_client.Client.open(
    "https://planetarycomputer.microsoft.com/api/stac/v1"
)
```

**Pros**: Modern STAC API, great tooling, additional datasets
**Cons**: Requires authentication for high-volume access

### Recommended Approach

Use **AWS Open Data** as primary source with **USDA WMS** as fallback:

```typescript
// src/lib/services/naip.ts

const NAIP_AWS_BASE = 'https://naip-visualization.s3.amazonaws.com';
const NAIP_WMS_BASE = 'https://gis.apfo.usda.gov/arcgis/services/NAIP/USDA_CONUS_PRIME/ImageServer/WMSServer';

async function fetchNAIPTile(bbox: BoundingBox, width = 512, height = 512): Promise<Buffer> {
  // Try AWS first (faster)
  try {
    return await fetchFromAWS(bbox, width, height);
  } catch (error) {
    // Fallback to WMS
    return await fetchFromWMS(bbox, width, height);
  }
}
```

## ML Analysis Strategy

### Primary: Claude Vision API

Claude's vision capabilities are well-suited for archaeological feature detection because:

1. **Zero-shot learning**: Can describe what to look for without training data
2. **Contextual understanding**: Understands "mound", "earthwork", "geometric pattern"
3. **Explanation capability**: Can explain why a feature looks archaeological
4. **Cost-effective**: ~$0.01-0.03 per image analysis

#### Analysis Prompt Template

```typescript
const ARCHAEOLOGICAL_PROMPT = `
Analyze this aerial/satellite image for potential archaeological features.

Look for:
1. **Mounds**: Circular or conical elevated areas, often 10-100m diameter
2. **Earthworks**: Linear embankments, geometric enclosures, effigy shapes
3. **Crop marks**: Vegetation differences indicating buried structures
4. **Shadow anomalies**: Subtle elevation changes visible in shadows
5. **Geometric patterns**: Unnatural straight lines, circles, or rectangles

For each potential feature found, provide:
- Feature type (mound/earthwork/cropmark/other)
- Confidence (low/medium/high)
- Approximate location in image (top-left, center, etc.)
- Size estimate
- Brief description of why this appears archaeological

If no features found, respond with: { "features": [] }

Respond in JSON format:
{
  "features": [
    {
      "type": "mound",
      "confidence": "high",
      "location": { "x": 0.3, "y": 0.6 },
      "size_meters": 25,
      "description": "Circular elevated feature with consistent profile..."
    }
  ],
  "overall_assessment": "Brief summary of the area"
}
`;
```

### Future: Custom ML Model

For higher volume or specialized detection, consider training a custom model:

```
Architecture: YOLOv8 or Mask R-CNN
Training data:
  - Known site locations + NAIP imagery
  - Manual annotations of features
  - Synthetic data augmentation

Deployment:
  - Replicate.com for serverless inference
  - Modal.com for batch processing
  - Self-hosted on GPU instance for high volume
```

## Processing Architecture

### Sync vs Async

| Region Size | Tiles | Processing | Approach |
|------------|-------|------------|----------|
| < 1 km² | 1-4 | < 30s | Synchronous |
| 1-10 km² | 4-40 | 30s-5min | Async + Polling |
| 10-100 km² | 40-400 | 5-60min | Async + Job Queue |

### Job Queue Implementation

For regions > 1 km², use async processing with Supabase:

```typescript
// 1. Create job record
const { data: job } = await supabase
  .from('analysis_jobs')
  .insert({
    bbox: region,
    status: 'queued',
    total_tiles: tileCount,
    processed_tiles: 0
  })
  .select()
  .single();

// 2. Process in background (edge function or external worker)
await processAnalysisJob(job.id);

// 3. Frontend polls for status
const { data: status } = await supabase
  .from('analysis_jobs')
  .select('status, processed_tiles, total_tiles, results_count')
  .eq('id', jobId)
  .single();
```

### Tiling Strategy

```
Input Region: User-drawn bounding box (max 100 km²)
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Grid Subdivision                           │
│  - Split into 500m x 500m analysis cells   │
│  - Each cell = ~1-4 NAIP tiles at z18      │
│  - Add 10% overlap for edge detection      │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Tile Fetching                              │
│  - Fetch NAIP tiles for each cell          │
│  - Composite into 1024x1024 analysis image │
│  - Cache composited image                   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Analysis                                   │
│  - Send each composite to ML               │
│  - Process in parallel (limit: 5 concurrent)│
│  - Merge results, remove duplicates        │
└─────────────────────────────────────────────┘
```

## Caching Strategy

### Tile Cache (Supabase Storage)

```
Bucket: naip-tiles
Structure: /{state}/{year}/{z}/{x}/{y}.jpg

Cache Policy:
- TTL: 1 year (NAIP updates every 2-3 years)
- Max size: Configure based on budget
- Eviction: LRU for tiles older than 2 years
```

### Analysis Cache (Supabase Table)

```sql
-- Cache ML analysis results by tile
CREATE TABLE tile_analysis_cache (
  tile_key TEXT PRIMARY KEY,  -- "{z}/{x}/{y}"
  bbox GEOMETRY(POLYGON, 4326),
  analysis_date TIMESTAMPTZ,
  model_version TEXT,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Don't re-analyze same tile with same model
CREATE INDEX idx_tile_analysis_version ON tile_analysis_cache(tile_key, model_version);
```

## Supabase Schema

### Enable PostGIS

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

### Tables

```sql
-- ============================================
-- KNOWN SITES (verified archaeological sites)
-- ============================================
CREATE TABLE known_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location GEOMETRY(POINT, 4326) NOT NULL,
  site_type TEXT,  -- 'mound', 'earthwork', 'village', etc.
  culture TEXT,    -- 'Hopewell', 'Mississippian', etc.
  time_period TEXT,
  description TEXT,
  source_url TEXT,
  source_name TEXT,
  verified_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_known_sites_location ON known_sites USING GIST(location);
CREATE INDEX idx_known_sites_type ON known_sites(site_type);

-- ============================================
-- POTENTIAL SITES (ML-detected candidates)
-- ============================================
CREATE TABLE potential_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location GEOMETRY(POINT, 4326) NOT NULL,
  bbox GEOMETRY(POLYGON, 4326),  -- Detection bounding box
  feature_type TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  size_meters REAL,
  description TEXT,
  ml_model TEXT NOT NULL,
  ml_response JSONB,
  source_tile TEXT,  -- Reference to analyzed tile
  analysis_job_id UUID REFERENCES analysis_jobs(id),
  status TEXT DEFAULT 'unverified',  -- 'unverified', 'verified', 'rejected', 'known'
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_potential_sites_location ON potential_sites USING GIST(location);
CREATE INDEX idx_potential_sites_confidence ON potential_sites(confidence DESC);
CREATE INDEX idx_potential_sites_status ON potential_sites(status);

-- ============================================
-- SCAN REGIONS (user-requested analysis areas)
-- ============================================
CREATE TABLE scan_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bbox GEOMETRY(POLYGON, 4326) NOT NULL,
  area_km2 REAL,
  requested_by UUID,
  status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'complete', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scan_regions_bbox ON scan_regions USING GIST(bbox);

-- ============================================
-- ANALYSIS JOBS (background processing)
-- ============================================
CREATE TABLE analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_region_id UUID REFERENCES scan_regions(id),
  bbox GEOMETRY(POLYGON, 4326) NOT NULL,
  status TEXT DEFAULT 'queued',  -- 'queued', 'fetching', 'analyzing', 'complete', 'failed'
  total_tiles INTEGER,
  processed_tiles INTEGER DEFAULT 0,
  results_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);

-- ============================================
-- TILE CACHE METADATA
-- ============================================
CREATE TABLE tile_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_key TEXT UNIQUE NOT NULL,  -- "z/x/y"
  bbox GEOMETRY(POLYGON, 4326),
  source TEXT NOT NULL,  -- 'naip_aws', 'naip_wms'
  year INTEGER,
  storage_path TEXT NOT NULL,  -- Path in Supabase Storage
  file_size INTEGER,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tile_cache_key ON tile_cache(tile_key);
CREATE INDEX idx_tile_cache_bbox ON tile_cache USING GIST(bbox);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Find known sites within a bounding box
CREATE OR REPLACE FUNCTION sites_in_bbox(
  north FLOAT, south FLOAT, east FLOAT, west FLOAT
) RETURNS SETOF known_sites AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM known_sites
  WHERE ST_Within(
    location,
    ST_MakeEnvelope(west, south, east, north, 4326)
  );
END;
$$ LANGUAGE plpgsql;

-- Find potential sites near a point (for deduplication)
CREATE OR REPLACE FUNCTION nearby_potential_sites(
  lat FLOAT, lng FLOAT, radius_meters FLOAT DEFAULT 100
) RETURNS SETOF potential_sites AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM potential_sites
  WHERE ST_DWithin(
    location::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  );
END;
$$ LANGUAGE plpgsql;
```

### Row Level Security

```sql
-- Enable RLS
ALTER TABLE known_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE potential_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tile_cache ENABLE ROW LEVEL SECURITY;

-- Public read access for known sites
CREATE POLICY "Known sites are viewable by everyone"
  ON known_sites FOR SELECT
  USING (true);

-- Public read access for potential sites
CREATE POLICY "Potential sites are viewable by everyone"
  ON potential_sites FOR SELECT
  USING (true);

-- Authenticated users can create scan regions
CREATE POLICY "Authenticated users can create scan regions"
  ON scan_regions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role for backend operations
CREATE POLICY "Service role full access to analysis_jobs"
  ON analysis_jobs FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access to tile_cache"
  ON tile_cache FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert potential_sites"
  ON potential_sites FOR INSERT
  TO service_role
  WITH CHECK (true);
```

## API Endpoints

### POST /api/analyze

Start analysis for a region.

```typescript
// Request
{
  bbox: { north: number, south: number, east: number, west: number }
}

// Response
{
  success: boolean,
  jobId: string,
  estimatedTiles: number,
  estimatedTime: string  // "~2 minutes"
}
```

### GET /api/analyze/[jobId]

Check analysis job status.

```typescript
// Response
{
  status: 'queued' | 'fetching' | 'analyzing' | 'complete' | 'failed',
  progress: {
    processed: number,
    total: number,
    percentage: number
  },
  results?: {
    sitesFound: number,
    sites: PotentialSite[]
  }
}
```

### GET /api/sites

Get sites within a bounding box.

```typescript
// Query params
?north=40&south=39&east=-82&west=-83&type=all|known|potential

// Response
{
  known: Site[],
  potential: PotentialSite[]
}
```

### GET /api/tiles/naip/[z]/[x]/[y]

Proxy NAIP tiles (for debugging/preview).

```typescript
// Returns: image/jpeg
```

## Cost Estimates

### Claude Vision API

| Region Size | Tiles | Cost/Analysis | Notes |
|------------|-------|---------------|-------|
| 1 km² | ~4 | ~$0.10 | Sync OK |
| 10 km² | ~40 | ~$1.00 | Async recommended |
| 100 km² | ~400 | ~$10.00 | Job queue required |

*Based on ~$0.025 per 1024x1024 image analysis*

### Supabase

| Resource | Free Tier | Pro Tier |
|----------|-----------|----------|
| Database | 500MB | 8GB |
| Storage | 1GB | 100GB |
| Bandwidth | 2GB | 250GB |

*Tile cache will be primary storage consumer*

### Total Monthly (Estimated)

| Usage Level | Analysis Cost | Supabase | Total |
|-------------|---------------|----------|-------|
| Light (10 regions/day) | ~$30 | Free | ~$30 |
| Medium (50 regions/day) | ~$150 | $25 | ~$175 |
| Heavy (200 regions/day) | ~$600 | $25 | ~$625 |

## Implementation Phases

### Phase 1: Core Pipeline (MVP)
- [ ] NAIP tile fetching service
- [ ] Basic Claude Vision integration
- [ ] Supabase schema setup
- [ ] Synchronous analysis for small regions
- [ ] Results display on map

### Phase 2: Scale & Reliability
- [ ] Async job processing
- [ ] Tile caching system
- [ ] Progress tracking UI
- [ ] Error handling & retries
- [ ] Rate limiting

### Phase 3: Enhanced Detection
- [ ] Multiple model comparison
- [ ] Confidence calibration
- [ ] Known site cross-referencing
- [ ] User verification workflow
- [ ] Export functionality

### Phase 4: Advanced Features
- [ ] Custom model training
- [ ] Time-series analysis (historical imagery)
- [ ] LiDAR integration (where available)
- [ ] Community contributions
- [ ] Mobile app

## Security Considerations

1. **API Keys**: Store Claude API key in environment variables, never expose to frontend
2. **Rate Limiting**: Implement per-IP and per-user rate limits on /api/analyze
3. **Input Validation**: Validate bbox coordinates, enforce max region size
4. **Storage Access**: Use signed URLs for tile cache access
5. **Cost Controls**: Set billing alerts, implement daily analysis quotas

## Monitoring & Observability

```typescript
// Key metrics to track
- Analysis jobs per day
- Average tiles per job
- ML API latency (p50, p95, p99)
- Cache hit rate
- Error rate by type
- Cost per analysis
```

Use Supabase logs + external service (Axiom, Datadog) for production monitoring.
