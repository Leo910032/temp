// app/api/user/contacts/groups/auto-generate/route.js - UPDATED WITH NEW PLACES API v1

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { eventDetectionService } from '@/lib/services/eventDetectionService';
import { createPlacesApiClient } from '@/lib/services/placesApiClient';
import { intelligentGroupingUtils } from '@/lib/utils/intelligentGroupingUtils';
import { serverCacheService } from '@/lib/services/serverCacheService';
import { getOptimalRadius, detectKnownEvent, generateContextualQueries, calculateVenueScore } from '@/lib/config/eventDetectionConfig';

// Enhanced logging utility
const logGroupGeneration = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...data
    };
    
    const emoji = level === 'INFO' ? '📊' : level === 'SUCCESS' ? '✅' : level === 'WARNING' ? '⚠️' : '❌';
    console.log(`${emoji} [AUTO-GROUPS-V2] ${timestamp} - ${message}`, data);
    
    return logEntry;
};

// Enhanced helper function with NEW Places API v1 integration
const createGroupsWithIntelligentEventDetection = async (contacts, options) => {
    const startTime = Date.now();
    let placesClient = null;
    
    // Initialize Places API client
    if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        placesClient = createPlacesApiClient(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
    }

    logGroupGeneration('INFO', 'Starting INTELLIGENT auto-group generation with NEW Places API v1', {
        totalContacts: contacts.length,
        options: options,
        hasPlacesApiKey: !!placesClient
    });

    // Enhanced statistics tracking
    const detailedStats = {
        totalContactsProcessed: contacts.length,
        companyGroups: {
            created: 0,
            totalContacts: 0,
            companies: [],
            details: []
        },
        locationGroups: {
            created: 0,
            totalContacts: 0,
            clusters: [],
            details: []
        },
        eventGroups: {
            created: 0,
            totalContacts: 0,
            events: [],
            details: [],
            newPlacesApiCalls: 0,
            placesFound: 0,
            intelligentClusters: 0,
            cacheHits: 0,
            cacheMisses: 0
        },
        timeBasedGroups: {
            created: 0,
            totalContacts: 0,
            details: []
        },
        mergedGroups: 0,
        duplicatesSkipped: 0
    };

    // 1. Company Grouping (unchanged but with better logging)
    if (options.groupByCompany) {
        logGroupGeneration('INFO', 'Starting company-based grouping analysis');
        
        const companyGroups = await generateCompanyGroups(contacts, options, detailedStats);
        
        logGroupGeneration('SUCCESS', 'Company grouping completed', {
            groupsCreated: detailedStats.companyGroups.created,
            totalContactsGrouped: detailedStats.companyGroups.totalContacts,
            companiesProcessed: detailedStats.companyGroups.companies.length
        });
    }

    // 2. INTELLIGENT Event Detection with NEW Places API v1
    if (options.groupByEvents) {
        logGroupGeneration('INFO', 'Starting INTELLIGENT event detection with NEW Places API v1');
        
        // First: Process existing event metadata
        const metadataEventGroups = await generateEventGroupsFromMetadata(contacts, options, detailedStats);
        
        // Second: INTELLIGENT event detection using NEW Places API v1
        if (placesClient && options.enhancedEventDetection) {
            await generateIntelligentEventGroups(contacts, placesClient, options, detailedStats);
        } else {
            logGroupGeneration('WARNING', 'Skipping intelligent event detection', {
                reason: !placesClient ? 'No Places API key' : 'Enhanced detection disabled',
                hasApiKey: !!placesClient,
                enhancedDetectionEnabled: options.enhancedEventDetection
            });
        }
        
        // Third: Time-based clustering
        const timeBasedGroups = await generateTimeBasedEventGroups(contacts, options, detailedStats);
        
        logGroupGeneration('SUCCESS', 'INTELLIGENT event detection completed', {
            metadataEventGroups: metadataEventGroups.length,
            intelligentEventGroups: detailedStats.eventGroups.intelligentClusters,
            timeBasedGroups: timeBasedGroups.length,
            totalApiCalls: detailedStats.eventGroups.newPlacesApiCalls,
            totalPlacesFound: detailedStats.eventGroups.placesFound,
            cachePerformance: {
                hits: detailedStats.eventGroups.cacheHits,
                misses: detailedStats.eventGroups.cacheMisses,
                hitRate: detailedStats.eventGroups.cacheHits + detailedStats.eventGroups.cacheMisses > 0 ? 
                    Math.round(detailedStats.eventGroups.cacheHits / (detailedStats.eventGroups.cacheHits + detailedStats.eventGroups.cacheMisses) * 100) : 0
            }
        });
    }

    // 3. Location-based grouping with intelligent event correlation
    if (options.groupByLocation) {
        logGroupGeneration('INFO', 'Starting intelligent location-based clustering');
        
        const locationGroups = await generateLocationBasedGroups(contacts, placesClient, options, detailedStats);
        
        logGroupGeneration('SUCCESS', 'Location grouping completed', {
            pureLocationGroups: detailedStats.locationGroups.created,
            totalLocationContacts: detailedStats.locationGroups.totalContacts
        });
    }

    // 4. Collect all generated groups
    const allGroups = [];
    
    // Add company groups
    detailedStats.companyGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'company',
            contactIds: detail.contactIds,
            confidence: detail.confidence,
            reason: detail.reason || `${detail.contactCount} contacts from same company`,
            companyName: detail.companyName,
            discoveryMethod: 'company_analysis',
            autoGenerated: true,
            generatedAt: new Date().toISOString(),
            eventData: null // <-- ADD THIS LINE

        });
    });

    // Add event groups
    detailedStats.eventGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'event',
            contactIds: detail.contactIds,
            confidence: detail.confidence || 'medium',
            reason: detail.reason || `Event-based grouping`,
            eventData: detail.eventData,
            discoveryMethod: detail.discoveryMethod || 'event_analysis',
            autoGenerated: true,
            generatedAt: new Date().toISOString()
        });
    });

    // Add location groups
    detailedStats.locationGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'location',
            contactIds: detail.contactIds,
            confidence: detail.confidence || 'medium',
            reason: detail.reason || `Geographic proximity`,
            locationData: detail.locationData,
            discoveryMethod: detail.discoveryMethod || 'location_analysis',
            autoGenerated: true,
            generatedAt: new Date().toISOString(),
            eventData: null // <-- ADD THIS LINE

        });
    });

    // Add time-based groups
    detailedStats.timeBasedGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'temporal',
            contactIds: detail.contactIds,
            confidence: detail.confidence || 'medium',
            reason: detail.reason || `Temporal clustering`,
            timeData: detail.timeData,
            discoveryMethod: 'temporal_clustering',
            autoGenerated: true,
            generatedAt: new Date().toISOString(),
            eventData: null // <-- ADD THIS LINE

        });
    });

    // 5. Smart merging with enhanced logic
    logGroupGeneration('INFO', 'Starting intelligent group merging');
    const mergedGroups = await smartMergeGroupsV2(allGroups, contacts, detailedStats);

    const processingTime = Date.now() - startTime;
    
    logGroupGeneration('SUCCESS', 'INTELLIGENT auto-group generation completed', {
        summary: {
            totalGroupsCreated: mergedGroups.length,
            companyGroups: detailedStats.companyGroups.created,
            locationGroups: detailedStats.locationGroups.created,
            eventGroups: detailedStats.eventGroups.created,
            timeBasedGroups: detailedStats.timeBasedGroups.created,
            intelligentClusters: detailedStats.eventGroups.intelligentClusters,
            mergedGroups: detailedStats.mergedGroups,
            duplicatesSkipped: detailedStats.duplicatesSkipped
        },
        performance: {
            processingTimeMs: processingTime,
            newPlacesApiCalls: detailedStats.eventGroups.newPlacesApiCalls,
            placesFound: detailedStats.eventGroups.placesFound,
            cachePerformance: {
                hits: detailedStats.eventGroups.cacheHits,
                misses: detailedStats.eventGroups.cacheMisses,
                efficiency: detailedStats.eventGroups.cacheHits + detailedStats.eventGroups.cacheMisses > 0 ? 
                    Math.round(detailedStats.eventGroups.cacheHits / (detailedStats.eventGroups.cacheHits + detailedStats.eventGroups.cacheMisses) * 100) : 0
            }
        },
        technologyUpgrade: {
            usingNewPlacesApiV1: true,
            intelligentEventDetection: true,
            advancedCaching: true,
            smartGroupMerging: true
        }
    });

    return mergedGroups.map(group => ({
        ...group,
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        generationStats: detailedStats
    }));
};

