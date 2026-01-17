/**
 * Svelte 5 runes-based state for managing archaeological site data
 */

import type {
	Site,
	LayerVisibility,
	ScanRegion,
	BoundingBox
} from '$lib/types';
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

/** Create the sites store using Svelte 5 runes */
function createSitesStore() {
	let sites = $state<Site[]>(sampleSites);
	let selectedSiteId = $state<string | null>(null);
	let layerVisibility = $state<LayerVisibility>({ ...DEFAULT_LAYER_VISIBILITY });
	let scanRegions = $state<ScanRegion[]>([]);

	const selectedSite = $derived(
		selectedSiteId ? sites.find(s => s.id === selectedSiteId) ?? null : null
	);

	const visibleSites = $derived(
		sites.filter((site) => {
			switch (site.status) {
				case 'known':
					return layerVisibility.knownSites;
				case 'potential':
					return layerVisibility.potentialSites;
				case 'unverified':
					return layerVisibility.unverifiedSites;
				default:
					return false;
			}
		})
	);

	const siteCounts = $derived({
		known: sites.filter((s) => s.status === 'known').length,
		potential: sites.filter((s) => s.status === 'potential').length,
		unverified: sites.filter((s) => s.status === 'unverified').length,
		total: sites.length
	});

	return {
		get sites() { return sites; },
		get selectedSite() { return selectedSite; },
		get layerVisibility() { return layerVisibility; },
		get scanRegions() { return scanRegions; },
		get visibleSites() { return visibleSites; },
		get siteCounts() { return siteCounts; },

		selectSite(siteId: string | null) {
			selectedSiteId = siteId;
		},

		toggleLayer(layer: keyof LayerVisibility) {
			layerVisibility = {
				...layerVisibility,
				[layer]: !layerVisibility[layer]
			};
		},

		addScanRegion(bounds: BoundingBox): ScanRegion {
			const region: ScanRegion = {
				id: crypto.randomUUID(),
				bounds,
				createdAt: new Date(),
				status: 'pending'
			};
			scanRegions = [...scanRegions, region];
			return region;
		},

		removeScanRegion(regionId: string) {
			scanRegions = scanRegions.filter((r) => r.id !== regionId);
		},

		addSite(site: Omit<Site, 'id'>): Site {
			const newSite: Site = {
				...site,
				id: crypto.randomUUID()
			};
			sites = [...sites, newSite];
			return newSite;
		}
	};
}

export const sitesStore = createSitesStore();