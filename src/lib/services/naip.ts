/**
 * NAIP (National Agriculture Imagery Program) tile fetching service
 *
 * NAIP provides high-resolution (30-60cm) aerial imagery of the continental US.
 * This service fetches tiles from USDA WMS servers.
 */

import type { BoundingBox } from '$lib/types';

// USDA NAIP WMS endpoint
const NAIP_WMS_BASE = 'https://gis.apfo.usda.gov/arcgis/services/NAIP/USDA_CONUS_PRIME/ImageServer/WMSServer';

// Fallback: ESRI World Imagery (not NAIP but similar quality, more reliable)
const ESRI_IMAGERY_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

export interface TileCoordinates {
	z: number;
	x: number;
	y: number;
}

export interface FetchedTile {
	tileKey: string;
	bbox: BoundingBox;
	imageData: ArrayBuffer;
	source: 'naip' | 'esri';
	width: number;
	height: number;
}

/**
 * Convert lat/lng bounding box to tile coordinates at a given zoom level
 */
export function bboxToTiles(bbox: BoundingBox, zoom: number): TileCoordinates[] {
	const tiles: TileCoordinates[] = [];

	// Convert lat/lng to tile coordinates
	const minTileX = lngToTileX(bbox.west, zoom);
	const maxTileX = lngToTileX(bbox.east, zoom);
	const minTileY = latToTileY(bbox.north, zoom); // Note: Y is inverted
	const maxTileY = latToTileY(bbox.south, zoom);

	for (let x = minTileX; x <= maxTileX; x++) {
		for (let y = minTileY; y <= maxTileY; y++) {
			tiles.push({ z: zoom, x, y });
		}
	}

	return tiles;
}

/**
 * Convert longitude to tile X coordinate
 */
function lngToTileX(lng: number, zoom: number): number {
	return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
}

/**
 * Convert latitude to tile Y coordinate
 */
function latToTileY(lat: number, zoom: number): number {
	const latRad = lat * Math.PI / 180;
	return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
}

/**
 * Convert tile coordinates back to bounding box
 */
export function tileToBbox(tile: TileCoordinates): BoundingBox {
	const n = Math.pow(2, tile.z);
	const west = tile.x / n * 360 - 180;
	const east = (tile.x + 1) / n * 360 - 180;
	const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * tile.y / n))) * 180 / Math.PI;
	const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tile.y + 1) / n))) * 180 / Math.PI;

	return { north, south, east, west };
}

/**
 * Generate tile key for caching
 */
export function getTileKey(tile: TileCoordinates): string {
	return `${tile.z}/${tile.x}/${tile.y}`;
}

/**
 * Fetch a single tile from NAIP WMS
 */
async function fetchNAIPTile(bbox: BoundingBox, width = 512, height = 512): Promise<ArrayBuffer> {
	const params = new URLSearchParams({
		SERVICE: 'WMS',
		VERSION: '1.1.1',
		REQUEST: 'GetMap',
		LAYERS: '0',
		STYLES: '',
		FORMAT: 'image/jpeg',
		TRANSPARENT: 'false',
		SRS: 'EPSG:4326',
		BBOX: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
		WIDTH: width.toString(),
		HEIGHT: height.toString()
	});

	const url = `${NAIP_WMS_BASE}?${params.toString()}`;

	const response = await fetch(url, {
		headers: {
			'Accept': 'image/jpeg,image/png,image/*'
		}
	});

	if (!response.ok) {
		throw new Error(`NAIP WMS request failed: ${response.status}`);
	}

	const contentType = response.headers.get('content-type');
	if (contentType && contentType.includes('xml')) {
		// WMS returned an error as XML
		const text = await response.text();
		throw new Error(`NAIP WMS error: ${text.substring(0, 200)}`);
	}

	return response.arrayBuffer();
}

/**
 * Fetch a single tile from ESRI World Imagery (fallback)
 */
async function fetchESRITile(tile: TileCoordinates): Promise<ArrayBuffer> {
	const url = `${ESRI_IMAGERY_BASE}/${tile.z}/${tile.y}/${tile.x}`;

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`ESRI tile request failed: ${response.status}`);
	}

	return response.arrayBuffer();
}

/**
 * Fetch imagery for a tile, trying NAIP first then falling back to ESRI
 */
