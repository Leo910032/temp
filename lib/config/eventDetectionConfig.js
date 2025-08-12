// lib/config/eventDetectionConfig.js - Optimized distance and detection configuration

export const EVENT_DETECTION_CONFIG = {
    // Optimized distance thresholds for different event types (in meters)
    DISTANCE_THRESHOLDS: {
        // Major conventions and conferences
        'convention_center': {
            base: 2000,      // 2km - Large convention centers span multiple blocks
            description: 'Majoor convention centers like CES, NAB Show venues',
            examples: ['Las Vegas Convention Center', 'Moscone Center', 'Jacob Javits Center']
        },
        'expo_center': {
            base: 2500,      // 2.5km - Expo centers often include outdoor areas
            description: 'Large exposition centers with multiple halls',
            examples: ['Orange County Convention Center', 'McCormick Place']
        },
        'conference_center': {
            base: 1500,      // 1.5km - Business conference centers
            description: 'Dedicated conference facilities',
            examples: ['Hotel conference centers', 'Corporate conference facilities']
        },

        // Entertainment and cultural venues
        'stadium': {
            base: 2000,      // 2km - Large stadiums with surrounding facilities
            description: 'Major sports stadiums and arenas',
            examples: ['MetLife Stadium', 'AT&T Stadium', 'Allegiant Stadium']
        },
        'arena': {
            base: 1500,      // 1.5km - Indoor arenas
            description: 'Indoor sports and entertainment arenas',
            examples: ['Madison Square Garden', 'T-Mobile Arena']
        },
        'concert_hall': {
            base: 800,       // 800m - Mid-size music venues
            description: 'Concert halls and music venues',
            examples: ['Radio City Music Hall', 'Hollywood Bowl']
        },
        'opera_house': {
            base: 600,       // 600m - Traditional opera houses
            description: 'Opera houses and performing arts centers',
            examples: ['Lincoln Center', 'Sydney Opera House']
        },
        'performing_arts_theater': {
            base: 500,       // 500m - Theater districts
            description: 'Theaters and performing arts venues',
            examples: ['Broadway theaters', 'West End theaters']
        },

        // Educational and corporate venues
        'university': {
            base: 3000,      // 3km - University campuses are large
            description: 'University campuses hosting conferences',
            examples: ['Stanford University', 'MIT', 'Harvard University']
        },
        'business_center': {
            base: 1000,      // 1km - Business districts
            description: 'Business centers and corporate complexes',
            examples: ['Financial districts', 'Corporate campuses']
        },
        'corporate_campus': {
            base: 2000,      // 2km - Large corporate campuses
            description: 'Major corporate headquarters and campuses',
            examples: ['Google Campus', 'Apple Park', 'Microsoft Campus']
        },

        // Cultural and community venues
        'museum': {
            base: 600,       // 600m - Museum districts
            description: 'Museums and cultural institutions',
            examples: ['Smithsonian Museums', 'Louvre', 'Metropolitan Museum']
        },
        'art_gallery': {
            base: 400,       // 400m - Art galleries in districts
            description: 'Art galleries and exhibition spaces',
            examples: ['Gallery districts', 'Art exhibition centers']
        },
        'cultural_center': {
            base: 1000,      // 1km - Community cultural areas
            description: 'Community and cultural centers',
            examples: ['Kennedy Center', 'Lincoln Center']
        },
        'community_center': {
            base: 800,       // 800m - Local community centers
            description: 'Local community centers hosting events',
            examples: ['Community halls', 'Civic centers']
        },

        // Hospitality venues (often host business events)
        'lodging': {
            base: 500,       // 500m - Hotels hosting events
            description: 'Hotels with conference facilities',
            examples: ['Convention hotels', 'Resort conference centers']
        },
        'resort': {
            base: 2000,      // 2km - Large resort properties
            description: 'Resort properties with multiple venues',
            examples: ['Las Vegas resorts', 'Disney resorts']
        },

        // Tourism and attraction venues
        'tourist_attraction': {
            base: 800,       // 800m - Tourist areas with events
            description: 'Tourist attractions hosting events',
            examples: ['Theme parks', 'Landmark venues']
        },
        'amusement_park': {
            base: 1500,      // 1.5km - Large theme parks
            description: 'Theme parks and amusement facilities',
            examples: ['Disneyland', 'Universal Studios']
        },

        // Default fallback
        'default': {
            base: 1000,      // 1km default for unknown venue types
            description: 'Default radius for unspecified venue types',
            examples: ['General event venues']
        }
    },

    // City-specific adjustments based on urban density and event distribution patterns
    CITY_ADJUSTMENTS: {
        // Major event destinations with specific characteristics
        'las vegas': {
            multiplier: 1.8,    // Vegas spreads events across the strip and downtown
            description: 'Events spread across Strip, Downtown, and convention areas',
            majorEvents: ['CES', 'NAB Show', 'DEFCON', 'Magic Trade Show'],
            specialZones: {
                'strip': { multiplier: 2.0, description: 'Las Vegas Strip resort complexes' },
                'downtown': { multiplier: 1.5, description: 'Downtown Las Vegas area' },
                'convention': { multiplier: 1.3, description: 'Convention Center area' }
            }
        },
        'orlando': {
            multiplier: 1.4,    // Theme parks and International Drive corridor
            description: 'Theme parks, I-Drive, and convention center area',
            majorEvents: ['Theme park events', 'Convention center shows'],
            specialZones: {
                'i-drive': { multiplier: 1.6, description: 'International Drive corridor' },
                'disney': { multiplier: 2.0, description: 'Walt Disney World area' },
                'universal': { multiplier: 1.5, description: 'Universal Studios area' }
            }
        },
        'austin': {
            multiplier: 1.3,    // SXSW spreads across downtown
            description: 'Downtown area with spread-out SXSW venues',
            majorEvents: ['SXSW', 'Austin City Limits', 'Formula 1'],
            specialZones: {
                'downtown': { multiplier: 1.5, description: 'Downtown SXSW area' },
                'east_austin': { multiplier: 1.4, description: 'East Austin venues' }
            }
        },

        // Dense urban areas requiring smaller search radii
        'san francisco': {
            multiplier: 0.7,    // Very dense urban area
            description: 'Dense urban area with concentrated venues',
            majorEvents: ['Dreamforce', 'RSA Conference', 'Game Developers Conference'],
            specialZones: {
                'soma': { multiplier: 0.8, description: 'South of Market tech area' },
                'financial': { multiplier: 0.6, description: 'Financial District' }
            }
        },
        'new york': {
            multiplier: 0.6,    // Extremely dense, very precise locations
            description: 'Very dense urban area with precise venue locations',
            majorEvents: ['Comic Con', 'Fashion Week', 'Toy Fair'],
            specialZones: {
                'manhattan': { multiplier: 0.5, description: 'Manhattan venues' },
                'brooklyn': { multiplier: 0.8, description: 'Brooklyn event spaces' },
                'javits': { multiplier: 1.0, description: 'Javits Center area' }
            }
        },
        'chicago': {
            multiplier: 0.8,    // Dense urban core
            description: 'Dense downtown area with McCormick Place',
            majorEvents: ['McCormick Place shows', 'Lollapalooza'],
            specialZones: {
                'loop': { multiplier: 0.7, description: 'Downtown Loop area' },
                'mccormick': { multiplier: 1.2, description: 'McCormick Place area' }
            }
        },

        // International cities with specific patterns
        'london': {
            multiplier: 0.8,    // Dense European city
            description: 'Dense urban area with scattered venues',
            majorEvents: ['London Fashion Week', 'London Book Fair'],
            specialZones: {
                'central': { multiplier: 0.7, description: 'Central London venues' },
                'canary_wharf': { multiplier: 0.9, description: 'Business district' }
            }
        },
        'paris': {
            multiplier: 0.8,    // Compact European conference areas
            description: 'Compact city with concentrated business areas',
            majorEvents: ['Paris Fashion Week', 'Maison et Objet'],
            specialZones: {
                'la_defense': { multiplier: 1.0, description: 'Business district' },
                'porte_de_versailles': { multiplier: 1.2, description: 'Exhibition center area' }
            }
        },
        'barcelona': {
            multiplier: 0.9,    // Compact European conference city
            description: 'Compact conference city with Fira venues',
            majorEvents: ['Mobile World Congress', 'ISE'],
            specialZones: {
                'fira': { multiplier: 1.3, description: 'Fira Barcelona area' },
                'gothic': { multiplier: 0.7, description: 'Gothic Quarter venues' }
            }
        },
        'singapore': {
            multiplier: 0.9,    // Compact but efficient layout
            description: 'Compact city-state with efficient venue distribution',
            majorEvents: ['Singapore International Water Week', 'FinTech Festival'],
            specialZones: {
                'marina_bay': { multiplier: 1.1, description: 'Marina Bay area' },
                'changi': { multiplier: 1.4, description: 'Changi Exhibition Centre' }
            }
        },

        // Tech hubs with specific patterns
        'seattle': {
            multiplier: 1.0,    // Moderate density with corporate campuses
            description: 'Tech hub with corporate campuses and downtown venues',
            majorEvents: ['PAX', 'Emerald City Comic Con'],
            specialZones: {
                'downtown': { multiplier: 0.9, description: 'Downtown Seattle' },
                'bellevue': { multiplier: 1.2, description: 'Bellevue tech area' }
            }
        },
        'boston': {
            multiplier: 0.8,    // Dense historical city
            description: 'Dense historical city with concentrated venues',
            majorEvents: ['PAX East', 'Boston Marathon events'],
            specialZones: {
                'back_bay': { multiplier: 0.7, description: 'Back Bay convention area' },
                'cambridge': { multiplier: 1.0, description: 'Cambridge/Harvard area' }
            }
        }
    },

    // Event type priorities for mixed-type venues
    EVENT_TYPE_PRIORITIES: {
        'convention_center': 10,     // Highest priority for business events
        'conference_center': 9,
        'university': 8,             // High priority for academic conferences
        'business_center': 6,
        'cultural_center': 5,
        'community_center': 4,
        'stadium': 3,                // Lower priority unless sports event
        'tourist_attraction': 2,
        'default': 1
    },

    // Temporal adjustments based on day/time
    TEMPORAL_ADJUSTMENTS: {
        // Day of week adjustments
        WEEKDAY_MULTIPLIERS: {
            1: 1.2, // Monday - common conference start
            2: 1.3, // Tuesday - peak conference day
            3: 1.3, // Wednesday - peak conference day
            4: 1.2, // Thursday - common conference day
            5: 1.0, // Friday - some conferences end
            6: 0.7, // Saturday - fewer business events
            0: 0.6  // Sunday - minimal business events
        },

        // Hour of day adjustments
        HOUR_MULTIPLIERS: {
            8: 1.1,  // 8 AM - early conferences
            9: 1.3,  // 9 AM - peak start time
            10: 1.2, // 10 AM - common start time
            11: 1.1, // 11 AM - late morning sessions
            12: 0.9, // 12 PM - lunch break
            13: 1.0, // 1 PM - afternoon sessions
            14: 1.2, // 2 PM - peak afternoon
            15: 1.1, // 3 PM - afternoon sessions
            16: 1.0, // 4 PM - late afternoon
            17: 0.8, // 5 PM - winding down
            18: 0.6, // 6 PM - evening events only
            19: 0.7, // 7 PM - evening events
            20: 0.6, // 8 PM - evening events
            21: 0.4, // 9 PM - late events
            22: 0.3  // 10 PM - very late events
        },

        // Seasonal adjustments (1-12 months)
        SEASONAL_MULTIPLIERS: {
            1: 0.8,  // January - post-holiday quiet
            2: 1.1,  // February - conference season starts
            3: 1.3,  // March - peak conference season
            4: 1.3,  // April - peak conference season
            5: 1.2,  // May - continued conference season
            6: 1.0,  // June - summer conferences
            7: 0.7,  // July - summer break
            8: 0.8,  // August - late summer
            9: 1.3,  // September - fall conference season
            10: 1.4, // October - peak fall season
            11: 1.2, // November - continued fall season
            12: 0.6  // December - holiday quiet
        }
    },

    // Specific event patterns and known venues
    KNOWN_EVENT_PATTERNS: {
        'ces': {
            city: 'las vegas',
            dates: { month: 1, days: [5, 6, 7, 8, 9] }, // Early January
            venues: ['Las Vegas Convention Center', 'Sands Expo', 'Tech East', 'Tech West'],
            radius: 3000, // 3km to cover all CES venues
            types: ['convention_center', 'expo_center'],
            description: 'Consumer Electronics Show - largest tech conference'
        },
        'nab_show': {
            city: 'las vegas',
            dates: { month: 4, days: [8, 9, 10, 11, 12] }, // Mid April
            venues: ['Las Vegas Convention Center'],
            radius: 2500,
            types: ['convention_center'],
            description: 'National Association of Broadcasters Show'
        },
        'sxsw': {
            city: 'austin',
            dates: { month: 3, days: [10, 11, 12, 13, 14, 15, 16, 17] }, // Mid March
            venues: ['Austin Convention Center', 'Various downtown venues'],
            radius: 2000, // Covers downtown Austin spread
            types: ['convention_center', 'cultural_center', 'performing_arts_theater'],
            description: 'South by Southwest - music, film, and interactive'
        },
        'comic_con': {
            city: 'san diego',
            dates: { month: 7, days: [20, 21, 22, 23, 24] }, // Late July
            venues: ['San Diego Convention Center'],
            radius: 1500,
            types: ['convention_center'],
            description: 'San Diego Comic Convention'
        },
        'dreamforce': {
            city: 'san francisco',
            dates: { month: 9, days: [12, 13, 14, 15] }, // Mid September
            venues: ['Moscone Center', 'Various SF venues'],
            radius: 1200, // Dense SF area
            types: ['convention_center', 'business_center'],
            description: 'Salesforce Dreamforce conference'
        },
        'mobile_world_congress': {
            city: 'barcelona',
            dates: { month: 2, days: [26, 27, 28] }, // Late February
            venues: ['Fira Barcelona'],
            radius: 1800,
            types: ['convention_center', 'expo_center'],
            description: 'Mobile World Congress'
        }
    },

    // Search optimization parameters
    SEARCH_OPTIMIZATION: {
        // Maximum number of API calls per location
        MAX_API_CALLS_PER_LOCATION: 3,
        
        // Batch processing limits
        MAX_LOCATIONS_PER_BATCH: 5,
        BATCH_DELAY_MS: 200,
        
        // Rate limiting
        MIN_REQUEST_INTERVAL_MS: 100,
        MAX_CONCURRENT_REQUESTS: 3,
        
        // Cache settings
        ENABLE_AGGRESSIVE_CACHING: true,
        CACHE_DURATION_HOURS: 4,
        PRELOAD_CACHE_RADIUS: [500, 1000, 2000], // Common radii to preload
        
        // Result filtering
        MIN_EVENT_SCORE_THRESHOLD: 0.3,
        MIN_TEXT_SEARCH_SCORE: 0.4,
        MAX_RESULTS_PER_LOCATION: 20,
        MAX_FINAL_RESULTS: 50,
        
        // Quality filters
        MIN_RATING_FOR_BONUS: 3.5,
        MIN_REVIEW_COUNT_FOR_BONUS: 20,
        OPERATIONAL_STATUS_REQUIRED: true
    },

    // Text search query templates for different contexts
    TEXT_SEARCH_TEMPLATES: {
        CURRENT_EVENTS: [
            'conference events {currentDate}',
            'meetings seminars {currentMonth}',
            'business events today',
            'networking events this week',
            'corporate gatherings {currentDate}'
        ],
        
        TECH_CONFERENCES: [
            'technology conference {currentMonth}',
            'tech summit {currentYear}',
            'developer conference',
            'startup events',
            'innovation summit'
        ],
        
        BUSINESS_EVENTS: [
            'business conference',
            'corporate meeting',
            'industry summit',
            'professional networking',
            'trade show'
        ],
        
        CULTURAL_EVENTS: [
            'cultural events',
            'art exhibition',
            'museum events',
            'gallery opening',
            'cultural festival'
        ],
        
        CITY_SPECIFIC: {
            'las vegas': [
                'CES {currentYear}',
                'NAB Show',
                'Las Vegas convention',
                'strip conference',
                'vegas trade show'
            ],
            'austin': [
                'SXSW {currentYear}',
                'Austin conference',
                'downtown events',
                'Austin tech meetup'
            ],
            'san francisco': [
                'Dreamforce',
                'SF tech conference',
                'Silicon Valley event',
                'Moscone Center event'
            ]
        }
    },

    // Venue analysis scoring weights
    VENUE_ANALYSIS_WEIGHTS: {
        VENUE_TYPE_SCORE: 0.40,      // 40% - Primary venue type relevance
        NAME_KEYWORD_SCORE: 0.25,    // 25% - Event-related keywords in name
        QUALITY_INDICATORS: 0.20,    // 20% - Rating, reviews, operational status
        TEMPORAL_RELEVANCE: 0.10,    // 10% - Current time/date relevance
        SEARCH_METHOD_BONUS: 0.05    // 5% - How the venue was discovered
    },

    // Clustering parameters for intelligent grouping
    CLUSTERING_CONFIG: {
        // Distance thresholds for different cluster types
        CLUSTER_DISTANCE_THRESHOLDS: {
            'tight': 500,      // 500m - Very close venues (same complex)
            'moderate': 1000,  // 1km - Walking distance
            'loose': 2000,     // 2km - Same area/district
            'city_wide': 5000  // 5km - Same city (for large events)
        },
        
        // Minimum requirements for cluster formation
        MIN_CONTACTS_PER_CLUSTER: 2,
        MIN_EVENTS_PER_CLUSTER: 1,
        MIN_CLUSTER_CONFIDENCE: 0.4,
        
        // Similarity thresholds
        MIN_EVENT_SIMILARITY: 0.6,    // 60% similarity for events to be clustered
        MIN_NAME_SIMILARITY: 0.4,     // 40% name similarity threshold
        MIN_TYPE_OVERLAP: 0.3,        // 30% type overlap required
        
        // Group suggestion parameters
        MAX_AUTO_SUGGESTIONS: 5,      // Maximum auto-generated group suggestions
        MIN_SUGGESTION_CONFIDENCE: 0.5,
        SUGGESTION_PRIORITY_WEIGHTS: {
            'contact_count': 0.3,      // 30% - Number of contacts
            'event_quality': 0.25,     // 25% - Event venue quality
            'temporal_relevance': 0.2, // 20% - How recent/current
            'cluster_confidence': 0.15, // 15% - Cluster analysis confidence
            'venue_importance': 0.1    // 10% - Venue importance/size
        }
    },

    // Performance monitoring thresholds
    PERFORMANCE_THRESHOLDS: {
        // Processing time warnings (milliseconds)
        WARN_PROCESSING_TIME_MS: 5000,    // 5 seconds
        ERROR_PROCESSING_TIME_MS: 15000,  // 15 seconds
        
        // API usage warnings
        WARN_API_CALLS_PER_SESSION: 50,
        ERROR_API_CALLS_PER_SESSION: 100,
        
        // Cache performance expectations
        TARGET_CACHE_HIT_RATE: 0.7,       // 70% cache hit rate target
        MIN_CACHE_HIT_RATE: 0.4,          // 40% minimum acceptable
        
        // Result quality thresholds
        MIN_HIGH_CONFIDENCE_RATIO: 0.2,   // 20% of results should be high confidence
        MIN_EVENTS_PER_LOCATION: 1,       // At least 1 event per location on average
        
        // Error rate thresholds
        MAX_LOCATION_ERROR_RATE: 0.1,     // 10% max location processing errors
        MAX_API_ERROR_RATE: 0.05          // 5% max API error rate
    }
};

