// lib/services/placesApiClient.js - Optimized Google Places API v1 client

export class PlacesApiClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://places.googleapis.com/v1/places';
        this.requestCount = 0;
        this.rateLimitDelay = 100; // Base delay between requests
        this.retryAttempts = 3;
        
        // Field mask for consistent API responses
        this.fieldMask = [
            'places.id',
            'places.displayName', 
            'places.location',
            'places.types',
            'places.rating',
            'places.userRatingCount',
            'places.businessStatus',
            'places.formattedAddress',
            'places.photos',
            'places.priceLevel',
            'places.primaryType',
            'places.editorialSummary'
        ].join(',');
    }

    // Rate limiting helper
    async rateLimitedRequest(requestFn) {
        const delay = this.rateLimitDelay + (this.requestCount * 50); // Progressive delay
        await new Promise(resolve => setTimeout(resolve, delay));
        this.requestCount++;
        return requestFn();
    }

    // Retry wrapper for API calls
    async withRetry(requestFn, attempts = this.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
            try {
                return await this.rateLimitedRequest(requestFn);
            } catch (error) {
                if (i === attempts - 1) throw error;
                
                // Exponential backoff for retries
                const retryDelay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                console.warn(`API request attempt ${i + 1} failed, retrying...`, error.message);
            }
        }
    }

    // Enhanced searchNearby with optimized parameters
    async searchNearby(location, options = {}) {
        const {
            radius = 1000,
            includedTypes = [],
            maxResults = 20,
            rankPreference = 'POPULARITY'
        } = options;

        const requestBody = {
            locationRestriction: {
                circle: {
                    center: {
                        latitude: location.latitude,
                        longitude: location.longitude
                    },
                    radius: radius
                }
            },
            maxResultCount: Math.min(maxResults, 20), // API limit
            rankPreference: rankPreference
        };

        // Only add includedTypes if provided and non-empty
        if (includedTypes.length > 0) {
            requestBody.includedTypes = includedTypes;
        }

        const requestFn = async () => {
            const response = await fetch(`${this.baseUrl}:searchNearby`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': this.fieldMask
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Places API searchNearby failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            return response.json();
        };

        return this.withRetry(requestFn);
    }

    // Enhanced searchText with intelligent query optimization
    async searchText(query, location, options = {}) {
        const {
            radius = 1000,
            maxResults = 10
        } = options;

        const requestBody = {
            textQuery: query,
            maxResultCount: Math.min(maxResults, 20),
            locationBias: {
                circle: {
                    center: {
                        latitude: location.latitude,
                        longitude: location.longitude
                    },
                    radius: radius
                }
            }
        };

        const requestFn = async () => {
            const response = await fetch(`${this.baseUrl}:searchText`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': this.fieldMask
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Places API searchText failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            return response.json();
        };

        return this.withRetry(requestFn);
    }

    // Get place details with enhanced fields
    async getPlaceDetails(placeId, options = {}) {
        const {
            languageCode = 'en'
        } = options;

        const requestFn = async () => {
            const response = await fetch(`${this.baseUrl}/${placeId}`, {
                method: 'GET',
                headers: {
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': this.fieldMask + ',places.website,places.phoneNumber,places.openingHours',
                    'Accept-Language': languageCode
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Places API getPlaceDetails failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            return response.json();
        };

        return this.withRetry(requestFn);
    }

    // Batch search with intelligent query distribution
    async batchSearchNearby(locations, options = {}) {
        const results = [];
        const errors = [];

        for (let i = 0; i < locations.length; i++) {
            const location = locations[i];
            
            try {
                console.log(`🔍 Searching location ${i + 1}/${locations.length}: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
                
                const data = await this.searchNearby(location, options);
                
                results.push({
                    location,
                    data,
                    success: true,
                    index: i
                });
                
                console.log(`✅ Found ${data.places?.length || 0} places for location ${i + 1}`);
                
            } catch (error) {
                console.error(`❌ Error searching location ${i + 1}:`, error.message);
                
                errors.push({
                    location,
                    error: error.message,
                    index: i
                });
                
                results.push({
                    location,
                    data: { places: [] },
                    success: false,
                    error: error.message,
                    index: i
                });
            }
        }

        return {
            results,
            errors,
            totalRequests: locations.length,
            successRate: (results.filter(r => r.success).length / locations.length * 100).toFixed(1)
        };
    }

    // Smart text search with context-aware queries
    async contextualTextSearch(location, context = {}) {
        const {
            dateRange = 'current',
            eventTypes = [],
            city = null
        } = context;

        // Generate intelligent search queries based on context
        const queries = this.generateContextualQueries(dateRange, eventTypes, city);
        const results = [];

        for (const query of queries) {
            try {
                console.log(`🔍 Text search: "${query}"`);
                
                const data = await this.searchText(query, location, {
                    radius: 2000, // Larger radius for text searches
                    maxResults: 15
                });
                
                if (data.places && data.places.length > 0) {
                    results.push({
                        query,
                        places: data.places,
                        count: data.places.length
                    });
                    
                    console.log(`✅ Text search "${query}" found ${data.places.length} places`);
                } else {
                    console.log(`ℹ️ Text search "${query}" found no places`);
                }
                
            } catch (error) {
                console.error(`❌ Text search "${query}" failed:`, error.message);
            }
        }

        return results;
    }

    // Generate intelligent search queries based on context
    generateContextualQueries(dateRange, eventTypes, city) {
        const currentDate = new Date();
        const month = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();
        
        const baseQueries = [
            'conference center events',
            'convention hall meetings',
            'business conferences',
            'professional networking events',
            'corporate gatherings',
            'industry conferences'
        ];

        // Add date-specific queries
        if (dateRange === 'current') {
            baseQueries.push(
                `${month} ${year} conferences`,
                `current events ${month}`,
                'happening now events',
                'today conferences'
            );
        }

        // Add event type specific queries
        if (eventTypes.includes('convention_center')) {
            baseQueries.push(
                'trade shows',
                'expo center events',
                'convention exhibits'
            );
        }

        if (eventTypes.includes('university')) {
            baseQueries.push(
                'academic conferences',
                'university seminars',
                'research symposiums'
            );
        }

        // Add city-specific queries for known event destinations
        if (city) {
            const cityLower = city.toLowerCase();
            
            if (cityLower.includes('las vegas')) {
                baseQueries.push(
                    'CES 2025',
                    'NAB Show',
                    'Las Vegas tech conferences',
                    'strip convention events'
                );
            } else if (cityLower.includes('austin')) {
                baseQueries.push(
                    'SXSW',
                    'Austin tech meetups',
                    'downtown conferences'
                );
            } else if (cityLower.includes('san francisco')) {
                baseQueries.push(
                    'tech conferences',
                    'startup events',
                    'Silicon Valley meetups'
                );
            }
        }

        // Remove duplicates and limit queries
        return [...new Set(baseQueries)].slice(0, 8); // Limit to 8 queries max
    }

    // Reset rate limiting counters
    resetRateLimit() {
        this.requestCount = 0;
    }

    // Get API usage statistics
    getUsageStats() {
        return {
            requestCount: this.requestCount,
            averageDelay: this.rateLimitDelay + (this.requestCount * 50),
            estimatedCost: this.requestCount * 0.017 // Approximate cost per request
        };
    }
}

// Export singleton factory
export const createPlacesApiClient = (apiKey) => new PlacesApiClient(apiKey);