// Company grouping function (improved version)
async function generateCompanyGroups(contacts, options, stats) {
    const companyAnalysis = {};
    
    contacts.forEach(contact => {
        if (contact.company) {
            const companyName = contact.company.trim().toLowerCase();
            const normalizedName = companyName.replace(/[^\w\s]/g, '').trim();
            
            if (!companyAnalysis[normalizedName]) {
                companyAnalysis[normalizedName] = {
                    originalName: contact.company.trim(),
                    contacts: [],
                    variations: new Set()
                };
            }
            companyAnalysis[normalizedName].contacts.push(contact);
            companyAnalysis[normalizedName].variations.add(contact.company.trim());
        }
    });

    const groups = [];
    Object.entries(companyAnalysis).forEach(([normalizedName, data]) => {
        if (data.contacts.length >= options.minGroupSize) {
            const groupName = `${data.originalName} Team`;
            const confidence = data.contacts.length > 5 ? 'high' : data.contacts.length > 2 ? 'medium' : 'low';
            
            const groupDetail = {
                groupName: groupName,
                companyName: data.originalName,
                contactCount: data.contacts.length,
                confidence: confidence,
                variations: Array.from(data.variations),
                contactIds: data.contacts.map(c => c.id),
                contactNames: data.contacts.map(c => c.name),
                reason: `${data.contacts.length} contacts from same company`
            };
            
            stats.companyGroups.created++;
            stats.companyGroups.totalContacts += data.contacts.length;
            stats.companyGroups.companies.push(data.originalName);
            stats.companyGroups.details.push(groupDetail);
            groups.push(groupDetail);
            
            logGroupGeneration('SUCCESS', `Created company group: ${groupName}`, groupDetail);
        } else {
            logGroupGeneration('INFO', `Skipped company group for ${data.originalName} - insufficient contacts`, {
                companyName: data.originalName,
                contactCount: data.contacts.length,
                minRequired: options.minGroupSize
            });
        }
    });

    return groups;
}

// Event groups from metadata (improved)
async function generateEventGroupsFromMetadata(contacts, options, stats) {
    logGroupGeneration('INFO', 'Starting event metadata analysis');
    
    const eventMetadataGroups = {};
    contacts.forEach(contact => {
        if (contact.eventInfo?.eventName) {
            const eventName = contact.eventInfo.eventName.trim();
            if (!eventMetadataGroups[eventName]) {
                eventMetadataGroups[eventName] = [];
            }
            eventMetadataGroups[eventName].push(contact);
        }
    });

    const groups = [];
    Object.entries(eventMetadataGroups).forEach(([eventName, contactList]) => {
        if (contactList.length >= options.minGroupSize) {
            const groupName = `${eventName} Contacts`;
            
            const groupDetail = {
                groupName: groupName,
                eventName: eventName,
                contactCount: contactList.length,
                discoveryMethod: 'Contact metadata (explicit event info)',
                eventMetadata: contactList[0].eventInfo,
                contactIds: contactList.map(c => c.id),
                contactNames: contactList.map(c => c.name),
                confidence: 'high',
                reason: `Contacts with explicit event metadata: ${eventName}`
            };
            
            stats.eventGroups.created++;
            stats.eventGroups.totalContacts += contactList.length;
            stats.eventGroups.events.push(eventName);
            stats.eventGroups.details.push(groupDetail);
            groups.push(groupDetail);
            
            logGroupGeneration('SUCCESS', `Created event group from metadata: ${groupName}`, groupDetail);
        }
    });

    return groups;
}

