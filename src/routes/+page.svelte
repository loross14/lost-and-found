<script lang="ts">
	import { browser } from '$app/environment';
	import Map from '$lib/components/Map.svelte';
	import Controls from '$lib/components/Controls.svelte';
	import SitePanel from '$lib/components/SitePanel.svelte';
	import type { BoundingBox } from '$lib/types';

	let mapComponent: Map | undefined = $state();
	let isDrawing = $state(false);
	let satelliteView = $state(false);
	let mounted = $state(false);

	$effect(() => {
		if (browser) {
			mounted = true;
		}
	});

	function handleDrawStart() {
		isDrawing = true;
		mapComponent?.enableDrawMode();
	}

	function handleRegionSelect(bounds: BoundingBox) {
		isDrawing = false;
		console.log('Region selected:', bounds);
	}

	function handleToggleSatellite() {
		mapComponent?.toggleSatelliteView();
		satelliteView = mapComponent?.isSatelliteView() ?? false;
	}
</script>

<svelte:head>
	<title>Lost & Found | Archaeological Site Detection</title>
</svelte:head>

<main class="app-container">
	{#if mounted}
		<Map bind:this={mapComponent} onRegionSelect={handleRegionSelect} />
	{/if}

	<Controls
		onDrawStart={handleDrawStart}
		{isDrawing}
		{satelliteView}
		onToggleSatellite={handleToggleSatellite}
	/>

	<SitePanel />
</main>

<style>
	.app-container {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}
</style>
