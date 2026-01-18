/**
 * Background scanner service for systematically analyzing satellite imagery
 */

import type { BoundingBox } from '$lib/types';
import { supabase } from '$lib/supabase';
import { fetchTileImagery, tileToBbox, getTileKey, type TileCoordinates } from './naip';
import { analyzeImage, confidenceToNumber, type DetectedFeature } from './analyzer';

export interface ScanJob {
	id: string;
	name: string;
	regionType: 'hot_zone' | 'state' | 'county' | 'custom';
	regionId: string | null;
	bbox: BoundingBox;
	status: 'queued' | 'scanning' | 'paused' | 'complete' | 'failed';
	progress: {
		totalTiles: number;
		scannedTiles: number;
		sitesFound: number;
		currentTileX: number;
		currentTileY: number;
	};
	zoomLevel: number;
	startedAt: Date | null;
	pausedAt: Date | null;
	completedAt: Date | null;
	createdAt: Date;
	errorMessage: string | null;
}

export interface ScanConfig {
	zoomLevel: number;
	maxConcurrentTiles: number;
	delayBetweenTiles: number;  // ms
	confidenceThreshold: number;
	skipAnalyzedTiles: boolean;
}

const DEFAULT_CONFIG: ScanConfig = {
	zoomLevel: 17,
	maxConcurrentTiles: 2,
	delayBetweenTiles: 1000,  // 1 second between tiles to avoid rate limits
	confidenceThreshold: 0.5,
	skipAnalyzedTiles: true
};

/**
 * Convert bounding box to tile range at given zoom level
 */
export function bboxToTileRange(bbox: BoundingBox, zoom: number): {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
} {
	const n = Math.pow(2, zoom);

	const minX = Math.floor((bbox.west + 180) / 360 * n);
	const maxX = Math.floor((bbox.east + 180) / 360 * n);

	const minY = Math.floor((1 - Math.log(Math.tan(bbox.north * Math.PI / 180) + 1 / Math.cos(bbox.north * Math.PI / 180)) / Math.PI) / 2 * n);
	const maxY = Math.floor((1 - Math.log(Math.tan(bbox.south * Math.PI / 180) + 1 / Math.cos(bbox.south * Math.PI / 180)) / Math.PI) / 2 * n);

	return { minX, maxX, minY, maxY };
}

/**
 * Calculate total number of tiles in a bounding box
 */
export function calculateTileCount(bbox: BoundingBox, zoom: number): number {
	const { minX, maxX, minY, maxY } = bboxToTileRange(bbox, zoom);
	return (maxX - minX + 1) * (maxY - minY + 1);
}

/**
 * Generate all tile coordinates for a bounding box
 */
export function* iterateTiles(bbox: BoundingBox, zoom: number): Generator<TileCoordinates> {
	const { minX, maxX, minY, maxY } = bboxToTileRange(bbox, zoom);

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			yield { z: zoom, x, y };
		}
	}
}

/**
 * Get tile index from x,y coordinates
 */
function getTileIndex(x: number, y: number, minX: number, minY: number, width: number): number {
	return (y - minY) * width + (x - minX);
}

/**
 * Create a new scan job
 */
