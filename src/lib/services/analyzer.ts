/**
 * Archaeological site detection using Claude Vision API
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BoundingBox } from '$lib/types';
import { arrayBufferToBase64 } from './naip';

// Initialize Anthropic client - API key from environment
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
	if (!anthropicClient) {
		anthropicClient = new Anthropic();
	}
	return anthropicClient;
}

export interface DetectedFeature {
	type: 'mound' | 'earthwork' | 'cropmark' | 'geometric' | 'anomaly' | 'other';
	confidence: 'low' | 'medium' | 'high';
	location: {
		x: number;  // 0-1, relative position in image
		y: number;  // 0-1, relative position in image
	};
	sizeMeters: number | null;
	description: string;
}

export interface AnalysisResult {
	features: DetectedFeature[];
	overallAssessment: string;
	processingTime: number;
	model: string;
}

const ARCHAEOLOGICAL_PROMPT = `You are an expert archaeological surveyor analyzing aerial/satellite imagery for potential undocumented archaeological sites in the United States.

Analyze this image for potential archaeological features. Focus on:

1. **Mounds**: Circular or conical elevated areas, typically 10-100m diameter. Look for:
   - Regular circular shadows indicating elevation
   - Vegetation differences on raised areas
   - Symmetrical shapes inconsistent with natural terrain

2. **Earthworks**: Linear embankments, geometric enclosures, effigy shapes. Look for:
   - Straight lines or regular curves in the landscape
   - Rectangular or circular enclosures
   - Connected linear features

3. **Crop marks**: Vegetation differences indicating buried structures. Look for:
   - Geometric patterns in crop/grass coloring
   - Lines or shapes visible through differential growth
   - Circles or rectangles in agricultural fields

4. **Shadow anomalies**: Subtle elevation changes. Look for:
   - Linear shadows that don't match surrounding terrain
   - Circular shadow patterns
   - Systematic raised or depressed areas

Important context:
- This is imagery from the continental United States
- Archaeological sites here include Native American mounds, Mississippian earthworks, Hopewell geometric enclosures, and burial mounds
- Many sites are subtle and may appear as slight discolorations or elevation changes
- Natural features like glacial kettles, sinkholes, or erosion can mimic archaeological features - note these as low confidence

For each potential feature found, estimate:
- Its type (mound, earthwork, cropmark, geometric, anomaly, other)
- Confidence level (low/medium/high) - be conservative, only use "high" for very clear features
- Approximate position in the image (x, y as 0-1 values where 0,0 is top-left)
- Estimated size in meters (rough estimate)
- Brief description of why this appears archaeological

If the image shows no potential archaeological features, that's completely fine - most terrain has no sites.

Respond ONLY with valid JSON in this exact format:
{
  "features": [
    {
      "type": "mound",
      "confidence": "medium",
      "location": { "x": 0.3, "y": 0.6 },
      "sizeMeters": 25,
      "description": "Circular elevated feature with regular profile and vegetation difference"
    }
  ],
  "overallAssessment": "Brief 1-2 sentence summary of the area"
}

If no features found, respond with:
{
  "features": [],
  "overallAssessment": "No potential archaeological features identified in this imagery."
}`;

/**
 * Analyze an image for archaeological features using Claude Vision
 */
export async function analyzeImage(
	imageData: ArrayBuffer,
	mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<AnalysisResult> {
	const startTime = Date.now();
	const client = getAnthropicClient();

	const base64Image = arrayBufferToBase64(imageData);

	const response = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 1024,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'image',
						source: {
							type: 'base64',
							media_type: mediaType,
							data: base64Image
						}
					},
					{
						type: 'text',
						text: ARCHAEOLOGICAL_PROMPT
					}
				]
			}
		]
	});

	const processingTime = Date.now() - startTime;

	// Extract text from response
	const textContent = response.content.find(c => c.type === 'text');
	if (!textContent || textContent.type !== 'text') {
		throw new Error('No text response from Claude');
	}

	// Parse JSON response
	let parsed: { features: DetectedFeature[]; overallAssessment: string };
	try {
		// Find JSON in the response (in case there's extra text)
		const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('No JSON found in response');
		}
		parsed = JSON.parse(jsonMatch[0]);
	} catch (parseError) {
		console.error('Failed to parse Claude response:', textContent.text);
		throw new Error(`Failed to parse analysis response: ${parseError}`);
	}

	return {
		features: parsed.features || [],
		overallAssessment: parsed.overallAssessment || 'Analysis complete',
		processingTime,
		model: 'claude-sonnet-4-20250514'
	};
}

/**
 * Convert image-relative coordinates to geographic coordinates
 */
export function featureToGeoCoordinates(
	feature: DetectedFeature,
	imageBbox: BoundingBox
): { lat: number; lng: number } {
	const { north, south, east, west } = imageBbox;

	// x: 0 = west, 1 = east
	// y: 0 = north, 1 = south (image coordinates)
	const lng = west + (east - west) * feature.location.x;
	const lat = north - (north - south) * feature.location.y;

	return { lat, lng };
}

/**
 * Convert confidence string to numeric value
 */
export function confidenceToNumber(confidence: 'low' | 'medium' | 'high'): number {
	switch (confidence) {
		case 'high': return 0.85;
		case 'medium': return 0.6;
		case 'low': return 0.35;
		default: return 0.5;
	}
}

/**
 * Analyze a region and return potential sites with geographic coordinates
 */
export async function analyzeRegion(
	imageData: ArrayBuffer,
	bbox: BoundingBox
): Promise<{
	sites: Array<{
		lat: number;
		lng: number;
		featureType: string;
		confidence: number;
		sizeMeters: number | null;
		description: string;
	}>;
	assessment: string;
	model: string;
	processingTime: number;
}> {
	const result = await analyzeImage(imageData);

	const sites = result.features.map(feature => {
		const coords = featureToGeoCoordinates(feature, bbox);
		return {
			lat: coords.lat,
			lng: coords.lng,
			featureType: feature.type,
			confidence: confidenceToNumber(feature.confidence),
			sizeMeters: feature.sizeMeters,
			description: feature.description
		};
	});

	return {
		sites,
		assessment: result.overallAssessment,
		model: result.model,
		processingTime: result.processingTime
	};
}
