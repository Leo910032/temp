// app/api/user/contacts/events/nearby/route.js - Enhanced Nearby Events API
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request) {
    try {
        console.log('🔍 POST /api/user/contacts/events/nearby - Finding nearby events');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const { locations, radius = 1000, eventTypes = [], includeTextSearch = true } = body;

        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            return NextResponse.json({ 
                error: 'Locations array is required' 
            }, { status: 400 });
        }

        // Validate Google Maps API key
        if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
            console.error('Google Maps API key not configured');
            return NextResponse.json({ 
                error: 'Google Maps API not configured' 
            }, { status: 500 });
        }

        const events = [];
        const processedLocations = new Set();
        const detectionResults = {
            locationsProcessed: 0,
            eventsFound: 0,
            highConfidenceEvents: 0,
            venueTypes: {},
            averageEventScore: 0
        };

        // Enhanced event types for better detection
        const defaultEventTypes = [
            'conference_center',
            'convention_center', 
            'exhibition_center',
            'event_venue',
            'university',
            'stadium',
            'theater',
            'community_center',
            'museum',
            'art_gallery'
        ];

        const searchTypes = eventTypes.length > 0 ? eventTypes : defaultEventTypes;

        // Process each unique location
        for (const location of locations) {
            const { latitude, longitude, contactIds = [], metadata = {} } = location;
            
            if (!latitude || !longitude) {
                continue;
            }

            // Create unique key for location (rounded to avoid duplicates)
            const locationKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
            
            if (processedLocations.has(locationKey)) {
                continue;
            }
            
            processedLocations.add(locationKey);
            detectionResults.locationsProcessed++;

            try {
                // Enhanced multi-type venue search
                for (const venueType of searchTypes) {
                    try {
                        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${venueType}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
                        
                        const placesResponse = await fetch(placesUrl);
                        const placesData = await placesResponse.json();

                        if (placesData.status === 'OK' && placesData.results) {
                            placesData.results.forEach(place => {
                                if (place.name && place.geometry && !events.some(e => e.id === place.place_id)) {
                                    const eventAnalysis = analyzeEventVenue(place, venueType);
                                    
                                    if (eventAnalysis.eventScore > 0.3) {
                                        const event = {
                                            id: place.place_id,
                                            name: place.name,
                                            location: {
                                                lat: place.geometry.location.lat,
                                                lng: place.geometry.location.lng
                                            },
                                            types: place.types,
                                            rating: place.rating,
                                            userRatingsTotal: place.user_ratings_total,
                                            vicinity: place.vicinity,
                                            businessStatus: place.business_status,
                                            priceLevel: place.price_level,
                                            contactIds: contactIds,
                                            eventScore: eventAnalysis.eventScore,
                                            confidence: eventAnalysis.confidence,
                                            venueType: venueType,
                                            eventIndicators: eventAnalysis.indicators,
                                            isActive: place.business_status === 'OPERATIONAL',
                                            distanceFromContacts: calculateDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
                                            temporalRelevance: calculateTemporalRelevance(place),
                                            photos: place.photos ? place.photos.slice(0, 3).map(photo => ({
                                                reference: photo.photo_reference,
                                                height: photo.height,
                                                width: photo.width
                                            })) : []
                                        };

                                        events.push(event);
                                        detectionResults.eventsFound++;
                                        
                                        if (eventAnalysis.confidence === 'high') {
                                            detectionResults.highConfidenceEvents++;
                                        }
                                        
                                        detectionResults.venueTypes[venueType] = (detectionResults.venueTypes[venueType] || 0) + 1;
                                    }
                                }
                            });
                        }

                        // Rate limiting between API calls
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } catch (typeError) {
                        console.error(`Error searching for ${venueType}:`, typeError);
                    }
                }

                // Enhanced text search for current events if enabled
                if (includeTextSearch) {
                    try {
                        const currentDate = new Date().toISOString().split('T')[0];
                        const searchQueries = [
                            `conference events ${currentDate}`,
                            `meetings seminars workshops`,
                            `business events today`,
                            `networking events`
                        ];

                        for (const query of searchQueries) {
                            const eventsUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)} near ${latitude},${longitude}&radius=${radius}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
                            
                            const eventsResponse = await fetch(eventsUrl);
                            const eventsData = await eventsResponse.json();

                            if (eventsData.status === 'OK' && eventsData.results) {
                                eventsData.results.forEach(place => {
                                    // Avoid duplicates
                                    if (!events.some(e => e.id === place.place_id) && place.name && place.geometry) {
                                        const eventAnalysis = analyzeEventVenue(place, 'text_search');
                                        
                                        if (eventAnalysis.eventScore > 0.4) { // Higher threshold for text search
                                            const event = {
                                                id: place.place_id,
                                                name: place.name,
                                                location: {
                                                    lat: place.geometry.location.lat,
                                                    lng: place.geometry.location.lng
                                                },
                                                types: place.types,
                                                rating: place.rating,
                                                userRatingsTotal: place.user_ratings_total,
                                                vicinity: place.vicinity || place.formatted_address,
                                                businessStatus: place.business_status,
                                                priceLevel: place.price_level,
                                                contactIds: contactIds,
                                                eventScore: eventAnalysis.eventScore,
                                                confidence: eventAnalysis.confidence,
                                                isTextSearch: true,
                                                searchQuery: query,
                                                eventIndicators: eventAnalysis.indicators,
                                                isActive: place.business_status === 'OPERATIONAL',
                                                distanceFromContacts: calculateDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
                                                temporalRelevance: calculateTemporalRelevance(place),
                                                photos: place.photos ? place.photos.slice(0, 3).map(photo => ({
                                                    reference: photo.photo_reference,
                                                    height: photo.height,
                                                    width: photo.width
                                                })) : []
                                            };

                                            events.push(event);
                                            detectionResults.eventsFound++;
                                            
                                            if (eventAnalysis.confidence === 'high') {
                                                detectionResults.highConfidenceEvents++;
                                            }
                                        }
                                    }
                                });
                            }

                            // Rate limiting between queries
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (textSearchError) {
                        console.error('Error in enhanced text search:', textSearchError);
                    }
                }

            } catch (locationError) {
                console.error('Error processing location:', locationError);
                // Continue with other locations
            }

            // Rate limiting between locations
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Calculate analytics
        if (events.length > 0) {
            detectionResults.averageEventScore = events.reduce((sum, e) => sum + e.eventScore, 0) / events.length;
        }

        // Sort events by comprehensive scoring
        events.sort((a, b) => {
            const scoreA = calculateOverallEventScore(a);
            const scoreB = calculateOverallEventScore(b);
            return scoreB - scoreA;
        });

        // Enhance events with additional context and group potential contacts
        const enhancedEvents = await enhanceEventsWithContactGrouping(events, userId);

        console.log('✅ Enhanced nearby events search completed:', {
            userId,
            ...detectionResults,
            finalEventsReturned: enhancedEvents.length
        });

        return NextResponse.json({
            success: true,
            events: enhancedEvents,
            analytics: detectionResults,
            metadata: {
                searchRadius: radius,
                eventTypesSearched: searchTypes,
                includeTextSearch,
                processedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error finding nearby events:', error);
        
        if (error.message.includes('quota')) {
            return NextResponse.json({ 
                error: 'API quota exceeded. Please try again later.' 
            }, { status: 429 });
        }
        
        return NextResponse.json({ 
            error: 'Failed to find nearby events',
            details: error.message 
        }, { status: 500 });
    }
}

// Enhanced venue analysis with multiple indicators
function analyzeEventVenue(place, searchType) {
    let score = 0;
    const indicators = [];

    // Type-based scoring with enhanced weights
    const typeScoring = {
        'conference_center': 0.9,
        'convention_center': 0.9,
        'exhibition_center': 0.8,
        'event_venue': 0.8,
        'university': 0.6,
        'stadium': 0.7,
        'theater': 0.6,
        'community_center': 0.5,
        'museum': 0.4,
        'art_gallery': 0.4,
        'library': 0.3
    };

    let typeScore = 0;
    place.types.forEach(type => {
        if (typeScoring[type]) {
            typeScore = Math.max(typeScore, typeScoring[type]);
            indicators.push(`venue_type_${type}`);
        }
    });
    score += typeScore;

    // Enhanced name-based analysis
    const eventKeywords = {
        high: ['conference', 'convention', 'expo', 'exhibition', 'summit', 'congress'],
        medium: ['center', 'hall', 'forum', 'symposium', 'seminar', 'workshop'],
        low: ['pavilion', 'auditorium', 'arena', 'theater', 'gallery']
    };

    const name = place.name.toLowerCase();
    
    eventKeywords.high.forEach(keyword => {
        if (name.includes(keyword)) {
            score += 0.3;
            indicators.push(`high_keyword_${keyword}`);
        }
    });
    
    eventKeywords.medium.forEach(keyword => {
        if (name.includes(keyword)) {
            score += 0.2;
            indicators.push(`medium_keyword_${keyword}`);
        }
    });
    
    eventKeywords.low.forEach(keyword => {
        if (name.includes(keyword)) {
            score += 0.1;
            indicators.push(`low_keyword_${keyword}`);
        }
    });

    // Business status and operational indicators
    if (place.business_status === 'OPERATIONAL') {
        score += 0.15;
        indicators.push('operational');
    }

    // Rating and popularity indicators
    if (place.rating && place.user_ratings_total) {
        if (place.rating >= 4.0 && place.user_ratings_total >= 200) {
            score += 0.25;
            indicators.push('highly_rated_popular');
        } else if (place.rating >= 3.5 && place.user_ratings_total >= 50) {
            score += 0.15;
            indicators.push('well_rated');
        } else if (place.user_ratings_total >= 20) {
            score += 0.1;
            indicators.push('has_reviews');
        }
    }

    // Search type bonus
    if (searchType === 'text_search') {
        score += 0.1; // Text search results are more likely to be current events
        indicators.push('text_search_result');
    }

    // Price level indicator (events often have no price level or mid-range)
    if (place.price_level === undefined || place.price_level <= 2) {
        score += 0.05;
        indicators.push('accessible_pricing');
    }

    // Determine confidence level
    let confidence = 'low';
    if (score >= 0.7) confidence = 'high';
    else if (score >= 0.4) confidence = 'medium';

    return {
        eventScore: Math.min(score, 1.0),
        confidence,
        indicators
    };
}

// Calculate temporal relevance based on current time/date
function calculateTemporalRelevance(place) {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    
    let temporalScore = 0;

    // Business hours scoring
    if (hour >= 8 && hour <= 18) {
        temporalScore += 0.3; // Standard business hours
    } else if (hour >= 19 && hour <= 22) {
        temporalScore += 0.2; // Evening events
    }

    // Day of week scoring
    if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Monday to Thursday
        temporalScore += 0.3; // Peak conference days
    } else if (dayOfWeek === 5) { // Friday
        temporalScore += 0.2; // Some events end on Friday
    } else {
        temporalScore += 0.1; // Weekend events less common for business
    }

    // Check for conference-heavy seasons (avoid holiday periods)
    const month = now.getMonth() + 1;
    if ([3, 4, 5, 9, 10, 11].includes(month)) { // Spring and Fall
        temporalScore += 0.2;
    }

    return Math.min(temporalScore, 1.0);
}

// Calculate overall event score combining multiple factors
function calculateOverallEventScore(event) {
    let overallScore = event.eventScore * 0.4; // Base event likelihood (40%)
    
    // Add temporal relevance (20%)
    overallScore += (event.temporalRelevance || 0) * 0.2;
    
    // Add rating factor (20%)
    if (event.rating && event.userRatingsTotal) {
        const ratingFactor = (event.rating / 5) * Math.min(event.userRatingsTotal / 100, 1);
        overallScore += ratingFactor * 0.2;
    }
    
    // Add proximity factor (10%)
    const proximityFactor = Math.max(0, 1 - (event.distanceFromContacts || 0) / 5); // Within 5km is good
    overallScore += proximityFactor * 0.1;
    
    // Add contact density factor (10%)
    const contactFactor = Math.min(event.contactIds.length / 10, 1); // More contacts nearby = higher score
    overallScore += contactFactor * 0.1;

    return Math.min(overallScore, 1.0);
}

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// Enhance events with contact grouping potential
async function enhanceEventsWithContactGrouping(events, userId) {
    return events.map(event => {
        // Calculate grouping potential
        const groupingPotential = {
            canCreateGroup: event.contactIds.length >= 2,
            suggestedGroupName: `${event.name} Attendees`,
            groupSize: event.contactIds.length,
            groupType: 'event',
            confidence: event.confidence
        };

        // Add event context
        const eventContext = {
            isLikelyCurrentEvent: event.temporalRelevance > 0.6,
            isPopularVenue: event.userRatingsTotal > 100,
            isHighQualityVenue: event.rating > 4.0,
            hasPhotos: event.photos.length > 0,
            searchMethod: event.isTextSearch ? 'text_search' : 'type_search'
        };

        return {
            ...event,
            groupingPotential,
            eventContext,
            enhancedAt: new Date().toISOString()
        };
    });
}

// GET endpoint for testing and documentation
export async function GET(request) {
    return NextResponse.json({
        message: 'Enhanced Nearby Events API endpoint. Use POST method with locations data.',
        version: '2.0',
        features: [
            'Multi-type venue search',
            'Enhanced event scoring',
            'Temporal relevance analysis',
            'Smart text search',
            'Contact grouping potential',
            'Comprehensive analytics'
        ],
        example: {
            locations: [
                {
                    latitude: 40.7589,
                    longitude: -73.9851,
                    contactIds: ['contact1', 'contact2'],
                    metadata: { source: 'business_cards' }
                }
            ],
            radius: 1000,
            eventTypes: ['conference_center', 'convention_center'],
            includeTextSearch: true
        },
        supportedEventTypes: [
            'conference_center',
            'convention_center', 
            'exhibition_center',
            'event_venue',
            'university',
            'stadium',
            'theater',
            'community_center',
            'museum',
            'art_gallery'
        ]
    });
}