// Helper functions for using the configuration

export function getOptimalRadius(eventTypes, cityName = null, currentTime = new Date()) {
    let maxRadius = 0;
    
    // Find the largest appropriate radius for the event types
    eventTypes.forEach(type => {
        const config = EVENT_DETECTION_CONFIG.DISTANCE_THRESHOLDS[type] || 
                      EVENT_DETECTION_CONFIG.DISTANCE_THRESHOLDS.default;
        maxRadius = Math.max(maxRadius, config.base);
    });
    
    // Apply city-specific adjustments
    if (cityName) {
        const cityKey = cityName.toLowerCase().replace(/\s+/g, '_');
        const cityConfig = EVENT_DETECTION_CONFIG.CITY_ADJUSTMENTS[cityKey];
        if (cityConfig) {
            maxRadius = Math.round(maxRadius * cityConfig.multiplier);
        }
    }
    
    // Apply temporal adjustments
    const dayOfWeek = currentTime.getDay();
    const hour = currentTime.getHours();
    const month = currentTime.getMonth() + 1;
    
    const dayMultiplier = EVENT_DETECTION_CONFIG.TEMPORAL_ADJUSTMENTS.WEEKDAY_MULTIPLIERS[dayOfWeek] || 1.0;
    const hourMultiplier = EVENT_DETECTION_CONFIG.TEMPORAL_ADJUSTMENTS.HOUR_MULTIPLIERS[hour] || 1.0;
    const seasonalMultiplier = EVENT_DETECTION_CONFIG.TEMPORAL_ADJUSTMENTS.SEASONAL_MULTIPLIERS[month] || 1.0;
    
    const temporalMultiplier = (dayMultiplier + hourMultiplier + seasonalMultiplier) / 3;
    maxRadius = Math.round(maxRadius * temporalMultiplier);
    
    // Ensure reasonable bounds
    return Math.min(Math.max(maxRadius, 300), 8000); // Between 300m and 8km
}