export async function fetchTileImagery(tile: TileCoordinates): Promise<FetchedTile> {
	const bbox = tileToBbox(tile);
	const tileKey = getTileKey(tile);

	// Try NAIP first
	try {
		const imageData = await fetchNAIPTile(bbox, 512, 512);
		return {
			tileKey,
			bbox,
			imageData,
			source: 'naip',
			width: 512,
			height: 512
		};
	} catch (naipError) {
		console.warn(`NAIP fetch failed for ${tileKey}, trying ESRI:`, naipError);
	}

	// Fallback to ESRI
	try {
		const imageData = await fetchESRITile(tile);
		return {
			tileKey,
			bbox,
			imageData,
			source: 'esri',
			width: 256,
			height: 256
		};
	} catch (esriError) {
		throw new Error(`All imagery sources failed for tile ${tileKey}`);
	}
}

/**
 * Fetch imagery for a bounding box, returning multiple tiles if needed
 */
export async function fetchRegionImagery(
	bbox: BoundingBox,
	zoom = 16,
	maxConcurrent = 3
): Promise<FetchedTile[]> {
	const tiles = bboxToTiles(bbox, zoom);
	const results: FetchedTile[] = [];

	// Process tiles in batches to avoid overwhelming servers
	for (let i = 0; i < tiles.length; i += maxConcurrent) {
		const batch = tiles.slice(i, i + maxConcurrent);
		const batchResults = await Promise.all(
			batch.map(tile => fetchTileImagery(tile).catch(err => {
				console.error(`Failed to fetch tile ${getTileKey(tile)}:`, err);
				return null;
			}))
		);

		results.push(...batchResults.filter((r): r is FetchedTile => r !== null));
	}

	return results;
}

/**
 * Fetch a single composite image for a bounding box
 * This is simpler for small regions - just fetches one WMS image
 */
export async function fetchRegionAsImage(
	bbox: BoundingBox,
	width = 1024,
	height = 1024
): Promise<{ imageData: ArrayBuffer; source: 'naip' | 'esri' }> {
	// Try NAIP WMS first (better for custom bbox)
	try {
		const imageData = await fetchNAIPTile(bbox, width, height);
		return { imageData, source: 'naip' };
	} catch (naipError) {
		console.warn('NAIP WMS failed, using ESRI tiles:', naipError);
	}

	// Fallback: fetch ESRI tiles and we'd need to composite them
	// For simplicity, just fetch the center tile at high zoom
	const centerLat = (bbox.north + bbox.south) / 2;
	const centerLng = (bbox.east + bbox.west) / 2;
	const zoom = 17;

	const tile: TileCoordinates = {
		z: zoom,
		x: lngToTileX(centerLng, zoom),
		y: latToTileY(centerLat, zoom)
	};

	const imageData = await fetchESRITile(tile);
	return { imageData, source: 'esri' };
}

/**
 * Convert ArrayBuffer to base64 data URL for use with vision APIs
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Calculate optimal zoom level for analysis based on region size
 */
export function getOptimalZoom(bbox: BoundingBox): number {
	const latDiff = Math.abs(bbox.north - bbox.south);
	const lngDiff = Math.abs(bbox.east - bbox.west);
	const maxDiff = Math.max(latDiff, lngDiff);

	// Rough heuristic: smaller regions get higher zoom
	if (maxDiff < 0.01) return 18;  // < 1km
	if (maxDiff < 0.05) return 17;  // < 5km
	if (maxDiff < 0.1) return 16;   // < 10km
	if (maxDiff < 0.5) return 15;   // < 50km
	return 14;
}

/**
 * Split a large region into analysis cells
 */
export function splitRegionIntoCells(
	bbox: BoundingBox,
	cellSizeKm = 0.5
): BoundingBox[] {
	const cells: BoundingBox[] = [];

	// Approximate degrees per km at this latitude
	const avgLat = (bbox.north + bbox.south) / 2;
	const latDegreesPerKm = 1 / 111;
	const lngDegreesPerKm = 1 / (111 * Math.cos(avgLat * Math.PI / 180));

	const cellLatSize = cellSizeKm * latDegreesPerKm;
	const cellLngSize = cellSizeKm * lngDegreesPerKm;

	for (let lat = bbox.south; lat < bbox.north; lat += cellLatSize) {
		for (let lng = bbox.west; lng < bbox.east; lng += cellLngSize) {
			cells.push({
				south: lat,
				north: Math.min(lat + cellLatSize, bbox.north),
				west: lng,
				east: Math.min(lng + cellLngSize, bbox.east)
			});
		}
	}

	return cells;
}