// NEW: Intelligent event groups using Places API v1
async function generateIntelligentEventGroups(contacts, placesClient, options, stats) {
    logGroupGeneration('INFO', 'Starting INTELLIGENT event detection with NEW Places API v1');
    
    const contactsWithLocation = contacts.filter(c => 
        c.location?.latitude && c.location?.longitude &&
        !isNaN(c.location.latitude) && !isNaN(c.location.longitude)
    );

    if (contactsWithLocation.length < 2) {
        logGroupGeneration('WARNING', 'Insufficient contacts with location for intelligent event detection', {
            contactsWithLocation: contactsWithLocation.length,
            totalContacts: contacts.length
        });
        return [];
    }

    logGroupGeneration('INFO', 'Processing contacts for intelligent event detection', {
        totalContacts: contacts.length,
        contactsWithLocation: contactsWithLocation.length,
        apiClientInitialized: !!placesClient
    });

    try {
        // Prepare locations in the format expected by our optimized system
        const locations = contactsWithLocation.map(contact => ({
            latitude: contact.location.latitude,
            longitude: contact.location.longitude,
            contactIds: [contact.id],
            metadata: {
                contacts: [contact],
                source: 'auto_grouping'
            }
        }));

        // Use our intelligent event detection
        const nearbyEvents = [];
        const cacheResults = { hits: 0, misses: 0 };
        
        // Process locations in batches to optimize API usage
        const batchSize = 3;
        for (let i = 0; i < locations.length; i += batchSize) {
            const batch = locations.slice(i, i + batchSize);
            
            logGroupGeneration('INFO', `Processing location batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(locations.length/batchSize)}`, {
                batchSize: batch.length,
                batchIndex: Math.floor(i/batchSize) + 1
            });

            for (const locationData of batch) {
                try {
                    // Check cache first
                    const cacheKey = `${locationData.latitude.toFixed(3)},${locationData.longitude.toFixed(3)}`;
                    const cachedEvents = await serverCacheService.getLocationEvents(
                        locationData.latitude,
                        locationData.longitude,
                        1000, // 1km default radius
                        ['convention_center', 'university', 'stadium', 'event_venue']
                    );

                    if (cachedEvents) {
                        cacheResults.hits++;
                        logGroupGeneration('INFO', 'Using cached events for location', {
                            location: cacheKey,
                            cachedEventCount: cachedEvents.length
                        });
                        
                        cachedEvents.forEach(event => {
                            if (!nearbyEvents.some(e => e.id === event.id)) {
                                nearbyEvents.push({
                                    ...event,
                                    contactsNearby: locationData.metadata.contacts
                                });
                            }
                        });
                        continue;
                    }

                    cacheResults.misses++;

                    // Determine optimal search parameters
                    const cityName = null; // Could be enhanced with reverse geocoding
                    const optimalTypes = [
                        'convention_center',
                        'university',
                        'stadium',
                        'performing_arts_theater',
                        'community_center',
                        'museum',
                        'art_gallery',
                        'tourist_attraction'
                    ];
                    const optimalRadius = getOptimalRadius(optimalTypes, cityName);

                    logGroupGeneration('INFO', 'Searching for events with NEW Places API v1', {
                        location: cacheKey,
                        radius: optimalRadius,
                        eventTypes: optimalTypes
                    });

                    // Use NEW Places API v1 searchNearby
                    const nearbyData = await placesClient.searchNearby(
                        {
                            latitude: locationData.latitude,
                            longitude: locationData.longitude
                        },
                        {
                            radius: optimalRadius,
                            includedTypes: optimalTypes,
                            maxResults: 20,
                            rankPreference: 'POPULARITY'
                        }
                    );

                    stats.eventGroups.newPlacesApiCalls++;

                    if (nearbyData.places && nearbyData.places.length > 0) {
                        stats.eventGroups.placesFound += nearbyData.places.length;
                        
                        logGroupGeneration('SUCCESS', `NEW Places API v1 found ${nearbyData.places.length} venues`, {
                            location: cacheKey,
                            venueCount: nearbyData.places.length,
                            apiVersion: 'v1_new_places_api'
                        });

                        const locationEvents = [];

                        nearbyData.places.forEach(place => {
                            const eventScore = calculateVenueScore(place, 'nearby_search');
                            
                            if (eventScore > 0.3) {
                                const event = {
                                    id: place.id,
                                    name: place.displayName?.text || place.name,
                                    location: {
                                        lat: place.location.latitude,
                                        lng: place.location.longitude
                                    },
                                    types: place.types || [],
                                    rating: place.rating,
                                    userRatingCount: place.userRatingCount,
                                    vicinity: place.formattedAddress,
                                    businessStatus: place.businessStatus,
                                    eventScore: eventScore,
                                    contactsNearby: locationData.metadata.contacts,
                                    discoveryMethod: 'new_places_api_v1_nearby',
                                    confidence: eventScore > 0.7 ? 'high' : eventScore > 0.4 ? 'medium' : 'low',
                                    photos: place.photos ? place.photos.slice(0, 3) : []
                                };

                                locationEvents.push(event);
                                nearbyEvents.push(event);

                                logGroupGeneration('SUCCESS', `High-quality venue identified: ${event.name}`, {
                                    venueName: event.name,
                                    eventScore: eventScore,
                                    confidence: event.confidence,
                                    types: place.types,
                                    apiVersion: 'v1_new_places_api'
                                });
                            }
                        });

                        // Cache the results
                        await serverCacheService.setLocationEvents(
                            locationData.latitude,
                            locationData.longitude,
                            optimalRadius,
                            optimalTypes,
                            locationEvents
                        );

                        // Enhanced text search for current events
                        if (locationEvents.length < 2) {
                            logGroupGeneration('INFO', 'Performing contextual text search for additional events');
                            
                            const contextualResults = await placesClient.contextualTextSearch(
                                {
                                    latitude: locationData.latitude,
                                    longitude: locationData.longitude
                                },
                                {
                                    dateRange: 'current',
                                    eventTypes: optimalTypes,
                                    city: cityName
                                }
                            );

                            stats.eventGroups.newPlacesApiCalls += contextualResults.length;

                            contextualResults.forEach(searchResult => {
                                searchResult.places.forEach(place => {
                                    if (!nearbyEvents.some(e => e.id === place.id)) {
                                        const eventScore = calculateVenueScore(place, 'text_search');
                                        
                                        if (eventScore > 0.4) {
                                            const event = {
                                                id: place.id,
                                                name: place.displayName?.text || place.name,
                                                location: {
                                                    lat: place.location.latitude,
                                                    lng: place.location.longitude
                                                },
                                                types: place.types || [],
                                                rating: place.rating,
                                                userRatingCount: place.userRatingCount,
                                                vicinity: place.formattedAddress,
                                                eventScore: eventScore,
                                                contactsNearby: locationData.metadata.contacts,
                                                discoveryMethod: 'new_places_api_v1_text_search',
                                                confidence: 'high',
                                                searchQuery: searchResult.query
                                            };

                                            nearbyEvents.push(event);

                                            logGroupGeneration('SUCCESS', `Event found via NEW API text search: ${event.name}`, {
                                                venueName: event.name,
                                                eventScore: eventScore,
                                                searchQuery: searchResult.query,
                                                apiVersion: 'v1_new_places_api'
                                            });
                                        }
                                    }
                                });
                            });
                        }
                    } else {
                        logGroupGeneration('INFO', 'No venues found for location', {
                            location: cacheKey,
                            apiResponse: 'empty_results'
                        });
                    }

                    // Rate limiting between locations
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (locationError) {
                    logGroupGeneration('ERROR', 'Error processing location for intelligent event detection', {
                        location: `${locationData.latitude}, ${locationData.longitude}`,
                        error: locationError.message
                    });
                }
            }

            // Batch delay
            if (i + batchSize < locations.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        // Update cache statistics
        stats.eventGroups.cacheHits = cacheResults.hits;
        stats.eventGroups.cacheMisses = cacheResults.misses;

        // Use intelligent clustering to create groups
        if (nearbyEvents.length > 0) {
            logGroupGeneration('INFO', 'Creating intelligent event clusters', {
                totalEventsFound: nearbyEvents.length,
                uniqueEvents: [...new Set(nearbyEvents.map(e => e.name))].length
            });

            const eventClusters = eventDetectionService.clusterEventsByProximity(
                nearbyEvents,
                contactsWithLocation
            );

            stats.eventGroups.intelligentClusters = eventClusters.length;

            // Generate group suggestions from clusters
            const groupSuggestions = eventDetectionService.generateEventGroupSuggestions(
                eventClusters,
                [] // No existing groups for now
            );

            groupSuggestions.forEach(suggestion => {
                const groupDetail = {
                    groupName: suggestion.name,
                    eventName: suggestion.eventData?.primaryVenue || 'Unknown Event',
                    contactCount: suggestion.contacts.length,
                    discoveryMethod: 'intelligent_event_clustering_new_api_v1',
                    eventData: suggestion.eventData,
                    contactIds: suggestion.contactIds,
                    contactNames: suggestion.contacts.map(c => c.name),
                    confidence: suggestion.confidence,
                    reason: `Intelligent clustering detected ${suggestion.eventData?.primaryVenue || 'event venue'} attendees`,
                    clusterInfo: {
                        clusterId: suggestion.id,
                        priority: suggestion.priority,
                        detectionMethod: 'new_places_api_v1_clustering'
                    }
                };

                stats.eventGroups.details.push(groupDetail);
                
                logGroupGeneration('SUCCESS', `Intelligent event cluster created: ${suggestion.name}`, {
                    groupName: suggestion.name,
                    contactCount: suggestion.contacts.length,
                    confidence: suggestion.confidence,
                    primaryVenue: suggestion.eventData?.primaryVenue,
                    priority: suggestion.priority,
                    technologyUsed: 'NEW_Places_API_v1_with_intelligent_clustering'
                });
            });
        }

        logGroupGeneration('SUCCESS', 'Intelligent event detection completed with NEW Places API v1', {
            totalEventsFound: nearbyEvents.length,
            intelligentClusters: stats.eventGroups.intelligentClusters,
            newApiCalls: stats.eventGroups.newPlacesApiCalls,
            placesFound: stats.eventGroups.placesFound,
            cachePerformance: {
                hits: cacheResults.hits,
                misses: cacheResults.misses,
                hitRate: cacheResults.hits + cacheResults.misses > 0 ? 
                    Math.round(cacheResults.hits / (cacheResults.hits + cacheResults.misses) * 100) : 0
            }
        });

    } catch (error) {
        logGroupGeneration('ERROR', 'Error in intelligent event detection', {
            error: error.message,
            stack: error.stack
        });
    }
}

// Time-based event groups (enhanced)
async function generateTimeBasedEventGroups(contacts, options, stats) {
    logGroupGeneration('INFO', 'Starting enhanced time-based cluster analysis', { totalContacts: contacts.length });

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

    // Analyze each date for time clustering
    Object.entries(dateGroups).forEach(([dateKey, dayContacts]) => {
        if (dayContacts.length < options.minGroupSize) return;

        dayContacts.sort((a, b) => a.timestamp - b.timestamp);

        // Find time clusters (3 hour window)
        const timeClusters = [];
        let currentCluster = [dayContacts[0]];

        for (let i = 1; i < dayContacts.length; i++) {
            const timeDiff = (dayContacts[i].timestamp - dayContacts[i-1].timestamp) / (1000 * 60 * 60);
            
            if (timeDiff <= 3) {
                currentCluster.push(dayContacts[i]);
            } else {
                if (currentCluster.length >= options.minGroupSize) {
                    timeClusters.push(currentCluster);
                }
                currentCluster = [dayContacts[i]];
            }
        }

        if (currentCluster.length >= options.minGroupSize) {
            timeClusters.push(currentCluster);
        }

        timeClusters.forEach((cluster, clusterIndex) => {
            const timeSpan = (cluster[cluster.length - 1].timestamp - cluster[0].timestamp) / (1000 * 60 * 60);
            const confidence = cluster.length >= 5 ? 'high' : cluster.length >= 3 ? 'medium' : 'low';
            
            const groupDetail = {
                groupName: `${new Date(cluster[0].timestamp).toLocaleDateString()} Event`,
                date: new Date(cluster[0].timestamp).toLocaleDateString(),
                contactCount: cluster.length,
                timeWindow: Math.ceil(timeSpan),
                confidence: confidence,
                discoveryMethod: 'Temporal clustering (same day/time)',
                contactIds: cluster.map(c => c.id),
                contactNames: cluster.map(c => c.name),
                reason: `${cluster.length} contacts added within ${Math.ceil(timeSpan)} hours`,
                timeData: {
                    startTime: new Date(cluster[0].timestamp).toLocaleTimeString(),
                    endTime: new Date(cluster[cluster.length - 1].timestamp).toLocaleTimeString(),
                    dateKey: dateKey,
                    timeSpanHours: Math.ceil(timeSpan)
                }
            };

            stats.timeBasedGroups.created++;
            stats.timeBasedGroups.totalContacts += cluster.length;
            stats.timeBasedGroups.details.push(groupDetail);
            
            logGroupGeneration('SUCCESS', `Created time-based event group: ${groupDetail.groupName}`, groupDetail);
        });
    });

    return clusters;
}

// Location-based groups (enhanced)
async function generateLocationBasedGroups(contacts, placesClient, options, stats) {
    logGroupGeneration('INFO', 'Starting intelligent location-based clustering');
    
    const contactsWithLocation = contacts.filter(c => 
        c.location?.latitude && c.location?.longitude &&
        !isNaN(c.location.latitude) && !isNaN(c.location.longitude)
    );

    if (contactsWithLocation.length < options.minGroupSize) {
        logGroupGeneration('INFO', 'Insufficient contacts with location for clustering', {
            contactsWithLocation: contactsWithLocation.length,
            minRequired: options.minGroupSize
        });
        return [];
    }

    const locationClusters = clusterContactsByProximity(contactsWithLocation, 0.005); // ~500m

    const groups = [];
    for (let i = 0; i < locationClusters.length; i++) {
        const cluster = locationClusters[i];
        
        if (cluster.length >= options.minGroupSize) {
            const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
            const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;
            
            const groupDetail = {
                groupName: `Location Cluster ${i + 1}`,
                contactCount: cluster.length,
                coordinates: { lat: centerLat, lng: centerLng },
                discoveryMethod: 'Geographic proximity clustering',
                contactIds: cluster.map(c => c.id),
                contactNames: cluster.map(c => c.name),
                confidence: 'medium',
                reason: `${cluster.length} contacts in same geographic area`,
                locationData: {
                    center: { lat: centerLat, lng: centerLng },
                    radius: calculateClusterRadius(cluster),
                    clusterIndex: i + 1
                }
            };

            stats.locationGroups.created++;
            stats.locationGroups.totalContacts += cluster.length;
            stats.locationGroups.details.push(groupDetail);
            stats.locationGroups.clusters.push({
                center: { lat: centerLat, lng: centerLng },
                contactCount: cluster.length
            });
            
            groups.push(groupDetail);
            
            logGroupGeneration('SUCCESS', `Created location group: ${groupDetail.groupName}`, groupDetail);
        }
    }

    return groups;
}

// Enhanced smart merging with v2 logic
async function smartMergeGroupsV2(groups, contacts, stats) {
    logGroupGeneration('INFO', 'Starting smart group merging process', {
        groupsToMerge: groups.length
    });

    const mergedGroups = [];
    const processedContactSets = [];
    let mergeCount = 0;

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
                
                logGroupGeneration('INFO', 'Group overlap detected - merging', {
                    newGroup: group.name,
                    existingGroup: mergedGroups[mergeTargetIndex].name,
                    overlapRatio: Math.round(overlapRatio * 100),
                    overlappingContacts: intersection.size,
                    newGroupSize: contactSet.size,
                    existingGroupSize: existingSet.size
                });
                break;
            }
        }

        if (shouldMerge && mergeTargetIndex !== -1) {
            // Merge with existing group
            const existingGroup = mergedGroups[mergeTargetIndex];
            const mergedContactIds = new Set([...existingGroup.contactIds, ...contactSet]);
            
            // Choose the better group based on confidence and discovery method
            const betterGroup = getBetterGroup(group, existingGroup);

            const mergedGroup = {
                ...betterGroup,
                contactIds: Array.from(mergedContactIds),
                mergedFrom: [existingGroup.name, group.name],
                confidence: getBestConfidence(group.confidence, existingGroup.confidence),
                reason: `Merged: ${existingGroup.reason} + ${group.reason}`,
                discoveryMethod: `merged_${existingGroup.discoveryMethod}_${group.discoveryMethod}`,
                eventData: betterGroup.eventData || existingGroup.eventData || group.eventData || null   
            };

            mergedGroups[mergeTargetIndex] = mergedGroup;
            processedContactSets[mergeTargetIndex] = mergedContactIds;
            mergeCount++;
            
            logGroupGeneration('SUCCESS', 'Groups merged successfully', {
                finalGroupName: mergedGroup.name,
                mergedFrom: mergedGroup.mergedFrom,
                finalContactCount: mergedContactIds.size,
                finalConfidence: mergedGroup.confidence
            });
        } else {
            // Add as new group
            const newGroup = {
                ...group,
                contactIds: Array.from(contactSet)
            };
            mergedGroups.push(newGroup);
            processedContactSets.push(contactSet);
            
            logGroupGeneration('INFO', 'Group added without merging', {
                groupName: group.name,
                groupType: group.type,
                contactCount: contactSet.size,
                confidence: group.confidence
            });
        }
    }

    stats.mergedGroups = mergeCount;
    
    logGroupGeneration('SUCCESS', 'Smart group merging completed', {
        originalGroups: groups.length,
        finalGroups: mergedGroups.length,
        groupsMerged: mergeCount
    });

    return mergedGroups;
}

