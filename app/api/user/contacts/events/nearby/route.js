// app/api/user/contacts/events/nearby/route.js - Find Events Near Contacts
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
        const { locations, radius = 1000 } = body;

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

        // Process each unique location
        for (const location of locations) {
            const { latitude, longitude, contactIds = [] } = location;
            
            if (!latitude || !longitude) {
                continue;
            }

            // Create unique key for location (rounded to avoid duplicates)
            const locationKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
            
            if (processedLocations.has(locationKey)) {
                continue;
            }
            
            processedLocations.add(locationKey);

            try {
                // Use Google Places API to find nearby events/venues
                const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=event_venue|conference_center|exhibition_center|convention_center|university&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
                
                const placesResponse = await fetch(placesUrl);
                const placesData = await placesResponse.json();

                if (placesData.status === 'OK' && placesData.results) {
                    placesData.results.forEach(place => {
                        if (place.name && place.geometry) {
                            // Calculate event likelihood score
                            const eventScore = calculateEventScore(place);
                            
                            if (eventScore > 0.3) { // Only include likely event venues
                                events.push({
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
                                    eventScore: eventScore,
                                    isActive: place.business_status === 'OPERATIONAL',
                                    photos: place.photos ? place.photos.slice(0, 2).map(photo => ({
                                        reference: photo.photo_reference,
                                        height: photo.height,
                                        width: photo.width
                                    })) : []
                                });
                            }
                        }
                    });
                }

                // Also search for current events using additional keywords
                const eventsUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=events+conferences+near+${latitude},${longitude}&radius=${radius}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
                
                const eventsResponse = await fetch(eventsUrl);
                const eventsData = await eventsResponse.json();

                if (eventsData.status === 'OK' && eventsData.results) {
                    eventsData.results.forEach(place => {
                        // Avoid duplicates
                        if (!events.some(e => e.id === place.place_id) && place.name && place.geometry) {
                            const eventScore = calculateEventScore(place);
                            
                            if (eventScore > 0.4) { // Higher threshold for text search results
                                events.push({
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
                                    eventScore: eventScore,
                                    isActive: place.business_status === 'OPERATIONAL',
                                    isTextSearch: true,
                                    photos: place.photos ? place.photos.slice(0, 2).map(photo => ({
                                        reference: photo.photo_reference,
                                        height: photo.height,
                                        width: photo.width
                                    })) : []
                                });
                            }
                        }
                    });
                }

            } catch (locationError) {
                console.error('Error processing location:', locationError);
                // Continue with other locations
            }

            // Rate limiting - small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Sort events by relevance score
        events.sort((a, b) => b.eventScore - a.eventScore);

        // Enhance events with additional context
        const enhancedEvents = await enhanceEventsWithContext(events, userId);

        console.log('✅ Found nearby events:', {
            userId,
            locationsProcessed: processedLocations.size,
            eventsFound: enhancedEvents.length
        });

        return NextResponse.json({
            success: true,
            events: enhancedEvents,
            totalLocationsProcessed: processedLocations.size,
            eventsFound: enhancedEvents.length
        });

    } catch (error) {
        console.error('❌ Error finding nearby events:', error);
        
        if (error.message.includes('quota')) {
            return NextResponse.json({ 
                error: 'API quota exceeded. Please try again later.' 
            }, { status: 429 });
        }
        
        return NextResponse.json({ 
            error: 'Failed to find nearby events' 
        }, { status: 500 });
    }
}

// Calculate how likely a place is to be an event venue
function calculateEventScore(place) {
    let score = 0;

    // Type-based scoring
    const eventTypes = [
        'event_venue', 'conference_center', 'exhibition_center', 
        'convention_center', 'university', 'stadium', 'theater',
        'museum', 'art_gallery', 'community_center'
    ];

    const highScoreTypes = ['event_venue', 'conference_center', 'exhibition_center', 'convention_center'];
    const mediumScoreTypes = ['university', 'stadium', 'theater', 'museum'];

    place.types.forEach(type => {
        if (highScoreTypes.includes(type)) {
            score += 0.4;
        } else if (mediumScoreTypes.includes(type)) {
            score += 0.2;
        } else if (eventTypes.includes(type)) {
            score += 0.1;
        }
    });

    // Name-based keywords
    const eventKeywords = [
        'conference', 'convention', 'center', 'hall', 'expo', 'exhibition',
        'forum', 'summit', 'congress', 'symposium', 'workshop', 'seminar',
        'festival', 'fair', 'show', 'arena', 'pavilion', 'auditorium'
    ];

    const name = place.name.toLowerCase();
    eventKeywords.forEach(keyword => {
        if (name.includes(keyword)) {
            score += 0.1;
        }
    });

    // Rating-based scoring (higher rated venues more likely to host events)
    if (place.rating && place.user_ratings_total) {
        if (place.rating >= 4.0 && place.user_ratings_total >= 100) {
            score += 0.2;
        } else if (place.rating >= 3.5 && place.user_ratings_total >= 50) {
            score += 0.1;
        }
    }

    // Business status
    if (place.business_status === 'OPERATIONAL') {
        score += 0.1;
    }

    // Cap the score at 1.0
    return Math.min(score, 1.0);
}

// Enhance events with additional context and filtering
async function enhanceEventsWithContext(events, userId) {
    // Filter for only high-quality events
    const qualityEvents = events.filter(event => 
        event.eventScore > 0.3 && 
        event.isActive &&
        event.name.length > 3 // Avoid single letter or very short names
    );

    // Add temporal context (check if it's likely an active event)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();

    return qualityEvents.map(event => {
        let temporalScore = 0;

        // Business hours logic for event venues
        if (hour >= 9 && hour <= 18) { // Business hours
            temporalScore += 0.3;
        } else if (hour >= 19 && hour <= 22) { // Evening events
            temporalScore += 0.2;
        }

        // Weekday vs weekend
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Weekdays
            temporalScore += 0.2;
        }

        // Event type specific timing
        if (event.types.includes('conference_center') || event.types.includes('convention_center')) {
            if (dayOfWeek >= 2 && dayOfWeek <= 4) { // Tuesday to Thursday
                temporalScore += 0.2;
            }
        }

        return {
            ...event,
            temporalScore,
            overallScore: (event.eventScore + temporalScore) / 2,
            likelihood: temporalScore > 0.3 ? 'high' : temporalScore > 0.1 ? 'medium' : 'low'
        };
    }).sort((a, b) => b.overallScore - a.overallScore);
}

// GET endpoint for testing
export async function GET(request) {
    return NextResponse.json({
        message: 'Nearby events API endpoint. Use POST method with locations data.',
        example: {
            locations: [
                {
                    latitude: 40.7589,
                    longitude: -73.9851,
                    contactIds: ['contact1', 'contact2']
                }
            ],
            radius: 1000
        }
    });
}