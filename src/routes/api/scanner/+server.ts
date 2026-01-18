/**
 * Scanner API endpoints
 * POST /api/scanner - Start a new scan
 * GET /api/scanner - List all scan jobs
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createScanJob, getAllScanJobs, runScan, type ScanJob } from '$lib/services/scanner';
import { getHotZone } from '$lib/data/hot-zones';
import type { BoundingBox } from '$lib/types';
import { ANTHROPIC_API_KEY } from '$env/static/private';

interface StartScanRequest {
	name?: string;
	regionType: 'hot_zone' | 'custom';
	regionId?: string;  // For hot_zone type
	bbox?: BoundingBox;  // For custom type
	zoomLevel?: number;
}

export const GET: RequestHandler = async () => {
	try {
		const jobs = await getAllScanJobs();
		return json({ success: true, jobs });
	} catch (error) {
		console.error('Failed to fetch scan jobs:', error);
		return json({
			success: false,
			message: 'Failed to fetch scan jobs'
		}, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: StartScanRequest = await request.json();
		const { regionType, regionId, bbox: customBbox, zoomLevel } = body;

		// Check for API key
		if (!ANTHROPIC_API_KEY) {
			return json({
				success: false,
				message: 'ML analysis not configured. Set ANTHROPIC_API_KEY to enable scanning.'
			}, { status: 400 });
		}

		let bbox: BoundingBox;
		let name: string;

		if (regionType === 'hot_zone') {
			if (!regionId) {
				return json({
					success: false,
					message: 'regionId is required for hot_zone scans'
				}, { status: 400 });
			}

			const hotZone = getHotZone(regionId);
			if (!hotZone) {
				return json({
					success: false,
					message: `Hot zone '${regionId}' not found`
				}, { status: 404 });
			}

			bbox = hotZone.bbox;
			name = body.name || `Scan: ${hotZone.name}`;
		} else if (regionType === 'custom') {
			if (!customBbox) {
				return json({
					success: false,
					message: 'bbox is required for custom scans'
				}, { status: 400 });
			}

			bbox = customBbox;
			name = body.name || 'Custom Region Scan';
		} else {
			return json({
				success: false,
				message: 'Invalid regionType. Must be "hot_zone" or "custom"'
			}, { status: 400 });
		}

		// Create the scan job
		const job = await createScanJob(
			name,
			bbox,
			regionType,
			regionId || null,
			{ zoomLevel: zoomLevel || 17 }
		);

		// Start the scan in the background
		// Note: In production, this would be handled by a queue/worker
		// For now, we start it but don't await it
		runScan(job.id).catch(error => {
			console.error(`Background scan ${job.id} failed:`, error);
		});

		return json({
			success: true,
			job,
			message: `Scan started: ${job.progress.totalTiles} tiles to process`
		});

	} catch (error) {
		console.error('Failed to start scan:', error);
		return json({
			success: false,
			message: 'Failed to start scan'
		}, { status: 500 });
	}
};