export function detectKnownEvent(cityName, currentDate) {
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    
    for (const [eventKey, eventConfig] of Object.entries(EVENT_DETECTION_CONFIG.KNOWN_EVENT_PATTERNS)) {
        if (eventConfig.city.toLowerCase() === cityName.toLowerCase() &&
            eventConfig.dates.month === month &&
            eventConfig.dates.days.includes(day)) {
            return {
                eventName: eventKey,
                config: eventConfig,
                isKnownEvent: true
            };
        }
    }
    
    return { isKnownEvent: false };
}

export function generateContextualQueries(cityName, currentDate, eventTypes = []) {
    const templates = EVENT_DETECTION_CONFIG.TEXT_SEARCH_TEMPLATES;
    const queries = [...templates.CURRENT_EVENTS, ...templates.BUSINESS_EVENTS];
    
    // Add tech-specific queries if tech event types are present
    const techTypes = ['convention_center', 'university', 'business_center'];
    if (eventTypes.some(type => techTypes.includes(type))) {
        queries.push(...templates.TECH_CONFERENCES);
    }
    
    // Add cultural queries if cultural event types are present
    const culturalTypes = ['museum', 'art_gallery', 'cultural_center'];
    if (eventTypes.some(type => culturalTypes.includes(type))) {
        queries.push(...templates.CULTURAL_EVENTS);
    }
    
    // Add city-specific queries
    const cityKey = cityName.toLowerCase().replace(/\s+/g, '_');
    if (templates.CITY_SPECIFIC[cityKey]) {
        queries.push(...templates.CITY_SPECIFIC[cityKey]);
    }
    
    // Replace placeholders with actual values
    const currentDateStr = currentDate.toLocaleDateString();
    const currentMonth = currentDate.toLocaleDateString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear().toString();
    
    return queries.map(query => 
        query.replace('{currentDate}', currentDateStr)
             .replace('{currentMonth}', currentMonth)
             .replace('{currentYear}', currentYear)
    ).slice(0, 8); // Limit to 8 queries max
}

