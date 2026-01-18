/**
 * Pre-defined hot zones with high archaeological potential
 * Based on documented concentrations of mound sites and earthworks
 */

import type { BoundingBox } from '$lib/types';

export interface HotZone {
	id: string;
	name: string;
	description: string;
	bbox: BoundingBox;
	center: { lat: number; lng: number };
	zoom: number;
	priority: 1 | 2 | 3;  // 1 = highest priority
	estimatedTiles: number;
	estimatedHours: number;
	knownSiteCount: string;  // Approximate known sites in region
	cultures: string[];
}

/**
 * Calculate approximate tile count for a bounding box at zoom 17
 */
function estimateTiles(bbox: BoundingBox, zoom = 17): number {
	const n = Math.pow(2, zoom);
	const minX = Math.floor((bbox.west + 180) / 360 * n);
	const maxX = Math.floor((bbox.east + 180) / 360 * n);
	const minY = Math.floor((1 - Math.log(Math.tan(bbox.north * Math.PI / 180) + 1 / Math.cos(bbox.north * Math.PI / 180)) / Math.PI) / 2 * n);
	const maxY = Math.floor((1 - Math.log(Math.tan(bbox.south * Math.PI / 180) + 1 / Math.cos(bbox.south * Math.PI / 180)) / Math.PI) / 2 * n);
	return (maxX - minX + 1) * (maxY - minY + 1);
}

