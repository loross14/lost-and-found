<script lang="ts">
	import { browser } from '$app/environment';
	import type { Map as LeafletMap } from 'leaflet';
	import { DEFAULT_MAP_CONFIG } from '$lib/types';
	import type { Site, BoundingBox } from '$lib/types';
	import { visibleSites, selectedSite, selectSite, addScanRegion } from '$lib/stores/sites';

	interface Props {
		onRegionSelect?: (bounds: BoundingBox) => void;
	}

	let { onRegionSelect = () => {} }: Props = $props();

	let mapContainer: HTMLDivElement | undefined = $state();
	let map: LeafletMap | null = $state(null);
	let L: typeof import('leaflet') | null = $state(null);
	let markers: Map<string, any> = new Map();
	let drawingRectangle = $state(false);
	let rectangleStart: any | null = $state(null);
	let currentRectangle: any | null = $state(null);
	let initialized = $state(false);
	let satelliteView = $state(false);
	let streetLayer: any = null;
	let satelliteLayer: any = null;

	const markerColors = {
		known: '#22c55e',
		potential: '#f59e0b',
		unverified: '#6b7280'
	};

	function createMarkerIcon(status: Site['status']) {
		if (!L) return null;
		const color = markerColors[status];
		return L.divIcon({
			className: 'custom-marker',
			html: `
				<div style="
					background-color: ${color};
					width: 24px;
					height: 24px;
					border-radius: 50%;
					border: 3px solid white;
					box-shadow: 0 2px 4px rgba(0,0,0,0.3);
					cursor: pointer;
				"></div>
			`,
			iconSize: [24, 24],
			iconAnchor: [12, 12]
		});
	}

	function updateMarkers(sites: Site[]): void {
		if (!map || !L) return;

		// Remove markers that are no longer visible
		markers.forEach((marker, id) => {
			if (!sites.find((s) => s.id === id)) {
				marker.remove();
				markers.delete(id);
			}
		});

		// Add or update markers for visible sites
		sites.forEach((site) => {
			if (markers.has(site.id)) {
				const marker = markers.get(site.id)!;
				marker.setLatLng([site.coordinates.lat, site.coordinates.lng]);
			} else {
				const marker = L!.marker([site.coordinates.lat, site.coordinates.lng], {
					icon: createMarkerIcon(site.status)
				});
				marker.on('click', () => {
					selectSite(site.id);
				});
				marker.addTo(map!);
				markers.set(site.id, marker);
			}
		});
	}

	export function enableDrawMode(): void {
		if (!map) return;
		drawingRectangle = true;
		map.getContainer().style.cursor = 'crosshair';
	}

	export function disableDrawMode(): void {
		if (!map) return;
		drawingRectangle = false;
		map.getContainer().style.cursor = '';
		rectangleStart = null;
		if (currentRectangle) {
			currentRectangle.remove();
			currentRectangle = null;
		}
	}

	export function flyToSite(site: Site): void {
		if (!map) return;
		map.flyTo([site.coordinates.lat, site.coordinates.lng], 12, {
			duration: 1
		});
	}

	export function toggleSatelliteView(): void {
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

	export function isSatelliteView(): boolean {
		return satelliteView;
	}

	let visibleSitesUnsubscribe: (() => void) | null = null;
	let selectedSiteUnsubscribe: (() => void) | null = null;

	async function initMap() {
		if (!mapContainer || initialized) return;
		initialized = true;

		const leafletModule = await import('leaflet');
		L = leafletModule.default ?? leafletModule;

		map = L.map(mapContainer, {
			zoomControl: false
		}).setView(
			[DEFAULT_MAP_CONFIG.center.lat, DEFAULT_MAP_CONFIG.center.lng],
			DEFAULT_MAP_CONFIG.zoom
		);

		// Add zoom control to bottom-right
		L.control.zoom({ position: 'bottomright' }).addTo(map);

		// Street map layer (OpenStreetMap)
		streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: DEFAULT_MAP_CONFIG.maxZoom,
			minZoom: DEFAULT_MAP_CONFIG.minZoom
		});

		// Satellite layer (Esri World Imagery)
		satelliteLayer = L.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			{
				attribution:
					'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
				maxZoom: DEFAULT_MAP_CONFIG.maxZoom,
				minZoom: DEFAULT_MAP_CONFIG.minZoom
			}
		);

		// Add the default layer
		streetLayer.addTo(map);

		map.on('mousedown', (e: any) => {
			if (!drawingRectangle || !L || !map) return;
			rectangleStart = e.latlng;
		});

		map.on('mousemove', (e: any) => {
			if (!drawingRectangle || !rectangleStart || !L || !map) return;
			if (currentRectangle) {
				currentRectangle.remove();
			}
			currentRectangle = L.rectangle([rectangleStart, e.latlng], {
				color: '#3b82f6',
				weight: 2,
				fillOpacity: 0.2
			}).addTo(map);
		});

		map.on('mouseup', (e: any) => {
			if (!drawingRectangle || !rectangleStart || !L || !map) return;

			const bounds: BoundingBox = {
				north: Math.max(rectangleStart.lat, e.latlng.lat),
				south: Math.min(rectangleStart.lat, e.latlng.lat),
				east: Math.max(rectangleStart.lng, e.latlng.lng),
				west: Math.min(rectangleStart.lng, e.latlng.lng)
			};

			if (bounds.north !== bounds.south && bounds.east !== bounds.west) {
				addScanRegion(bounds);
				onRegionSelect(bounds);
			}

			disableDrawMode();
		});

		// Subscribe to visible sites for marker updates
		visibleSitesUnsubscribe = visibleSites.subscribe((sites) => {
			updateMarkers(sites);
		});

		// Subscribe to selectedSite for flyTo
		selectedSiteUnsubscribe = selectedSite.subscribe((site) => {
			if (site && map) {
				flyToSite(site);
			}
		});
	}

	// Initialize when container is available and we're in browser
	$effect(() => {
		if (browser && mapContainer) {
			initMap();
		}
	});

	// Cleanup
	$effect(() => {
		return () => {
			if (visibleSitesUnsubscribe) {
				visibleSitesUnsubscribe();
			}
			if (selectedSiteUnsubscribe) {
				selectedSiteUnsubscribe();
			}
			if (map) {
				map.remove();
				map = null;
			}
		};
	});
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
	.map-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	:global(.custom-marker) {
		background: transparent;
		border: none;
	}
</style>
