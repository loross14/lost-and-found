/**
 * Discoveries API endpoints
 * GET /api/discoveries - List potential sites (paginated, filterable)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';

export interface Discovery {
	id: string;
	name: string;
	lat: number;
	lng: number;
	featureType: string | null;
	confidence: number | null;
	sizeMeters: number | null;
	description: string | null;
	mlReasoning: string | null;
	reviewStatus: 'pending' | 'verified' | 'rejected' | 'skipped';
	tileZ: number | null;
	tileX: number | null;
	tileY: number | null;
	createdAt: string;
}

export interface DiscoveryStats {
	totalPotential: number;
	pendingReview: number;
	verified: number;
	rejected: number;
	avgConfidence: number | null;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const status = url.searchParams.get('status') || 'pending';  // pending, verified, rejected, all
		const sortBy = url.searchParams.get('sortBy') || 'confidence';  // confidence, date, type
		const sortOrder = url.searchParams.get('sortOrder') || 'desc';
		const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0');

		const offset = (page - 1) * limit;

		// Build query
		let query = supabase
			.from('sites')
			.select('*', { count: 'exact' })
			.eq('status', 'potential');

		// Filter by review status
		if (status !== 'all') {
			query = query.eq('review_status', status);
		}

		// Filter by minimum confidence
		if (minConfidence > 0) {
			query = query.gte('confidence', minConfidence);
		}

		// Sort
		const sortColumn = sortBy === 'date' ? 'created_at' : sortBy === 'type' ? 'feature_type' : 'confidence';
		query = query.order(sortColumn, { ascending: sortOrder === 'asc', nullsFirst: false });

		// Paginate
		query = query.range(offset, offset + limit - 1);

		const { data, error, count } = await query;

		if (error) {
			throw error;
		}

		// Transform to Discovery type
		const discoveries: Discovery[] = (data || []).map(row => ({
			id: row.id,
			name: row.name,
			lat: row.lat,
			lng: row.lng,
			featureType: row.feature_type,
			confidence: row.confidence,
			sizeMeters: row.size_meters,
			description: row.description,
			mlReasoning: row.ml_reasoning,
			reviewStatus: row.review_status,
			tileZ: row.tile_z,
			tileX: row.tile_x,
			tileY: row.tile_y,
			createdAt: row.created_at
		}));

		// Get stats
		const { data: statsData } = await supabase.rpc('get_discovery_stats');
		const stats: DiscoveryStats = statsData ? {
			totalPotential: statsData.total_potential || 0,
			pendingReview: statsData.pending_review || 0,
			verified: statsData.verified || 0,
			rejected: statsData.rejected || 0,
			avgConfidence: statsData.avg_confidence
		} : {
			totalPotential: 0,
			pendingReview: 0,
			verified: 0,
			rejected: 0,
			avgConfidence: null
		};

		return json({
			success: true,
			discoveries,
			pagination: {
				page,
				limit,
				total: count || 0,
				totalPages: Math.ceil((count || 0) / limit)
			},
			stats
		});

	} catch (error) {
		console.error('Failed to fetch discoveries:', error);
		return json({
			success: false,
			message: 'Failed to fetch discoveries'
		}, { status: 500 });
	}
};