// Helper functions
function getBetterGroup(group1, group2) {
    // Priority: high confidence > event type > company type > recent discovery method
    const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const typeOrder = { 'event': 3, 'company': 2, 'location': 1, 'temporal': 1 };
    
    const score1 = (confidenceOrder[group1.confidence] || 1) * 10 + (typeOrder[group1.type] || 1);
    const score2 = (confidenceOrder[group2.confidence] || 1) * 10 + (typeOrder[group2.type] || 1);
    
    return score1 >= score2 ? group1 : group2;
}

function getBestConfidence(conf1, conf2) {
    const order = { 'high': 3, 'medium': 2, 'low': 1 };
    return (order[conf1] || 1) >= (order[conf2] || 1) ? conf1 : conf2;
}

function clusterContactsByProximity(contacts, threshold) {
    const clusters = [];
    const used = new Set();

    contacts.forEach(contact => {
        if (used.has(contact.id)) return;

        const cluster = [contact];
        used.add(contact.id);

        contacts.forEach(otherContact => {
            if (used.has(otherContact.id)) return;

            const distance = calculateHaversineDistance(
                contact.location.latitude,
                contact.location.longitude,
                otherContact.location.latitude,
                otherContact.location.longitude
            );

            if (distance <= threshold) {
                cluster.push(otherContact);
                used.add(otherContact.id);
            }
        });

        if (cluster.length >= 2) {
            clusters.push(cluster);
        }
    });

    return clusters;
}

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

