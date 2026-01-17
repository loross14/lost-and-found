/**
 * Svelte stores for managing archaeological site data
 */

import { writable, derived } from 'svelte/store';
import type {
	Site,
	LayerVisibility,
	ScanRegion,
	BoundingBox
} from '$lib/types';
import { DEFAULT_LAYER_VISIBILITY } from '$lib/types';

/** Store for all archaeological sites */
export const sites = writable<Site[]>([
	// Sample data for development
	{
		id: '1',
		name: 'Norton Mounds',
		coordinates: { lat: 42.9634, lng: -85.6681 },
		status: 'known',
		description: 'Hopewell burial mounds complex dating to 100 BCE - 400 CE',
		culture: 'Hopewell',
		timePeriod: '100 BCE - 400 CE',
		features: ['Burial mounds', 'Ceremonial artifacts']
	},
	{
		id: '2',
		name: 'Sanilac Petroglyphs',
		coordinates: { lat: 43.5317, lng: -82.9253 },
		status: 'known',
		description: 'Ancient rock carvings created by Indigenous peoples',
		culture: 'Algonquian',
		timePeriod: '300-1000 CE',
		features: ['Petroglyphs', 'Rock art']
	},
	{
		id: '3',
		name: 'Potential Site Alpha',
		coordinates: { lat: 44.2, lng: -84.5 },
		status: 'potential',
		description: 'Anomaly detected via satellite imagery analysis',
		features: ['Geometric patterns', 'Soil discoloration']
	},
	{
		id: '4',
		name: 'Potential Site Beta',
		coordinates: { lat: 43.8, lng: -86.1 },
		status: 'potential',
		description: 'Possible earthwork formation near river confluence',
		features: ['Linear features', 'Elevated terrain']
	},
	{
		id: '5',
		name: 'Unverified Location C',
		coordinates: { lat: 45.1, lng: -84.8 },
		status: 'unverified',
		description: 'Reported anomaly requiring field verification'
	}
]);

/** Currently selected site */
export const selectedSite = writable<Site | null>(null);

/** Layer visibility settings */
export const layerVisibility = writable<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);

/** Active scan regions */
export const scanRegions = writable<ScanRegion[]>([]);

/** Derived store: filtered sites based on layer visibility */
export const visibleSites = derived(
	[sites, layerVisibility],
	([$sites, $layerVisibility]) => {
		return $sites.filter((site) => {
			switch (site.status) {
				case 'known':
					return $layerVisibility.knownSites;
				case 'potential':
					return $layerVisibility.potentialSites;
				case 'unverified':
					return $layerVisibility.unverifiedSites;
				default:
					return false;
			}
		});
	}
);

/** Derived store: count sites by status */
export const siteCounts = derived(sites, ($sites) => {
	return {
		known: $sites.filter((s) => s.status === 'known').length,
		potential: $sites.filter((s) => s.status === 'potential').length,
		unverified: $sites.filter((s) => s.status === 'unverified').length,
		total: $sites.length
	};
});

/** Actions */

/** Select a site by ID */
export function selectSite(siteId: string | null): void {
	if (siteId === null) {
		selectedSite.set(null);
		return;
	}

	sites.subscribe(($sites) => {
		const site = $sites.find((s) => s.id === siteId);
		selectedSite.set(site || null);
	})();
}

/** Toggle layer visibility */
export function toggleLayer(layer: keyof LayerVisibility): void {
	layerVisibility.update((current) => ({
		...current,
		[layer]: !current[layer]
	}));
}

/** Add a new scan region */
export function addScanRegion(bounds: BoundingBox): ScanRegion {
	const region: ScanRegion = {
		id: crypto.randomUUID(),
		bounds,
		createdAt: new Date(),
		status: 'pending'
	};

	scanRegions.update((regions) => [...regions, region]);
	return region;
}

/** Remove a scan region */
export function removeScanRegion(regionId: string): void {
	scanRegions.update((regions) => regions.filter((r) => r.id !== regionId));
}

/** Add a new site (for future use when scanning produces results) */
export function addSite(site: Omit<Site, 'id'>): Site {
	const newSite: Site = {
		...site,
		id: crypto.randomUUID()
	};

	sites.update((current) => [...current, newSite]);
	return newSite;
}
