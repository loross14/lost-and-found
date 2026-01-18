<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface Discovery {
		id: string;
		name: string;
		lat: number;
		lng: number;
		featureType: string | null;
		confidence: number | null;
		sizeMeters: number | null;
		description: string | null;
		reviewStatus: string;
		createdAt: string;
	}

	interface Stats {
		totalPotential: number;
		pendingReview: number;
		verified: number;
		rejected: number;
		avgConfidence: number | null;
	}

	let discoveries: Discovery[] = $state([]);
	let stats: Stats | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let page = $state(1);
	let totalPages = $state(1);
	let statusFilter = $state('pending');
	let sortBy = $state('confidence');

	async function loadDiscoveries() {
		loading = true;
		error = null;

		try {
			const params = new URLSearchParams({
				page: page.toString(),
				limit: '20',
				status: statusFilter,
				sortBy,
				sortOrder: 'desc'
			});

			const response = await fetch(`/api/discoveries?${params}`);
			const data = await response.json();

			if (data.success) {
				discoveries = data.discoveries;
				stats = data.stats;
				totalPages = data.pagination.totalPages;
			} else {
				error = data.message;
			}
		} catch (e) {
			error = 'Failed to load discoveries';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	function formatConfidence(confidence: number | null): string {
		if (confidence === null) return 'N/A';
		return `${Math.round(confidence * 100)}%`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

		if (diffHours < 1) return 'Just now';
		if (diffHours < 24) return `${diffHours} hours ago`;
		if (diffHours < 48) return 'Yesterday';
		return date.toLocaleDateString();
	}

	function formatCoords(lat: number, lng: number): string {
		const latDir = lat >= 0 ? 'N' : 'S';
		const lngDir = lng >= 0 ? 'E' : 'W';
		return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
	}

	function getFeatureTypeLabel(type: string | null): string {
		if (!type) return 'Unknown';
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function getConfidenceColor(confidence: number | null): string {
		if (confidence === null) return 'bg-gray-200';
		if (confidence >= 0.8) return 'bg-green-500';
		if (confidence >= 0.6) return 'bg-yellow-500';
		return 'bg-orange-500';
	}

	function handleStatusChange(event: Event) {
		statusFilter = (event.target as HTMLSelectElement).value;
		page = 1;
		loadDiscoveries();
	}

	function handleSortChange(event: Event) {
		sortBy = (event.target as HTMLSelectElement).value;
		page = 1;
		loadDiscoveries();
	}

	function nextPage() {
		if (page < totalPages) {
			page++;
			loadDiscoveries();
		}
	}

	function prevPage() {
		if (page > 1) {
			page--;
			loadDiscoveries();
		}
	}

	onMount(() => {
		if (browser) {
			loadDiscoveries();
		}
	});
</script>

<svelte:head>
	<title>Potential Discoveries | Lost & Found</title>
</svelte:head>

<div class="discoveries-page">
	<header class="page-header">
		<div class="header-content">
			<div class="header-nav">
				<a href="/" class="back-link">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
					</svg>
					Back to Map
				</a>
				<a href="/scanner" class="scanner-link">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clip-rule="evenodd" />
						<path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM16 13a1 1 0 100 2v2a1 1 0 102 0v-2a1 1 0 00-2 0zM13 13a1 1 0 100 2h4a1 1 0 100-2h-4z" />
					</svg>
					Scanner
				</a>
			</div>
			<h1 class="page-title">Potential Discoveries</h1>
		</div>
	</header>

	{#if stats}
		<div class="stats-bar">
			<div class="stat">
				<span class="stat-value">{stats.pendingReview}</span>
				<span class="stat-label">Pending Review</span>
			</div>
			<div class="stat">
				<span class="stat-value">{stats.verified}</span>
				<span class="stat-label">Verified</span>
			</div>
			<div class="stat">
				<span class="stat-value">{stats.rejected}</span>
				<span class="stat-label">Rejected</span>
			</div>
			<div class="stat">
				<span class="stat-value">{stats.avgConfidence ? `${Math.round(stats.avgConfidence * 100)}%` : 'N/A'}</span>
				<span class="stat-label">Avg Confidence</span>
			</div>
		</div>
	{/if}

	<div class="filters-bar">
		<div class="filter-group">
			<label for="status-filter">Status:</label>
			<select id="status-filter" value={statusFilter} onchange={handleStatusChange}>
				<option value="pending">Pending Review</option>
				<option value="verified">Verified</option>
				<option value="rejected">Rejected</option>
				<option value="all">All</option>
			</select>
		</div>
		<div class="filter-group">
			<label for="sort-filter">Sort by:</label>
			<select id="sort-filter" value={sortBy} onchange={handleSortChange}>
				<option value="confidence">Confidence (highest)</option>
				<option value="date">Date (newest)</option>
				<option value="type">Feature Type</option>
			</select>
		</div>
	</div>

	<main class="discoveries-content">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading discoveries...</p>
			</div>
		{:else if error}
			<div class="error-state">
				<p>{error}</p>
				<button onclick={loadDiscoveries}>Try Again</button>
			</div>
		{:else if discoveries.length === 0}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
				</svg>
				<h3>No discoveries found</h3>
				<p>Start a scan from the <a href="/scanner">Scanner Dashboard</a> to detect potential sites.</p>
			</div>
		{:else}
			<div class="discoveries-list">
				{#each discoveries as discovery, index (discovery.id)}
					<a href="/discoveries/{discovery.id}" class="discovery-card">
						<div class="discovery-rank">#{(page - 1) * 20 + index + 1}</div>
						<div class="discovery-info">
							<div class="discovery-header">
								<span class="feature-type">{getFeatureTypeLabel(discovery.featureType)}</span>
								<div class="confidence-badge {getConfidenceColor(discovery.confidence)}">
									{formatConfidence(discovery.confidence)}
								</div>
							</div>
							<div class="discovery-coords">
								{formatCoords(discovery.lat, discovery.lng)}
							</div>
							{#if discovery.description}
								<p class="discovery-description">{discovery.description}</p>
							{/if}
							<div class="discovery-meta">
								<span class="detected-date">Detected: {formatDate(discovery.createdAt)}</span>
							</div>
						</div>
						<div class="discovery-action">
							<span class="review-btn">Review</span>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
							</svg>
						</div>
					</a>
				{/each}
			</div>

			{#if totalPages > 1}
				<div class="pagination">
					<button class="page-btn" onclick={prevPage} disabled={page === 1}>
						Previous
					</button>
					<span class="page-info">Page {page} of {totalPages}</span>
					<button class="page-btn" onclick={nextPage} disabled={page === totalPages}>
						Next
					</button>
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.discoveries-page {
		min-height: 100vh;
		background: #f9fafb;
	}

	.page-header {
		background: white;
		border-bottom: 1px solid #e5e7eb;
		padding: 16px 24px;
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: #6b7280;
		font-size: 14px;
		text-decoration: none;
		margin-bottom: 8px;
	}

	.back-link:hover {
		color: #3b82f6;
	}

	.header-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.scanner-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: #6b7280;
		font-size: 14px;
		text-decoration: none;
		padding: 6px 12px;
		background: #f3f4f6;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.scanner-link:hover {
		color: #3b82f6;
		background: #eff6ff;
	}

	.page-title {
		font-size: 24px;
		font-weight: 700;
		color: #1f2937;
	}

	.stats-bar {
		display: flex;
		gap: 24px;
		padding: 16px 24px;
		background: white;
		border-bottom: 1px solid #e5e7eb;
		max-width: 1200px;
		margin: 0 auto;
	}

	.stat {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 24px;
		font-weight: 700;
		color: #1f2937;
	}

	.stat-label {
		font-size: 12px;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.filters-bar {
		display: flex;
		gap: 16px;
		padding: 16px 24px;
		background: white;
		border-bottom: 1px solid #e5e7eb;
		max-width: 1200px;
		margin: 0 auto;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.filter-group label {
		font-size: 14px;
		color: #6b7280;
	}

	.filter-group select {
		padding: 8px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		font-size: 14px;
		background: white;
	}

	.discoveries-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
	}

	.loading-state,
	.error-state,
	.empty-state {
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

	.empty-icon {
		width: 64px;
		height: 64px;
		color: #d1d5db;
		margin-bottom: 16px;
	}

	.empty-state h3 {
		font-size: 18px;
		font-weight: 600;
		color: #4b5563;
		margin-bottom: 8px;
	}

	.empty-state p {
		color: #6b7280;
	}

	.empty-state a {
		color: #3b82f6;
	}

	.discoveries-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.discovery-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 20px;
		background: white;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
		text-decoration: none;
		transition: all 0.2s;
	}

	.discovery-card:hover {
		border-color: #3b82f6;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
	}

	.discovery-rank {
		font-size: 14px;
		font-weight: 600;
		color: #9ca3af;
		min-width: 40px;
	}

	.discovery-info {
		flex: 1;
	}

	.discovery-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 4px;
	}

	.feature-type {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.confidence-badge {
		font-size: 12px;
		font-weight: 600;
		color: white;
		padding: 2px 8px;
		border-radius: 12px;
	}

	.discovery-coords {
		font-size: 13px;
		color: #6b7280;
		font-family: monospace;
		margin-bottom: 8px;
	}

	.discovery-description {
		font-size: 14px;
		color: #4b5563;
		line-height: 1.4;
		margin-bottom: 8px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.discovery-meta {
		font-size: 12px;
		color: #9ca3af;
	}

	.discovery-action {
		display: flex;
		align-items: center;
		gap: 4px;
		color: #3b82f6;
		font-size: 14px;
		font-weight: 500;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 16px;
		margin-top: 24px;
	}

	.page-btn {
		padding: 8px 16px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		font-size: 14px;
		color: #4b5563;
		cursor: pointer;
		transition: all 0.2s;
	}

	.page-btn:hover:not(:disabled) {
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.page-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 14px;
		color: #6b7280;
	}
</style>
