<script lang="ts">
	import { selectedSite, selectSite } from '$lib/stores/sites';

	const statusConfig = {
		known: { label: 'Known Site', color: 'bg-site-known', textColor: 'text-site-known' },
		potential: {
			label: 'Potential Site',
			color: 'bg-site-potential',
			textColor: 'text-site-potential'
		},
		unverified: {
			label: 'Unverified',
			color: 'bg-site-unverified',
			textColor: 'text-site-unverified'
		}
	};

	function handleClose() {
		selectSite(null);
	}

	function formatCoordinates(lat: number, lng: number): string {
		const latDir = lat >= 0 ? 'N' : 'S';
		const lngDir = lng >= 0 ? 'E' : 'W';
		return `${Math.abs(lat).toFixed(4)}${latDir}, ${Math.abs(lng).toFixed(4)}${lngDir}`;
	}
</script>

{#if $selectedSite}
	{@const site = $selectedSite}
	{@const config = statusConfig[site.status]}

	<div class="site-panel">
		<div class="panel-header">
			<div class="flex items-center gap-2">
				<span class="status-badge {config.color}"></span>
				<span class="status-label {config.textColor}">{config.label}</span>
			</div>
			<button class="close-btn" onclick={handleClose} aria-label="Close panel">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
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

		<h2 class="site-name">{site.name}</h2>

		<div class="site-coordinates">
			{formatCoordinates(site.coordinates.lat, site.coordinates.lng)}
		</div>

		{#if site.description}
			<p class="site-description">{site.description}</p>
		{/if}

		<div class="site-details">
			{#if site.culture}
				<div class="detail-row">
					<span class="detail-label">Culture</span>
					<span class="detail-value">{site.culture}</span>
				</div>
			{/if}

			{#if site.timePeriod}
				<div class="detail-row">
					<span class="detail-label">Time Period</span>
					<span class="detail-value">{site.timePeriod}</span>
				</div>
			{/if}

			{#if site.dateDiscovered}
				<div class="detail-row">
					<span class="detail-label">Discovered</span>
					<span class="detail-value">{site.dateDiscovered}</span>
				</div>
			{/if}
		</div>

		{#if site.features && site.features.length > 0}
			<div class="site-features">
				<span class="detail-label">Features</span>
				<div class="feature-tags">
					{#each site.features as feature}
						<span class="feature-tag">{feature}</span>
					{/each}
				</div>
			</div>
		{/if}

		{#if site.sourceUrl}
			<a href={site.sourceUrl} target="_blank" rel="noopener noreferrer" class="source-link">
				View Source
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
					/>
					<path
						d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
					/>
				</svg>
			</a>
		{/if}

		<div class="panel-actions">
			<button class="action-btn action-btn-secondary" disabled title="Coming soon">
				Add Note
			</button>
			<button class="action-btn action-btn-primary" disabled title="Coming soon">
				Verify Site
			</button>
		</div>
	</div>
{/if}

<style>
	.site-panel {
		position: absolute;
		top: 80px;
		right: 16px;
		width: 320px;
		max-height: calc(100vh - 100px);
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		padding: 20px;
		z-index: 1000;
		overflow-y: auto;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.status-badge {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.status-label {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.close-btn {
		padding: 4px;
		border-radius: 6px;
		color: #6b7280;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #1f2937;
	}

	.site-name {
		font-size: 20px;
		font-weight: 700;
		color: #1f2937;
		margin-bottom: 4px;
	}

	.site-coordinates {
		font-size: 13px;
		color: #6b7280;
		font-family: monospace;
		margin-bottom: 16px;
	}

	.site-description {
		font-size: 14px;
		color: #4b5563;
		line-height: 1.5;
		margin-bottom: 16px;
	}

	.site-details {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.detail-label {
		font-size: 12px;
		color: #6b7280;
		font-weight: 500;
	}

	.detail-value {
		font-size: 14px;
		color: #1f2937;
		font-weight: 500;
	}

	.site-features {
		margin-bottom: 16px;
	}

	.feature-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}

	.feature-tag {
		font-size: 12px;
		background: #f3f4f6;
		color: #4b5563;
		padding: 4px 10px;
		border-radius: 16px;
	}

	.source-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 14px;
		color: #3b82f6;
		text-decoration: none;
		margin-bottom: 16px;
	}

	.source-link:hover {
		text-decoration: underline;
	}

	.panel-actions {
		display: flex;
		gap: 8px;
		padding-top: 16px;
		border-top: 1px solid #e5e7eb;
	}

	.action-btn {
		flex: 1;
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn-secondary {
		background: #f3f4f6;
		color: #4b5563;
	}

	.action-btn-secondary:hover:not(:disabled) {
		background: #e5e7eb;
	}

	.action-btn-primary {
		background: #3b82f6;
		color: white;
	}

	.action-btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}
</style>
