import type { BoundingBox } from '$lib/types';

/** Earth's radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Maximum allowed region size in square kilometers */
export const MAX_REGION_SIZE_KM2 = 100;

/** Tile size at zoom level 18 (approximately) */
const TILE_SIZE_METERS = 152.87; // at equator, zoom 18

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
	return degrees * (Math.PI / 180);
}

/**
 * Calculate the area of a bounding box in square kilometers
 * Uses the Haversine formula approximation for small areas
 */
export function calculateArea(bbox: BoundingBox): number {
	const { north, south, east, west } = bbox;

	// Calculate latitude difference in km
	const latDiffRad = toRadians(north - south);
	const avgLatRad = toRadians((north + south) / 2);

	// Height in km (latitude distance)
	const heightKm = latDiffRad * EARTH_RADIUS_KM;

	// Width in km (longitude distance, adjusted for latitude)
	const lngDiffRad = toRadians(east - west);
	const widthKm = lngDiffRad * EARTH_RADIUS_KM * Math.cos(avgLatRad);

	return Math.abs(heightKm * widthKm);
}

/**
 * Estimate the number of satellite image tiles needed to cover the region
 * Based on typical satellite imagery tile sizes
 */
export function estimateTileCount(bbox: BoundingBox, zoom: number = 18): number {
	const { north, south, east, west } = bbox;

	// Calculate dimensions in degrees
	const latDiff = Math.abs(north - south);
	const lngDiff = Math.abs(east - west);

	// Approximate tile coverage at given zoom level
	// At zoom 18, each tile is roughly 0.0014 degrees
	const tileDegreesAtZoom18 = 0.0014;
	const zoomFactor = Math.pow(2, 18 - zoom);
	const tileDegrees = tileDegreesAtZoom18 * zoomFactor;

	const tilesX = Math.ceil(lngDiff / tileDegrees);
	const tilesY = Math.ceil(latDiff / tileDegrees);

	return Math.max(1, tilesX * tilesY);
}

/**
 * Validate that a region is within acceptable size limits
 */
export function validateRegionSize(bbox: BoundingBox): {
	valid: boolean;
	area: number;
	tileCount: number;
	message?: string;
} {
	const area = calculateArea(bbox);
	const tileCount = estimateTileCount(bbox);

	if (area > MAX_REGION_SIZE_KM2) {
		return {
			valid: false,
			area,
			tileCount,
			message: `Region too large (${area.toFixed(1)} sq km). This would require ~${tileCount} API calls. Please select a smaller area (max ${MAX_REGION_SIZE_KM2} sq km) or upgrade your plan.`
		};
	}

	if (area < 0.01) {
		return {
			valid: false,
			area,
			tileCount,
			message: 'Region too small. Please select a larger area for meaningful analysis.'
		};
	}

	return {
		valid: true,
		area,
		tileCount
	};
}

/**
 * Format area for display
 */
export function formatArea(areaKm2: number): string {
	if (areaKm2 < 1) {
		return `${(areaKm2 * 1000000).toFixed(0)} sq m`;
	}
	return `${areaKm2.toFixed(1)} sq km`;
}

/**
 * Preset regions for quick selection - archaeological hot zones
 */
export const PRESET_REGIONS: {
	name: string;
	description: string;
	bbox: BoundingBox;
	center: { lat: number; lng: number };
	zoom: number;
}[] = [
	{
		name: 'Cahokia Area',
		description: 'Ancient city near modern St. Louis, IL',
		bbox: { north: 38.68, south: 38.64, east: -90.04, west: -90.08 },
		center: { lat: 38.66, lng: -90.06 },
		zoom: 14
	},
	{
		name: 'Poverty Point',
		description: 'UNESCO World Heritage Site, Louisiana',
		bbox: { north: 32.64, south: 32.62, east: -91.39, west: -91.42 },
		center: { lat: 32.63, lng: -91.405 },
		zoom: 15
	},
	{
		name: 'Serpent Mound',
		description: 'Effigy mound in Ohio',
		bbox: { north: 39.03, south: 39.02, east: -83.42, west: -83.44 },
		center: { lat: 39.025, lng: -83.43 },
		zoom: 16
	},
	{
		name: 'Moundville',
		description: 'Mississippian culture site, Alabama',
		bbox: { north: 33.01, south: 32.99, east: -87.62, west: -87.64 },
		center: { lat: 33.0, lng: -87.63 },
		zoom: 15
	},
	{
		name: 'Hopewell Culture NHP',
		description: 'Hopewell earthworks in Ohio',
		bbox: { north: 39.38, south: 39.36, east: -83.06, west: -83.09 },
		center: { lat: 39.37, lng: -83.075 },
		zoom: 15
	}
];

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const dLat = toRadians(lat2 - lat1);
	const dLng = toRadians(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_KM * c;
}

