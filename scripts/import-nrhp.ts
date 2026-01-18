/**
 * NRHP Data Import Script
 *
 * Fetches ~90k records from the NRHP ArcGIS REST API
 * and upserts them to the known_sites table in Supabase.
 *
 * Prerequisites:
 * 1. Run the database migration (supabase/migrations/001_known_sites.sql)
 * 2. Set SUPABASE_SERVICE_ROLE_KEY environment variable
 *
 * Run with: npx tsx scripts/import-nrhp.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const NRHP_API_BASE =
	'https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/NRHP_Centroids/FeatureServer/0/query';
const PAGE_SIZE = 1000;
const RATE_LIMIT_DELAY = 200; // ms between API requests

// Environment variables
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
	console.error('Error: Missing environment variables');
	console.error('Required: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
	console.error('\nUsage:');
	console.error(
		'  PUBLIC_SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/import-nrhp.ts'
	);
	process.exit(1);
}

interface NRHPFeature {
	attributes: {
		OBJECTID: number;
		REFNUM: string;
		RESNAME: string;
		RESTYPE: string;
		ADDRESS: string;
		CITY: string;
		COUNTY: string;
		STATE: string;
		DATE_ENTER: number | null;
		DATE_LIST: number | null;
	};
	geometry: {
		x: number;
		y: number;
	} | null;
}

interface NRHPResponse {
	features: NRHPFeature[];
	exceededTransferLimit?: boolean;
}

interface KnownSiteRecord {
	nrhp_id: string;
	name: string;
	site_type: string | null;
	category: string;
	address: string | null;
	city: string | null;
	county: string | null;
	state: string;
	lat: number;
	lng: number;
	coordinates: string;
	date_listed: string | null;
}

/**
 * Categorize resource type into broader categories
 */
function categorizeResourceType(resType: string | null): string {
	if (!resType) return 'other';
	const type = resType.toLowerCase();
	if (type.includes('building')) return 'building';
	if (type.includes('structure')) return 'structure';
	if (type.includes('site')) return 'site';
	if (type.includes('district')) return 'district';
	if (type.includes('object')) return 'object';
	return 'other';
}

/**
 * Parse ESRI timestamp to ISO date string
 */
function parseEsriDate(timestamp: number | null): string | null {
	if (!timestamp) return null;
	try {
		const date = new Date(timestamp);
		return date.toISOString().split('T')[0];
	} catch {
		return null;
	}
}

/**
 * Clean and validate string fields
 */
function cleanString(value: string | null | undefined): string | null {
	if (!value) return null;
	const cleaned = value.trim();
	return cleaned.length > 0 ? cleaned : null;
}

/**
 * Fetch a page of NRHP data
 */
async function fetchPage(offset: number): Promise<NRHPResponse> {
	const params = new URLSearchParams({
		where: '1=1',
		outFields: 'OBJECTID,REFNUM,RESNAME,RESTYPE,ADDRESS,CITY,COUNTY,STATE,DATE_ENTER,DATE_LIST',
		geometryType: 'esriGeometryPoint',
		spatialRel: 'esriSpatialRelIntersects',
		returnGeometry: 'true',
		outSR: '4326',
		resultOffset: offset.toString(),
		resultRecordCount: PAGE_SIZE.toString(),
		f: 'json'
	});

	const url = `${NRHP_API_BASE}?${params}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();

	if (data.error) {
		throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
	}

	return data;
}

/**
 * Transform NRHP feature to our schema
 */
function transformFeature(feature: NRHPFeature): KnownSiteRecord | null {
	const { attributes, geometry } = feature;

	// Skip records without valid geometry or ID
	if (!geometry || !attributes.REFNUM) {
		return null;
	}

	// Validate coordinates are within reasonable bounds
	const lng = geometry.x;
	const lat = geometry.y;
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		return null;
	}

	// Skip non-US records (should have 2-letter state code)
	const state = cleanString(attributes.STATE);
	if (!state || state.length !== 2) {
		return null;
	}

	return {
		nrhp_id: attributes.REFNUM,
		name: cleanString(attributes.RESNAME) || 'Unnamed Site',
		site_type: cleanString(attributes.RESTYPE),
		category: categorizeResourceType(attributes.RESTYPE),
		address: cleanString(attributes.ADDRESS),
		city: cleanString(attributes.CITY),
		county: cleanString(attributes.COUNTY),
		state: state.toUpperCase(),
		lat,
		lng,
		coordinates: `POINT(${lng} ${lat})`,
		date_listed: parseEsriDate(attributes.DATE_LIST)
	};
}

/**
 * Main import function
 */
async function main() {
	console.log('='.repeat(60));
	console.log('NRHP Data Import');
	console.log('='.repeat(60));
	console.log(`\nTarget: ${SUPABASE_URL}`);
	console.log(`Source: ${NRHP_API_BASE}`);
	console.log(`Page size: ${PAGE_SIZE}\n`);

	const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

	let offset = 0;
	let totalImported = 0;
	let totalSkipped = 0;
	let hasMore = true;
	let pageCount = 0;
	const startTime = Date.now();

	while (hasMore) {
		pageCount++;
		const pageStart = Date.now();

		try {
			console.log(`[Page ${pageCount}] Fetching records ${offset} - ${offset + PAGE_SIZE}...`);

			const data = await fetchPage(offset);
			const features = data.features || [];

			if (features.length === 0) {
				console.log('  No more records found.');
				hasMore = false;
				break;
			}

			// Transform features to our schema
			const records: KnownSiteRecord[] = [];
			let skippedInBatch = 0;

			for (const feature of features) {
				const record = transformFeature(feature);
				if (record) {
					records.push(record);
				} else {
					skippedInBatch++;
				}
			}

			totalSkipped += skippedInBatch;

			if (records.length > 0) {
				// Upsert to Supabase (update on conflict with nrhp_id)
				const { error } = await supabase.from('known_sites').upsert(records, {
					onConflict: 'nrhp_id',
					ignoreDuplicates: false
				});

				if (error) {
					console.error(`  Error upserting batch: ${error.message}`);
					// Continue with next batch instead of failing completely
				} else {
					totalImported += records.length;
				}
			}

			const elapsed = ((Date.now() - pageStart) / 1000).toFixed(1);
			console.log(
				`  Imported: ${records.length} | Skipped: ${skippedInBatch} | Time: ${elapsed}s | Total: ${totalImported}`
			);

			// Check if there are more records
			hasMore = data.exceededTransferLimit || features.length === PAGE_SIZE;
			offset += PAGE_SIZE;

			// Rate limiting
			if (hasMore) {
				await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
			}
		} catch (error) {
			console.error(`  Error on page ${pageCount}:`, error);

			// Retry logic with exponential backoff
			const retryDelay = Math.min(2000 * Math.pow(2, Math.floor(pageCount / 10)), 30000);
			console.log(`  Retrying in ${retryDelay / 1000}s...`);
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}

	const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

	console.log('\n' + '='.repeat(60));
	console.log('Import Complete');
	console.log('='.repeat(60));
	console.log(`Total imported: ${totalImported.toLocaleString()}`);
	console.log(`Total skipped:  ${totalSkipped.toLocaleString()}`);
	console.log(`Total time:     ${totalTime} minutes`);
	console.log('='.repeat(60));

	// Verify final count
	const { count, error: countError } = await supabase
		.from('known_sites')
		.select('*', { count: 'exact', head: true });

	if (!countError && count !== null) {
		console.log(`\nVerified database count: ${count.toLocaleString()} records`);
	}
}

// Run the import
main().catch((error) => {
	console.error('\nFatal error:', error);
	process.exit(1);
});
