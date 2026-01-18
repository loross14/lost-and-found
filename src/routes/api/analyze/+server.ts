import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { BoundingBox, Site } from '$lib/types';
import { validateRegionSize, calculateArea } from '$lib/utils/geo';
import { supabase } from '$lib/supabase';
import { fetchRegionAsImage } from '$lib/services/naip';
import { analyzeRegion } from '$lib/services/analyzer';
import { ANTHROPIC_API_KEY } from '$env/static/private';

interface AnalyzeRequest {
	bbox: BoundingBox;
}

interface AnalyzeResponse {
	success: boolean;
	jobId?: string;
	message?: string;
	stats?: {
		area: number;
		tileCount: number;
		processingTime?: number;
	};
	existingSites?: Site[];
	newSites?: Array<{
		id: string;
		lat: number;
		lng: number;
		featureType: string;
		confidence: number;
		description: string;
	}>;
	assessment?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: AnalyzeRequest = await request.json();
		const { bbox } = body;

		// Validate input
		if (!bbox || typeof bbox.north !== 'number' || typeof bbox.south !== 'number' ||
			typeof bbox.east !== 'number' || typeof bbox.west !== 'number') {
			return json({
				success: false,
				message: 'Invalid bounding box. Must include north, south, east, and west coordinates.'
			} satisfies AnalyzeResponse, { status: 400 });
		}

		// Validate bounds are in correct order
		if (bbox.north <= bbox.south) {
			return json({
				success: false,
				message: 'North coordinate must be greater than south coordinate.'
			} satisfies AnalyzeResponse, { status: 400 });
		}

		if (bbox.east <= bbox.west) {
			return json({
				success: false,
				message: 'East coordinate must be greater than west coordinate.'
			} satisfies AnalyzeResponse, { status: 400 });
		}

		// Validate region size
		const validation = validateRegionSize(bbox);
		if (!validation.valid) {
			return json({
				success: false,
				message: validation.message
			} satisfies AnalyzeResponse, { status: 400 });
		}

		// Create analysis job record
		const { data: job, error: jobError } = await supabase
			.from('analysis_jobs')
			.insert({
				north: bbox.north,
				south: bbox.south,
				east: bbox.east,
				west: bbox.west,
				status: 'fetching',
				total_tiles: validation.tileCount,
				started_at: new Date().toISOString()
			})
			.select()
			.single();

		if (jobError) {
			console.error('Failed to create analysis job:', jobError);
			// Continue anyway - job tracking is not critical
		}

		const jobId = job?.id || crypto.randomUUID();

		// Query existing sites within the bounding box
		const { data: existingSites, error: fetchError } = await supabase
			.from('sites')
			.select('*')
			.gte('lat', bbox.south)
			.lte('lat', bbox.north)
			.gte('lng', bbox.west)
			.lte('lng', bbox.east);

		if (fetchError) {
			console.error('Error fetching existing sites:', fetchError);
		}

		// Transform existing sites
		const existingSitesList: Site[] = (existingSites || []).map((row) => ({
			id: row.id,
			name: row.name,
			coordinates: { lat: row.lat, lng: row.lng },
			status: row.status,
			description: row.description,
			dateDiscovered: row.date_discovered,
			culture: row.culture,
			timePeriod: row.time_period,
			features: row.features,
			imageUrl: row.image_url,
			sourceUrl: row.source_url
		}));

		// Check if we have an API key for ML analysis
		if (!ANTHROPIC_API_KEY) {
			console.warn('ANTHROPIC_API_KEY not set - skipping ML analysis');
			return json({
				success: true,
				jobId,
				stats: {
					area: validation.area,
					tileCount: validation.tileCount
				},
				existingSites: existingSitesList,
				newSites: [],
				assessment: 'ML analysis skipped - API key not configured',
				message: `Found ${existingSitesList.length} existing sites. ML analysis requires ANTHROPIC_API_KEY.`
			} satisfies AnalyzeResponse);
		}

		// Update job status
		if (job) {
			await supabase
				.from('analysis_jobs')
				.update({ status: 'fetching' })
				.eq('id', jobId);
		}

