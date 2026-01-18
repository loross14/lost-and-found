<script lang="ts">
	import { toggleLayer, layerVisibility, siteCounts } from '$lib/stores/sites';
	import RegionSelector from './RegionSelector.svelte';
	import type { BoundingBox } from '$lib/types';

	interface Props {
		onDrawStart?: () => void;
		isDrawing?: boolean;
		satelliteView?: boolean;
		onToggleSatellite?: () => void;
	}

	let {
		onDrawStart = () => {},
		isDrawing = false,
		satelliteView = false,
		onToggleSatellite = () => {}
	}: Props = $props();

	let showControls = $state(true);

	const layerConfig = [
		{ key: 'knownSites' as const, label: 'Known Sites', color: 'bg-site-known' },
		{ key: 'potentialSites' as const, label: 'Potential Sites', color: 'bg-site-potential' },
		{ key: 'unverifiedSites' as const, label: 'Unverified', color: 'bg-site-unverified' }
	];

	function handleToggleLayer(layerKey: 'knownSites' | 'potentialSites' | 'unverifiedSites') {
		toggleLayer(layerKey);
	}

	function handleToggleControls() {
		showControls = !showControls;
	}

	function getLayerCount(key: string, counts: typeof $siteCounts): number {
		if (key === 'knownSites') return counts.known;
		if (key === 'potentialSites') return counts.potential;
		return counts.unverified;
	}
</script>

<div class="controls-wrapper">
	<aside class="control-panel">
		<header class="panel-header">
			<div class="logo">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="logo-icon"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
						clip-rule="evenodd"
					/>
				</svg>
				<div class="logo-text">
					<h1 class="app-name">Lost & Found</h1>
					<p class="app-subtitle">Archaeological Site Detection</p>
				</div>
			</div>
			<button class="toggle-btn" onclick={handleToggleControls}>
				{showControls ? '−' : '+'}
			</button>
		</header>

		{#if showControls}
			<section class="panel-section">
				<h2 class="section-title">Map View</h2>
				<label class="layer-toggle">
					<input
						type="checkbox"
						checked={satelliteView}
						onchange={onToggleSatellite}
					/>
					<span class="toggle-indicator satellite-indicator"></span>
					<span class="toggle-label">Satellite View</span>
				</label>
			</section>

			<section class="panel-section">
				<h2 class="section-title">Layers</h2>
				<div class="layer-toggles">
					{#each layerConfig as layer}
						<label class="layer-toggle">
							<input
								type="checkbox"
								checked={$layerVisibility[layer.key]}
								onchange={() => handleToggleLayer(layer.key)}
							/>
							<span class="toggle-indicator {layer.color}"></span>
							<span class="toggle-label">{layer.label}</span>
							<span class="toggle-count">
								{getLayerCount(layer.key, $siteCounts)}
							</span>
						</label>
					{/each}
				</div>
			</section>

			<section class="panel-section">
				<RegionSelector {onDrawStart} {isDrawing} />
			</section>

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
		{/if}
	</aside>
</div>

<style>
	.controls-wrapper {
		position: absolute;
		top: 16px;
		left: 16px;
		z-index: 1000;
	}

	.control-panel {
		width: 260px;
		max-height: calc(100vh - 48px);
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		overflow-y: auto;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.logo-icon {
		width: 24px;
		height: 24px;
		color: #d97706;
	}

	.logo-text {
		display: flex;
		flex-direction: column;
	}

	.app-name {
		font-size: 16px;
		font-weight: 700;
		color: #1f2937;
		line-height: 1.2;
	}

	.app-subtitle {
		font-size: 10px;
		color: #6b7280;
	}

	.toggle-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		font-weight: 400;
		color: #6b7280;
		background: #f3f4f6;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.toggle-btn:hover {
		background: #e5e7eb;
		color: #374151;
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

	.satellite-indicator {
		background: #3b82f6;
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
