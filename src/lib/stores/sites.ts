/**
 * Svelte 5 stores for managing archaeological site data
 */

import { writable, derived } from 'svelte/store';
import type { Site, LayerVisibility, ScanRegion, BoundingBox } from '$lib/types';
import { DEFAULT_LAYER_VISIBILITY } from '$lib/types';
import { supabase } from '$lib/supabase';

/** Loading state */
export const isLoading = writable<boolean>(false);
export const loadError = writable<string | null>(null);

/** Core writable stores */
export const sites = writable<Site[]>([]);
export const selectedSiteId = writable<string | null>(null);
export const layerVisibility = writable<LayerVisibility>({ ...DEFAULT_LAYER_VISIBILITY });
export const scanRegions = writable<ScanRegion[]>([]);

/** Derived stores */
export const selectedSite = derived(
	[sites, selectedSiteId],
	([$sites, $selectedSiteId]) =>
		$selectedSiteId ? $sites.find((s) => s.id === $selectedSiteId) ?? null : null
);

export const visibleSites = derived(
	[sites, layerVisibility],
	([$sites, $layerVisibility]) =>
		$sites.filter((site) => {
			switch (site.status) {
				case 'known':
					return $layerVisibility.knownSites;
				case 'potential':
					return $layerVisibility.potentialSites;
				case 'unverified':
					return $layerVisibility.unverifiedSites;
				default:
					return false;
			}
		})
);

export const siteCounts = derived(sites, ($sites) => ({
	known: $sites.filter((s) => s.status === 'known').length,
	potential: $sites.filter((s) => s.status === 'potential').length,
	unverified: $sites.filter((s) => s.status === 'unverified').length,
	total: $sites.length
}));

/** Transform database row to Site type */
function dbRowToSite(row: any): Site {
	return {
		id: row.id,
		name: row.name,
		coordinates: { lat: row.lat, lng: row.lng },
		status: row.status,
		description: row.description || undefined,
		dateDiscovered: row.date_discovered || undefined,
		culture: row.culture || undefined,
		timePeriod: row.time_period || undefined,
		features: row.features || undefined,
		imageUrl: row.image_url || undefined,
		sourceUrl: row.source_url || undefined
	};
}

/** Transform Site type to database row */
function siteToDbRow(site: Omit<Site, 'id'>) {
	return {
		name: site.name,
		lat: site.coordinates.lat,
		lng: site.coordinates.lng,
		status: site.status,
		description: site.description || null,
		date_discovered: site.dateDiscovered || null,
		culture: site.culture || null,
		time_period: site.timePeriod || null,
		features: site.features || null,
		image_url: site.imageUrl || null,
		source_url: site.sourceUrl || null
	};
}

/** Load sites from Supabase */
export async function loadSites(): Promise<void> {
	isLoading.set(true);
	loadError.set(null);

	console.log('Loading sites from Supabase...');

	try {
		const { data, error } = await supabase.from('sites').select('*').order('name');

		console.log('Supabase response:', { data, error });

		if (error) {
			throw error;
		}

		const loadedSites = (data || []).map(dbRowToSite);
		console.log('Loaded sites:', loadedSites);
		sites.set(loadedSites);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load sites';
		loadError.set(message);
		console.error('Error loading sites:', err);
	} finally {
		isLoading.set(false);
	}
}

/** Store actions */
export function selectSite(siteId: string | null): void {
	selectedSiteId.set(siteId);
}

export function toggleLayer(layer: keyof LayerVisibility): void {
	layerVisibility.update((current) => ({
		...current,
		[layer]: !current[layer]
	}));
}

export function addScanRegion(bounds: BoundingBox): ScanRegion {
	const region: ScanRegion = {
		id: crypto.randomUUID(),
		bounds,
		createdAt: new Date(),
		status: 'pending'
	};
	scanRegions.update((current) => [...current, region]);
	return region;
}

export function removeScanRegion(regionId: string): void {
	scanRegions.update((current) => current.filter((r) => r.id !== regionId));
}

/** Add a new site to the database */
export async function addSite(site: Omit<Site, 'id'>): Promise<Site | null> {
	try {
		const { data, error } = await supabase
			.from('sites')
			.insert(siteToDbRow(site))
			.select()
			.single();

		if (error) {
			throw error;
		}

		const newSite = dbRowToSite(data);
		sites.update((current) => [...current, newSite]);
		return newSite;
	} catch (err) {
		console.error('Error adding site:', err);
		return null;
	}
}

/** Update an existing site in the database */
export async function updateSite(id: string, updates: Partial<Omit<Site, 'id'>>): Promise<boolean> {
	try {
		const dbUpdates: any = {};
		if (updates.name !== undefined) dbUpdates.name = updates.name;
		if (updates.coordinates !== undefined) {
			dbUpdates.lat = updates.coordinates.lat;
			dbUpdates.lng = updates.coordinates.lng;
		}
		if (updates.status !== undefined) dbUpdates.status = updates.status;
		if (updates.description !== undefined) dbUpdates.description = updates.description;
		if (updates.culture !== undefined) dbUpdates.culture = updates.culture;
		if (updates.timePeriod !== undefined) dbUpdates.time_period = updates.timePeriod;
		if (updates.features !== undefined) dbUpdates.features = updates.features;
		if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
		if (updates.sourceUrl !== undefined) dbUpdates.source_url = updates.sourceUrl;

		const { error } = await supabase.from('sites').update(dbUpdates).eq('id', id);

		if (error) {
			throw error;
		}

		// Update local store
		sites.update((current) =>
			current.map((s) => (s.id === id ? { ...s, ...updates } : s))
		);
		return true;
	} catch (err) {
		console.error('Error updating site:', err);
		return false;
	}
}

/** Delete a site from the database */
export async function deleteSite(id: string): Promise<boolean> {
	try {
		const { error } = await supabase.from('sites').delete().eq('id', id);

		if (error) {
			throw error;
		}

		sites.update((current) => current.filter((s) => s.id !== id));
		return true;
	} catch (err) {
		console.error('Error deleting site:', err);
		return false;
	}
}