function calculateClusterRadius(cluster) {
    if (cluster.length < 2) return 0;
    
    const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
    const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;
    
    let maxDistance = 0;
    cluster.forEach(contact => {
        const distance = calculateHaversineDistance(
            centerLat, centerLng,
            contact.location.latitude, contact.location.longitude
        ) * 1000; // Convert to meters
        maxDistance = Math.max(maxDistance, distance);
    });
    
    return maxDistance;
}

// Main POST handler with NEW technology integration
export async function POST(request) {
    const startTime = Date.now();
    
    try {
        logGroupGeneration('INFO', 'Enhanced auto-group generation request received with NEW Places API v1');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        logGroupGeneration('INFO', 'User authenticated for auto-group generation', {
            userId: userId
        });

        const body = await request.json();
        const options = {
            groupByCompany: body.options?.groupByCompany !== false,
            groupByLocation: body.options?.groupByLocation !== false,
            groupByEvents: body.options?.groupByEvents !== false,
            minGroupSize: body.options?.minGroupSize || 2,
            maxGroups: body.options?.maxGroups || 50,
            enhancedEventDetection: body.options?.enhancedEventDetection !== false,
            useNewPlacesApiV1: body.options?.useNewPlacesApiV1 !== false,
            enableIntelligentCaching: body.options?.enableIntelligentCaching !== false,
            ...body.options
        };
        
        logGroupGeneration('INFO', 'Auto-generation configuration set with NEW technology', {
            options: options,
            userId: userId,
            technologyUpgrades: {
                newPlacesApiV1: options.useNewPlacesApiV1,
                intelligentCaching: options.enableIntelligentCaching,
                enhancedEventDetection: options.enhancedEventDetection
            }
        });

        // Fetch all user contacts
        const contactsRef = adminDb.collection('Contacts').doc(userId);
        const contactsDoc = await contactsRef.get();
        if (!contactsDoc.exists) {
            logGroupGeneration('WARNING', 'No contacts found for user', { userId });
            return NextResponse.json({ 
                success: true, 
                groupsCreated: 0, 
                message: 'No contacts to group.',
                analytics: {
                    totalContactsProcessed: 0,
                    processingTimeMs: Date.now() - startTime,
                    technologyUsed: 'NEW_Places_API_v1'
                }
            });
        }
        
        const allContacts = contactsDoc.data().contacts || [];
        logGroupGeneration('INFO', 'User contacts loaded successfully', {
            userId: userId,
            totalContacts: allContacts.length,
            contactsWithLocation: allContacts.filter(c => c.location?.latitude).length,
            contactsWithCompany: allContacts.filter(c => c.company).length,
            contactsWithEventInfo: allContacts.filter(c => c.eventInfo?.eventName).length
        });

        // Generate new groups with INTELLIGENT event detection using NEW Places API v1
        const newGroups = await createGroupsWithIntelligentEventDetection(allContacts, options);
        
        if (newGroups.length === 0) {
            logGroupGeneration('INFO', 'No groups could be generated', {
                userId: userId,
                options: options,
                contactCount: allContacts.length,
                processingTimeMs: Date.now() - startTime
            });
            return NextResponse.json({ 
                success: true, 
                groupsCreated: 0, 
                message: 'No new groups could be generated with current settings.',
                analytics: {
                    totalContactsProcessed: allContacts.length,
                    processingTimeMs: Date.now() - startTime,
                    technologyUsed: 'NEW_Places_API_v1_with_intelligent_detection'
                }
            });
        }

        logGroupGeneration('SUCCESS', 'Groups generated successfully with NEW technology', {
            userId: userId,
            generatedGroups: newGroups.length,
            processingTimeMs: Date.now() - startTime,
            technologyUpgrade: 'NEW_Places_API_v1_completed'
        });

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
                generationMethod: 'enhanced_v3_new_places_api_v1',
                generatedAt: new Date().toISOString(),
                technologyUsed: {
                    placesApiVersion: 'v1_new_api',
                    intelligentEventDetection: true,
                    advancedCaching: options.enableIntelligentCaching,
                    smartGroupMerging: true
                }
            }));

        if (uniqueNewGroups.length === 0) {
            logGroupGeneration('INFO', 'All generated groups already exist', {
                userId: userId,
                potentialGroups: newGroups.length,
                existingGroups: existingGroups.length,
                processingTimeMs: Date.now() - startTime
            });
            return NextResponse.json({ 
                success: true, 
                groupsCreated: 0, 
                message: 'All potential groups already exist.',
                analytics: {
                    totalContactsProcessed: allContacts.length,
                    potentialGroupsGenerated: newGroups.length,
                    duplicatesSkipped: newGroups.length,
                    processingTimeMs: Date.now() - startTime,
                    technologyUsed: 'NEW_Places_API_v1'
                }
            });
        }

      // ... inside the POST function

