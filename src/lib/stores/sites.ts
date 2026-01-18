/**
 * Svelte 5 stores for managing archaeological site data
 */

import { writable, derived } from 'svelte/store';
import type { Site, LayerVisibility, ScanRegion, BoundingBox } from '$lib/types';
import { DEFAULT_LAYER_VISIBILITY } from '$lib/types';

/** Sample data for development */
const sampleSites: Site[] = [
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
];

/** Core writable stores */
export const sites = writable<Site[]>(sampleSites);
export const selectedSiteId = writable<string | null>(null);
export const layerVisibility = writable<LayerVisibility>({ ...DEFAULT_LAYER_VISIBILITY });
export const scanRegions = writable<ScanRegion[]>([]);

/** Derived stores */
export const selectedSite = derived(
	[sites, selectedSiteId],
	([$sites, $selectedSiteId]) =>
		$selectedSiteId ? $sites.find((s) => s.id === $selectedSiteId) ?? null : null
);

export const visibleSites = derived(
	[sites, layerVisibility],
	([$sites, $layerVisibility]) =>
		$sites.filter((site) => {
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
		})
);

export const siteCounts = derived(sites, ($sites) => ({
	known: $sites.filter((s) => s.status === 'known').length,
	potential: $sites.filter((s) => s.status === 'potential').length,
	unverified: $sites.filter((s) => s.status === 'unverified').length,
	total: $sites.length
}));

/** Store actions */
export function selectSite(siteId: string | null): void {
	selectedSiteId.set(siteId);
}

export function toggleLayer(layer: keyof LayerVisibility): void {
	layerVisibility.update((current) => ({
		...current,
		[layer]: !current[layer]
	}));
}

export function addScanRegion(bounds: BoundingBox): ScanRegion {
	const region: ScanRegion = {
		id: crypto.randomUUID(),
		bounds,
		createdAt: new Date(),
		status: 'pending'
	};
	scanRegions.update((current) => [...current, region]);
	return region;
}

export function removeScanRegion(regionId: string): void {
	scanRegions.update((current) => current.filter((r) => r.id !== regionId));
}

export function addSite(site: Omit<Site, 'id'>): Site {
	const newSite: Site = {
		...site,
		id: crypto.randomUUID()
	};
	sites.update((current) => [...current, newSite]);
	return newSite;
}
