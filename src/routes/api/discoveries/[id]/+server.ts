/**
 * Individual discovery endpoints
 * GET /api/discoveries/[id] - Get single discovery details
 * PATCH /api/discoveries/[id] - Update verification status
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';

export interface DiscoveryDetail {
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
	mlResponse: any;
	reviewStatus: 'pending' | 'verified' | 'rejected' | 'skipped';
	reviewerNotes: string | null;
	reviewedAt: string | null;
	tileZ: number | null;
	tileX: number | null;
	tileY: number | null;
	scanJobId: string | null;
	createdAt: string;
	nearestKnownSite: {
		id: string;
		name: string;
		distanceKm: number;
	} | null;
}

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	try {
		// Get discovery details
		const { data: site, error } = await supabase
			.from('sites')
			.select('*')
			.eq('id', id)
			.single();

		if (error || !site) {
			return json({
				success: false,
				message: 'Discovery not found'
			}, { status: 404 });
		}

		// Get nearest known site
		const { data: nearestData } = await supabase.rpc('get_nearest_known_site', {
			p_lat: site.lat,
			p_lng: site.lng
		});

		const nearestKnownSite = nearestData && nearestData.length > 0 ? {
			id: nearestData[0].site_id,
			name: nearestData[0].site_name,
			distanceKm: nearestData[0].distance_km
		} : null;

		const discovery: DiscoveryDetail = {
			id: site.id,
			name: site.name,
			lat: site.lat,
			lng: site.lng,
			featureType: site.feature_type,
			confidence: site.confidence,
			sizeMeters: site.size_meters,
			description: site.description,
			mlModel: site.ml_model,
			mlReasoning: site.ml_reasoning,
			mlResponse: site.ml_response,
			reviewStatus: site.review_status,
			reviewerNotes: site.reviewer_notes,
			reviewedAt: site.reviewed_at,
			tileZ: site.tile_z,
			tileX: site.tile_x,
			tileY: site.tile_y,
			scanJobId: site.scan_job_id,
			createdAt: site.created_at,
			nearestKnownSite
		};

		return json({
			success: true,
			discovery
		});

	} catch (error) {
		console.error('Failed to fetch discovery:', error);
		return json({
			success: false,
			message: 'Failed to fetch discovery'
		}, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { id } = params;

	try {
		const body = await request.json();
		const { reviewStatus, reviewerNotes } = body as {
			reviewStatus: 'verified' | 'rejected' | 'skipped';
			reviewerNotes?: string;
		};

		if (!['verified', 'rejected', 'skipped'].includes(reviewStatus)) {
			return json({
				success: false,
				message: 'Invalid reviewStatus. Must be "verified", "rejected", or "skipped"'
			}, { status: 400 });
		}

		const updates: Record<string, any> = {
			review_status: reviewStatus,
			reviewed_at: new Date().toISOString()
		};

		if (reviewerNotes !== undefined) {
			updates.reviewer_notes = reviewerNotes;
		}

		// If verified, also update the main status
		if (reviewStatus === 'verified') {
			updates.status = 'verified';
		} else if (reviewStatus === 'rejected') {
			updates.status = 'rejected';
		}

		const { data, error } = await supabase
			.from('sites')
			.update(updates)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw error;
		}

		return json({
			success: true,
			message: `Discovery marked as ${reviewStatus}`,
			discovery: data
		});

	} catch (error) {
		console.error('Failed to update discovery:', error);
		return json({
			success: false,
			message: 'Failed to update discovery'
		}, { status: 500 });
	}
};
