<script lang="ts">
	import { toggleLayer, layerVisibility, siteCounts } from '$lib/stores/sites';
	import RegionSelector from './RegionSelector.svelte';
	import type { BoundingBox } from '$lib/types';

	interface Props {
		onDrawStart?: () => void;
		onPresetSelect?: (bbox: BoundingBox, center: { lat: number; lng: number }, zoom: number) => void;
		onAnalyze?: (bbox: BoundingBox) => void;
		isDrawing?: boolean;
		pendingRegion?: BoundingBox | null;
		satelliteView?: boolean;
		onToggleSatellite?: () => void;
	}

	let {
		onDrawStart = () => {},
		onPresetSelect = () => {},
		onAnalyze = () => {},
		isDrawing = false,
		pendingRegion = null,
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
			<nav class="panel-section nav-section">
				<a href="/discoveries" class="nav-link">
					<svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 20 20" fill="currentColor">
						<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
						<path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
					</svg>
					<span class="nav-label">Review Discoveries</span>
					<svg xmlns="http://www.w3.org/2000/svg" class="nav-arrow" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					</svg>
				</a>
				<a href="/scanner" class="nav-link">
					<svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clip-rule="evenodd" />
						<path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM16 13a1 1 0 100 2v2a1 1 0 102 0v-2a1 1 0 00-2 0zM13 13a1 1 0 100 2h4a1 1 0 100-2h-4z" />
					</svg>
					<span class="nav-label">Scanner Dashboard</span>
					<svg xmlns="http://www.w3.org/2000/svg" class="nav-arrow" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					</svg>
				</a>
			</nav>

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
				<RegionSelector
					{onDrawStart}
					{onPresetSelect}
					{onAnalyze}
					{isDrawing}
					{pendingRegion}
				/>
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

	.nav-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
		border-radius: 8px;
		text-decoration: none;
		color: #374151;
		transition: all 0.2s;
		border: 1px solid #e5e7eb;
	}

	.nav-link:hover {
		background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
		border-color: #93c5fd;
		color: #1d4ed8;
	}

	.nav-icon {
		width: 18px;
		height: 18px;
		color: #6b7280;
		flex-shrink: 0;
	}

	.nav-link:hover .nav-icon {
		color: #3b82f6;
	}

	.nav-label {
		flex: 1;
		font-size: 14px;
		font-weight: 500;
	}

	.nav-arrow {
		width: 16px;
		height: 16px;
		color: #9ca3af;
		flex-shrink: 0;
	}

	.nav-link:hover .nav-arrow {
		color: #3b82f6;
	}
</style>
