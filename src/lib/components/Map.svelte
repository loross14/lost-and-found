<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as LeafletMap } from 'leaflet';
	import { DEFAULT_MAP_CONFIG } from '$lib/types';
	import type { Site, BoundingBox } from '$lib/types';
	import { sitesStore } from '$lib/stores/sites.svelte';

	/** Exported props */
	interface Props {
		onRegionSelect?: (bounds: BoundingBox) => void;
	}
	let { onRegionSelect }: Props = $props();

	let mapContainer: HTMLDivElement;
	let map: LeafletMap | null = $state(null);
	let L: typeof import('leaflet') | null = $state(null);
	let markers: Map<string, any> = new Map();
	let drawingRectangle = $state(false);
	let rectangleStart: any | null = $state(null);
	let currentRectangle: any | null = $state(null);

	/** Marker colors by site status */
	const markerColors = {
		known: '#22c55e',
		potential: '#f59e0b',
		unverified: '#6b7280'
	};

	/** Create a custom icon for a site */
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

	/** Update markers based on visible sites */
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
				// Update existing marker position if needed
				const marker = markers.get(site.id)!;
				marker.setLatLng([site.coordinates.lat, site.coordinates.lng]);
			} else {
				// Create new marker
				const marker = L!.marker([site.coordinates.lat, site.coordinates.lng], {
					icon: createMarkerIcon(site.status)
				});

				marker.on('click', () => {
					sitesStore.selectSite(site.id);
				});

				marker.addTo(map!);
				markers.set(site.id, marker);
			}
		});
	}

	/** Enable rectangle drawing mode */
	export function enableDrawMode(): void {
		if (!map) return;
		drawingRectangle = true;
		map.getContainer().style.cursor = 'crosshair';
	}

	/** Disable rectangle drawing mode */
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

	/** Fly to a specific site */
	export function flyToSite(site: Site): void {
		if (!map) return;
		map.flyTo([site.coordinates.lat, site.coordinates.lng], 12, {
			duration: 1
		});
	}

	onMount(async () => {
		// Dynamically import Leaflet (client-side only)
		L = await import('leaflet');

		// Initialize map
		map = L.map(mapContainer).setView(
			[DEFAULT_MAP_CONFIG.center.lat, DEFAULT_MAP_CONFIG.center.lng],
			DEFAULT_MAP_CONFIG.zoom
		);

		// Add OpenStreetMap tiles (free, no API key)
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: DEFAULT_MAP_CONFIG.maxZoom,
			minZoom: DEFAULT_MAP_CONFIG.minZoom
		}).addTo(map);

		// Handle rectangle drawing
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

			// Only trigger if rectangle has some size
			if (bounds.north !== bounds.south && bounds.east !== bounds.west) {
				sitesStore.addScanRegion(bounds);
				if (onRegionSelect) {
					onRegionSelect(bounds);
				}
			}

			disableDrawMode();
		});

		// Initial marker update
		updateMarkers(sitesStore.visibleSites);
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
	});

	// React to visible sites and selected site changes
	$effect(() => {
		if (map && L) {
			updateMarkers(sitesStore.visibleSites);
		}
	});

	$effect(() => {
		const selected = sitesStore.selectedSite;
		if (selected && map) {
			flyToSite(selected);
		}
	});
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
		integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
		crossorigin=""
	/>
</svelte:head>

<div bind:this={mapContainer} class="map-container"></div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	:global(.custom-marker) {
		background: transparent;
		border: none;
	}
</style>