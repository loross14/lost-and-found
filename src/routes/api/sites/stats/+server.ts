/**
 * Sites Stats API
 * GET /api/sites/stats - Counts by state and type
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import type { SiteStats } from '$lib/types/known-sites';

export const GET: RequestHandler = async () => {
	try {
		// Get total count
		const { count: total, error: countError } = await supabase
			.from('known_sites')
			.select('*', { count: 'exact', head: true });

		if (countError) {
			throw countError;
		}

		// Try RPC for state counts, fallback to client-side aggregation
		let byState: Record<string, number> = {};
		const stateResult = await supabase.rpc('count_known_sites_by_state');

		if (stateResult.error?.code === 'PGRST202') {
			// RPC doesn't exist - do simple query and aggregate
			console.log('State count RPC not found, using fallback');
			const { data: stateData } = await supabase
				.from('known_sites')
				.select('state')
				.limit(10000);

			if (stateData) {
				stateData.forEach((row: { state: string }) => {
					byState[row.state] = (byState[row.state] || 0) + 1;
				});
			}
		} else if (stateResult.error) {
			console.error('Error fetching state counts:', stateResult.error);
		} else {
			(stateResult.data || []).forEach((row: { state: string; count: number }) => {
				byState[row.state] = Number(row.count);
			});
		}

		// Try RPC for type counts, fallback to client-side aggregation
		let byType: Record<string, number> = {};
		const typeResult = await supabase.rpc('count_known_sites_by_type');

		if (typeResult.error?.code === 'PGRST202') {
			// RPC doesn't exist - do simple query and aggregate
			console.log('Type count RPC not found, using fallback');
			const { data: typeData } = await supabase
				.from('known_sites')
				.select('site_type')
				.not('site_type', 'is', null)
				.limit(10000);

			if (typeData) {
				typeData.forEach((row: { site_type: string }) => {
					if (row.site_type) {
						byType[row.site_type] = (byType[row.site_type] || 0) + 1;
					}
				});
			}
		} else if (typeResult.error) {
			console.error('Error fetching type counts:', typeResult.error);
		} else {
			(typeResult.data || []).forEach((row: { site_type: string; count: number }) => {
				if (row.site_type) {
					byType[row.site_type] = Number(row.count);
				}
			});
		}

		const stats: SiteStats = {
			total: total || 0,
			byState,
			byType
		};

		return json({
			success: true,
			stats
		});
	} catch (error) {
		console.error('Stats API error:', error);
		return json(
			{
				success: false,
				message: 'Failed to fetch stats'
			},
			{ status: 500 }
		);
	}
};
