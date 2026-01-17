/**
 * Type definitions for Lost & Found archaeological site detection tool
 */

/** Site classification status */
export type SiteStatus = 'known' | 'potential' | 'unverified';

/** Geographic coordinates */
export interface Coordinates {
	lat: number;
	lng: number;
}

/** Bounding box for region selection */
export interface BoundingBox {
	north: number;
	south: number;
	east: number;
	west: number;
}

/** Archaeological site data */
export interface Site {
	id: string;
	name: string;
	coordinates: Coordinates;
	status: SiteStatus;
	description?: string;
	dateDiscovered?: string;
	culture?: string;
	timePeriod?: string;
	features?: string[];
	imageUrl?: string;
	sourceUrl?: string;
}

/** Layer visibility settings */
export interface LayerVisibility {
	knownSites: boolean;
	potentialSites: boolean;
	unverifiedSites: boolean;
}

/** Map configuration */
export interface MapConfig {
	center: Coordinates;
	zoom: number;
	minZoom: number;
	maxZoom: number;
}

/** Scan region for analysis */
export interface ScanRegion {
	id: string;
	bounds: BoundingBox;
	createdAt: Date;
	status: 'pending' | 'scanning' | 'complete' | 'error';
	resultsCount?: number;
}

/** Default map configuration - centered on Great Lakes region */
export const DEFAULT_MAP_CONFIG: MapConfig = {
	center: { lat: 44, lng: -85 },
	zoom: 7,
	minZoom: 3,
	maxZoom: 18
};

/** Default layer visibility */
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
	knownSites: true,
	potentialSites: true,
	unverifiedSites: false
};
