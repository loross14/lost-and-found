<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { HOT_ZONES, formatEstimatedTime, type HotZone } from '$lib/data/hot-zones';

	interface ScanJob {
		id: string;
		name: string;
		regionType: string;
		status: 'queued' | 'scanning' | 'paused' | 'complete' | 'failed';
		progress: {
			totalTiles: number;
			scannedTiles: number;
			sitesFound: number;
		};
		startedAt: string | null;
		completedAt: string | null;
		createdAt: string;
	}

	let jobs: ScanJob[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedZone = $state<string>('');
	let startingJob = $state(false);

	let pollingInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		// Set up polling for active scans
		if (browser) {
			const activeJob = jobs.find(j => j.status === 'scanning');
			if (activeJob && !pollingInterval) {
				pollingInterval = setInterval(loadJobs, 5000);
			} else if (!activeJob && pollingInterval) {
				clearInterval(pollingInterval);
				pollingInterval = null;
			}
		}

		return () => {
			if (pollingInterval) {
				clearInterval(pollingInterval);
			}
		};
	});

	async function loadJobs() {
		try {
			const response = await fetch('/api/scanner');
			const data = await response.json();

			if (data.success) {
				jobs = data.jobs;
			}
		} catch (e) {
			console.error('Failed to load jobs:', e);
		} finally {
			loading = false;
		}
	}

	async function startScan() {
		if (!selectedZone) return;

		startingJob = true;
		error = null;

		try {
			const response = await fetch('/api/scanner', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					regionType: 'hot_zone',
					regionId: selectedZone
				})
			});

			const data = await response.json();

			if (data.success) {
				selectedZone = '';
				await loadJobs();
			} else {
				error = data.message;
			}
		} catch (e) {
			error = 'Failed to start scan';
			console.error(e);
		} finally {
			startingJob = false;
		}
	}

	async function controlScan(jobId: string, action: 'pause' | 'resume' | 'cancel') {
		try {
			const response = await fetch(`/api/scanner/${jobId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});

			const data = await response.json();

			if (data.success) {
				await loadJobs();
			} else {
				error = data.message;
			}
		} catch (e) {
			error = 'Failed to control scan';
			console.error(e);
		}
	}

	function getProgressPercent(job: ScanJob): number {
		if (job.progress.totalTiles === 0) return 0;
		return Math.round((job.progress.scannedTiles / job.progress.totalTiles) * 100);
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleString();
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'scanning': return 'badge-scanning';
			case 'paused': return 'badge-paused';
			case 'complete': return 'badge-complete';
			case 'failed': return 'badge-failed';
			default: return 'badge-queued';
		}
	}

	function getSelectedZoneInfo(): HotZone | undefined {
		return HOT_ZONES.find(z => z.id === selectedZone);
	}

	const activeJob = $derived(jobs.find(j => j.status === 'scanning' || j.status === 'paused'));
	const completedJobs = $derived(jobs.filter(j => j.status === 'complete'));

	onMount(() => {
		if (browser) {
			loadJobs();
		}
	});
</script>

<svelte:head>
	<title>Scanner Dashboard | Lost & Found</title>
</svelte:head>

<div class="scanner-page">
	<header class="page-header">
		<div class="header-content">
			<a href="/" class="back-link">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
				</svg>
				Back to Map
			</a>
			<h1 class="page-title">Scanner Dashboard</h1>
		</div>
	</header>

	<main class="scanner-content">
		{#if error}
			<div class="error-banner">
				<p>{error}</p>
				<button onclick={() => error = null}>Dismiss</button>
			</div>
		{/if}

		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading scanner status...</p>
			</div>
		{:else}
			<!-- Active Scan Section -->
			{#if activeJob}
				<section class="section">
					<h2 class="section-title">
						{activeJob.status === 'scanning' ? 'Active Scan' : 'Paused Scan'}
					</h2>
					<div class="active-job-card">
						<div class="job-header">
							<h3 class="job-name">{activeJob.name}</h3>
							<span class="status-badge {getStatusBadgeClass(activeJob.status)}">
								{activeJob.status}
							</span>
						</div>

						<div class="progress-section">
							<div class="progress-bar-container">
								<div
									class="progress-bar"
									style="width: {getProgressPercent(activeJob)}%"
								></div>
							</div>
							<div class="progress-stats">
								<span class="progress-percent">{getProgressPercent(activeJob)}%</span>
								<span class="progress-detail">
									{activeJob.progress.scannedTiles.toLocaleString()} / {activeJob.progress.totalTiles.toLocaleString()} tiles
								</span>
							</div>
						</div>

						<div class="job-stats">
							<div class="stat">
								<span class="stat-value">{activeJob.progress.sitesFound}</span>
								<span class="stat-label">Sites Found</span>
							</div>
							<div class="stat">
								<span class="stat-value">
									{formatEstimatedTime((activeJob.progress.totalTiles - activeJob.progress.scannedTiles) * 3 / 3600)}
								</span>
								<span class="stat-label">ETA</span>
							</div>
						</div>

						<div class="job-actions">
							{#if activeJob.status === 'scanning'}
								<button class="control-btn pause-btn" onclick={() => controlScan(activeJob.id, 'pause')}>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
									</svg>
									Pause Scan
								</button>
							{:else}
								<button class="control-btn resume-btn" onclick={() => controlScan(activeJob.id, 'resume')}>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
									</svg>
									Resume Scan
								</button>
							{/if}
							<button class="control-btn cancel-btn" onclick={() => controlScan(activeJob.id, 'cancel')}>
								Cancel
							</button>
						</div>
					</div>
				</section>
			{/if}

			<!-- Start New Scan Section -->
			<section class="section">
				<h2 class="section-title">Start New Scan</h2>
				<div class="new-scan-card">
					<p class="scan-description">
						Select a hot zone to begin systematic scanning for archaeological features.
						Scans can take several hours for large regions.
					</p>

					<div class="zone-selector">
						<label for="zone-select">Select Region:</label>
						<select id="zone-select" bind:value={selectedZone} disabled={!!activeJob}>
							<option value="">Choose a hot zone...</option>
							{#each HOT_ZONES.sort((a, b) => a.priority - b.priority) as zone}
								<option value={zone.id}>
									{zone.name} ({formatEstimatedTime(zone.estimatedHours)})
								</option>
							{/each}
						</select>
					</div>

					{#if selectedZone}
						{@const zoneInfo = getSelectedZoneInfo()}
						{#if zoneInfo}
							<div class="zone-info">
								<h4>{zoneInfo.name}</h4>
								<p class="zone-description">{zoneInfo.description}</p>
								<div class="zone-stats">
									<span>Priority: {zoneInfo.priority}</span>
									<span>Est. tiles: {zoneInfo.estimatedTiles.toLocaleString()}</span>
									<span>Known sites: {zoneInfo.knownSiteCount}</span>
									<span>Cultures: {zoneInfo.cultures.join(', ')}</span>
								</div>
							</div>
						{/if}
					{/if}

					<button
						class="start-btn"
						onclick={startScan}
						disabled={!selectedZone || startingJob || !!activeJob}
					>
						{#if startingJob}
							Starting...
						{:else if activeJob}
							Scan in Progress
						{:else}
							Start Scan
						{/if}
					</button>

					{#if activeJob}
						<p class="scan-warning">
							Please wait for the current scan to complete or pause it before starting a new one.
						</p>
					{/if}
				</div>
			</section>

			<!-- Completed Scans Section -->
			{#if completedJobs.length > 0}
				<section class="section">
					<h2 class="section-title">Completed Scans</h2>
					<div class="completed-list">
						{#each completedJobs as job (job.id)}
							<div class="completed-job-card">
								<div class="completed-job-info">
									<h4>{job.name}</h4>
									<p class="completed-date">Completed: {formatDate(job.completedAt)}</p>
								</div>
								<div class="completed-job-stats">
									<span class="sites-found">{job.progress.sitesFound} sites found</span>
									<span class="tiles-scanned">{job.progress.scannedTiles.toLocaleString()} tiles</span>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Link to Discoveries -->
			<section class="section">
				<a href="/discoveries" class="discoveries-link">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
					</svg>
					<div>
						<h3>Review Discoveries</h3>
						<p>View and verify potential archaeological sites</p>
					</div>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 arrow" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					</svg>
				</a>
			</section>
		{/if}
	</main>
</div>

<style>
	.scanner-page {
		min-height: 100vh;
		background: #f9fafb;
	}

	.page-header {
		background: white;
		border-bottom: 1px solid #e5e7eb;
		padding: 16px 24px;
	}

	.header-content {
		max-width: 800px;
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

	.page-title {
		font-size: 24px;
		font-weight: 700;
		color: #1f2937;
	}

	.scanner-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 24px;
	}

	.error-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		margin-bottom: 24px;
		color: #dc2626;
	}

	.error-banner button {
		color: #dc2626;
		font-weight: 500;
	}

	.loading-state {
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

	.section {
		margin-bottom: 32px;
	}

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 16px;
	}

	.active-job-card,
	.new-scan-card {
		background: white;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
		padding: 24px;
	}

	.job-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.job-name {
		font-size: 18px;
		font-weight: 600;
		color: #1f2937;
	}

	.status-badge {
		font-size: 12px;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: 16px;
		text-transform: uppercase;
	}

	.badge-scanning {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.badge-paused {
		background: #fef3c7;
		color: #b45309;
	}

	.badge-complete {
		background: #d1fae5;
		color: #047857;
	}

	.badge-failed {
		background: #fee2e2;
		color: #dc2626;
	}

	.badge-queued {
		background: #f3f4f6;
		color: #6b7280;
	}

	.progress-section {
		margin-bottom: 20px;
	}

	.progress-bar-container {
		height: 8px;
		background: #e5e7eb;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 8px;
	}

	.progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #8b5cf6);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.progress-stats {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
	}

	.progress-percent {
		font-weight: 600;
		color: #1f2937;
	}

	.progress-detail {
		color: #6b7280;
	}

	.job-stats {
		display: flex;
		gap: 32px;
		margin-bottom: 20px;
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
	}

	.job-actions {
		display: flex;
		gap: 12px;
	}

	.control-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.pause-btn {
		background: #fef3c7;
		color: #b45309;
	}

	.pause-btn:hover {
		background: #fde68a;
	}

	.resume-btn {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.resume-btn:hover {
		background: #bfdbfe;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #6b7280;
	}

	.cancel-btn:hover {
		background: #e5e7eb;
	}

	.scan-description {
		font-size: 14px;
		color: #6b7280;
		margin-bottom: 20px;
	}

	.zone-selector {
		margin-bottom: 20px;
	}

	.zone-selector label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: #4b5563;
		margin-bottom: 8px;
	}

	.zone-selector select {
		width: 100%;
		padding: 12px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 14px;
		background: white;
	}

	.zone-selector select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.zone-info {
		background: #f9fafb;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 20px;
	}

	.zone-info h4 {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
		margin-bottom: 8px;
	}

	.zone-description {
		font-size: 14px;
		color: #4b5563;
		margin-bottom: 12px;
	}

	.zone-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		font-size: 12px;
		color: #6b7280;
	}

	.zone-stats span {
		background: white;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.start-btn {
		width: 100%;
		padding: 14px;
		background: #3b82f6;
		color: white;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.start-btn:hover:not(:disabled) {
		background: #2563eb;
	}

	.start-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.scan-warning {
		font-size: 13px;
		color: #b45309;
		text-align: center;
		margin-top: 12px;
	}

	.completed-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.completed-job-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		background: white;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.completed-job-info h4 {
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
	}

	.completed-date {
		font-size: 12px;
		color: #6b7280;
	}

	.completed-job-stats {
		display: flex;
		gap: 16px;
		font-size: 13px;
	}

	.sites-found {
		color: #059669;
		font-weight: 500;
	}

	.tiles-scanned {
		color: #6b7280;
	}

	.discoveries-link {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		background: white;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
		text-decoration: none;
		transition: all 0.2s;
	}

	.discoveries-link:hover {
		border-color: #3b82f6;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
	}

	.discoveries-link h3 {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
	}

	.discoveries-link p {
		font-size: 14px;
		color: #6b7280;
	}

	.discoveries-link .arrow {
		margin-left: auto;
		color: #9ca3af;
	}

	.discoveries-link:hover .arrow {
		color: #3b82f6;
	}
</style>
