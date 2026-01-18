<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let discoveryCount = $state(0);
	let loading = $state(true);

	onMount(async () => {
		if (browser) {
			try {
				const res = await fetch('/api/discoveries?limit=1');
				const data = await res.json();
				if (data.success && data.stats) {
					discoveryCount = data.stats.pendingReview || 0;
				}
			} catch (e) {
				console.error('Failed to fetch discovery count:', e);
			} finally {
				loading = false;
			}
		}
	});
</script>

{#if !loading && discoveryCount > 0}
	<div class="upsell-banner">
		<div class="upsell-content">
			<div class="upsell-icon">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="icon"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
					/>
				</svg>
			</div>
			<div class="upsell-text">
				<p class="upsell-title">
					<strong>{discoveryCount.toLocaleString()}</strong> AI-discovered potential sites awaiting review
				</p>
				<p class="upsell-subtitle">Our scanner found sites not in the NRHP database</p>
			</div>
			<a href="/discoveries" class="upsell-btn">
				Explore Discoveries
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="arrow-icon"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</a>
		</div>
	</div>
{/if}

<style>
	.upsell-banner {
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		max-width: 650px;
		width: calc(100% - 340px);
	}

	.upsell-content {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 20px;
		background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%);
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
	}

	.upsell-icon {
		flex-shrink: 0;
		color: #fbbf24;
	}

	.upsell-icon .icon {
		width: 28px;
		height: 28px;
	}

	.upsell-text {
		flex: 1;
		min-width: 0;
	}

	.upsell-title {
		font-size: 14px;
		color: white;
		margin: 0;
	}

	.upsell-title strong {
		color: #fbbf24;
	}

	.upsell-subtitle {
		font-size: 12px;
		color: #93c5fd;
		margin: 2px 0 0 0;
	}

	.upsell-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 18px;
		background: #3b82f6;
		color: white;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.upsell-btn:hover {
		background: #2563eb;
		transform: translateY(-1px);
	}

	.arrow-icon {
		width: 16px;
		height: 16px;
	}

	@media (max-width: 900px) {
		.upsell-banner {
			width: calc(100% - 32px);
			left: 16px;
			transform: none;
		}
	}

	@media (max-width: 640px) {
		.upsell-content {
			flex-direction: column;
			text-align: center;
			gap: 12px;
		}

		.upsell-icon {
			display: none;
		}
	}
</style>
