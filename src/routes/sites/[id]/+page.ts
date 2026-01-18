/**
 * Site detail page SSR loader
 * Pre-fetches site data for SEO and faster initial render
 */

import type { PageLoad } from './$types';
import type { KnownSite, NearbySite } from '$lib/types/known-sites';

export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const res = await fetch(`/api/sites/${params.id}`);
		const data = await res.json();

		if (!data.success || !data.site) {
			return {
				site: null,
				nearbySites: [],
				error: data.message || 'Site not found'
			};
		}

		return {
			site: data.site as KnownSite,
			nearbySites: (data.nearbySites || []) as NearbySite[],
			error: null
		};
	} catch (error) {
		console.error('Failed to load site:', error);
		return {
			site: null,
			nearbySites: [],
			error: 'Failed to load site'
		};
	}
};
