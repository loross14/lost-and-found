<script lang="ts">
	import { scanRegions, removeScanRegion } from '$lib/stores/sites';
	import type { ScanRegion, BoundingBox } from '$lib/types';
	import {
		validateRegionSize,
		formatArea,
		PRESET_REGIONS,
		calculateArea,
		estimateTileCount
	} from '$lib/utils/geo';

	interface Props {
		onDrawStart?: () => void;
		onPresetSelect?: (bbox: BoundingBox, center: { lat: number; lng: number }, zoom: number) => void;
		onAnalyze?: (bbox: BoundingBox) => void;
		isDrawing?: boolean;
		pendingRegion?: BoundingBox | null;
	}

	let {
		onDrawStart = () => {},
		onPresetSelect = () => {},
		onAnalyze = () => {},
		isDrawing = false,
		pendingRegion = null
	}: Props = $props();

	let showConfirmDialog = $state(false);
	let regionToAnalyze = $state<BoundingBox | null>(null);
	let validationResult = $state<ReturnType<typeof validateRegionSize> | null>(null);
	let isAnalyzing = $state(false);
	let selectedPreset = $state<string>('');

	function handleStartDraw() {
		onDrawStart();
	}

	function handlePresetChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const presetName = select.value;
		selectedPreset = presetName;

		if (!presetName) return;

		const preset = PRESET_REGIONS.find((p) => p.name === presetName);
		if (preset) {
			onPresetSelect(preset.bbox, preset.center, preset.zoom);
		}
	}

	function handleRemoveRegion(regionId: string) {
		removeScanRegion(regionId);
	}

	function openConfirmDialog(bbox: BoundingBox) {
		regionToAnalyze = bbox;
		validationResult = validateRegionSize(bbox);
		showConfirmDialog = true;
	}

	function closeConfirmDialog() {
		showConfirmDialog = false;
		regionToAnalyze = null;
		validationResult = null;
	}

	async function handleConfirmAnalysis() {
		if (!regionToAnalyze || !validationResult?.valid) return;

		isAnalyzing = true;
		try {
			await onAnalyze(regionToAnalyze);
		} finally {
			isAnalyzing = false;
			closeConfirmDialog();
		}
	}

	function formatBounds(region: ScanRegion): string {
		const { north, south, east, west } = region.bounds;
		return `${north.toFixed(2)}N, ${west.toFixed(2)}W to ${south.toFixed(2)}N, ${east.toFixed(2)}W`;
	}

	function getStatusIcon(status: ScanRegion['status']): string {
		switch (status) {
			case 'pending':
				return '...';
			case 'scanning':
				return '...';
			case 'complete':
				return 'ok';
			case 'error':
				return '!';
			default:
				return '?';
		}
	}

	function getStatusColor(status: ScanRegion['status']): string {
		switch (status) {
			case 'pending':
				return 'text-gray-500';
			case 'scanning':
				return 'text-blue-500';
			case 'complete':
				return 'text-green-500';
			case 'error':
				return 'text-red-500';
			default:
				return 'text-gray-500';
		}
	}

	// Watch for pending region changes to open confirmation dialog
	$effect(() => {
		if (pendingRegion) {
			openConfirmDialog(pendingRegion);
		}
	});
</script>