export function calculateVenueScore(place, searchMethod = 'nearby_search') {
    const weights = EVENT_DETECTION_CONFIG.VENUE_ANALYSIS_WEIGHTS;
    let totalScore = 0;
    
    // Venue type scoring
    let typeScore = 0;
    if (place.types) {
        place.types.forEach(type => {
            const config = EVENT_DETECTION_CONFIG.DISTANCE_THRESHOLDS[type];
            if (config) {
                const priority = EVENT_DETECTION_CONFIG.EVENT_TYPE_PRIORITIES[type] || 1;
                typeScore = Math.max(typeScore, priority / 10); // Normalize to 0-1
            }
        });
    }
    totalScore += typeScore * weights.VENUE_TYPE_SCORE;
    
    // Name keyword scoring
    const eventKeywords = ['conference', 'convention', 'expo', 'center', 'hall', 'arena'];
    const name = (place.displayName?.text || place.name || '').toLowerCase();
    const keywordMatches = eventKeywords.filter(keyword => name.includes(keyword)).length;
    const nameScore = Math.min(keywordMatches / eventKeywords.length * 2, 1); // Max score of 1
    totalScore += nameScore * weights.NAME_KEYWORD_SCORE;
    
    // Quality indicators
    let qualityScore = 0;
    if (place.businessStatus === 'OPERATIONAL') qualityScore += 0.3;
    if (place.rating && place.rating >= EVENT_DETECTION_CONFIG.SEARCH_OPTIMIZATION.MIN_RATING_FOR_BONUS) {
        qualityScore += (place.rating / 5) * 0.4;
    }
    if (place.userRatingCount && place.userRatingCount >= EVENT_DETECTION_CONFIG.SEARCH_OPTIMIZATION.MIN_REVIEW_COUNT_FOR_BONUS) {
        qualityScore += Math.min(place.userRatingCount / 500, 1) * 0.3;
    }
    totalScore += qualityScore * weights.QUALITY_INDICATORS;
    
    // Temporal relevance (simplified - could be enhanced)
    const currentHour = new Date().getHours();
    const hourMultiplier = EVENT_DETECTION_CONFIG.TEMPORAL_ADJUSTMENTS.HOUR_MULTIPLIERS[currentHour] || 0.5;
    totalScore += hourMultiplier * weights.TEMPORAL_RELEVANCE;
    
    // Search method bonus
    const methodBonus = searchMethod === 'text_search' ? 0.8 : 0.5;
    totalScore += methodBonus * weights.SEARCH_METHOD_BONUS;
    
    return Math.min(totalScore, 1.0); // Cap at 1.0
}

export function shouldProcessLocation(location, existingLocations = []) {
    // Check if location is too close to existing processed locations
    const MIN_DISTANCE_BETWEEN_LOCATIONS = 100; // 100m minimum
    
    return !existingLocations.some(existing => {
        const distance = calculateDistance(
            location.latitude, location.longitude,
            existing.latitude, existing.longitude
        );
        return distance < MIN_DISTANCE_BETWEEN_LOCATIONS;
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}