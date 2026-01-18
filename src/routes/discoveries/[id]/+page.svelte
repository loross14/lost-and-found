<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface DiscoveryDetail {
		id: string;
		name: string;
		lat: number;
		lng: number;
		featureType: string | null;
		confidence: number | null;
		sizeMeters: number | null;
		description: string | null;
		mlModel: string | null;
		mlReasoning: string | null;
		reviewStatus: string;
		reviewerNotes: string | null;
		tileZ: number | null;
		tileX: number | null;
		tileY: number | null;
		createdAt: string;
		nearestKnownSite: {
			id: string;
			name: string;
			distanceKm: number;
		} | null;
	}

	let discovery: DiscoveryDetail | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let reviewerNotes = $state('');

	const id = $derived($page.params.id);

	async function loadDiscovery() {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/discoveries/${id}`);
			const data = await response.json();

			if (data.success) {
				discovery = data.discovery;
				reviewerNotes = discovery?.reviewerNotes || '';
			} else {
				error = data.message;
			}
		} catch (e) {
			error = 'Failed to load discovery';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function submitReview(status: 'verified' | 'rejected' | 'skipped') {
		if (!discovery) return;

		submitting = true;
		try {
			const response = await fetch(`/api/discoveries/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reviewStatus: status,
					reviewerNotes: reviewerNotes || null
				})
			});

			const data = await response.json();

			if (data.success) {
				// Go to next unreviewed discovery or back to list
				goto('/discoveries');
			} else {
				error = data.message;
			}
		} catch (e) {
			error = 'Failed to submit review';
			console.error(e);
		} finally {
			submitting = false;
		}
	}

	function formatConfidence(confidence: number | null): string {
		if (confidence === null) return 'N/A';
		return `${Math.round(confidence * 100)}%`;
	}

	function formatCoords(lat: number, lng: number): string {
		const latDir = lat >= 0 ? 'N' : 'S';
		const lngDir = lng >= 0 ? 'E' : 'W';
		return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`;
	}

	function getFeatureTypeLabel(type: string | null): string {
		if (!type) return 'Unknown Feature';
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function getTileImageUrl(z: number, x: number, y: number): string {
		// ESRI World Imagery tile URL
		return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
	}

	function getGoogleMapsUrl(lat: number, lng: number): string {
		return `https://www.google.com/maps/@${lat},${lng},18z`;
	}

	onMount(() => {
		if (browser) {
			loadDiscovery();
		}
	});
</script>

<svelte:head>
	<title>Review Discovery | Lost & Found</title>
</svelte:head>

