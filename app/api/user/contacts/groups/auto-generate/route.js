// app/api/user/contacts/groups/auto-generate/route.js - ENHANCED VERSION

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// Helper function to create groups with enhanced event detection
const createGroupsWithEventDetection = async (contacts, options) => {
    const groups = {};
    console.log('🤖 Starting enhanced auto-group generation for', contacts.length, 'contacts');

    // 1. Group by company (existing logic enhanced)
    if (options.groupByCompany) {
        console.log('🏢 Analyzing company groups...');
        contacts.forEach(contact => {
            if (contact.company) {
                const companyName = contact.company.trim();
                if (!groups[`company_${companyName}`]) {
                    groups[`company_${companyName}`] = { 
                        name: `${companyName} Team`, 
                        type: 'company', 
                        contactIds: new Set(),
                        companyName: companyName,
                        confidence: 'high'
                    };
                }
                groups[`company_${companyName}`].contactIds.add(contact.id);
            }
        });
    }
    
    // 2. Enhanced location grouping with event detection
    if (options.groupByLocation) {
        console.log('📍 Analyzing location clusters...');
        
        // Group contacts by proximity (within ~500m)
        const locationClusters = clusterContactsByProximity(contacts, 0.005); // ~500m
        
        for (const cluster of locationClusters) {
            if (cluster.length >= options.minGroupSize) {
                const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
                const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;
                
                // Try to find nearby events for this cluster
                const nearbyEvents = await findNearbyEventsForLocation(centerLat, centerLng, 1000);
                
                if (nearbyEvents.length > 0) {
                    // Create event-based groups
                    nearbyEvents.forEach((event, index) => {
                        if (event.eventScore > 0.4) { // High confidence events only
                            const groupKey = `event_${event.id}_${index}`;
                            groups[groupKey] = {
                                name: `${event.name} Attendees`,
                                type: 'event',
                                contactIds: new Set(cluster.map(c => c.id)),
                                eventData: event,
                                confidence: event.eventScore > 0.7 ? 'high' : 'medium',
                                reason: `Contacts found near ${event.name}`
                            };
                        }
                    });
                } else {
                    // Fallback to location-based group
                    const locationName = await getLocationName(centerLat, centerLng);
                    const groupKey = `location_${centerLat.toFixed(3)}_${centerLng.toFixed(3)}`;
                    groups[groupKey] = {
                        name: locationName || `Location Group`,
                        type: 'location',
                        contactIds: new Set(cluster.map(c => c.id)),
                        confidence: 'medium',
                        coordinates: { lat: centerLat, lng: centerLng }
                    };
                }
            }
        }
    }

    // 3. Enhanced event detection from contact metadata
    if (options.groupByEvents) {
        console.log('📅 Analyzing event metadata...');
        
        // Group by explicit event info
        contacts.forEach(contact => {
            if (contact.eventInfo?.eventName) {
                const eventName = contact.eventInfo.eventName.trim();
                const groupKey = `metadata_event_${eventName.replace(/\s+/g, '_')}`;
                if (!groups[groupKey]) {
                    groups[groupKey] = { 
                        name: `${eventName} Contacts`, 
                        type: 'event', 
                        contactIds: new Set(),
                        eventMetadata: contact.eventInfo,
                        confidence: 'high'
                    };
                }
                groups[groupKey].contactIds.add(contact.id);
            }
        });

        // Analyze contact timestamps for potential events
        const timeBasedClusters = analyzeTimeBasedClusters(contacts);
        timeBasedClusters.forEach(cluster => {
            if (cluster.contacts.length >= options.minGroupSize) {
                const groupKey = `time_cluster_${cluster.date}`;
                groups[groupKey] = {
                    name: `${cluster.date} Event`,
                    type: 'event',
                    contactIds: new Set(cluster.contacts.map(c => c.id)),
                    confidence: cluster.confidence,
                    reason: `${cluster.contacts.length} contacts added within ${cluster.timeWindow} hours`
                };
            }
        });
    }

    // 4. Smart duplicate detection and merging
    const mergedGroups = await smartMergeGroups(Object.values(groups), contacts);

    // 5. Filter and format results
    return mergedGroups
        .filter(group => group.contactIds.size >= options.minGroupSize)
        .map(group => ({
            ...group,
            contactIds: Array.from(group.contactIds),
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            autoGenerated: true
        }))
        .slice(0, options.maxGroups);
};