/**
 * Format coordinates for display (e.g., "38.6600° N, 90.0600° W")
 */
export function formatCoords(lat: number, lng: number): string {
	const latDir = lat >= 0 ? 'N' : 'S';
	const lngDir = lng >= 0 ? 'E' : 'W';
	return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

/**
 * Format coordinates in DMS format (degrees, minutes, seconds)
 */
export function formatCoordsDMS(lat: number, lng: number): string {
	const formatDMS = (decimal: number, isLat: boolean): string => {
		const absolute = Math.abs(decimal);
		const degrees = Math.floor(absolute);
		const minutesNotTruncated = (absolute - degrees) * 60;
		const minutes = Math.floor(minutesNotTruncated);
		const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
		const direction = isLat ? (decimal >= 0 ? 'N' : 'S') : decimal >= 0 ? 'E' : 'W';
		return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
	};
	return `${formatDMS(lat, true)}, ${formatDMS(lng, false)}`;
}

/**
 * Generate Google Maps URL for a location
 */
export function googleMapsUrl(lat: number, lng: number, zoom: number = 18): string {
	return `https://www.google.com/maps/@${lat},${lng},${zoom}z`;
}

/**
 * Generate Google Maps directions URL
 */
export function googleMapsDirectionsUrl(lat: number, lng: number): string {
	return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Generate NRHP official page URL from reference number
 */
export function nrhpUrl(nrhpId: string): string {
	return `https://npgallery.nps.gov/NRHP/GetAsset/${nrhpId}`;
}

/**
 * Generate NRHP search URL
 */
export function nrhpSearchUrl(query: string): string {
	return `https://npgallery.nps.gov/NRHP/BasicSearch/?q=${encodeURIComponent(query)}`;
}

/**
 * Generate static map image URL using ESRI World Imagery
 * @param lat - Latitude
 * @param lng - Longitude
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param zoom - Zoom level (higher = more zoomed in)
 */
export function staticMapUrl(
	lat: number,
	lng: number,
	width: number = 600,
	height: number = 400,
	zoom: number = 17
): string {
	// Calculate bbox based on zoom level
	// At zoom 17, show approximately 500m x 500m area
	const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
	const latOffset = ((metersPerPixel * height) / 2 / 111320) * 0.9;
	const lngOffset = ((metersPerPixel * width) / 2 / (111320 * Math.cos((lat * Math.PI) / 180))) * 0.9;

	const bbox = `${lng - lngOffset},${lat - latOffset},${lng + lngOffset},${lat + latOffset}`;
	return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&size=${width},${height}&format=png&f=image`;
}

/**
 * Generate OpenStreetMap URL
 */
export function osmUrl(lat: number, lng: number, zoom: number = 17): string {
	return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

/**
 * Generate Wikipedia search URL
 */
export function wikipediaSearchUrl(query: string): string {
	return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`;
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
	if (km < 1) {
		return `${Math.round(km * 1000)} m`;
	}
	if (km < 10) {
		return `${km.toFixed(1)} km`;
	}
	return `${Math.round(km)} km`;
}

/**
 * Format distance in miles
 */
export function formatDistanceMiles(km: number): string {
	const miles = km * 0.621371;
	if (miles < 1) {
		return `${(miles * 5280).toFixed(0)} ft`;
	}
	if (miles < 10) {
		return `${miles.toFixed(1)} mi`;
	}
	return `${Math.round(miles)} mi`;
}