export const HOT_ZONES: HotZone[] = [
	// ============================================
	// PRIORITY 1 - Highest concentration of sites
	// ============================================
	{
		id: 'cahokia-region',
		name: 'Cahokia Region',
		description: 'American Bottom floodplain - densest concentration of Mississippian sites',
		bbox: { north: 38.8, south: 38.5, east: -89.9, west: -90.3 },
		center: { lat: 38.65, lng: -90.1 },
		zoom: 13,
		priority: 1,
		estimatedTiles: estimateTiles({ north: 38.8, south: 38.5, east: -89.9, west: -90.3 }),
		estimatedHours: 2,
		knownSiteCount: '100+',
		cultures: ['Mississippian']
	},
	{
		id: 'poverty-point-region',
		name: 'Poverty Point Region',
		description: 'Late Archaic monumental architecture complex in Louisiana',
		bbox: { north: 32.75, south: 32.5, east: -91.3, west: -91.55 },
		center: { lat: 32.63, lng: -91.41 },
		zoom: 13,
		priority: 1,
		estimatedTiles: estimateTiles({ north: 32.75, south: 32.5, east: -91.3, west: -91.55 }),
		estimatedHours: 1,
		knownSiteCount: '20+',
		cultures: ['Poverty Point culture']
	},
	{
		id: 'newark-earthworks',
		name: 'Newark Earthworks Area',
		description: 'Largest geometric earthen enclosures in the world',
		bbox: { north: 40.1, south: 40.0, east: -82.35, west: -82.5 },
		center: { lat: 40.05, lng: -82.43 },
		zoom: 14,
		priority: 1,
		estimatedTiles: estimateTiles({ north: 40.1, south: 40.0, east: -82.35, west: -82.5 }),
		estimatedHours: 0.5,
		knownSiteCount: '10+',
		cultures: ['Hopewell']
	},

	// ============================================
	// PRIORITY 2 - Major archaeological regions
	// ============================================
	{
		id: 'lower-mississippi-valley',
		name: 'Lower Mississippi Valley',
		description: 'Louisiana-Mississippi border region with numerous mound sites',
		bbox: { north: 33.5, south: 31.0, east: -90.5, west: -92.0 },
		center: { lat: 32.25, lng: -91.25 },
		zoom: 10,
		priority: 2,
		estimatedTiles: estimateTiles({ north: 33.5, south: 31.0, east: -90.5, west: -92.0 }),
		estimatedHours: 15,
		knownSiteCount: '200+',
		cultures: ['Mississippian', 'Plaquemine', 'Poverty Point']
	},
	{
		id: 'ohio-valley-hopewell',
		name: 'Ohio Valley Hopewell Heartland',
		description: 'Core Hopewell region along Scioto and Ohio rivers',
		bbox: { north: 40.0, south: 39.0, east: -82.5, west: -83.5 },
		center: { lat: 39.5, lng: -83.0 },
		zoom: 11,
		priority: 2,
		estimatedTiles: estimateTiles({ north: 40.0, south: 39.0, east: -82.5, west: -83.5 }),
		estimatedHours: 8,
		knownSiteCount: '100+',
		cultures: ['Hopewell', 'Adena']
	},
	{
		id: 'moundville-region',
		name: 'Moundville Region',
		description: 'Black Warrior River Valley - major Mississippian center',
		bbox: { north: 33.15, south: 32.85, east: -87.5, west: -87.75 },
		center: { lat: 33.0, lng: -87.63 },
		zoom: 13,
		priority: 2,
		estimatedTiles: estimateTiles({ north: 33.15, south: 32.85, east: -87.5, west: -87.75 }),
		estimatedHours: 1,
		knownSiteCount: '30+',
		cultures: ['Mississippian']
	},
	{
		id: 'etowah-region',
		name: 'Etowah River Valley',
		description: 'Georgia Mississippian complex around Etowah Mounds',
		bbox: { north: 34.25, south: 34.0, east: -84.7, west: -84.95 },
		center: { lat: 34.125, lng: -84.83 },
		zoom: 13,
		priority: 2,
		estimatedTiles: estimateTiles({ north: 34.25, south: 34.0, east: -84.7, west: -84.95 }),
		estimatedHours: 1,
		knownSiteCount: '15+',
		cultures: ['Mississippian']
	},
	{
		id: 'kincaid-region',
		name: 'Kincaid-Angel Mounds Corridor',
		description: 'Ohio-Wabash confluence area with major Mississippian sites',
		bbox: { north: 38.1, south: 37.0, east: -87.2, west: -88.7 },
		center: { lat: 37.55, lng: -87.95 },
		zoom: 11,
		priority: 2,
		estimatedTiles: estimateTiles({ north: 38.1, south: 37.0, east: -87.2, west: -88.7 }),
		estimatedHours: 10,
		knownSiteCount: '50+',
		cultures: ['Mississippian']
	},

	// ============================================
	// PRIORITY 3 - Extended survey areas
	// ============================================
	{
		id: 'upper-mississippi',
		name: 'Upper Mississippi Valley',
		description: 'Wisconsin-Illinois-Iowa border effigy mound region',
		bbox: { north: 43.5, south: 42.0, east: -89.5, west: -91.5 },
		center: { lat: 42.75, lng: -90.5 },
		zoom: 10,
		priority: 3,
		estimatedTiles: estimateTiles({ north: 43.5, south: 42.0, east: -89.5, west: -91.5 }),
		estimatedHours: 20,
		knownSiteCount: '500+ effigy mounds',
		cultures: ['Effigy Mound', 'Middle Woodland']
	},
	{
		id: 'tennessee-cumberland',
		name: 'Tennessee-Cumberland Region',
		description: 'Middle Tennessee mound complexes',
		bbox: { north: 36.5, south: 35.5, east: -86.0, west: -87.5 },
		center: { lat: 36.0, lng: -86.75 },
		zoom: 10,
		priority: 3,
		estimatedTiles: estimateTiles({ north: 36.5, south: 35.5, east: -86.0, west: -87.5 }),
		estimatedHours: 12,
		knownSiteCount: '50+',
		cultures: ['Mississippian', 'Middle Woodland']
	},
	{
		id: 'spiro-region',
		name: 'Spiro Mounds Region',
		description: 'Arkansas River Valley Caddoan ceremonial center',
		bbox: { north: 35.4, south: 35.1, east: -94.4, west: -94.8 },
		center: { lat: 35.25, lng: -94.6 },
		zoom: 13,
		priority: 3,
		estimatedTiles: estimateTiles({ north: 35.4, south: 35.1, east: -94.4, west: -94.8 }),
		estimatedHours: 1,
		knownSiteCount: '15+',
		cultures: ['Caddoan Mississippian']
	},
	{
		id: 'ocmulgee-region',
		name: 'Ocmulgee-Oconee Corridor',
		description: 'Central Georgia Mississippian sites',
		bbox: { north: 33.0, south: 32.6, east: -83.4, west: -83.8 },
		center: { lat: 32.8, lng: -83.6 },
		zoom: 12,
		priority: 3,
		estimatedTiles: estimateTiles({ north: 33.0, south: 32.6, east: -83.4, west: -83.8 }),
		estimatedHours: 2,
		knownSiteCount: '20+',
		cultures: ['Mississippian']
	},
	{
		id: 'great-serpent-region',
		name: 'Great Serpent Mound Region',
		description: 'Adams County Ohio effigy and burial mound concentration',
		bbox: { north: 39.1, south: 38.9, east: -83.3, west: -83.55 },
		center: { lat: 39.0, lng: -83.43 },
		zoom: 13,
		priority: 2,
		estimatedTiles: estimateTiles({ north: 39.1, south: 38.9, east: -83.3, west: -83.55 }),
		estimatedHours: 0.5,
		knownSiteCount: '10+',
		cultures: ['Fort Ancient', 'Adena']
	}
];

/**
 * Get hot zone by ID
 */
export function getHotZone(id: string): HotZone | undefined {
	return HOT_ZONES.find(zone => zone.id === id);
}

/**
 * Get hot zones sorted by priority
 */
export function getHotZonesByPriority(): HotZone[] {
	return [...HOT_ZONES].sort((a, b) => a.priority - b.priority);
}

/**
 * Get total estimated scan time for all zones
 */
export function getTotalEstimatedHours(): number {
	return HOT_ZONES.reduce((sum, zone) => sum + zone.estimatedHours, 0);
}

/**
 * Format estimated time for display
 */
export function formatEstimatedTime(hours: number): string {
	if (hours < 1) {
		return `~${Math.round(hours * 60)} min`;
	}
	if (hours < 24) {
		return `~${hours.toFixed(1)} hrs`;
	}
	return `~${(hours / 24).toFixed(1)} days`;
}