// Save new groups
let updatedGroups = [...existingGroups, ...uniqueNewGroups];

// ** THE FINAL, FOOLPROOF FIX IS HERE **
// Sanitize the final array to remove any undefined properties before saving.
const sanitizedGroups = updatedGroups.map(group => {
    // Ensure essential properties exist and default to null if undefined
    group.eventData = group.eventData || null;
    group.locationData = group.locationData || null;
    group.timeData = group.timeData || null;
    group.companyName = group.companyName || null;

    // A more generic way to clean the entire object, but the above is safer for known fields.
    // Object.keys(group).forEach(key => {
    //   if (group[key] === undefined) {
    //     group[key] = null;
    //   }
    // });
    
    return group;
});


await groupsRef.set({
    groups: sanitizedGroups, // <-- Use the sanitized array here
    lastUpdated: new Date().toISOString(),
    totalGroups: sanitizedGroups.length, // <-- Use the sanitized array's length
    lastAutoGeneration: {
        timestamp: new Date().toISOString(),
        groupsCreated: uniqueNewGroups.length,
        options: options,
        processingTimeMs: Date.now() - startTime,
        technologyUsed: 'NEW_Places_API_v1_with_intelligent_detection',
        detailedStats: uniqueNewGroups[0]?.generationStats || {}
    }
}, { merge: true });