// Enhanced clustering algorithm for location-based grouping
function clusterContactsByProximity(contacts, threshold) {
    const contactsWithLocation = contacts.filter(c => c.location?.latitude && c.location?.longitude);
    const clusters = [];
    const processed = new Set();

    for (const contact of contactsWithLocation) {
        if (processed.has(contact.id)) continue;

        const cluster = [contact];
        processed.add(contact.id);

        // Find nearby contacts
        for (const otherContact of contactsWithLocation) {
            if (processed.has(otherContact.id)) continue;

            const distance = calculateHaversineDistance(
                contact.location.latitude, contact.location.longitude,
                otherContact.location.latitude, otherContact.location.longitude
            );

            if (distance <= threshold) {
                cluster.push(otherContact);
                processed.add(otherContact.id);
            }
        }

        if (cluster.length >= 2) {
            clusters.push(cluster);
        }
    }

    return clusters;
}

// Calculate distance between two coordinates using Haversine formula
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Find nearby events using Google Places API
async function findNearbyEventsForLocation(lat, lng, radius = 1000) {
    try {
        if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
            console.warn('⚠️ Google Maps API key not configured for event detection');
            return [];
        }

        const eventVenueTypes = [
            'conference_center',
            'convention_center', 
            'exhibition_center',
            'event_venue',
            'university',
            'stadium',
            'theater'
        ];

        const events = [];

        // Search for event venues
        for (const venueType of eventVenueTypes) {
            try {
                const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${venueType}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
                
                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.results) {
                    data.results.forEach(place => {
                        const eventScore = calculateEventLikelihood(place);
                        if (eventScore > 0.3) {
                            events.push({
                                id: place.place_id,
                                name: place.name,
                                types: place.types,
                                location: {
                                    lat: place.geometry.location.lat,
                                    lng: place.geometry.location.lng
                                },
                                rating: place.rating,
                                vicinity: place.vicinity,
                                eventScore: eventScore,
                                venueType: venueType,
                                businessStatus: place.business_status
                            });
                        }
                    });
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error searching for ${venueType}:`, error);
            }
        }

        // Additional text search for current events
        try {
            const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=conference+event+meeting+near+${lat},${lng}&radius=${radius}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
            
            const response = await fetch(textSearchUrl);
            const data = await response.json();

            if (data.status === 'OK' && data.results) {
                data.results.forEach(place => {
                    if (!events.some(e => e.id === place.place_id)) {
                        const eventScore = calculateEventLikelihood(place);
                        if (eventScore > 0.4) {
                            events.push({
                                id: place.place_id,
                                name: place.name,
                                types: place.types,
                                location: {
                                    lat: place.geometry.location.lat,
                                    lng: place.geometry.location.lng
                                },
                                rating: place.rating,
                                vicinity: place.vicinity || place.formatted_address,
                                eventScore: eventScore,
                                isTextSearch: true,
                                businessStatus: place.business_status
                            });
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error in text search for events:', error);
        }

        // Sort by event likelihood and return top results
        return events
            .sort((a, b) => b.eventScore - a.eventScore)
            .slice(0, 5); // Top 5 most likely events

    } catch (error) {
        console.error('Error finding nearby events:', error);
        return [];
    }
}

// Calculate how likely a place is to be hosting events
function calculateEventLikelihood(place) {
    let score = 0;

    // Type-based scoring
    const highScoreTypes = ['conference_center', 'convention_center', 'exhibition_center', 'event_venue'];
    const mediumScoreTypes = ['university', 'stadium', 'theater', 'community_center'];
    const lowScoreTypes = ['museum', 'art_gallery', 'library'];

    place.types.forEach(type => {
        if (highScoreTypes.includes(type)) score += 0.5;
        else if (mediumScoreTypes.includes(type)) score += 0.3;
        else if (lowScoreTypes.includes(type)) score += 0.1;
    });

    // Name-based keywords
    const eventKeywords = [
        'conference', 'convention', 'center', 'hall', 'expo', 'exhibition',
        'forum', 'summit', 'congress', 'symposium', 'seminar', 'workshop',
        'festival', 'arena', 'pavilion', 'auditorium'
    ];

    const name = place.name.toLowerCase();
    eventKeywords.forEach(keyword => {
        if (name.includes(keyword)) score += 0.15;
    });

    // Business status
    if (place.business_status === 'OPERATIONAL') score += 0.1;

    // Rating and reviews (higher rated venues more likely to host events)
    if (place.rating && place.user_ratings_total) {
        if (place.rating >= 4.0 && place.user_ratings_total >= 100) score += 0.2;
        else if (place.rating >= 3.5) score += 0.1;
    }

    // Temporal relevance (current day/time)
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Business hours boost
    if (hour >= 8 && hour <= 20) score += 0.1;
    
    // Weekday boost for business venues
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (highScoreTypes.some(type => place.types.includes(type))) {
            score += 0.15;
        }
    }

    return Math.min(score, 1.0);
}

// Get location name using reverse geocoding
async function getLocationName(lat, lng) {
    try {
        if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return null;

        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
            const result = data.results[0];
            
            // Try to get a meaningful location name
            const addressComponents = result.address_components;
            
            // Look for neighborhood, locality, or administrative area
            const relevantTypes = ['neighborhood', 'locality', 'sublocality', 'administrative_area_level_2'];
            
            for (const type of relevantTypes) {
                const component = addressComponents.find(comp => comp.types.includes(type));
                if (component) {
                    return `${component.long_name} Area`;
                }
            }
            
            // Fallback to formatted address (first part)
            const addressParts = result.formatted_address.split(',');
            return addressParts[0] ? `${addressParts[0]} Area` : 'Location Group';
        }
    } catch (error) {
        console.error('Error getting location name:', error);
    }
    
    return 'Location Group';
}

// Analyze time-based patterns for event detection
function analyzeTimeBasedClusters(contacts) {
    const clusters = [];
    const dateGroups = {};

    // Group contacts by date
    contacts.forEach(contact => {
        const date = new Date(contact.submittedAt || contact.createdAt);
        const dateKey = date.toDateString();
        
        if (!dateGroups[dateKey]) {
            dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push({
            ...contact,
            timestamp: date.getTime()
        });
    });

    // Analyze each date group for clustering
    Object.entries(dateGroups).forEach(([dateKey, dayContacts]) => {
        if (dayContacts.length < 2) return;

        // Sort by time
        dayContacts.sort((a, b) => a.timestamp - b.timestamp);

        // Find time clusters (contacts added within 3 hours of each other)
        const timeClusters = [];
        let currentCluster = [dayContacts[0]];

        for (let i = 1; i < dayContacts.length; i++) {
            const timeDiff = (dayContacts[i].timestamp - dayContacts[i-1].timestamp) / (1000 * 60 * 60); // hours
            
            if (timeDiff <= 3) { // 3 hour window
                currentCluster.push(dayContacts[i]);
            } else {
                if (currentCluster.length >= 2) {
                    timeClusters.push(currentCluster);
                }
                currentCluster = [dayContacts[i]];
            }
        }

        // Don't forget the last cluster
        if (currentCluster.length >= 2) {
            timeClusters.push(currentCluster);
        }

        // Convert time clusters to group suggestions
        timeClusters.forEach(cluster => {
            const timeSpan = (cluster[cluster.length - 1].timestamp - cluster[0].timestamp) / (1000 * 60 * 60);
            const confidence = cluster.length >= 5 ? 'high' : cluster.length >= 3 ? 'medium' : 'low';
            
            clusters.push({
                date: new Date(cluster[0].timestamp).toLocaleDateString(),
                contacts: cluster,
                timeWindow: Math.ceil(timeSpan),
                confidence: confidence
            });
        });
    });

    return clusters;
}

// Smart group merging to avoid duplicates
async function smartMergeGroups(groups, contacts) {
    const mergedGroups = [];
    const processedContactSets = [];

    for (const group of groups) {
        const contactSet = new Set(group.contactIds);
        let shouldMerge = false;
        let mergeTargetIndex = -1;

        // Check for overlap with existing groups
        for (let i = 0; i < processedContactSets.length; i++) {
            const existingSet = processedContactSets[i];
            const intersection = new Set([...contactSet].filter(id => existingSet.has(id)));
            const overlapRatio = intersection.size / Math.min(contactSet.size, existingSet.size);

            // If more than 70% overlap, consider merging
            if (overlapRatio > 0.7) {
                shouldMerge = true;
                mergeTargetIndex = i;
                break;
            }
        }

        if (shouldMerge && mergeTargetIndex !== -1) {
            // Merge with existing group
            const existingGroup = mergedGroups[mergeTargetIndex];
            const mergedContactIds = new Set([...existingGroup.contactIds, ...contactSet]);
            
            // Choose the better group name and type
            const betterGroup = group.confidence === 'high' || 
                              (group.confidence === 'medium' && existingGroup.confidence === 'low') ? 
                              group : existingGroup;

            mergedGroups[mergeTargetIndex] = {
                ...betterGroup,
                contactIds: mergedContactIds,
                mergedFrom: [existingGroup.name, group.name],
                confidence: group.confidence === 'high' || existingGroup.confidence === 'high' ? 'high' :
                           group.confidence === 'medium' || existingGroup.confidence === 'medium' ? 'medium' : 'low'
            };

            processedContactSets[mergeTargetIndex] = mergedContactIds;
        } else {
            // Add as new group
            mergedGroups.push(group);
            processedContactSets.push(contactSet);
        }
    }

    return mergedGroups;
}

// Main POST handler with enhanced auto-generation
export async function POST(request) {
    try {
        console.log('🤖 POST /api/user/contacts/groups/auto-generate - Enhanced auto-generation');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const options = {
            groupByCompany: body.options?.groupByCompany !== false,
            groupByLocation: body.options?.groupByLocation !== false,
            groupByEvents: body.options?.groupByEvents !== false,
            minGroupSize: body.options?.minGroupSize || 2,
            maxGroups: body.options?.maxGroups || 50,
            enhancedEventDetection: body.options?.enhancedEventDetection !== false,
            ...body.options
        };
        
        console.log('🔧 Auto-generation options:', options);

        // Fetch all user contacts
        const contactsRef = adminDb.collection('Contacts').doc(userId);
        const contactsDoc = await contactsRef.get();
        if (!contactsDoc.exists) {
            return NextResponse.json({ 
                success: true, 
                groupsCreated: 0, 
                message: 'No contacts to group.' 
            });
        }
        
        const allContacts = contactsDoc.data().contacts || [];
        console.log('📊 Processing', allContacts.length, 'contacts for auto-grouping');

        // Generate new groups with enhanced logic
        const newGroups = await createGroupsWithEventDetection(allContacts, options);
        
        if (newGroups.length === 0) {
            return NextResponse.json({ 
                success: true, 
                groupsCreated: 0, 
                message: 'No new groups could be generated with current settings.' 
            });
        }

        console.log('🎯 Generated', newGroups.length, 'potential groups');

        // Fetch existing groups to avoid duplicates
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();
        let existingGroups = [];
        if (groupsDoc.exists) {
            existingGroups = groupsDoc.data().groups || [];
        }
        
        const existingGroupNames = new Set(existingGroups.map(g => g.name.toLowerCase()));

        // Filter out duplicates and add enhanced metadata
        const uniqueNewGroups = newGroups
            .filter(g => !existingGroupNames.has(g.name.toLowerCase()))
            .map(group => ({
                ...group,
                description: group.reason || generateGroupDescription(group),
                autoGenerated: true,
                generationMethod: 'enhanced_v2',
                generatedAt: new Date().toISOString()
            }));

        if (uniqueNewGroups.length === 0) {
            return NextResponse.json({ 
                success: true, 
                groupsCreated: 0, 
                message: 'All potential groups already exist.' 
            });
        }

        // Save new groups
        const updatedGroups = [...existingGroups, ...uniqueNewGroups];
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length,
            lastAutoGeneration: {
                timestamp: new Date().toISOString(),
                groupsCreated: uniqueNewGroups.length,
                options: options
            }
        }, { merge: true });

        console.log('✅ Enhanced auto-generation complete:', {
            userId,
            groupsCreated: uniqueNewGroups.length,
            eventBasedGroups: uniqueNewGroups.filter(g => g.type === 'event').length,
            companyGroups: uniqueNewGroups.filter(g => g.type === 'company').length,
            locationGroups: uniqueNewGroups.filter(g => g.type === 'location').length
        });

        return NextResponse.json({
            success: true,
            groupsCreated: uniqueNewGroups.length,
            newGroups: uniqueNewGroups,
            analytics: {
                totalContactsProcessed: allContacts.length,
                eventBasedGroups: uniqueNewGroups.filter(g => g.type === 'event').length,
                companyGroups: uniqueNewGroups.filter(g => g.type === 'company').length,
                locationGroups: uniqueNewGroups.filter(g => g.type === 'location').length,
                highConfidenceGroups: uniqueNewGroups.filter(g => g.confidence === 'high').length
            },
            message: `Successfully generated ${uniqueNewGroups.length} new groups with enhanced event detection.`
        });

    } catch (error) {
        console.error('❌ Error in enhanced auto-group generation:', error);
        return NextResponse.json({ 
            error: 'Failed to auto-generate groups',
            details: error.message 
        }, { status: 500 });
    }
}

// Helper function to generate group descriptions
function generateGroupDescription(group) {
    switch (group.type) {
        case 'event':
            if (group.eventData) {
                return `Contacts found near ${group.eventData.name} (${group.contactIds.length} people)`;
            }
            return `Event-based group with ${group.contactIds.length} contacts`;
        
        case 'company':
            return `Team members from ${group.companyName} (${group.contactIds.length} people)`;
        
        case 'location':
            return `Contacts from the same location (${group.contactIds.length} people)`;
        
        default:
            return `Auto-generated group with ${group.contactIds.length} contacts`;
    }
}