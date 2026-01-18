/**
 * Site Detail API
 * GET /api/sites/[id] - Full site details with nearby sites
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import {
	dbRowToKnownSite,
	dbRowToNearbySite,
	type KnownSite,
	type NearbySite
} from '$lib/types/known-sites';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { id } = params;

		// Fetch site details
		const { data: siteData, error: siteError } = await supabase
			.from('known_sites')
			.select('*')
			.eq('id', id)
			.single();

		if (siteError || !siteData) {
			return json(
				{
					success: false,
					message: 'Site not found'
				},
				{ status: 404 }
			);
		}

		const site: KnownSite = dbRowToKnownSite(siteData);

		// Fetch nearby sites using PostGIS
		const { data: nearbyData, error: nearbyError } = await supabase.rpc('known_nearby_sites', {
			center_lat: site.lat,
			center_lng: site.lng,
			radius_km: 100,
			exclude_id: id,
			max_results: 5
		});

		if (nearbyError) {
			console.error('Error fetching nearby sites:', nearbyError);
		}

		const nearbySites: NearbySite[] = (nearbyData || []).map((row: Record<string, unknown>) =>
			dbRowToNearbySite(row)
		);

		return json({
			success: true,
			site,
			nearbySites
		});
	} catch (error) {
		console.error('Site detail API error:', error);
		return json(
			{
				success: false,
				message: 'Failed to fetch site details'
			},
			{ status: 500 }
		);
	}
};
