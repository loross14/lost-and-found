<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import {
		getCategoryColor,
		getCategoryLabel,
		getStateName,
		type KnownSite,
		type NearbySite
	} from '$lib/types/known-sites';
	import {
		formatCoords,
		formatCoordsDMS,
		googleMapsUrl,
		googleMapsDirectionsUrl,
		nrhpUrl,
		staticMapUrl,
		osmUrl,
		wikipediaSearchUrl,
		formatDistanceMiles
	} from '$lib/utils/geo';

	let { data }: { data: PageData } = $props();

	const site = $derived(data.site as KnownSite | null);
	const nearbySites = $derived((data.nearbySites || []) as NearbySite[]);
	const error = $derived(data.error as string | null);

	// Generate meta info
	const pageTitle = $derived(
		site ? `${site.name} - Historic Site | Lost & Found` : 'Site Not Found | Lost & Found'
	);
	const pageDescription = $derived(
		site
			? `${site.name} in ${site.city ? site.city + ', ' : ''}${getStateName(site.state)}. ${site.siteType || 'Historic site'} listed on the National Register of Historic Places.`
			: 'Site not found.'
	);
	const ogImage = $derived(site ? staticMapUrl(site.lat, site.lng, 1200, 630, 16) : '');

	// Format location string
	function formatLocation(s: KnownSite): string {
		const parts = [];
		if (s.address) parts.push(s.address);
		if (s.city) parts.push(s.city);
		if (s.county) parts.push(s.county + ' County');
		parts.push(getStateName(s.state));
		return parts.join(', ');
	}

	// Format date for display
	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	// Navigate to another site
	function goToSite(id: string) {
		goto(`/sites/${id}`);
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	{#if site}
		<meta property="og:title" content={site.name} />
		<meta property="og:description" content={pageDescription} />
		<meta property="og:image" content={ogImage} />
		<meta property="og:type" content="website" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={site.name} />
		<meta name="twitter:description" content={pageDescription} />
		<meta name="twitter:image" content={ogImage} />
	{/if}
</svelte:head>

<div class="site-detail-page">
	{#if error || !site}
		<div class="error-container">
			<div class="error-content">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="error-icon"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h1>Site Not Found</h1>
				<p>{error || 'The requested site could not be found.'}</p>
				<a href="/" class="back-button">Back to Explorer</a>
			</div>
		</div>
	{:else}
		<!-- Hero Section with Satellite Image -->
		<div class="hero-section">
			<img
				src={staticMapUrl(site.lat, site.lng, 1200, 400, 17)}
				alt="Satellite view of {site.name}"
				class="hero-image"
			/>
			<div class="hero-overlay"></div>
			<div class="hero-content">
				<a href="/" class="back-link">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="back-icon"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						/>
					</svg>
					Back to Explorer
				</a>
				<div class="hero-text">
					<span class="category-badge" style="background-color: {getCategoryColor(site.category)}">
						{getCategoryLabel(site.category)}
					</span>
					<h1 class="site-name">{site.name}</h1>
					<p class="site-location">{formatLocation(site)}</p>
				</div>
			</div>
		</div>

		<div class="content-wrapper">
			<main class="main-content">
				<!-- Quick Info Cards -->
				<div class="info-grid">
					<div class="info-card">
						<div class="info-label">Site Type</div>
						<div class="info-value">{site.siteType || 'Not specified'}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Date Listed</div>
						<div class="info-value">{formatDate(site.dateListed)}</div>
					</div>
					<div class="info-card">
						<div class="info-label">NRHP Reference</div>
						<div class="info-value">{site.nrhpId}</div>
					</div>
					{#if site.architect}
						<div class="info-card">
							<div class="info-label">Architect/Builder</div>
							<div class="info-value">{site.architect}</div>
						</div>
					{/if}
				</div>

				<!-- Description -->
				{#if site.description || site.significance}
					<section class="section">
						<h2 class="section-title">About This Site</h2>
						{#if site.description}
							<p class="section-text">{site.description}</p>
						{/if}
						{#if site.significance}
							<div class="significance-block">
								<h3>Historical Significance</h3>
								<p>{site.significance}</p>
							</div>
						{/if}
					</section>
				{/if}

				<!-- Historical Context -->
				{#if site.timePeriod || site.culture}
					<section class="section">
						<h2 class="section-title">Historical Context</h2>
						<div class="context-grid">
							{#if site.timePeriod}
								<div class="context-item">
									<div class="context-label">Time Period</div>
									<div class="context-value">{site.timePeriod}</div>
								</div>
							{/if}
							{#if site.culture}
								<div class="context-item">
									<div class="context-label">Associated Culture</div>
									<div class="context-value">{site.culture}</div>
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Coordinates -->
				<section class="section">
					<h2 class="section-title">Location</h2>
					<div class="coords-block">
						<div class="coords-row">
							<span class="coords-label">Decimal:</span>
							<span class="coords-value">{formatCoords(site.lat, site.lng)}</span>
						</div>
						<div class="coords-row">
							<span class="coords-label">DMS:</span>
							<span class="coords-value">{formatCoordsDMS(site.lat, site.lng)}</span>
						</div>
					</div>
				</section>

				<!-- External Links -->
				<section class="section">
					<h2 class="section-title">External Resources</h2>
					<div class="links-grid">
						<a
							href={googleMapsUrl(site.lat, site.lng)}
							target="_blank"
							rel="noopener noreferrer"
							class="external-link"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="link-icon"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
								/>
							</svg>
							View on Google Maps
						</a>
						<a
							href={googleMapsDirectionsUrl(site.lat, site.lng)}
							target="_blank"
							rel="noopener noreferrer"
							class="external-link"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="link-icon"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
							Get Directions
						</a>
						<a
							href={osmUrl(site.lat, site.lng)}
							target="_blank"
							rel="noopener noreferrer"
							class="external-link"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="link-icon"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							OpenStreetMap
						</a>
						<a
							href={nrhpUrl(site.nrhpId)}
							target="_blank"
							rel="noopener noreferrer"
							class="external-link nrhp"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="link-icon"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
								/>
							</svg>
							NRHP Record
						</a>
						{#if site.wikipediaUrl}
							<a
								href={site.wikipediaUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="external-link"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="link-icon"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
									/>
								</svg>
								Wikipedia
							</a>
						{:else}
							<a
								href={wikipediaSearchUrl(site.name)}
								target="_blank"
								rel="noopener noreferrer"
								class="external-link"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="link-icon"
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
								Search Wikipedia
							</a>
						{/if}
					</div>
				</section>
			</main>

			<!-- Sidebar with Nearby Sites -->
			<aside class="sidebar">
				<div class="nearby-section">
					<h2 class="nearby-title">Nearby Historic Sites</h2>
					{#if nearbySites.length === 0}
						<p class="nearby-empty">No nearby sites found within 100 km.</p>
					{:else}
						<ul class="nearby-list">
							{#each nearbySites as nearby}
								<li class="nearby-item">
									<button class="nearby-link" onclick={() => goToSite(nearby.id)}>
										<div class="nearby-info">
											<span class="nearby-name">{nearby.name}</span>
											<span class="nearby-location">
												{nearby.city ? nearby.city + ', ' : ''}{nearby.state}
											</span>
										</div>
										<span class="nearby-distance">
											{formatDistanceMiles(nearby.distanceKm)}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<!-- Mini Map Placeholder -->
				<div class="mini-map-section">
					<h3 class="mini-map-title">Location Preview</h3>
					<img
						src={staticMapUrl(site.lat, site.lng, 300, 200, 14)}
						alt="Map showing location of {site.name}"
						class="mini-map"
					/>
				</div>
			</aside>
		</div>
	{/if}
</div>

<style>
	.site-detail-page {
		min-height: 100vh;
		background: #f8fafc;
	}

	/* Error State */
	.error-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 20px;
	}

	.error-content {
		text-align: center;
		max-width: 400px;
	}

	.error-icon {
		width: 64px;
		height: 64px;
		color: #9ca3af;
		margin-bottom: 16px;
	}

	.error-content h1 {
		font-size: 24px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 8px 0;
	}

	.error-content p {
		color: #6b7280;
		margin: 0 0 24px 0;
	}

	.back-button {
		display: inline-flex;
		padding: 12px 24px;
		background: #3b82f6;
		color: white;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 500;
		transition: background 0.2s;
	}

	.back-button:hover {
		background: #2563eb;
	}

	/* Hero Section */
	.hero-section {
		position: relative;
		height: 350px;
		overflow: hidden;
	}

	.hero-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.7) 100%);
	}

	.hero-content {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 20px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: white;
		text-decoration: none;
		font-size: 14px;
		opacity: 0.9;
		transition: opacity 0.2s;
	}

	.back-link:hover {
		opacity: 1;
	}

	.back-icon {
		width: 18px;
		height: 18px;
	}

	.hero-text {
		padding-bottom: 20px;
	}

	.category-badge {
		display: inline-block;
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		color: white;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 12px;
	}

	.site-name {
		font-size: 36px;
		font-weight: 700;
		color: white;
		margin: 0 0 8px 0;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.site-location {
		font-size: 16px;
		color: rgba(255, 255, 255, 0.9);
		margin: 0;
	}

	/* Content Layout */
	.content-wrapper {
		display: flex;
		gap: 32px;
		max-width: 1200px;
		margin: 0 auto;
		padding: 32px 20px 48px;
	}

	.main-content {
		flex: 1;
		min-width: 0;
	}

	.sidebar {
		width: 320px;
		flex-shrink: 0;
	}

	/* Info Grid */
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 32px;
	}

	.info-card {
		background: white;
		border-radius: 12px;
		padding: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.info-label {
		font-size: 12px;
		font-weight: 500;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 4px;
	}

	.info-value {
		font-size: 15px;
		font-weight: 600;
		color: #1f2937;
	}

	/* Sections */
	.section {
		background: white;
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 24px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.section-title {
		font-size: 18px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 16px 0;
	}

	.section-text {
		font-size: 15px;
		line-height: 1.7;
		color: #4b5563;
		margin: 0;
	}

	.significance-block {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid #e5e7eb;
	}

	.significance-block h3 {
		font-size: 14px;
		font-weight: 600;
		color: #374151;
		margin: 0 0 8px 0;
	}

	.significance-block p {
		font-size: 14px;
		line-height: 1.6;
		color: #6b7280;
		margin: 0;
	}

	/* Context */
	.context-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}

	.context-item {
		padding: 12px;
		background: #f9fafb;
		border-radius: 8px;
	}

	.context-label {
		font-size: 12px;
		font-weight: 500;
		color: #6b7280;
		margin-bottom: 4px;
	}

	.context-value {
		font-size: 14px;
		font-weight: 500;
		color: #1f2937;
	}

	/* Coordinates */
	.coords-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.coords-row {
		display: flex;
		gap: 12px;
		font-size: 14px;
	}

	.coords-label {
		font-weight: 500;
		color: #6b7280;
		min-width: 70px;
	}

	.coords-value {
		color: #1f2937;
		font-family: 'SF Mono', Monaco, monospace;
	}

	/* External Links */
	.links-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;
	}

	.external-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: #f3f4f6;
		border-radius: 8px;
		color: #374151;
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.external-link:hover {
		background: #e5e7eb;
		color: #1f2937;
	}

	.external-link.nrhp {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.external-link.nrhp:hover {
		background: #bfdbfe;
	}

	.link-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	/* Sidebar */
	.nearby-section {
		background: white;
		border-radius: 12px;
		padding: 20px;
		margin-bottom: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.nearby-title {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 16px 0;
	}

	.nearby-empty {
		font-size: 14px;
		color: #6b7280;
		margin: 0;
	}

	.nearby-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.nearby-item {
		border-bottom: 1px solid #f3f4f6;
	}

	.nearby-item:last-child {
		border-bottom: none;
	}

	.nearby-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 12px 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background 0.2s;
	}

	.nearby-link:hover {
		background: #f9fafb;
		margin: 0 -12px;
		padding-left: 12px;
		padding-right: 12px;
	}

	.nearby-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.nearby-name {
		font-size: 14px;
		font-weight: 500;
		color: #1f2937;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nearby-location {
		font-size: 12px;
		color: #6b7280;
	}

	.nearby-distance {
		font-size: 13px;
		font-weight: 500;
		color: #3b82f6;
		white-space: nowrap;
		margin-left: 12px;
	}

	/* Mini Map */
	.mini-map-section {
		background: white;
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.mini-map-title {
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 12px 0;
	}

	.mini-map {
		width: 100%;
		height: auto;
		border-radius: 8px;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.content-wrapper {
			flex-direction: column;
		}

		.sidebar {
			width: 100%;
		}
	}

	@media (max-width: 640px) {
		.hero-section {
			height: 280px;
		}

		.site-name {
			font-size: 24px;
		}

		.site-location {
			font-size: 14px;
		}

		.info-grid {
			grid-template-columns: 1fr 1fr;
		}

		.links-grid {
			grid-template-columns: 1fr;
		}

		.content-wrapper {
			padding: 20px 16px 32px;
		}
	}
</style>
