<script lang="ts">
	import { browser } from '$app/environment';
	import type { Map as LeafletMap } from 'leaflet';
	import type { BoundingBox } from '$lib/types';
	import { type KnownSiteSummary, getCategoryColor } from '$lib/types/known-sites';

	interface Props {
		onBoundsChange?: (bbox: BoundingBox) => void;
		onSiteClick?: (site: KnownSiteSummary) => void;
		selectedSiteId?: string | null;
	}

	let {
		onBoundsChange = () => {},
		onSiteClick = () => {},
		selectedSiteId = null
	}: Props = $props();

	let mapContainer: HTMLDivElement | undefined = $state();
	let map: LeafletMap | null = $state(null);
	let L: typeof import('leaflet') | null = $state(null);
	let markerCluster: any = $state(null);
	let initialized = $state(false);
	let satelliteView = $state(false);
	let streetLayer: any = null;
	let satelliteLayer: any = null;
	let sitesMap: Map<string, any> = new Map();

	/**
	 * Create cluster icon based on count
	 */
	function createClusterIcon(cluster: any) {
		const count = cluster.getChildCount();
		let size = 'small';
		let pixels = 36;

		if (count > 500) {
			size = 'large';
			pixels = 50;
		} else if (count > 50) {
			size = 'medium';
			pixels = 44;
		}

		return L!.divIcon({
			html: `<div class="cluster-marker cluster-${size}"><span>${count >= 1000 ? Math.floor(count / 1000) + 'k' : count}</span></div>`,
			className: 'custom-cluster-icon',
			iconSize: L!.point(pixels, pixels)
		});
	}

	/**
	 * Create site marker icon
	 */
	function createSiteIcon(category: string | null, isSelected: boolean = false) {
		const color = getCategoryColor(category);
		const size = isSelected ? 18 : 12;
		const borderWidth = isSelected ? 3 : 2;

		return L!.divIcon({
			className: 'site-marker',
			html: `
				<div style="
					background-color: ${color};
					width: ${size}px;
					height: ${size}px;
					border-radius: 50%;
					border: ${borderWidth}px solid white;
					box-shadow: 0 2px 4px rgba(0,0,0,0.3);
					${isSelected ? 'box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 2px 4px rgba(0,0,0,0.3);' : ''}
				"></div>
			`,
			iconSize: [size, size],
			iconAnchor: [size / 2, size / 2]
		});
	}

	/**
	 * Update markers on the map
	 */
	export function updateSites(sites: KnownSiteSummary[]) {
		if (!map || !L || !markerCluster) return;

		// Clear existing markers
		markerCluster.clearLayers();
		sitesMap.clear();

		// Add new markers
		const markers = sites.map((site) => {
			const marker = L!.marker([site.lat, site.lng], {
				icon: createSiteIcon(site.category, site.id === selectedSiteId)
			});

			marker.on('click', () => onSiteClick(site));

			// Simple popup with name
			marker.bindPopup(
				`
				<div class="site-popup">
					<strong>${site.name}</strong>
					<div class="site-popup-meta">${site.city ? site.city + ', ' : ''}${site.state}</div>
					<div class="site-popup-type">${site.siteType || 'Historic Site'}</div>
				</div>
			`,
				{ closeButton: false, offset: L!.point(0, -5) }
			);

			sitesMap.set(site.id, marker);
			return marker;
		});

		markerCluster.addLayers(markers);
	}

	/**
	 * Fly to a specific location
	 */
	export function flyTo(lat: number, lng: number, zoom: number = 15) {
		if (!map) return;
		map.flyTo([lat, lng], zoom, { duration: 1 });
	}

	/**
	 * Get current map bounds
	 */
	export function getBounds(): BoundingBox | null {
		if (!map) return null;
		const bounds = map.getBounds();
		return {
			north: bounds.getNorth(),
			south: bounds.getSouth(),
			east: bounds.getEast(),
			west: bounds.getWest()
		};
	}

	/**
	 * Toggle satellite view
	 */
	export function toggleSatellite() {
		if (!map || !streetLayer || !satelliteLayer) return;
		satelliteView = !satelliteView;
		if (satelliteView) {
			map.removeLayer(streetLayer);
			satelliteLayer.addTo(map);
		} else {
			map.removeLayer(satelliteLayer);
			streetLayer.addTo(map);
		}
	}

	/**
	 * Check if satellite view is active
	 */
	export function isSatelliteView(): boolean {
		return satelliteView;
	}

	/**
	 * Initialize the map
	 */
	async function initMap() {
		if (!mapContainer || initialized) return;
		initialized = true;

		// Dynamic imports for SSR safety
		const leafletModule = await import('leaflet');
		L = leafletModule.default ?? leafletModule;

		// Import marker cluster plugin
		await import('leaflet.markercluster');

		// Initialize map centered on contiguous US
		map = L.map(mapContainer, {
			zoomControl: false,
			preferCanvas: true,
			maxBounds: [
				[-85, -180],
				[85, 180]
			],
			maxBoundsViscosity: 1.0
		}).setView([39.8, -98.5], 4);

		// Add zoom control at bottom right
		L.control.zoom({ position: 'bottomright' }).addTo(map);

		// Street layer (default)
		streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 19
		});

		// Satellite layer
		satelliteLayer = L.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			{
				attribution: 'Tiles &copy; Esri',
				maxZoom: 19
			}
		);

		streetLayer.addTo(map);

		// Initialize marker cluster group
		markerCluster = (L as any).markerClusterGroup({
			chunkedLoading: true,
			maxClusterRadius: 80,
			spiderfyOnMaxZoom: true,
			showCoverageOnHover: false,
			zoomToBoundsOnClick: true,
			iconCreateFunction: createClusterIcon,
			disableClusteringAtZoom: 16,
			animate: true,
			animateAddingMarkers: false
		});

		map.addLayer(markerCluster);

		// Emit bounds on map move
		map.on('moveend', () => {
			const bounds = getBounds();
			if (bounds) {
				onBoundsChange(bounds);
			}
		});

		// Initial bounds emit after a brief delay
		setTimeout(() => {
			const bounds = getBounds();
			if (bounds) {
				onBoundsChange(bounds);
			}
		}, 100);
	}

	// Initialize on mount
	$effect(() => {
		if (browser && mapContainer) {
			initMap();
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (map) {
				map.remove();
				map = null;
			}
		};
	});
</script>

<div bind:this={mapContainer} class="site-map-container"></div>

<style>
	.site-map-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	:global(.site-marker) {
		background: transparent;
		border: none;
	}

	:global(.custom-cluster-icon) {
		background: transparent;
		border: none;
	}

	:global(.cluster-marker) {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-weight: 600;
		color: white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	:global(.cluster-small) {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		font-size: 12px;
	}

	:global(.cluster-medium) {
		background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
		font-size: 13px;
	}

	:global(.cluster-large) {
		background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
		font-size: 14px;
	}

	:global(.site-popup) {
		min-width: 150px;
		padding: 4px 0;
	}

	:global(.site-popup strong) {
		font-size: 14px;
		color: #1f2937;
		display: block;
		margin-bottom: 4px;
	}

	:global(.site-popup-meta) {
		font-size: 12px;
		color: #6b7280;
	}

	:global(.site-popup-type) {
		font-size: 11px;
		color: #9ca3af;
		margin-top: 4px;
	}

	:global(.leaflet-popup-content-wrapper) {
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	:global(.leaflet-popup-tip) {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}
</style>
