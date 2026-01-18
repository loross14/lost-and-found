<script lang="ts">
	import { removeScanRegion, scanRegions } from '$lib/stores/sites';
	import type { ScanRegion } from '$lib/types';

	interface Props {
		onDrawStart?: () => void;
		isDrawing?: boolean;
	}

	let { onDrawStart = () => {}, isDrawing = false }: Props = $props();

	function handleStartDraw() {
		onDrawStart();
	}

	function handleRemoveRegion(regionId: string) {
		removeScanRegion(regionId);
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
</script>

<div class="region-selector">
	<div class="selector-header">
		<h3 class="selector-title">Scan Regions</h3>
		<button
			class="draw-btn"
			class:drawing={isDrawing}
			onclick={handleStartDraw}
			disabled={isDrawing}
		>
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
	</div>

	<p class="selector-help">
		{#if isDrawing}
			Click and drag on the map to select a region to scan
		{:else}
			Draw a rectangle on the map to define areas for archaeological site detection
		{/if}
	</p>

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

		<button class="scan-btn" disabled title="Scanning functionality coming soon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
					clip-rule="evenodd"
				/>
			</svg>
			Scan Selected Regions
		</button>
	{/if}
</div>

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

	.draw-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
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
		font-size: 13px;
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
		font-size: 12px;
		font-family: monospace;
		color: #4b5563;
	}

	.region-meta {
		font-size: 11px;
		color: #9ca3af;
		text-transform: capitalize;
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

	.scan-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 12px;
		font-size: 14px;
		font-weight: 500;
		color: white;
		background: #3b82f6;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.scan-btn:hover:not(:disabled) {
		background: #2563eb;
	}

	.scan-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