<div class="review-page">
	<header class="page-header">
		<div class="header-content">
			<div class="header-nav">
				<a href="/discoveries" class="back-link">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
					</svg>
					Back to Discoveries
				</a>
				<div class="header-links">
					<a href="/" class="header-link">Map</a>
					<a href="/scanner" class="header-link">Scanner</a>
				</div>
			</div>
		</div>
	</header>

	<main class="review-content">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading discovery...</p>
			</div>
		{:else if error}
			<div class="error-state">
				<p>{error}</p>
				<button onclick={loadDiscovery}>Try Again</button>
			</div>
		{:else if discovery}
			<div class="review-layout">
				<!-- Image Section -->
				<div class="image-section">
					<div class="image-container">
						{#if discovery.tileZ && discovery.tileX && discovery.tileY}
							<img
								src={getTileImageUrl(discovery.tileZ, discovery.tileX, discovery.tileY)}
								alt="Satellite imagery of potential site"
								class="tile-image"
							/>
							<div class="image-marker"></div>
						{:else}
							<div class="no-image">
								<p>No satellite imagery available</p>
							</div>
						{/if}
					</div>
					<div class="image-controls">
						<a
							href={getGoogleMapsUrl(discovery.lat, discovery.lng)}
							target="_blank"
							rel="noopener noreferrer"
							class="external-link"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
								<path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
								<path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
							</svg>
							View in Google Maps
						</a>
					</div>
				</div>

				<!-- Details Section -->
				<div class="details-section">
					<div class="detail-card">
						<h2 class="section-title">Detection Details</h2>

						<div class="detail-row">
							<span class="detail-label">Feature Type</span>
							<span class="detail-value feature-type">{getFeatureTypeLabel(discovery.featureType)}</span>
						</div>

						<div class="detail-row">
							<span class="detail-label">Confidence</span>
							<span class="detail-value confidence">{formatConfidence(discovery.confidence)}</span>
						</div>

						<div class="detail-row">
							<span class="detail-label">Coordinates</span>
							<span class="detail-value coords">{formatCoords(discovery.lat, discovery.lng)}</span>
						</div>

						{#if discovery.sizeMeters}
							<div class="detail-row">
								<span class="detail-label">Estimated Size</span>
								<span class="detail-value">~{Math.round(discovery.sizeMeters)} meters</span>
							</div>
						{/if}
					</div>

					<div class="detail-card">
						<h2 class="section-title">ML Analysis</h2>

						{#if discovery.description}
							<p class="ml-description">{discovery.description}</p>
						{/if}

						{#if discovery.mlReasoning}
							<div class="ml-reasoning">
								<h3>Why this looks archaeological:</h3>
								<p>{discovery.mlReasoning}</p>
							</div>
						{/if}

						{#if discovery.mlModel}
							<p class="ml-model">Model: {discovery.mlModel}</p>
						{/if}
					</div>

					{#if discovery.nearestKnownSite}
						<div class="detail-card">
							<h2 class="section-title">Cross-Reference</h2>
							<div class="nearest-site">
								<p>
									<strong>Nearest known site:</strong> {discovery.nearestKnownSite.name}
								</p>
								<p class="distance">
									{discovery.nearestKnownSite.distanceKm.toFixed(1)} km away
								</p>
							</div>
						</div>
					{/if}

					<div class="detail-card">
						<h2 class="section-title">Your Review</h2>
						<textarea
							bind:value={reviewerNotes}
							placeholder="Add notes about this site (optional)..."
							class="notes-input"
							rows="3"
						></textarea>
					</div>

					<div class="action-buttons">
						<button
							class="action-btn reject-btn"
							onclick={() => submitReview('rejected')}
							disabled={submitting}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
							Reject
							<span class="btn-subtitle">Not a site</span>
						</button>

						<button
							class="action-btn skip-btn"
							onclick={() => submitReview('skipped')}
							disabled={submitting}
						>
							Skip for now
						</button>

						<button
							class="action-btn verify-btn"
							onclick={() => submitReview('verified')}
							disabled={submitting}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
							Verify
							<span class="btn-subtitle">Looks real</span>
						</button>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	.review-page {
		min-height: 100vh;
		background: #f9fafb;
	}

	.page-header {
		background: white;
		border-bottom: 1px solid #e5e7eb;
		padding: 16px 24px;
	}

	.header-content {
		max-width: 1400px;
		margin: 0 auto;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: #6b7280;
		font-size: 14px;
		text-decoration: none;
	}

	.back-link:hover {
		color: #3b82f6;
	}

	.header-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-links {
		display: flex;
		gap: 8px;
	}

	.header-link {
		padding: 6px 12px;
		background: #f3f4f6;
		border-radius: 6px;
		font-size: 14px;
		color: #6b7280;
		text-decoration: none;
		transition: all 0.2s;
	}

	.header-link:hover {
		color: #3b82f6;
		background: #eff6ff;
	}

	.review-content {
		max-width: 1400px;
		margin: 0 auto;
		padding: 24px;
	}

	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 64px;
		text-align: center;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #e5e7eb;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.review-layout {
		display: grid;
		grid-template-columns: 1fr 400px;
		gap: 24px;
	}

	@media (max-width: 1024px) {
		.review-layout {
			grid-template-columns: 1fr;
		}
	}

	.image-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.image-container {
		position: relative;
		background: #1f2937;
		border-radius: 12px;
		overflow: hidden;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tile-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.image-marker {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 40px;
		height: 40px;
		border: 3px solid #ef4444;
		border-radius: 50%;
		box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3);
		pointer-events: none;
	}

	.no-image {
		color: #9ca3af;
		text-align: center;
		padding: 64px;
	}

	.image-controls {
		display: flex;
		gap: 8px;
	}

	.external-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		font-size: 14px;
		color: #4b5563;
		text-decoration: none;
		transition: all 0.2s;
	}

	.external-link:hover {
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.details-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.detail-card {
		background: white;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
		padding: 20px;
	}

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 16px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid #f3f4f6;
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-label {
		font-size: 14px;
		color: #6b7280;
	}

	.detail-value {
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
	}

	.detail-value.feature-type {
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.detail-value.confidence {
		color: #059669;
	}

	.detail-value.coords {
		font-family: monospace;
		font-size: 13px;
	}

	.ml-description {
		font-size: 15px;
		color: #1f2937;
		line-height: 1.6;
		margin-bottom: 16px;
	}

	.ml-reasoning {
		background: #f9fafb;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 12px;
	}

	.ml-reasoning h3 {
		font-size: 13px;
		font-weight: 600;
		color: #4b5563;
		margin-bottom: 8px;
	}

	.ml-reasoning p {
		font-size: 14px;
		color: #4b5563;
		line-height: 1.5;
		font-style: italic;
	}

	.ml-model {
		font-size: 12px;
		color: #9ca3af;
	}

	.nearest-site p {
		font-size: 14px;
		color: #4b5563;
	}

	.nearest-site .distance {
		color: #6b7280;
		margin-top: 4px;
	}

	.notes-input {
		width: 100%;
		padding: 12px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 14px;
		resize: vertical;
	}

	.notes-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.action-buttons {
		display: flex;
		gap: 12px;
		margin-top: 8px;
	}

	.action-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 16px;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-subtitle {
		font-size: 12px;
		font-weight: 400;
		opacity: 0.8;
	}

	.reject-btn {
		background: #fef2f2;
		color: #dc2626;
		border: 2px solid #fecaca;
	}

	.reject-btn:hover:not(:disabled) {
		background: #fee2e2;
		border-color: #fca5a5;
	}

	.skip-btn {
		background: #f9fafb;
		color: #6b7280;
		border: 2px solid #e5e7eb;
	}

	.skip-btn:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.verify-btn {
		background: #ecfdf5;
		color: #059669;
		border: 2px solid #a7f3d0;
	}

	.verify-btn:hover:not(:disabled) {
		background: #d1fae5;
		border-color: #6ee7b7;
	}
</style>
