/**
 * Lost & Found - Archaeological Site Detection Tool
 *
 * Library barrel export file
 */

// Re-export types
export * from './types';

// Re-export stores
export {
	sites,
	selectedSite,
	layerVisibility,
	scanRegions,
	visibleSites,
	siteCounts,
	selectSite,
	toggleLayer,
	addScanRegion,
	removeScanRegion,
	addSite
} from './stores/sites';

// Re-export components (for potential external use)
export { default as Map } from './components/Map.svelte';
export { default as SiteMarker } from './components/SiteMarker.svelte';
export { default as SitePanel } from './components/SitePanel.svelte';
export { default as RegionSelector } from './components/RegionSelector.svelte';
