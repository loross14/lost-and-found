/**
 * Type definitions for NRHP known sites
 */

/**
 * Full known site record with all fields
 */
export interface KnownSite {
	id: string;
	nrhpId: string;
	name: string;
	siteType: string | null;
	category: string | null;
	address: string | null;
	city: string | null;
	county: string | null;
	state: string;
	lat: number;
	lng: number;
	dateListed: string | null;
	description: string | null;
	significance: string | null;
	architect: string | null;
	timePeriod: string | null;
	culture: string | null;
	nrhpUrl: string | null;
	wikipediaUrl: string | null;
	imageUrl: string | null;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * Summary version for map markers and lists
 */
export interface KnownSiteSummary {
	id: string;
	nrhpId: string;
	name: string;
	siteType: string | null;
	category: string | null;
	city: string | null;
	state: string;
	lat: number;
	lng: number;
	dateListed: string | null;
}

/**
 * Nearby site with distance
 */
export interface NearbySite {
	id: string;
	nrhpId: string;
	name: string;
	siteType: string | null;
	city: string | null;
	state: string;
	lat: number;
	lng: number;
	distanceKm: number;
}

/**
 * Filter options for site queries
 */
export interface SiteFilters {
	bbox?: {
		north: number;
		south: number;
		east: number;
		west: number;
	};
	states?: string[];
	siteTypes?: string[];
	search?: string;
	page?: number;
	limit?: number;
}

/**
 * Site statistics
 */
export interface SiteStats {
	total: number;
	byState: Record<string, number>;
	byType: Record<string, number>;
}

/**
 * US States and territories for dropdown
 */
export const US_STATES: { code: string; name: string }[] = [
	{ code: 'AL', name: 'Alabama' },
	{ code: 'AK', name: 'Alaska' },
	{ code: 'AZ', name: 'Arizona' },
	{ code: 'AR', name: 'Arkansas' },
	{ code: 'CA', name: 'California' },
	{ code: 'CO', name: 'Colorado' },
	{ code: 'CT', name: 'Connecticut' },
	{ code: 'DE', name: 'Delaware' },
	{ code: 'DC', name: 'District of Columbia' },
	{ code: 'FL', name: 'Florida' },
	{ code: 'GA', name: 'Georgia' },
	{ code: 'HI', name: 'Hawaii' },
	{ code: 'ID', name: 'Idaho' },
	{ code: 'IL', name: 'Illinois' },
	{ code: 'IN', name: 'Indiana' },
	{ code: 'IA', name: 'Iowa' },
	{ code: 'KS', name: 'Kansas' },
	{ code: 'KY', name: 'Kentucky' },
	{ code: 'LA', name: 'Louisiana' },
	{ code: 'ME', name: 'Maine' },
	{ code: 'MD', name: 'Maryland' },
	{ code: 'MA', name: 'Massachusetts' },
	{ code: 'MI', name: 'Michigan' },
	{ code: 'MN', name: 'Minnesota' },
	{ code: 'MS', name: 'Mississippi' },
	{ code: 'MO', name: 'Missouri' },
	{ code: 'MT', name: 'Montana' },
	{ code: 'NE', name: 'Nebraska' },
	{ code: 'NV', name: 'Nevada' },
	{ code: 'NH', name: 'New Hampshire' },
	{ code: 'NJ', name: 'New Jersey' },
	{ code: 'NM', name: 'New Mexico' },
	{ code: 'NY', name: 'New York' },
	{ code: 'NC', name: 'North Carolina' },
	{ code: 'ND', name: 'North Dakota' },
	{ code: 'OH', name: 'Ohio' },
	{ code: 'OK', name: 'Oklahoma' },
	{ code: 'OR', name: 'Oregon' },
	{ code: 'PA', name: 'Pennsylvania' },
	{ code: 'PR', name: 'Puerto Rico' },
	{ code: 'RI', name: 'Rhode Island' },
	{ code: 'SC', name: 'South Carolina' },
	{ code: 'SD', name: 'South Dakota' },
	{ code: 'TN', name: 'Tennessee' },
	{ code: 'TX', name: 'Texas' },
	{ code: 'UT', name: 'Utah' },
	{ code: 'VT', name: 'Vermont' },
	{ code: 'VA', name: 'Virginia' },
	{ code: 'VI', name: 'Virgin Islands' },
	{ code: 'WA', name: 'Washington' },
	{ code: 'WV', name: 'West Virginia' },
	{ code: 'WI', name: 'Wisconsin' },
	{ code: 'WY', name: 'Wyoming' }
];

/**
 * Site categories for filtering
 */
export const SITE_CATEGORIES: { value: string; label: string; color: string }[] = [
	{ value: 'building', label: 'Buildings', color: '#3b82f6' },
	{ value: 'structure', label: 'Structures', color: '#8b5cf6' },
	{ value: 'site', label: 'Archaeological Sites', color: '#f59e0b' },
	{ value: 'district', label: 'Historic Districts', color: '#10b981' },
	{ value: 'object', label: 'Objects', color: '#ef4444' },
	{ value: 'other', label: 'Other', color: '#6b7280' }
];

/**
 * Get color for a category
 */
export function getCategoryColor(category: string | null): string {
	const found = SITE_CATEGORIES.find((c) => c.value === category);
	return found?.color || '#6b7280';
}

/**
 * Get label for a category
 */
export function getCategoryLabel(category: string | null): string {
	const found = SITE_CATEGORIES.find((c) => c.value === category);
	return found?.label || 'Unknown';
}

/**
 * Get state name from code
 */
export function getStateName(code: string): string {
	const found = US_STATES.find((s) => s.code === code);
	return found?.name || code;
}

/**
 * Transform database row to KnownSite type
 */
export function dbRowToKnownSite(row: Record<string, unknown>): KnownSite {
	return {
		id: row.id as string,
		nrhpId: row.nrhp_id as string,
		name: row.name as string,
		siteType: row.site_type as string | null,
		category: row.category as string | null,
		address: row.address as string | null,
		city: row.city as string | null,
		county: row.county as string | null,
		state: row.state as string,
		lat: row.lat as number,
		lng: row.lng as number,
		dateListed: row.date_listed as string | null,
		description: row.description as string | null,
		significance: row.significance as string | null,
		architect: row.architect as string | null,
		timePeriod: row.time_period as string | null,
		culture: row.culture as string | null,
		nrhpUrl: row.nrhp_url as string | null,
		wikipediaUrl: row.wikipedia_url as string | null,
		imageUrl: row.image_url as string | null,
		createdAt: row.created_at as string | undefined,
		updatedAt: row.updated_at as string | undefined
	};
}

/**
 * Transform database row to KnownSiteSummary type
 */
export function dbRowToKnownSiteSummary(row: Record<string, unknown>): KnownSiteSummary {
	return {
		id: row.id as string,
		nrhpId: row.nrhp_id as string,
		name: row.name as string,
		siteType: row.site_type as string | null,
		category: row.category as string | null,
		city: row.city as string | null,
		state: row.state as string,
		lat: row.lat as number,
		lng: row.lng as number,
		dateListed: row.date_listed as string | null
	};
}

/**
 * Transform database row to NearbySite type
 */
export function dbRowToNearbySite(row: Record<string, unknown>): NearbySite {
	return {
		id: row.id as string,
		nrhpId: row.nrhp_id as string,
		name: row.name as string,
		siteType: row.site_type as string | null,
		city: row.city as string | null,
		state: row.state as string,
		lat: row.lat as number,
		lng: row.lng as number,
		distanceKm: row.distance_km as number
	};
}