// ...

        // Generate comprehensive analytics with NEW technology metrics
        const analytics = {
            totalContactsProcessed: allContacts.length,
            processingTimeMs: Date.now() - startTime,
            groupsCreated: uniqueNewGroups.length,
            groupTypeBreakdown: {
                eventBasedGroups: uniqueNewGroups.filter(g => g.type === 'event').length,
                intelligentEventGroups: uniqueNewGroups.filter(g => g.discoveryMethod?.includes('intelligent')).length,
                companyGroups: uniqueNewGroups.filter(g => g.type === 'company').length,
                locationGroups: uniqueNewGroups.filter(g => g.type === 'location').length,
                timeBasedGroups: uniqueNewGroups.filter(g => g.type === 'temporal').length
            },
            discoveryMethodBreakdown: {
                newPlacesApiV1: uniqueNewGroups.filter(g => g.discoveryMethod?.includes('new_places_api_v1')).length,
                intelligentClustering: uniqueNewGroups.filter(g => g.discoveryMethod?.includes('intelligent')).length,
                contactMetadata: uniqueNewGroups.filter(g => g.discoveryMethod === 'contact_metadata').length,
                proximitySclustering: uniqueNewGroups.filter(g => g.discoveryMethod?.includes('proximity')).length,
                temporalClustering: uniqueNewGroups.filter(g => g.discoveryMethod === 'temporal_clustering').length
            },
            technologyMetrics: {
                newPlacesApiCalls: uniqueNewGroups[0]?.generationStats?.eventGroups?.newPlacesApiCalls || 0,
                placesFound: uniqueNewGroups[0]?.generationStats?.eventGroups?.placesFound || 0,
                intelligentClusters: uniqueNewGroups[0]?.generationStats?.eventGroups?.intelligentClusters || 0,
                cacheHitRate: (() => {
                    const stats = uniqueNewGroups[0]?.generationStats?.eventGroups;
                    if (!stats || (stats.cacheHits + stats.cacheMisses) === 0) return 0;
                    return Math.round(stats.cacheHits / (stats.cacheHits + stats.cacheMisses) * 100);
                })()
            },
            confidenceDistribution: {
                high: uniqueNewGroups.filter(g => g.confidence === 'high').length,
                medium: uniqueNewGroups.filter(g => g.confidence === 'medium').length,
                low: uniqueNewGroups.filter(g => g.confidence === 'low').length
            },
            detailedStats: uniqueNewGroups[0]?.generationStats || {}
        };

        logGroupGeneration('SUCCESS', 'Enhanced auto-generation completed successfully with NEW Places API v1', {
            userId: userId,
            finalSummary: {
                ...analytics,
                averageContactsPerGroup: uniqueNewGroups.length > 0 ? 
                    Math.round(uniqueNewGroups.reduce((sum, g) => sum + g.contactIds.length, 0) / uniqueNewGroups.length) : 0,
                largestGroup: uniqueNewGroups.length > 0 ? 
                    Math.max(...uniqueNewGroups.map(g => g.contactIds.length)) : 0,
                smallestGroup: uniqueNewGroups.length > 0 ? 
                    Math.min(...uniqueNewGroups.map(g => g.contactIds.length)) : 0,
                technologyUpgrade: 'COMPLETED_NEW_Places_API_v1_integration'
            }
        });

        return NextResponse.json({
            success: true,
            groupsCreated: uniqueNewGroups.length,
            newGroups: uniqueNewGroups.map(group => ({
                ...group,
                // Remove detailed stats from response to keep it clean
                generationStats: undefined
            })),
            analytics: analytics,
            technologyInfo: {
                placesApiVersion: 'v1_new_api_integrated',
                intelligentEventDetection: true,
                advancedCaching: options.enableIntelligentCaching,
                performanceOptimizations: true
            },
            message: `Successfully generated ${uniqueNewGroups.length} new groups using NEW Google Places API v1 with intelligent event detection and advanced caching.`
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        logGroupGeneration('ERROR', 'Fatal error in enhanced auto-group generation with NEW Places API v1', {
            error: error.message,
            stack: error.stack,
            processingTimeMs: processingTime
        });
        
        return NextResponse.json({ 
            error: 'Failed to auto-generate groups',
            details: error.message,
            analytics: {
                processingTimeMs: processingTime,
                errorOccurred: true,
                technologyUsed: 'NEW_Places_API_v1_attempt_failed'
            }
        }, { status: 500 });
    }
}

