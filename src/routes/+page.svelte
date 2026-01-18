<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import SiteMap from '$lib/components/SiteMap.svelte';
	import DiscoveryUpsell from '$lib/components/DiscoveryUpsell.svelte';
	import type { BoundingBox } from '$lib/types';
	import { type KnownSiteSummary, US_STATES, SITE_CATEGORIES } from '$lib/types/known-sites';

	let mapComponent: SiteMap | undefined = $state();
	let mounted = $state(false);
	let loading = $state(false);
	let showFilters = $state(true);

	// Sites data
	let sites = $state<KnownSiteSummary[]>([]);
	let sitesInView = $state(0);
	let totalSites = $state(0);

	// Filters
	let selectedStates = $state<string[]>([]);
	let selectedTypes = $state<string[]>([]);
	let searchQuery = $state('');
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Current bbox
	let currentBbox = $state<BoundingBox | null>(null);

	// Satellite toggle
	let satelliteView = $state(false);

	$effect(() => {
		if (browser) {
			mounted = true;
			loadStats();
		}
	});

	async function loadStats() {
		try {
			const res = await fetch('/api/sites/stats');
			const data = await res.json();
			if (data.success) {
				totalSites = data.stats.total;
			}
		} catch (e) {
			console.error('Failed to load stats:', e);
		}
	}

	async function loadSites(bbox: BoundingBox) {
		loading = true;
		try {
			const params = new URLSearchParams({
				north: bbox.north.toString(),
				south: bbox.south.toString(),
				east: bbox.east.toString(),
				west: bbox.west.toString(),
				limit: '1500'
			});

			if (selectedStates.length > 0) {
				params.set('states', selectedStates.join(','));
			}
			if (selectedTypes.length > 0) {
				params.set('types', selectedTypes.join(','));
			}
			if (searchQuery.trim()) {
				params.set('search', searchQuery.trim());
			}

			const res = await fetch(`/api/sites?${params}`);
			const data = await res.json();

			if (data.success) {
				sites = data.sites;
				sitesInView = sites.length;
				mapComponent?.updateSites(sites);
			}
		} catch (e) {
			console.error('Failed to load sites:', e);
		} finally {
			loading = false;
		}
	}

	function handleBoundsChange(bbox: BoundingBox) {
		currentBbox = bbox;
		loadSites(bbox);
	}

	function handleSiteClick(site: KnownSiteSummary) {
		goto(`/sites/${site.id}`);
	}

	function handleFilterChange() {
		if (currentBbox) {
			loadSites(currentBbox);
		}
	}

	function handleSearchInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		searchQuery = value;

		// Debounce search
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			handleFilterChange();
		}, 400);
	}

	function handleStateChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		if (value && !selectedStates.includes(value)) {
			selectedStates = [...selectedStates, value];
			handleFilterChange();
		}
		(event.target as HTMLSelectElement).value = '';
	}

	function removeState(stateCode: string) {
		selectedStates = selectedStates.filter((s) => s !== stateCode);
		handleFilterChange();
	}

	function handleTypeToggle(type: string) {
		if (selectedTypes.includes(type)) {
			selectedTypes = selectedTypes.filter((t) => t !== type);
		} else {
			selectedTypes = [...selectedTypes, type];
		}
		handleFilterChange();
	}

	function clearFilters() {
		selectedStates = [];
		selectedTypes = [];
		searchQuery = '';
		handleFilterChange();
	}

	function toggleSatellite() {
		mapComponent?.toggleSatellite();
		satelliteView = mapComponent?.isSatelliteView() ?? false;
	}

	const hasActiveFilters = $derived(
		selectedStates.length > 0 || selectedTypes.length > 0 || searchQuery.trim() !== ''
	);
</script>