		// Fetch satellite imagery for the region
		let imageData: ArrayBuffer;
		let imageSource: 'naip' | 'esri';

		try {
			const result = await fetchRegionAsImage(bbox, 1024, 1024);
			imageData = result.imageData;
			imageSource = result.source;
			console.log(`Fetched imagery from ${imageSource} for analysis`);
		} catch (fetchImageError) {
			console.error('Failed to fetch imagery:', fetchImageError);

			if (job) {
				await supabase
					.from('analysis_jobs')
					.update({
						status: 'failed',
						error_message: 'Failed to fetch satellite imagery',
						completed_at: new Date().toISOString()
					})
					.eq('id', jobId);
			}

			return json({
				success: false,
				jobId,
				message: 'Failed to fetch satellite imagery for this region. Please try again.'
			} satisfies AnalyzeResponse, { status: 500 });
		}

		// Update job status to analyzing
		if (job) {
			await supabase
				.from('analysis_jobs')
				.update({ status: 'analyzing', processed_tiles: 1 })
				.eq('id', jobId);
		}

		// Run ML analysis
		let analysisResult;
		try {
			analysisResult = await analyzeRegion(imageData, bbox);
			console.log(`Analysis complete: found ${analysisResult.sites.length} potential features`);
		} catch (analysisError) {
			console.error('ML analysis failed:', analysisError);

			if (job) {
				await supabase
					.from('analysis_jobs')
					.update({
						status: 'failed',
						error_message: `ML analysis failed: ${analysisError}`,
						completed_at: new Date().toISOString()
					})
					.eq('id', jobId);
			}

			return json({
				success: false,
				jobId,
				message: 'ML analysis failed. Please try again.'
			} satisfies AnalyzeResponse, { status: 500 });
		}

		// Filter out sites that are too close to existing known sites
		const newSites = analysisResult.sites.filter(site => {
			const tooCloseToKnown = existingSitesList.some(existing => {
				const latDiff = Math.abs(existing.coordinates.lat - site.lat);
				const lngDiff = Math.abs(existing.coordinates.lng - site.lng);
				// Within ~100m
				return latDiff < 0.001 && lngDiff < 0.001;
			});
			return !tooCloseToKnown;
		});

		// Insert new potential sites into database
		const insertedSites: Array<{
			id: string;
			lat: number;
			lng: number;
			featureType: string;
			confidence: number;
			description: string;
		}> = [];

		for (const site of newSites) {
			// Only insert if confidence is above threshold
			if (site.confidence < 0.3) continue;

			const { data: inserted, error: insertError } = await supabase
				.from('sites')
				.insert({
					name: `Potential ${site.featureType}`,
					lat: site.lat,
					lng: site.lng,
					status: 'potential',
					feature_type: site.featureType,
					confidence: site.confidence,
					size_meters: site.sizeMeters,
					description: site.description,
					ml_model: analysisResult.model,
					analysis_job_id: job?.id
				})
				.select()
				.single();

			if (insertError) {
				console.error('Failed to insert potential site:', insertError);
			} else if (inserted) {
				insertedSites.push({
					id: inserted.id,
					lat: inserted.lat,
					lng: inserted.lng,
					featureType: inserted.feature_type,
					confidence: inserted.confidence,
					description: inserted.description
				});
			}
		}

		// Update job as complete
		if (job) {
			await supabase
				.from('analysis_jobs')
				.update({
					status: 'complete',
					results_count: insertedSites.length,
					completed_at: new Date().toISOString()
				})
				.eq('id', jobId);
		}

		return json({
			success: true,
			jobId,
			stats: {
				area: validation.area,
				tileCount: validation.tileCount,
				processingTime: analysisResult.processingTime
			},
			existingSites: existingSitesList,
			newSites: insertedSites,
			assessment: analysisResult.assessment,
			message: `Analysis complete. Found ${existingSitesList.length} existing sites and ${insertedSites.length} new potential sites.`
		} satisfies AnalyzeResponse);

	} catch (error) {
		console.error('Analyze API error:', error);
		return json({
			success: false,
			message: 'An unexpected error occurred during analysis.'
		} satisfies AnalyzeResponse, { status: 500 });
	}
};