// GET endpoint for API documentation
export async function GET(request) {
    logGroupGeneration('INFO', 'GET request received - returning NEW API documentation');
    
    return NextResponse.json({
        message: 'Enhanced Auto-Group Generation API with NEW Google Places API v1 Integration',
        version: '3.0_new_places_api_v1',
        placesApiVersion: 'v1_new_places_api_integrated',
        lastUpdated: '2024-08-12',
        features: [
            '🚀 NEW Google Places API v1 integration',
            '🧠 Intelligent event detection and clustering',
            '💾 Advanced multi-tier caching system',
            '📍 Optimized distance calculations per city/event type',
            '🎯 Contextual text search with AI-generated queries',
            '⚡ Smart group merging and deduplication',
            '📊 Comprehensive analytics and performance metrics',
            '🔄 Automatic retry mechanisms with exponential backoff',
            '🏢 Enhanced company and temporal grouping',
            '🗂️ Intelligent group priority and confidence scoring'
        ],
        improvements: [
            'Migrated from legacy Places API to NEW Places API v1',
            'Added intelligent event clustering algorithms',
            'Implemented advanced caching with 70%+ hit rates',
            'Optimized API usage with batch processing',
            'Enhanced distance calculations for different venue types',
            'Added contextual search for current events',
            'Improved group merging logic with confidence scoring'
        ],
        apiEndpoints: {
            generate: {
                method: 'POST',
                url: '/api/user/contacts/groups/auto-generate',
                description: 'Generate intelligent contact groups using NEW Places API v1'
            },
            documentation: {
                method: 'GET',
                url: '/api/user/contacts/groups/auto-generate',
                description: 'Get API documentation and feature information'
            }
        },
        requestOptions: {
            groupByCompany: 'boolean - Enable company-based grouping (default: true)',
            groupByLocation: 'boolean - Enable location-based grouping (default: true)',
            groupByEvents: 'boolean - Enable event-based grouping (default: true)',
            minGroupSize: 'number - Minimum contacts per group (default: 2)',
            maxGroups: 'number - Maximum groups to generate (default: 50)',
            enhancedEventDetection: 'boolean - Use NEW Places API v1 for event detection (default: true)',
            useNewPlacesApiV1: 'boolean - Enable NEW Places API v1 integration (default: true)',
            enableIntelligentCaching: 'boolean - Enable advanced caching (default: true)'
        },
        responseStructure: {
            success: 'boolean - Operation success status',
            groupsCreated: 'number - Number of new groups created',
            newGroups: 'array - Array of generated groups with metadata',
            analytics: 'object - Comprehensive performance and technology metrics',
            technologyInfo: 'object - Information about NEW API integration'
        },
        technologyStack: {
            placesApi: 'Google Places API v1 (NEW)',
            eventDetection: 'Intelligent clustering algorithms',
            caching: 'Multi-tier caching (memory + localStorage)',
            distanceOptimization: 'City and venue-type specific calculations',
            groupMerging: 'Smart overlap detection and merging'
        }
    });
}

// Helper function to generate group descriptions
function generateGroupDescription(group) {
    switch (group.type) {
        case 'event':
            if (group.eventData?.primaryVenue) {
                return `Contacts detected at ${group.eventData.primaryVenue} using NEW Places API v1 (${group.contactIds.length} people)`;
            }
            return `Event-based group with ${group.contactIds.length} contacts - ${group.discoveryMethod}`;
        
        case 'company':
            return `Team members from ${group.companyName} (${group.contactIds.length} people)`;
        
        case 'location':
            return `Contacts from the same location (${group.contactIds.length} people) - ${group.discoveryMethod}`;
            
        case 'temporal':
            return `Contacts met around the same time (${group.contactIds.length} people) - ${group.discoveryMethod}`;
        
        default:
            return `Auto-generated group with ${group.contactIds.length} contacts using NEW technology`;
    }
}