<svelte:head>
	<title>Lost & Found | Explore Historic Sites</title>
	<meta
		name="description"
		content="Explore over 90,000 historic places from the National Register of Historic Places. Interactive map with filtering and search."
	/>
	<meta property="og:title" content="Lost & Found | Explore Historic Sites" />
	<meta
		property="og:description"
		content="Discover America's archaeological and historic heritage with our interactive explorer."
	/>
</svelte:head>

<main class="explorer-container">
	{#if mounted}
		<SiteMap
			bind:this={mapComponent}
			onBoundsChange={handleBoundsChange}
			onSiteClick={handleSiteClick}
		/>
	{/if}

	<!-- Filter Panel -->
	<aside class="filter-panel" class:collapsed={!showFilters}>
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
					<p class="app-subtitle">Historic Site Explorer</p>
				</div>
			</div>
			<button class="toggle-btn" onclick={() => (showFilters = !showFilters)}>
				{showFilters ? '−' : '+'}
			</button>
		</header>

		{#if showFilters}
			<!-- Search -->
			<section class="panel-section">
				<div class="search-wrapper">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="search-icon"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="search"
						placeholder="Search sites..."
						value={searchQuery}
						oninput={handleSearchInput}
						class="search-input"
					/>
				</div>
			</section>

			<!-- Map View Toggle -->
			<section class="panel-section">
				<h2 class="section-title">Map View</h2>
				<label class="view-toggle">
					<input type="checkbox" checked={satelliteView} onchange={toggleSatellite} />
					<span class="toggle-indicator"></span>
					<span class="toggle-label">Satellite View</span>
				</label>
			</section>

			<!-- State Filter -->
			<section class="panel-section">
				<h2 class="section-title">Filter by State</h2>
				<select class="state-select" onchange={handleStateChange}>
					<option value="">Select state...</option>
					{#each US_STATES as state}
						<option value={state.code} disabled={selectedStates.includes(state.code)}>
							{state.name}
						</option>
					{/each}
				</select>

				{#if selectedStates.length > 0}
					<div class="selected-tags">
						{#each selectedStates as state}
							<button class="tag" onclick={() => removeState(state)}>
								{state}
								<span class="tag-remove">×</span>
							</button>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Type Filter -->
			<section class="panel-section">
				<h2 class="section-title">Site Type</h2>
				<div class="type-checkboxes">
					{#each SITE_CATEGORIES as category}
						<label class="type-checkbox">
							<input
								type="checkbox"
								checked={selectedTypes.includes(category.value)}
								onchange={() => handleTypeToggle(category.value)}
							/>
							<span class="checkbox-indicator" style="background-color: {category.color}"></span>
							<span class="checkbox-label">{category.label}</span>
						</label>
					{/each}
				</div>
			</section>

			<!-- Stats -->
			<section class="panel-section stats-section">
				<div class="stat">
					<span class="stat-value">{sitesInView.toLocaleString()}</span>
					<span class="stat-label">In View</span>
				</div>
				<div class="stat">
					<span class="stat-value">{totalSites.toLocaleString()}</span>
					<span class="stat-label">Total Sites</span>
				</div>
			</section>

			{#if hasActiveFilters}
				<section class="panel-section">
					<button class="clear-filters-btn" onclick={clearFilters}> Clear All Filters </button>
				</section>
			{/if}

			<!-- Loading indicator -->
			{#if loading}
				<div class="loading-indicator">
					<div class="loading-spinner"></div>
					<span>Loading sites...</span>
				</div>
			{/if}

			<!-- Navigation Links -->
			<section class="panel-section nav-section">
				<a href="/scanner" class="nav-link">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="nav-icon"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z"
							clip-rule="evenodd"
						/>
						<path
							d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM16 13a1 1 0 100 2v2a1 1 0 102 0v-2a1 1 0 00-2 0zM13 13a1 1 0 100 2h4a1 1 0 100-2h-4z"
						/>
					</svg>
					<span>Scanner Dashboard</span>
				</a>
				<a href="/discoveries" class="nav-link">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="nav-icon"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"
						/>
						<path
							fill-rule="evenodd"
							d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
							clip-rule="evenodd"
						/>
					</svg>
					<span>AI Discoveries</span>
				</a>
			</section>
		{/if}
	</aside>

	<!-- Upsell Banner -->
	<DiscoveryUpsell />
</main>

<style>
	.explorer-container {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}

	.filter-panel {
		position: absolute;
		top: 16px;
		left: 16px;
		width: 280px;
		max-height: calc(100vh - 100px);
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		overflow-y: auto;
		z-index: 1000;
		transition: width 0.2s;
	}

	.filter-panel.collapsed {
		width: auto;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 16px;
		border-bottom: 1px solid #e5e7eb;
		position: sticky;
		top: 0;
		background: white;
		z-index: 1;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.logo-icon {
		width: 26px;
		height: 26px;
		color: #d97706;
	}

	.logo-text {
		display: flex;
		flex-direction: column;
	}

	.app-name {
		font-size: 17px;
		font-weight: 700;
		color: #1f2937;
		line-height: 1.2;
	}

	.app-subtitle {
		font-size: 11px;
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
		flex-shrink: 0;
	}

	.toggle-btn:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.panel-section {
		padding: 14px 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.panel-section:last-child {
		border-bottom: none;
	}

	.section-title {
		font-size: 11px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 10px;
	}

	.search-wrapper {
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		width: 18px;
		height: 18px;
		color: #9ca3af;
	}

	.search-input {
		width: 100%;
		padding: 10px 12px 10px 36px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 14px;
		transition: all 0.2s;
	}

	.search-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.view-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		background: #f9fafb;
		border-radius: 8px;
		cursor: pointer;
	}

	.view-toggle input {
		display: none;
	}

	.toggle-indicator {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		background: #3b82f6;
		opacity: 0.3;
		transition: opacity 0.2s;
	}

	.view-toggle input:checked + .toggle-indicator {
		opacity: 1;
	}

	.toggle-label {
		font-size: 14px;
		color: #374151;
	}

	.state-select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 14px;
		background: white;
		cursor: pointer;
	}

	.state-select:focus {
		outline: none;
		border-color: #3b82f6;
	}

	.selected-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}

	.tag {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: #eff6ff;
		color: #3b82f6;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tag:hover {
		background: #dbeafe;
	}

	.tag-remove {
		font-size: 14px;
		font-weight: 400;
	}

	.type-checkboxes {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.type-checkbox {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.type-checkbox:hover {
		background: #f9fafb;
	}

	.type-checkbox input {
		display: none;
	}

	.checkbox-indicator {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		opacity: 0.3;
		transition: opacity 0.2s;
	}

	.type-checkbox input:checked + .checkbox-indicator {
		opacity: 1;
	}

	.checkbox-label {
		font-size: 13px;
		color: #374151;
	}

	.stats-section {
		display: flex;
		gap: 12px;
	}

	.stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10px;
		background: #f9fafb;
		border-radius: 8px;
	}

	.stat-value {
		font-size: 18px;
		font-weight: 700;
		color: #1f2937;
	}

	.stat-label {
		font-size: 10px;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.clear-filters-btn {
		width: 100%;
		padding: 10px;
		background: #f3f4f6;
		border-radius: 8px;
		font-size: 13px;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-filters-btn:hover {
		background: #e5e7eb;
		color: #4b5563;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		font-size: 13px;
		color: #6b7280;
		background: #f9fafb;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #e5e7eb;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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
		background: #f9fafb;
		border-radius: 8px;
		text-decoration: none;
		color: #4b5563;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.nav-link:hover {
		background: #eff6ff;
		color: #3b82f6;
	}

	.nav-icon {
		width: 18px;
		height: 18px;
		color: #9ca3af;
	}

	.nav-link:hover .nav-icon {
		color: #3b82f6;
	}
</style>