<div class="region-selector">
	<div class="selector-header">
		<h3 class="selector-title">Scan Regions</h3>
	</div>

	<!-- Preset Regions Dropdown -->
	<div class="preset-section">
		<label class="preset-label" for="preset-select">Quick Select</label>
		<select
			id="preset-select"
			class="preset-select"
			bind:value={selectedPreset}
			onchange={handlePresetChange}
		>
			<option value="">Choose a known site...</option>
			{#each PRESET_REGIONS as preset}
				<option value={preset.name}>{preset.name}</option>
			{/each}
		</select>
		{#if selectedPreset}
			{@const preset = PRESET_REGIONS.find((p) => p.name === selectedPreset)}
			{#if preset}
				<p class="preset-description">{preset.description}</p>
			{/if}
		{/if}
	</div>

	<!-- Draw Region Button -->
	<button class="draw-btn" class:drawing={isDrawing} onclick={handleStartDraw} disabled={isDrawing}>
		{#if isDrawing}
			<span class="drawing-indicator"></span>
			Drawing...
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"
				/>
			</svg>
			Draw Region
		{/if}
	</button>

	<p class="selector-help">
		{#if isDrawing}
			Click and drag on the map to select a region to analyze
		{:else}
			Draw a rectangle on the map to define areas for archaeological site detection
		{/if}
	</p>

	<!-- Scan Regions List -->
	{#if $scanRegions.length === 0}
		<div class="empty-state">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-8 w-8 text-gray-300"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
				/>
			</svg>
			<p class="empty-text">No scan regions defined</p>
		</div>
	{:else}
		<div class="regions-list">
			{#each $scanRegions as region (region.id)}
				<div class="region-item">
					<div class="region-info">
						<div class="region-status {getStatusColor(region.status)}">
							{getStatusIcon(region.status)}
						</div>
						<div class="region-details">
							<span class="region-bounds">{formatBounds(region)}</span>
							<span class="region-meta">
								{formatArea(calculateArea(region.bounds))} ·
								{region.status === 'complete' && region.resultsCount !== undefined
									? `${region.resultsCount} sites found`
									: region.status}
							</span>
						</div>
					</div>
					<button
						class="remove-btn"
						onclick={() => handleRemoveRegion(region.id)}
						aria-label="Remove region"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Confirmation Dialog -->
{#if showConfirmDialog && regionToAnalyze && validationResult}
	<div
		class="dialog-overlay"
		onclick={closeConfirmDialog}
		onkeydown={(e) => e.key === 'Escape' && closeConfirmDialog()}
		role="button"
		tabindex="-1"
	>
		<div
			class="dialog"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<h3 class="dialog-title">
				{validationResult.valid ? 'Analyze this region?' : 'Region Size Warning'}
			</h3>

			{#if validationResult.valid}
				<div class="dialog-stats">
					<div class="stat-row">
						<span class="stat-label">Area</span>
						<span class="stat-value">~{formatArea(validationResult.area)}</span>
					</div>
					<div class="stat-row">
						<span class="stat-label">Estimated tiles</span>
						<span class="stat-value">{validationResult.tileCount}</span>
					</div>
					<div class="stat-row">
						<span class="stat-label">Estimated API calls</span>
						<span class="stat-value">{validationResult.tileCount}</span>
					</div>
				</div>
			{:else}
				<div class="dialog-warning">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="warning-icon"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="warning-text">{validationResult.message}</p>
				</div>
			{/if}

			<div class="dialog-actions">
				<button class="btn btn-secondary" onclick={closeConfirmDialog}>Cancel</button>
				{#if validationResult.valid}
					<button class="btn btn-primary" onclick={handleConfirmAnalysis} disabled={isAnalyzing}>
						{#if isAnalyzing}
							Analyzing...
						{:else}
							Analyze
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.region-selector {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.selector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.selector-title {
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
	}

	/* Preset Section */
	.preset-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.preset-label {
		font-size: 12px;
		color: #6b7280;
		font-weight: 500;
	}

	.preset-select {
		width: 100%;
		padding: 8px 10px;
		font-size: 13px;
		color: #374151;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.preset-select:hover {
		border-color: #d1d5db;
	}

	.preset-select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.preset-description {
		font-size: 11px;
		color: #6b7280;
		font-style: italic;
	}

	/* Draw Button */
	.draw-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 10px 12px;
		font-size: 13px;
		font-weight: 500;
		color: #3b82f6;
		background: #eff6ff;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.draw-btn:hover:not(:disabled) {
		background: #dbeafe;
	}

	.draw-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.draw-btn.drawing {
		background: #3b82f6;
		color: white;
	}

	.drawing-indicator {
		width: 8px;
		height: 8px;
		background: white;
		border-radius: 50%;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.selector-help {
		font-size: 12px;
		color: #6b7280;
		line-height: 1.4;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px dashed #e5e7eb;
	}

	.empty-text {
		font-size: 13px;
		color: #9ca3af;
	}

	.regions-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.region-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.region-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.region-status {
		font-size: 12px;
		font-weight: 600;
	}

	.region-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.region-bounds {
		font-size: 11px;
		font-family: monospace;
		color: #4b5563;
	}

	.region-meta {
		font-size: 11px;
		color: #9ca3af;
	}

	.remove-btn {
		padding: 4px;
		color: #9ca3af;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.remove-btn:hover {
		background: #fee2e2;
		color: #ef4444;
	}

	/* Dialog Styles */
	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.dialog {
		background: white;
		border-radius: 12px;
		padding: 24px;
		width: 90%;
		max-width: 360px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
	}

	.dialog-title {
		font-size: 18px;
		font-weight: 600;
		color: #1f2937;
		margin-bottom: 16px;
	}

	.dialog-stats {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 8px;
		margin-bottom: 20px;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.stat-row .stat-label {
		font-size: 13px;
		color: #6b7280;
	}

	.stat-row .stat-value {
		font-size: 13px;
		font-weight: 600;
		color: #1f2937;
	}

	.dialog-warning {
		display: flex;
		gap: 12px;
		padding: 12px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		margin-bottom: 20px;
	}

	.warning-icon {
		width: 20px;
		height: 20px;
		color: #ef4444;
		flex-shrink: 0;
	}

	.warning-text {
		font-size: 13px;
		color: #991b1b;
		line-height: 1.4;
	}

	.dialog-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.btn {
		padding: 10px 16px;
		font-size: 14px;
		font-weight: 500;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #4b5563;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
