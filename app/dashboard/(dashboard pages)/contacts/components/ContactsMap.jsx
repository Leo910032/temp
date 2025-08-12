// components/ContactsMap.jsx - FINAL FIXED VERSION - No Infinite Loops
'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useTranslation } from "@/lib/translation/useTranslation";
import { improvedEventDetectionService } from '@/lib/services/improvedEventDetectionService';
import { IMPROVED_EVENT_DETECTION_CONFIG } from '@/lib/config/improvedEventDetectionConfig';
import { createPlacesApiClient } from '@/lib/services/placesApiClient';

// Cache keys and storage
const CACHE_PREFIX = 'contacts_map_';
const EVENTS_CACHE_KEY = `${CACHE_PREFIX}events`;
const MARKERS_CACHE_KEY = `${CACHE_PREFIX}markers`;
const GROUPS_CACHE_KEY = `${CACHE_PREFIX}groups`;

export default function ContactsMap({ 
    contacts = [], 
    selectedContactId = null, 
    onMarkerClick = null,
    groups = [],
    selectedGroupIds = [],
    onGroupToggle = null,
    onGroupCreate = null,
    showGroupClusters = true,
    onContactsUpdate = null
}) {
    const { t } = useTranslation();
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const eventMarkersRef = useRef([]);
    const clustererRef = useRef(null);
    const placesClientRef = useRef(null);
    
    // State management
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [showLegend, setShowLegend] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [selectedMarkers, setSelectedMarkers] = useState([]);
    const [isSelectingMode, setIsSelectingMode] = useState(false);
    const [nearbyEvents, setNearbyEvents] = useState([]);
    const [eventClusters, setEventClusters] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [suggestedGroups, setSuggestedGroups] = useState([]);
    const [showAutoGroupSuggestions, setShowAutoGroupSuggestions] = useState(false);
    const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 });
    
    // Filter state
    const [filters, setFilters] = useState({
        status: 'all',
        company: 'all',
        hasLocation: 'all',
        hasEvent: 'all',
        dateRange: 'all'
    });

    // References to track processed data and prevent duplicate calls
    const lastProcessedLocationsRef = useRef(null);
    const isProcessingEventsRef = useRef(false);

    // Initialize Places API client
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && !placesClientRef.current) {
            placesClientRef.current = createPlacesApiClient(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
        }
    }, []);

    // Check if device is mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Memoized filtered contacts for performance
    const filteredContacts = useMemo(() => {
        return contacts.filter(contact => {
            // Group filter
            if (selectedGroupIds.length > 0) {
                const hasSelectedGroup = selectedGroupIds.some(groupId => {
                    const group = groups.find(g => g.id === groupId);
                    return group && group.contactIds.includes(contact.id);
                });
                if (!hasSelectedGroup) return false;
            }

            // Apply other filters
            if (filters.status !== 'all' && contact.status !== filters.status) return false;
            if (filters.company !== 'all') {
                if (filters.company === 'no-company' && contact.company) return false;
                if (filters.company !== 'no-company' && contact.company !== filters.company) return false;
            }
            if (filters.hasLocation !== 'all') {
                const hasLocation = contact.location && contact.location.latitude && contact.location.longitude;
                if (filters.hasLocation === 'yes' && !hasLocation) return false;
                if (filters.hasLocation === 'no' && hasLocation) return false;
            }
            if (filters.hasEvent !== 'all') {
                const hasEvent = contact.eventInfo || nearbyEvents.some(event => 
                    event.contactsNearby && event.contactsNearby.some(c => c.id === contact.id)
                );
                if (filters.hasEvent === 'yes' && !hasEvent) return false;
                if (filters.hasEvent === 'no' && hasEvent) return false;
            }
            if (filters.dateRange !== 'all') {
                const contactDate = new Date(contact.submittedAt || contact.createdAt);
                const now = new Date();
                let cutoffDate;

                switch (filters.dateRange) {
                    case 'today':
                        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        break;
                    case 'week':
                        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        cutoffDate = null;
                }

                if (cutoffDate && contactDate < cutoffDate) return false;
            }

            return true;
        });
    }, [contacts, selectedGroupIds, groups, filters, nearbyEvents]);

    // Memoized contacts with location
    const contactsWithLocation = useMemo(() => {
        return filteredContacts.filter(contact =>
            contact.location &&
            contact.location.latitude &&
            contact.location.longitude &&
            !isNaN(contact.location.latitude) &&
            !isNaN(contact.location.longitude)
        );
    }, [filteredContacts]);

    // ============= STABLE UTILITY FUNCTIONS =============
    
    // Helper function for deduplicating contact locations
    const deduplicateContactLocations = useCallback((locations) => {
        const uniqueLocations = {};

        locations.forEach(contact => {
            if (contact.location?.latitude && contact.location?.longitude) {
                const key = `${contact.location.latitude.toFixed(4)},${contact.location.longitude.toFixed(4)}`;
                
                if (!uniqueLocations[key]) {
                    uniqueLocations[key] = {
                        location: {
                            latitude: contact.location.latitude,
                            longitude: contact.location.longitude,
                        },
                        contacts: []
                    };
                }
                uniqueLocations[key].contacts.push(contact);
            }
        });

        return Object.values(uniqueLocations);
    }, []);

    // Cache management functions - COMPLETELY STABLE
    const getCachedData = useCallback((key, maxAge = 30 * 60 * 1000) => {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp > maxAge) {
                localStorage.removeItem(key);
                return null;
            }
            
            // Use functional update to avoid closure issues
            setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
            return data.payload;
        } catch (error) {
            console.warn('Cache read error:', error);
            return null;
        }
    }, []); // Empty dependency array - completely stable

    const setCachedData = useCallback((key, data) => {
        try {
            const cacheEntry = {
                payload: data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheEntry));
            // Use functional update to avoid closure issues
            setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        } catch (error) {
            console.warn('Cache write error:', error);
        }
    }, []); // Empty dependency array - completely stable

    // ============= STABLE EVENT PROCESSING FUNCTIONS =============

    const inferCityFromCoordinates = useCallback(async (lat, lng) => {
        return null; // Placeholder
    }, []);

    const getOptimalEventTypes = useCallback((contacts) => {
        const companies = contacts.map(c => c.company).filter(Boolean);
        const hasCorpContacts = companies.length > 0;
        
        if (hasCorpContacts) {
            return ['convention_center', 'university', 'hotel', 'tourist_attraction'];
        }
        
        return ['convention_center', 'university', 'stadium', 'performing_arts_theater', 'community_center', 'museum', 'art_gallery', 'tourist_attraction'];
    }, []);

    const analyzeEventVenue = useCallback((place, searchTypes, searchMethod = 'nearby') => {
        let score = 0;
        const indicators = [];
        
        const typeScoring = {
            'convention_center': 0.9,
            'event_venue': 0.8,
            'concert_hall': 0.8,
            'university': 0.6,
            'stadium': 0.7,
            'performing_arts_theater': 0.6,
            'community_center': 0.5,
            'museum': 0.4,
            'art_gallery': 0.4,
            'tourist_attraction': 0.4
        };

        let typeScore = 0;
        if (place.types) {
            place.types.forEach(type => {
                if (typeScoring[type]) {
                    typeScore = Math.max(typeScore, typeScoring[type]);
                    indicators.push(`venue_type_${type}`);
                }
            });
        }
        score += typeScore;

        const eventKeywords = {
            high: ['conference', 'convention', 'expo', 'exhibition', 'summit', 'congress'],
            medium: ['center', 'hall', 'forum', 'symposium', 'seminar', 'workshop'],
            low: ['pavilion', 'arena', 'theater', 'gallery', 'community']
        };

        const name = (place.displayName?.text || place.name || '').toLowerCase();
        
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

        if (place.businessStatus === 'OPERATIONAL') {
            score += 0.15;
            indicators.push('operational');
        }

        if (place.rating && place.userRatingCount) {
            if (place.rating >= 4.0 && place.userRatingCount >= 200) {
                score += 0.15;
                indicators.push('highly_rated_popular');
            } else if (place.rating >= 3.5 && place.userRatingCount >= 50) {
                score += 0.1;
                indicators.push('well_rated');
            }
        }

        if (searchMethod === 'text_search') {
            score += 0.1;
            indicators.push('text_search_result');
        }

        let confidence = 'low';
        if (score >= 0.7) confidence = 'high';
        else if (score >= 0.4) confidence = 'medium';

        return {
            eventScore: Math.min(score, 1.0),
            confidence,
            indicators
        };
    }, []);

    const createEventFromPlace = useCallback((place, nearbyContacts, eventAnalysis, searchQuery = null) => {
        return {
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
            priceLevel: place.priceLevel,
            contactsNearby: nearbyContacts,
            eventScore: eventAnalysis.eventScore,
            confidence: eventAnalysis.confidence,
            eventIndicators: eventAnalysis.indicators,
            isActive: place.businessStatus === 'OPERATIONAL',
            searchQuery: searchQuery,
            discoveryMethod: searchQuery ? 'contextual_text_search' : 'intelligent_nearby_search',
            photos: place.photos ? place.photos.slice(0, 3) : [],
            timestamp: Date.now()
        };
    }, []);

    const removeDuplicateEvents = useCallback((events) => {
        const seen = new Set();
        return events.filter(event => {
            if (seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
        });
    }, []);

    const sortEventsByRelevance = useCallback((events) => {
        return events.sort((a, b) => {
            const scoreA = (a.eventScore * 0.4) + 
                          ((a.contactsNearby?.length || 0) * 0.3) + 
                          ((a.rating || 0) / 5 * 0.2) + 
                          (a.confidence === 'high' ? 0.1 : a.confidence === 'medium' ? 0.05 : 0);
            
            const scoreB = (b.eventScore * 0.4) + 
                          ((b.contactsNearby?.length || 0) * 0.3) + 
                          ((b.rating || 0) / 5 * 0.2) + 
                          (b.confidence === 'high' ? 0.1 : b.confidence === 'medium' ? 0.05 : 0);
            
            return scoreB - scoreA;
        });
    }, []);

    // ============= MAIN EVENT PROCESSING FUNCTION =============


const findNearbyEvents = useCallback(async (contactLocations) => {
    // Prevent concurrent execution
    if (isProcessingEventsRef.current) {
        console.log('⏭️ Event processing already in progress, skipping...');
        return;
    }

    if (!placesClientRef.current || contactLocations.length === 0) return;
    
    isProcessingEventsRef.current = true;
    console.log('🔍 Starting intelligent event detection for', contactLocations.length, 'locations');
    setLoadingEvents(true);
    
    try {
        // Generate cache key based on locations and current date
        const locationHash = contactLocations
            .map(c => `${c.location.latitude.toFixed(3)},${c.location.longitude.toFixed(3)}`)
            .sort()
            .join('|');
        const cacheKey = `${EVENTS_CACHE_KEY}_${locationHash}_${new Date().toDateString()}`;
        
        // Try to get cached events first
        const cachedEvents = getCachedData(cacheKey, 60 * 60 * 1000); // 1 hour cache
        if (cachedEvents) {
            console.log('✅ Using cached events data');
            setNearbyEvents(cachedEvents);
            
            // FIXED: Generate group suggestions from cached events
            setTimeout(() => {
                try {
                    console.log('🧠 Generating intelligent group suggestions from cached events', {
                        eventsCount: cachedEvents.length,
                        contactLocationsCount: contactLocations.length
                    });
                    
                    // FIXED: Use cachedEvents instead of events
                    const clusters = improvedEventDetectionService.clusterEventsByProximity(cachedEvents, contactLocations);
                    setEventClusters(clusters);
                    
                    const suggestions = improvedEventDetectionService.generateEventGroupSuggestions(clusters, groups);
                    setSuggestedGroups(suggestions);
                    
                    if (suggestions.length > 0) {
                        console.log(`💡 Generated ${suggestions.length} intelligent group suggestions from cache`);
                        setShowAutoGroupSuggestions(true);
                    }
                } catch (error) {
                    console.error('❌ Error generating group suggestions from cached events:', error);
                }
            }, 100);
            
            setLoadingEvents(false);
            isProcessingEventsRef.current = false;
            return;
        }

        // Deduplicate and optimize locations
        const uniqueLocations = deduplicateContactLocations(contactLocations);
        console.log(`📍 Processing ${uniqueLocations.length} unique locations (${contactLocations.length - uniqueLocations.length} duplicates removed)`);

        const allEvents = [];
        const batchSize = 3;
        
        for (let i = 0; i < uniqueLocations.length; i += batchSize) {
            const batch = uniqueLocations.slice(i, i + batchSize);
            console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uniqueLocations.length/batchSize)}`);
            
            const batchPromises = batch.map(async (locationData) => {
                const { location, contacts: nearbyContacts } = locationData;
                
                try {
                    const cityName = await inferCityFromCoordinates(location.latitude, location.longitude);
                    const optimalTypes = getOptimalEventTypes(nearbyContacts);
                    
                    // FIXED: Extract company name properly
                    const companies = nearbyContacts.map(c => c.company).filter(Boolean);
                    const dominantCompany = companies.length > 0 ? 
                        companies.reduce((a, b) => companies.filter(c => c === a).length >= companies.filter(c => c === b).length ? a : b) : null;
                    
                    const optimalRadius = improvedEventDetectionService.getOptimalRadius(optimalTypes, cityName, dominantCompany);
                    
                    console.log(`🎯 Searching ${cityName || 'unknown city'} with ${optimalRadius}m radius for types:`, optimalTypes);

                    const nearbyData = await placesClientRef.current.searchNearby(location, {
                        radius: optimalRadius,
                        includedTypes: optimalTypes,
                        maxResults: 20,
                        rankPreference: 'POPULARITY'
                    });

                    const locationEvents = [];

                    if (nearbyData.places && nearbyData.places.length > 0) {
                        console.log(`📍 Found ${nearbyData.places.length} potential venues near ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
                        
                        nearbyData.places.forEach(place => {
                            const eventAnalysis = analyzeEventVenue(place, optimalTypes);
                            
                            if (eventAnalysis.eventScore > 0.3) {
                                const event = createEventFromPlace(place, nearbyContacts, eventAnalysis);
                                locationEvents.push(event);
                            }
                        });
                    }

                    if (locationEvents.length < 2) {
                        console.log(`🔍 Performing contextual text search for additional events`);
                        
                        const textSearchResults = await placesClientRef.current.contextualTextSearch(location, {
                            dateRange: 'current',
                            eventTypes: optimalTypes,
                            city: cityName
                        });

                        textSearchResults.forEach(searchResult => {
                            searchResult.places.forEach(place => {
                                if (!locationEvents.some(e => e.id === place.id)) {
                                    const eventAnalysis = analyzeEventVenue(place, optimalTypes, 'text_search');
                                    
                                    if (eventAnalysis.eventScore > 0.4) {
                                        const event = createEventFromPlace(place, nearbyContacts, eventAnalysis, searchResult.query);
                                        locationEvents.push(event);
                                    }
                                }
                            });
                        });
                    }

                    return locationEvents;
                    
                } catch (error) {
                    console.error(`❌ Error processing location ${location.latitude}, ${location.longitude}:`, error);
                    return [];
                }
            });

            const batchResults = await Promise.all(batchPromises);
            allEvents.push(...batchResults.flat());

            if (i + batchSize < uniqueLocations.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        const uniqueEvents = removeDuplicateEvents(allEvents);
        const sortedEvents = sortEventsByRelevance(uniqueEvents);
        
        console.log(`✅ Event detection complete: ${sortedEvents.length} unique events found`);

        setCachedData(cacheKey, sortedEvents);
        setNearbyEvents(sortedEvents);
        
        // FIXED: Generate intelligent clustering from new events
        setTimeout(() => {
            try {
                console.log('🧠 Generating intelligent group suggestions from new events', {
                    eventsCount: sortedEvents.length,
                    contactLocationsCount: contactLocations.length
                });
                
                // FIXED: Use sortedEvents instead of events
                const clusters = improvedEventDetectionService.clusterEventsByProximity(sortedEvents, contactLocations);
                setEventClusters(clusters);
                
                const suggestions = improvedEventDetectionService.generateEventGroupSuggestions(clusters, groups);
                setSuggestedGroups(suggestions);
                
                if (suggestions.length > 0) {
                    console.log(`💡 Generated ${suggestions.length} intelligent group suggestions from new events`);
                    setShowAutoGroupSuggestions(true);
                }
            } catch (error) {
                console.error('❌ Error generating group suggestions from new events:', error);
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Error in findNearbyEvents:', error);
        setError(`Failed to find nearby events: ${error.message}`);
    } finally {
        setLoadingEvents(false);
        isProcessingEventsRef.current = false;
    }
}, [
    getCachedData,
    setCachedData,
    deduplicateContactLocations,
    inferCityFromCoordinates,
    getOptimalEventTypes,
    analyzeEventVenue,
    createEventFromPlace,
    removeDuplicateEvents,
    sortEventsByRelevance,
    groups // Include groups here since it's used in the setTimeout
]);

    // ============= CRITICAL: SINGLE EFFECT FOR EVENT DETECTION =============
    
    useEffect(() => {
        if (contactsWithLocation.length === 0) {
            // Reset events when no contacts with location
            if (nearbyEvents.length > 0) {
                setNearbyEvents([]);
                setSuggestedGroups([]);
                setShowAutoGroupSuggestions(false);
            }
            return;
        }

        // Create a stable hash of current locations to prevent duplicate processing
        const locationHash = contactsWithLocation
            .map(c => `${c.id}_${c.location.latitude.toFixed(4)}_${c.location.longitude.toFixed(4)}`)
            .sort()
            .join('|');

        // Only process if locations actually changed and we're not already processing
        if (lastProcessedLocationsRef.current !== locationHash && !isProcessingEventsRef.current) {
            lastProcessedLocationsRef.current = locationHash;
            console.log('📍 Contacts with location changed, triggering event detection');
            findNearbyEvents(contactsWithLocation);
        }
    }, [contactsWithLocation, findNearbyEvents]);

    // Map initialization effect
    useEffect(() => {
        let isMounted = true;

        const initializeMap = async () => {
            if (!mapRef.current) return;

            try {
                const loader = new Loader({
                    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
                    version: 'weekly',
                    libraries: ['maps', 'marker', 'places']
                });

                const { Map } = await loader.importLibrary('maps');
                const { AdvancedMarkerElement } = await loader.importLibrary('marker');

                if (!isMounted) return;

                let center = { lat: 40.7128, lng: -74.0060 };
                let zoom = 12;

                if (contactsWithLocation.length > 0) {
                    const bounds = new google.maps.LatLngBounds();
                    contactsWithLocation.forEach(contact => {
                        bounds.extend({
                            lat: contact.location.latitude,
                            lng: contact.location.longitude
                        });
                    });
                    center = bounds.getCenter().toJSON();
                }

                const map = new Map(mapRef.current, {
                    center,
                    zoom,
                    mapId: 'DEMO_MAP_ID',
                    gestureHandling: 'greedy',
                    disableDefaultUI: isMobile,
                });
                mapInstanceRef.current = map;

                // Clear old markers
                markersRef.current.forEach(m => m.map = null);
                markersRef.current = [];

                // Create new markers
                contactsWithLocation.forEach(contact => {
                    const markerElement = document.createElement('div');
                    markerElement.className = 'contact-marker';
                    markerElement.style.width = '30px';
                    markerElement.style.height = '30px';
                    markerElement.style.borderRadius = '50%';
                    markerElement.style.backgroundColor = '#4F46E5';
                    markerElement.style.border = '2px solid white';
                    markerElement.style.cursor = 'pointer';

                    const marker = new AdvancedMarkerElement({
                        map,
                        position: { lat: contact.location.latitude, lng: contact.location.longitude },
                        content: markerElement,
                        title: contact.name,
                    });

                    markerElement.addEventListener('click', () => {
                        if (onMarkerClick) onMarkerClick(contact);
                    });

                    markersRef.current.push(marker);
                });
                
                if (contactsWithLocation.length > 1) {
                     const bounds = new google.maps.LatLngBounds();
                     contactsWithLocation.forEach(contact => {
                         bounds.extend({
                             lat: contact.location.latitude,
                             lng: contact.location.longitude
                         });
                     });
                     map.fitBounds(bounds, { padding: isMobile ? 40 : 100 });
                }

                map.addListener('idle', () => {
                    if (isMounted) {
                        setIsLoaded(true);
                    }
                });

            } catch (e) {
                console.error("Failed to load Google Maps", e);
                setError(e.message);
            }
        };

        initializeMap();

        return () => {
            isMounted = false;
        };
    }, [contactsWithLocation, isMobile, onMarkerClick]);

    // ============= UI INTERACTION FUNCTIONS =============

    const startGroupSelection = useCallback(() => {
        setIsSelectingMode(true);
        setSelectedMarkers([]);
    }, []);

    const cancelGroupSelection = useCallback(() => {
        setIsSelectingMode(false);
        setSelectedMarkers([]);
    }, []);

    const createGroupFromSelection = useCallback(() => {
        if (selectedMarkers.length > 0) {
            setShowGroupModal(true);
        }
    }, [selectedMarkers.length]);

    const acceptAutoGroup = useCallback((suggestion) => {
        if (onGroupCreate) {
            onGroupCreate({
                id: `group_${Date.now()}`,
                name: suggestion.name,
                type: suggestion.eventData ? 'event' : 'custom',
                description: suggestion.description,
                contactIds: suggestion.contactIds,
                eventData: suggestion.eventData || null,
                autoGenerated: true,
                reason: suggestion.reason
            });
        }
        setSuggestedGroups(prev => prev.filter(s => s.id !== suggestion.id));
    }, [onGroupCreate]);

    const dismissAutoGroup = useCallback((suggestionId) => {
        setSuggestedGroups(prev => prev.filter(s => s.id !== suggestionId));
    }, []);

    // ============= COMPUTED VALUES =============

    const groupStats = useMemo(() => {
        return groups.map(group => ({
            ...group,
            contactCount: group.contactIds.filter(id =>
                filteredContacts.some(c => c.id === id)
            ).length
        }));
    }, [groups, filteredContacts]);

    const contactCounts = useMemo(() => {
        return {
            new: filteredContacts.filter(c => c.status === 'new').length,
            viewed: filteredContacts.filter(c => c.status === 'viewed').length,
            archived: filteredContacts.filter(c => c.status === 'archived').length,
            total: filteredContacts.length
        };
    }, [filteredContacts]);

    const getUniqueCompanies = useCallback(() => {
        return [...new Set(contacts.map(c => c.company).filter(Boolean))].sort();
    }, [contacts]);

    const getGroupColor = useCallback((groupId) => {
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
        ];
        const index = groups.findIndex(g => g.id === groupId);
        return colors[index % colors.length] || '#6B7280';
    }, [groups]);

    return (
        <div className="relative h-full w-full">
            {/* Loading state */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
                    <div className="flex flex-col items-center space-y-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                        <span className="text-gray-500 text-sm font-medium">
                            Loading {contactsWithLocation.length} contacts...
                        </span>
                        {loadingEvents && (
                            <span className="text-purple-600 text-xs">
                                🔍 Detecting nearby events...
                            </span>
                        )}
                    </div>
                </div>
            )}
            
            {/* Map Container */}
            <div 
                className="h-full w-full rounded-lg overflow-hidden border border-gray-200"
                ref={mapRef}
            />

            {/* Enhanced Smart Group Suggestions */}
            {isLoaded && suggestedGroups.length > 0 && (
                <div className="absolute top-4 left-4 z-30 max-w-sm">
                    <div className="bg-white rounded-lg shadow-lg border border-purple-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-900">Smart Groups</h4>
                                    <p className="text-xs text-gray-500">AI-detected event groups</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAutoGroupSuggestions(!showAutoGroupSuggestions)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                                <svg className={`w-4 h-4 transition-transform ${showAutoGroupSuggestions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>

                        {showAutoGroupSuggestions && (
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {suggestedGroups.slice(0, 3).map(suggestion => (
                                    <div key={suggestion.id} className="border border-gray-100 rounded-lg p-3 bg-gradient-to-br from-gray-50 to-white">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        suggestion.confidence === 'high' 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {suggestion.confidence}
                                                    </span>
                                                    <span className="text-xs">
                                                        {suggestion.subType === 'conference' && '🏢'}
                                                        {suggestion.subType === 'entertainment' && '🎭'}
                                                        {suggestion.subType === 'sports' && '⚽'}
                                                        {suggestion.subType === 'education' && '🎓'}
                                                        {suggestion.subType === 'cultural' && '🎨'}
                                                        {suggestion.subType === 'business' && '💼'}
                                                    </span>
                                                    <span className="text-xs text-purple-600 font-medium">
                                                        Priority: {suggestion.priority}
                                                    </span>
                                                </div>
                                                <h5 className="font-medium text-sm text-gray-900 truncate">
                                                    {suggestion.name}
                                                </h5>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {suggestion.description}
                                                </p>
                                                <p className="text-xs text-purple-600 mt-1 font-medium">
                                                    📍 {suggestion.eventData?.primaryVenue}
                                                </p>
                                                {suggestion.eventData?.estimatedAttendees && (
                                                    <p className="text-xs text-blue-600 mt-1">
                                                        👥 {suggestion.eventData.estimatedAttendees} contacts detected
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => acceptAutoGroup(suggestion)}
                                                className="flex-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium"
                                            >
                                                Create Group
                                            </button>
                                            <button
                                                onClick={() => dismissAutoGroup(suggestion.id)}
                                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition-colors"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                
                                {suggestedGroups.length > 3 && (
                                    <div className="text-center pt-2 border-t">
                                        <span className="text-xs text-gray-500">
                                            +{suggestedGroups.length - 3} more intelligent suggestions
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Cache Performance Indicator (Debug Mode) */}
            {process.env.NODE_ENV === 'development' && isLoaded && (
                <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs">
                    Cache: {cacheStats.hits}H/{cacheStats.misses}M
                    {placesClientRef.current?.getUsageStats && (
                        <div>API: {placesClientRef.current.getUsageStats().requestCount} reqs</div>
                    )}
                </div>
            )}
            
            {/* Filters Panel */}
            {isLoaded && !isMobile && (
                <div className="absolute top-4 right-4 z-20">
                    {!isSelectingMode ? (
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                                </svg>
                                Filters
                                {Object.values(filters).some(f => f !== 'all') && (
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                        Active
                                    </span>
                                )}
                            </button>
                            
                            <button
                                onClick={startGroupSelection}
                                className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-purple-600 hover:bg-purple-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Create Group
                            </button>
                            
                            {loadingEvents && (
                                <div className="bg-white p-2 rounded-lg shadow-lg border flex items-center gap-2 text-xs text-gray-600">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                    Finding events...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white p-3 rounded-lg shadow-lg border">
                            <div className="text-sm font-medium text-gray-900 mb-2">
                                Select contacts for group
                            </div>
                            <div className="text-xs text-gray-600 mb-3">
                                {selectedMarkers.length} selected
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={cancelGroupSelection}
                                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createGroupFromSelection}
                                    disabled={selectedMarkers.length === 0}
                                    className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                                >
                                    Create ({selectedMarkers.length})
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Filters Dropdown */}
            {showFilters && isLoaded && !isMobile && (
                <div className="absolute top-20 right-4 z-30 bg-white rounded-lg shadow-lg border p-4 w-80">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-sm text-gray-900">Filter Contacts</h4>
                        <button
                            onClick={() => setShowFilters(false)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Status Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="new">New</option>
                                <option value="viewed">Viewed</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>

                        {/* Company Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                            <select
                                value={filters.company}
                                onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Companies</option>
                                <option value="no-company">No Company</option>
                                {getUniqueCompanies().map(company => (
                                    <option key={company} value={company}>{company}</option>
                                ))}
                            </select>
                        </div>

                        {/* Location Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                            <select
                                value={filters.hasLocation}
                                onChange={(e) => setFilters(prev => ({ ...prev, hasLocation: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Contacts</option>
                                <option value="yes">With Location</option>
                                <option value="no">Without Location</option>
                            </select>
                        </div>

                        {/* Event Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Events</label>
                            <select
                                value={filters.hasEvent}
                                onChange={(e) => setFilters(prev => ({ ...prev, hasEvent: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Contacts</option>
                                <option value="yes">From Events</option>
                                <option value="no">Not from Events</option>
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Date Added</label>
                            <select
                                value={filters.dateRange}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>

                        {/* Clear Filters */}
                        <div className="pt-2 border-t">
                            <button
                                onClick={() => setFilters({
                                    status: 'all',
                                    company: 'all',
                                    hasLocation: 'all',
                                    hasEvent: 'all',
                                    dateRange: 'all'
                                })}
                                className="w-full px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Legend with Groups */}
            {isLoaded && !isMobile && !showFilters && (
                <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg border min-w-64 z-20 max-h-80 overflow-y-auto">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        Contact Locations
                    </h4>
                    
                    {/* Groups Section */}
                    {groupStats.length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Groups
                            </h5>
                            <div className="space-y-1 text-xs">
                                {groupStats.map(group => (
                                    <div key={group.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <button
                                                onClick={() => onGroupToggle && onGroupToggle(group.id)}
                                                className="flex items-center gap-2 hover:bg-gray-50 rounded p-1 -m-1 flex-1 min-w-0"
                                            >
                                                <div 
                                                    className="w-3 h-3 rounded-full border-2 border-white shadow"
                                                    style={{ backgroundColor: getGroupColor(group.id) }}
                                                />
                                                <span className="text-gray-700 truncate" title={group.name}>
                                                    {group.name}
                                                </span>
                                                {group.type === 'auto' && (
                                                    <span className="text-xs text-gray-400" title="Auto-generated">🤖</span>
                                                )}
                                                {group.type === 'event' && (
                                                    <span className="text-xs text-gray-400" title="Event-based">📅</span>
                                                )}
                                                {group.type === 'company' && (
                                                    <span className="text-xs text-gray-400" title="Company-based">🏢</span>
                                                )}
                                            </button>
                                        </div>
                                        <span className="font-medium text-gray-600 ml-2">
                                            {group.contactCount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status Section */}
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                                <span className="text-gray-600">New contacts</span>
                            </div>
                            <span className="font-medium text-blue-600">{contactCounts.new}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow"></div>
                                <span className="text-gray-600">Viewed contacts</span>
                            </div>
                            <span className="font-medium text-green-600">{contactCounts.viewed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-white shadow"></div>
                                <span className="text-gray-600">Archived contacts</span>
                            </div>
                            <span className="font-medium text-gray-600">{contactCounts.archived}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-purple-500 border-2 border-white shadow"></div>
                                <span className="text-gray-600">Events nearby</span>
                            </div>
                            <span className="font-medium text-purple-600">{nearbyEvents.length}</span>
                        </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                            Total: {contactCounts.total} contact{contactCounts.total !== 1 ? 's' : ''}
                            {Object.values(filters).some(f => f !== 'all') && (
                                <span className="text-blue-600"> (filtered)</span>
                            )}
                        </div>
                        {nearbyEvents.length > 0 && (
                            <div className="text-xs text-purple-600 mt-1">
                                📅 {nearbyEvents.length} nearby event{nearbyEvents.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Mobile Legend Toggle */}
            {isLoaded && isMobile && (
                <button
                    onClick={() => setShowLegend(!showLegend)}
                    className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 z-20"
                >
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                        {groupStats.length > 0 ? `${groupStats.length} Groups` : 'Locations'}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {contactCounts.total}
                    </span>
                </button>
            )}

            {/* Mobile Legend Overlay */}
            {isLoaded && isMobile && showLegend && (
                <div className="absolute inset-x-4 top-16 bg-white p-4 rounded-lg shadow-lg border z-30 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm">Contact Locations</h4>
                        <button
                            onClick={() => setShowLegend(false)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Mobile Groups */}
                    {groupStats.length > 0 && (
                        <div className="mb-3">
                            <h5 className="text-xs font-medium text-gray-700 mb-2">Groups</h5>
                            <div className="space-y-1">
                                {groupStats.map(group => (
                                    <button
                                        key={group.id}
                                        onClick={() => onGroupToggle && onGroupToggle(group.id)}
                                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div 
                                                className="w-3 h-3 rounded-full border-2 border-white shadow"
                                                style={{ backgroundColor: getGroupColor(group.id) }}
                                            />
                                            <span>{group.name}</span>
                                            {group.type === 'auto' && <span>🤖</span>}
                                            {group.type === 'event' && <span>📅</span>}
                                            {group.type === 'company' && <span>🏢</span>}
                                        </div>
                                        <span className="font-medium">{group.contactCount}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Mobile Status Grid */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="text-center">
                            <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow mx-auto mb-1"></div>
                            <div className="font-medium text-blue-600">{contactCounts.new}</div>
                            <div className="text-gray-600">New</div>
                        </div>
                        <div className="text-center">
                            <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow mx-auto mb-1"></div>
                            <div className="font-medium text-green-600">{contactCounts.viewed}</div>
                            <div className="text-gray-600">Viewed</div>
                        </div>
                        <div className="text-center">
                            <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-white shadow mx-auto mb-1"></div>
                            <div className="font-medium text-gray-600">{contactCounts.archived}</div>
                            <div className="text-gray-600">Archived</div>
                        </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                        <div className="text-xs text-gray-500">
                            Total: {contactCounts.total} contact{contactCounts.total !== 1 ? 's' : ''}
                        </div>
                        {nearbyEvents.length > 0 && (
                            <div className="text-xs text-purple-600 mt-1">
                                📅 {nearbyEvents.length} nearby event{nearbyEvents.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Group Creation Modal */}
            <GroupCreationModal
                isOpen={showGroupModal}
                onClose={() => {
                    setShowGroupModal(false);
                    setIsSelectingMode(false);
                    setSelectedMarkers([]);
                }}
                selectedContacts={selectedMarkers}
                nearbyEvents={nearbyEvents}
                onCreateGroup={(groupData) => {
                    if (onGroupCreate) {
                        onGroupCreate(groupData);
                    }
                    setShowGroupModal(false);
                    setIsSelectingMode(false);
                    setSelectedMarkers([]);
                }}
            />

            {/* Helper Text */}
            {isLoaded && !isMobile && contactsWithLocation.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-white p-2 rounded-lg shadow border text-xs text-gray-500 max-w-48">
                    💡 {isSelectingMode 
                        ? 'Click markers to select contacts for grouping'
                        : 'Click markers for more information. Purple squares are events.'
                    }
                </div>
            )}
        </div>
    );
}

// Group Creation Modal Component
function GroupCreationModal({ isOpen, onClose, selectedContacts, nearbyEvents, onCreateGroup }) {
    const { t } = useTranslation();
    const [groupName, setGroupName] = useState('');
    const [groupType, setGroupType] = useState('custom');
    const [selectedEvent, setSelectedEvent] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Auto-suggest group name based on common company or nearby events
            if (selectedContacts.length > 0) {
                const companies = selectedContacts
                    .map(c => c.company)
                    .filter(Boolean);
                
                const commonCompany = companies.find((company, index) => 
                    companies.indexOf(company) !== index
                );

                if (commonCompany) {
                    setGroupName(`${commonCompany} Team`);
                    setDescription(`Contacts from ${commonCompany}`);
                    setGroupType('company');
                } else if (nearbyEvents.length > 0) {
                    const event = nearbyEvents[0];
                    setGroupName(`${event.name} Contacts`);
                    setDescription(`Contacts met at ${event.name}`);
                    setGroupType('event');
                    setSelectedEvent(event.id);
                } else {
                    setGroupName(`Group ${new Date().toLocaleDateString()}`);
                }
            }
        } else {
            // Reset form
            setGroupName('');
            setGroupType('custom');
            setSelectedEvent('');
            setDescription('');
        }
    }, [isOpen, selectedContacts, nearbyEvents]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!groupName.trim() || selectedContacts.length === 0) return;

        const groupData = {
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: groupName.trim(),
            type: groupType,
            description: description.trim(),
            contactIds: selectedContacts.map(c => c.id),
            createdAt: new Date().toISOString(),
            eventData: selectedEvent && nearbyEvents.find(e => e.id === selectedEvent) || null
        };

        onCreateGroup(groupData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Create Contact Group</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {/* Selected Contacts Preview */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selected Contacts ({selectedContacts.length})
                        </label>
                        <div className="max-h-24 overflow-y-auto bg-gray-50 rounded-lg p-2">
                            {selectedContacts.map(contact => (
                                <div key={contact.id} className="flex items-center gap-2 py-1">
                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm text-gray-700 truncate">
                                        {contact.name} - {contact.company || 'No company'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Group Type */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Group Type
                        </label>
                        <select
                            value={groupType}
                            onChange={(e) => setGroupType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="custom">Custom Group</option>
                            <option value="company">Company/Organization</option>
                            {nearbyEvents.length > 0 && (
                                <option value="event">Event-based</option>
                            )}
                        </select>
                    </div>

                    {/* Event Selection (if event type) */}
                    {groupType === 'event' && nearbyEvents.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Associated Event
                            </label>
                            <select
                                value={selectedEvent}
                                onChange={(e) => setSelectedEvent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select an event...</option>
                                {nearbyEvents.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.name} - {event.vicinity}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Group Name */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Group Name *
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!groupName.trim() || selectedContacts.length === 0}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Create Group
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}