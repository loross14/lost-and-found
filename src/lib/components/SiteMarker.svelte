<script lang="ts">
	/**
	 * SiteMarker component - renders a marker for archaeological sites
	 * Note: This component is primarily for reference/documentation.
	 * Actual markers are rendered directly in Map.svelte using Leaflet's API
	 * for better performance with many markers.
	 */

	import type { Site } from '$lib/types';

	export let site: Site;
	export let selected = false;

	const statusColors = {
		known: 'bg-site-known',
		potential: 'bg-site-potential',
		unverified: 'bg-site-unverified'
	};

	const statusLabels = {
		known: 'Known Site',
		potential: 'Potential Site',
		unverified: 'Unverified'
	};
</script>

<!--
	This component is a visual reference for site marker styling.
	Actual map markers are created programmatically in Map.svelte.
-->
<div class="site-marker" class:selected>
	<div class="marker-dot {statusColors[site.status]}" title={statusLabels[site.status]}></div>
	{#if selected}
		<div class="marker-label">
			{site.name}
		</div>
	{/if}
</div>

<style>
	.site-marker {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.marker-dot {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 3px solid white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		cursor: pointer;
		transition: transform 0.2s ease;
	}

	.marker-dot:hover,
	.selected .marker-dot {
		transform: scale(1.2);
	}

	.marker-label {
		position: absolute;
		top: 100%;
		margin-top: 4px;
		background: white;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
</style>