export async function createScanJob(
	name: string,
	bbox: BoundingBox,
	regionType: ScanJob['regionType'],
	regionId: string | null = null,
	config: Partial<ScanConfig> = {}
): Promise<ScanJob> {
	const fullConfig = { ...DEFAULT_CONFIG, ...config };
	const totalTiles = calculateTileCount(bbox, fullConfig.zoomLevel);
	const { minX, minY } = bboxToTileRange(bbox, fullConfig.zoomLevel);

	const { data, error } = await supabase
		.from('scan_jobs')
		.insert({
			name,
			region_type: regionType,
			region_id: regionId,
			north: bbox.north,
			south: bbox.south,
			east: bbox.east,
			west: bbox.west,
			status: 'queued',
			total_tiles: totalTiles,
			scanned_tiles: 0,
			sites_found: 0,
			current_tile_x: minX,
			current_tile_y: minY,
			zoom_level: fullConfig.zoomLevel
		})
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create scan job: ${error.message}`);
	}

	return dbRowToScanJob(data);
}

/**
 * Get scan job by ID
 */
export async function getScanJob(jobId: string): Promise<ScanJob | null> {
	const { data, error } = await supabase
		.from('scan_jobs')
		.select('*')
		.eq('id', jobId)
		.single();

	if (error || !data) {
		return null;
	}

	return dbRowToScanJob(data);
}

/**
 * Get all scan jobs
 */
export async function getAllScanJobs(): Promise<ScanJob[]> {
	const { data, error } = await supabase
		.from('scan_jobs')
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		throw new Error(`Failed to fetch scan jobs: ${error.message}`);
	}

	return (data || []).map(dbRowToScanJob);
}

/**
 * Get active scan job (if any)
 */
export async function getActiveScanJob(): Promise<ScanJob | null> {
	const { data, error } = await supabase
		.from('scan_jobs')
		.select('*')
		.eq('status', 'scanning')
		.limit(1)
		.single();

	if (error || !data) {
		return null;
	}

	return dbRowToScanJob(data);
}

/**
 * Update scan job status
 */
export async function updateScanJobStatus(
	jobId: string,
	status: ScanJob['status'],
	updates: Partial<{
		scanned_tiles: number;
		sites_found: number;
		current_tile_x: number;
		current_tile_y: number;
		error_message: string;
		started_at: string;
		paused_at: string;
		completed_at: string;
	}> = {}
): Promise<void> {
	const { error } = await supabase
		.from('scan_jobs')
		.update({ status, ...updates })
		.eq('id', jobId);

	if (error) {
		throw new Error(`Failed to update scan job: ${error.message}`);
	}
}

/**
 * Pause a running scan
 */
export async function pauseScan(jobId: string): Promise<void> {
	await updateScanJobStatus(jobId, 'paused', {
		paused_at: new Date().toISOString()
	});
}

/**
 * Check if a scan is paused
 */
export async function isScanPaused(jobId: string): Promise<boolean> {
	const job = await getScanJob(jobId);
	return job?.status === 'paused';
}

/**
 * Store a detected potential site
 */
async function storePotentialSite(
	feature: DetectedFeature,
	tile: TileCoordinates,
	tileBbox: BoundingBox,
	scanJobId: string,
	model: string,
	reasoning: string
): Promise<string | null> {
	// Convert image coordinates to geographic coordinates
	const lat = tileBbox.north - (tileBbox.north - tileBbox.south) * feature.location.y;
	const lng = tileBbox.west + (tileBbox.east - tileBbox.west) * feature.location.x;

	// Check for nearby existing sites
	const { data: nearby } = await supabase.rpc('has_nearby_site', {
		p_lat: lat,
		p_lng: lng,
		p_radius_km: 0.05  // 50 meters
	});

	if (nearby) {
		console.log(`Skipping duplicate near ${lat}, ${lng}`);
		return null;
	}

	const confidence = confidenceToNumber(feature.confidence);

	const { data, error } = await supabase
		.from('sites')
		.insert({
			name: `Potential ${feature.type}`,
			lat,
			lng,
			status: 'potential',
			review_status: 'pending',
			feature_type: feature.type,
			confidence,
			size_meters: feature.sizeMeters,
			description: feature.description,
			ml_model: model,
			ml_reasoning: reasoning,
			tile_z: tile.z,
			tile_x: tile.x,
			tile_y: tile.y,
			scan_job_id: scanJobId
		})
		.select('id')
		.single();

	if (error) {
		console.error('Failed to store potential site:', error);
		return null;
	}

	return data.id;
}

/**
 * Process a single tile
 */
async function processTile(
	tile: TileCoordinates,
	scanJobId: string,
	config: ScanConfig
): Promise<number> {
	const tileBbox = tileToBbox(tile);
	const tileKey = getTileKey(tile);

	// Check if already analyzed
	if (config.skipAnalyzedTiles) {
		const { data: cached } = await supabase
			.from('tile_cache')
			.select('analyzed')
			.eq('tile_key', tileKey)
			.single();

		if (cached?.analyzed) {
			console.log(`Tile ${tileKey} already analyzed, skipping`);
			return 0;
		}
	}

	// Fetch imagery
	let imageData: ArrayBuffer;
	try {
		const result = await fetchTileImagery(tile);
		imageData = result.imageData;
	} catch (fetchError) {
		console.error(`Failed to fetch tile ${tileKey}:`, fetchError);
		return 0;
	}

	// Analyze with ML
	let analysisResult;
	try {
		analysisResult = await analyzeImage(imageData);
	} catch (analysisError) {
		console.error(`Failed to analyze tile ${tileKey}:`, analysisError);
		return 0;
	}

	// Store tile as analyzed
	await supabase
		.from('tile_cache')
		.upsert({
			tile_key: tileKey,
			z: tile.z,
			x: tile.x,
			y: tile.y,
			north: tileBbox.north,
			south: tileBbox.south,
			east: tileBbox.east,
			west: tileBbox.west,
			analyzed: true,
			analyzed_at: new Date().toISOString()
		}, { onConflict: 'tile_key' });

	// Store detected features
	let sitesFound = 0;
	for (const feature of analysisResult.features) {
		const numericConfidence = confidenceToNumber(feature.confidence);
		if (numericConfidence < config.confidenceThreshold) {
			continue;
		}

		const siteId = await storePotentialSite(
			feature,
			tile,
			tileBbox,
			scanJobId,
			analysisResult.model,
			analysisResult.overallAssessment
		);

		if (siteId) {
			sitesFound++;
		}
	}

	return sitesFound;
}

/**
 * Run a scan job (call this from an API endpoint or background worker)
 */
export async function runScan(
	jobId: string,
	config: Partial<ScanConfig> = {},
	onProgress?: (progress: ScanJob['progress']) => void
): Promise<void> {
	const fullConfig = { ...DEFAULT_CONFIG, ...config };

	const job = await getScanJob(jobId);
	if (!job) {
		throw new Error(`Scan job ${jobId} not found`);
	}

	if (job.status !== 'queued' && job.status !== 'paused') {
		throw new Error(`Scan job ${jobId} is not in a runnable state`);
	}

	// Update status to scanning
	await updateScanJobStatus(jobId, 'scanning', {
		started_at: job.startedAt ? undefined : new Date().toISOString()
	});

	const { minX, maxX, minY, maxY } = bboxToTileRange(job.bbox, job.zoomLevel);
	const width = maxX - minX + 1;

	let scannedTiles = job.progress.scannedTiles;
	let sitesFound = job.progress.sitesFound;
	let currentX = job.progress.currentTileX || minX;
	let currentY = job.progress.currentTileY || minY;

	// Resume from last position
	const allTiles = Array.from(iterateTiles(job.bbox, job.zoomLevel));
	const startIndex = getTileIndex(currentX, currentY, minX, minY, width);

	for (let i = startIndex; i < allTiles.length; i++) {
		// Check for pause
		if (await isScanPaused(jobId)) {
			console.log(`Scan ${jobId} paused at tile ${i}`);
			return;
		}

		const tile = allTiles[i];
		currentX = tile.x;
		currentY = tile.y;

		try {
			const found = await processTile(tile, jobId, fullConfig);
			sitesFound += found;
			scannedTiles++;

			// Update progress
			await updateScanJobStatus(jobId, 'scanning', {
				scanned_tiles: scannedTiles,
				sites_found: sitesFound,
				current_tile_x: currentX,
				current_tile_y: currentY
			});

			if (onProgress) {
				onProgress({
					totalTiles: job.progress.totalTiles,
					scannedTiles,
					sitesFound,
					currentTileX: currentX,
					currentTileY: currentY
				});
			}

			// Delay between tiles
			if (fullConfig.delayBetweenTiles > 0) {
				await new Promise(resolve => setTimeout(resolve, fullConfig.delayBetweenTiles));
			}
		} catch (tileError) {
			console.error(`Error processing tile ${tile.z}/${tile.x}/${tile.y}:`, tileError);
			// Continue to next tile
		}
	}

	// Mark as complete
	await updateScanJobStatus(jobId, 'complete', {
		scanned_tiles: scannedTiles,
		sites_found: sitesFound,
		completed_at: new Date().toISOString()
	});

	console.log(`Scan ${jobId} complete. Found ${sitesFound} sites in ${scannedTiles} tiles.`);
}

/**
 * Convert database row to ScanJob type
 */
function dbRowToScanJob(row: any): ScanJob {
	return {
		id: row.id,
		name: row.name,
		regionType: row.region_type,
		regionId: row.region_id,
		bbox: {
			north: row.north,
			south: row.south,
			east: row.east,
			west: row.west
		},
		status: row.status,
		progress: {
			totalTiles: row.total_tiles,
			scannedTiles: row.scanned_tiles,
			sitesFound: row.sites_found,
			currentTileX: row.current_tile_x,
			currentTileY: row.current_tile_y
		},
		zoomLevel: row.zoom_level,
		startedAt: row.started_at ? new Date(row.started_at) : null,
		pausedAt: row.paused_at ? new Date(row.paused_at) : null,
		completedAt: row.completed_at ? new Date(row.completed_at) : null,
		createdAt: new Date(row.created_at),
		errorMessage: row.error_message
	};
}

/**
 * Estimate time remaining for a scan
 */
export function estimateTimeRemaining(job: ScanJob, avgSecondsPerTile = 3): string {
	const remaining = job.progress.totalTiles - job.progress.scannedTiles;
	const seconds = remaining * avgSecondsPerTile;

	if (seconds < 60) return `~${seconds} seconds`;
	if (seconds < 3600) return `~${Math.round(seconds / 60)} minutes`;
	if (seconds < 86400) return `~${(seconds / 3600).toFixed(1)} hours`;
	return `~${(seconds / 86400).toFixed(1)} days`;
}
