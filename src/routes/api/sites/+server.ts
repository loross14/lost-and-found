/**
 * Known Sites API
 * GET /api/sites - List sites with bbox, filtering, search, pagination
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import { dbRowToKnownSiteSummary, type KnownSiteSummary } from '$lib/types/known-sites';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Parse bounding box parameters
		const north = parseFloat(url.searchParams.get('north') || '90');
		const south = parseFloat(url.searchParams.get('south') || '-90');
		const east = parseFloat(url.searchParams.get('east') || '180');
		const west = parseFloat(url.searchParams.get('west') || '-180');

		// Parse filter parameters
		const statesParam = url.searchParams.get('states');
		const states = statesParam ? statesParam.split(',').filter(Boolean) : null;

		const typesParam = url.searchParams.get('types');
		const types = typesParam ? typesParam.split(',').filter(Boolean) : null;

		const search = url.searchParams.get('search') || null;

		// Parse pagination
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000'), 2000);

		// Validate bbox
		if (north <= south || east <= west) {
			return json(
				{
					success: false,
					message: 'Invalid bounding box'
				},
				{ status: 400 }
			);
		}

		// Try RPC function first (more efficient with PostGIS), fallback to direct query
		let data: Record<string, unknown>[] | null = null;
		let error: { message: string; code?: string } | null = null;

		// Try RPC function
		const rpcResult = await supabase.rpc('sites_in_bbox', {
			min_lng: west,
			min_lat: south,
			max_lng: east,
			max_lat: north,
			site_types: types,
			filter_states: states,
			search_query: search,
			max_results: limit
		});

		if (rpcResult.error?.code === 'PGRST202') {
			// RPC function doesn't exist - use direct query fallback
			console.log('RPC function not found, using direct query fallback');

			let query = supabase
				.from('known_sites')
				.select('id, nrhp_id, name, site_type, category, city, state, lat, lng, date_listed')
				.gte('lat', south)
				.lte('lat', north)
				.gte('lng', west)
				.lte('lng', east)
				.limit(limit);

			// Apply filters
			if (states && states.length > 0) {
				query = query.in('state', states);
			}

			if (types && types.length > 0) {
				query = query.in('site_type', types);
			}

			if (search) {
				query = query.ilike('name', `%${search}%`);
			}

			query = query.order('name');

			const directResult = await query;
			data = directResult.data;
			error = directResult.error;
		} else {
			data = rpcResult.data;
			error = rpcResult.error;
		}

		if (error) {
			console.error('Sites API error:', JSON.stringify(error, null, 2));
			throw error;
		}

		console.log(`Sites API: Found ${(data || []).length} sites`);

		// Transform to client format
		const sites: KnownSiteSummary[] = (data || []).map((row: Record<string, unknown>) =>
			dbRowToKnownSiteSummary(row)
		);

		return json({
			success: true,
			sites,
			count: sites.length,
			hasMore: sites.length === limit
		});
	} catch (error) {
		console.error('Sites API error:', error);
		return json(
			{
				success: false,
				message: 'Failed to fetch sites'
			},
			{ status: 500 }
		);
	}
};
