/**
 * Individual scan job endpoints
 * GET /api/scanner/[jobId] - Get scan status
 * POST /api/scanner/[jobId] - Control scan (pause/resume)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getScanJob, pauseScan, runScan, updateScanJobStatus, estimateTimeRemaining } from '$lib/services/scanner';

export const GET: RequestHandler = async ({ params }) => {
	const { jobId } = params;

	try {
		const job = await getScanJob(jobId);

		if (!job) {
			return json({
				success: false,
				message: 'Scan job not found'
			}, { status: 404 });
		}

		return json({
			success: true,
			job,
			eta: job.status === 'scanning' ? estimateTimeRemaining(job) : null
		});

	} catch (error) {
		console.error('Failed to get scan job:', error);
		return json({
			success: false,
			message: 'Failed to get scan job'
		}, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { jobId } = params;

	try {
		const body = await request.json();
		const { action } = body as { action: 'pause' | 'resume' | 'cancel' };

		const job = await getScanJob(jobId);
		if (!job) {
			return json({
				success: false,
				message: 'Scan job not found'
			}, { status: 404 });
		}

		switch (action) {
			case 'pause':
				if (job.status !== 'scanning') {
					return json({
						success: false,
						message: 'Can only pause a running scan'
					}, { status: 400 });
				}
				await pauseScan(jobId);
				return json({
					success: true,
					message: 'Scan paused'
				});

			case 'resume':
				if (job.status !== 'paused') {
					return json({
						success: false,
						message: 'Can only resume a paused scan'
					}, { status: 400 });
				}
				// Resume in background
				runScan(jobId).catch(error => {
					console.error(`Failed to resume scan ${jobId}:`, error);
				});
				return json({
					success: true,
					message: 'Scan resumed'
				});

			case 'cancel':
				if (job.status === 'complete' || job.status === 'failed') {
					return json({
						success: false,
						message: 'Cannot cancel a completed scan'
					}, { status: 400 });
				}
				await updateScanJobStatus(jobId, 'failed', {
					error_message: 'Cancelled by user'
				});
				return json({
					success: true,
					message: 'Scan cancelled'
				});

			default:
				return json({
					success: false,
					message: 'Invalid action. Must be "pause", "resume", or "cancel"'
				}, { status: 400 });
		}

	} catch (error) {
		console.error('Failed to control scan:', error);
		return json({
			success: false,
			message: 'Failed to control scan'
		}, { status: 500 });
	}
};
