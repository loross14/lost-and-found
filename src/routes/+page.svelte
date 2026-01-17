<script lang="ts">
	import { browser } from '$app/environment';
	import Map from '$lib/components/Map.svelte';
	import SitePanel from '$lib/components/SitePanel.svelte';
	import RegionSelector from '$lib/components/RegionSelector.svelte';
	import { layerVisibility, toggleLayer, siteCounts } from '$lib/stores/sites';
	import type { BoundingBox } from '$lib/types';

	let mapComponent: Map;
	let isDrawing = false;
	let showControls = true;

	const layerConfig = [
		{ key: 'knownSites' as const, label: 'Known Sites', color: 'bg-site-known' },
		{ key: 'potentialSites' as const, label: 'Potential Sites', color: 'bg-site-potential' },
		{ key: 'unverifiedSites' as const, label: 'Unverified', color: 'bg-site-unverified' }
	];

	function handleDrawStart() {
		isDrawing = true;
		mapComponent?.enableDrawMode();
	}

	function handleRegionSelect(bounds: BoundingBox) {
		isDrawing = false;
		console.log('Region selected:', bounds);
		// Future: trigger scan for this region
	}

	function handleToggleLayer(layerKey: keyof typeof $layerVisibility) {
		toggleLayer(layerKey);
	}
</script>

<svelte:head>
	<title>Lost & Found | Archaeological Site Detection</title>
</svelte:head>

<main class="app-container">
	<!-- Map (full screen) -->
	{#if browser}
		<Map bind:this={mapComponent} onRegionSelect={handleRegionSelect} />
	{/if}

	<!-- Header overlay -->
	<header class="header-overlay">
		<div class="header-content">
			<div class="logo">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 text-amber-600"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
						clip-rule="evenodd"
					/>
				</svg>
				<h1 class="logo-text">Lost & Found</h1>
			</div>
			<p class="subtitle">Archaeological Site Detection</p>
		</div>

		<button class="toggle-controls-btn" on:click={() => (showControls = !showControls)}>
			{showControls ? 'Hide Controls' : 'Show Controls'}
		</button>
	</header>

	<!-- Control panel (left side) -->
	{#if showControls}
		<aside class="control-panel animate-slide-right">
			<!-- Layer toggles -->
			<section class="panel-section">
				<h2 class="section-title">Layers</h2>
				<div class="layer-toggles">
					{#each layerConfig as layer}
						<label class="layer-toggle">
							<input
								type="checkbox"
								checked={$layerVisibility[layer.key]}
								on:change={() => handleToggleLayer(layer.key)}
							/>
							<span class="toggle-indicator {layer.color}"></span>
							<span class="toggle-label">{layer.label}</span>
							<span class="toggle-count">
								{layer.key === 'knownSites'
									? $siteCounts.known
									: layer.key === 'potentialSites'
										? $siteCounts.potential
										: $siteCounts.unverified}
							</span>
						</label>
					{/each}
				</div>
			</section>

			<!-- Region selector -->
			<section class="panel-section">
				<RegionSelector onDrawStart={handleDrawStart} {isDrawing} />
			</section>

			<!-- Stats -->
			<section class="panel-section stats-section">
				<div class="stat">
					<span class="stat-value">{$siteCounts.total}</span>
					<span class="stat-label">Total Sites</span>
				</div>
				<div class="stat">
					<span class="stat-value">{$siteCounts.known}</span>
					<span class="stat-label">Verified</span>
				</div>
			</section>
		</aside>
	{/if}

	<!-- Site detail panel (right side) -->
	<SitePanel />
</main>

<style>
	.app-container {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}

	/* Header overlay */
	.header-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
		z-index: 1000;
		pointer-events: none;
	}

	.header-content {
		pointer-events: auto;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo-text {
		font-size: 20px;
		font-weight: 700;
		color: #1f2937;
	}

	.subtitle {
		font-size: 12px;
		color: #6b7280;
		margin-left: 32px;
	}

	.toggle-controls-btn {
		pointer-events: auto;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		color: #4b5563;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		transition: all 0.2s;
	}

	.toggle-controls-btn:hover {
		background: #f9fafb;
	}

	/* Control panel */
	.control-panel {
		position: absolute;
		top: 80px;
		left: 16px;
		width: 280px;
		max-height: calc(100vh - 100px);
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		overflow-y: auto;
		z-index: 1000;
	}

	.panel-section {
		padding: 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.panel-section:last-child {
		border-bottom: none;
	}

	.section-title {
		font-size: 12px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 12px;
	}

	/* Layer toggles */
	.layer-toggles {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.layer-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		background: #f9fafb;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.layer-toggle:hover {
		background: #f3f4f6;
	}

	.layer-toggle input {
		display: none;
	}

	.toggle-indicator {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		opacity: 0.3;
		transition: opacity 0.2s;
	}

	.layer-toggle input:checked + .toggle-indicator {
		opacity: 1;
	}

	.toggle-label {
		flex: 1;
		font-size: 14px;
		color: #374151;
	}

	.toggle-count {
		font-size: 12px;
		color: #9ca3af;
		font-weight: 500;
	}

	/* Stats section */
	.stats-section {
		display: flex;
		gap: 16px;
	}

	.stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px;
		background: #f9fafb;
		border-radius: 8px;
	}

	.stat-value {
		font-size: 24px;
		font-weight: 700;
		color: #1f2937;
	}

	.stat-label {
		font-size: 11px;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
