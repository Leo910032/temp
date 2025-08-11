// components/ContactsMap.jsx - Enhanced with Intelligent Auto-Grouping
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useTranslation } from "@/lib/translation/useTranslation";

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
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [showLegend, setShowLegend] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [selectedMarkers, setSelectedMarkers] = useState([]);
    const [isSelectingMode, setIsSelectingMode] = useState(false);
    const [nearbyEvents, setNearbyEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        status: 'all',
        company: 'all',
        hasLocation: 'all',
        hasEvent: 'all',
        dateRange: 'all'
    });
    const [suggestedGroups, setSuggestedGroups] = useState([]);
    const [showAutoGroupSuggestions, setShowAutoGroupSuggestions] = useState(false);

    // Check if device is mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Auto-generate group suggestions when contacts change
    useEffect(() => {
        if (contacts.length > 0) {
            generateAutoGroupSuggestions();
        }
    }, [contacts]);

    // Filter contacts based on selected groups and filters
    const filteredContacts = contacts.filter(contact => {
        // Group filter
        if (selectedGroupIds.length > 0) {
            const hasSelectedGroup = selectedGroupIds.some(groupId => {
                const group = groups.find(g => g.id === groupId);
                return group && group.contactIds.includes(contact.id);
            });
            if (!hasSelectedGroup) return false;
        }

        // Status filter
        if (filters.status !== 'all' && contact.status !== filters.status) {
            return false;
        }

        // Company filter
        if (filters.company !== 'all') {
            if (filters.company === 'no-company' && contact.company) return false;
            if (filters.company !== 'no-company' && contact.company !== filters.company) return false;
        }

        // Location filter
        if (filters.hasLocation !== 'all') {
            const hasLocation = contact.location && contact.location.latitude && contact.location.longitude;
            if (filters.hasLocation === 'yes' && !hasLocation) return false;
            if (filters.hasLocation === 'no' && hasLocation) return false;
        }

        // Event filter
        if (filters.hasEvent !== 'all') {
            const hasEvent = contact.eventInfo || nearbyEvents.some(event => 
                event.contactsNearby && event.contactsNearby.some(c => c.id === contact.id)
            );
            if (filters.hasEvent === 'yes' && !hasEvent) return false;
            if (filters.hasEvent === 'no' && hasEvent) return false;
        }

        // Date range filter
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

    const contactsWithLocation = filteredContacts.filter(contact =>
        contact.location &&
        contact.location.latitude &&
        contact.location.longitude &&
        !isNaN(contact.location.latitude) &&
        !isNaN(contact.location.longitude)
    );

    // Generate intelligent auto-grouping suggestions
    const generateAutoGroupSuggestions = useCallback(async () => {
        const suggestions = [];

        // 1. Group by Company
        const companyGroups = {};
        contacts.forEach(contact => {
            if (contact.company && contact.company.trim()) {
                const company = contact.company.trim().toLowerCase();
                if (!companyGroups[company]) {
                    companyGroups[company] = [];
                }
                companyGroups[company].push(contact);
            }
        });

        Object.entries(companyGroups).forEach(([company, contactList]) => {
            if (contactList.length >= 2) {
                suggestions.push({
                    id: `company_${company.replace(/\s+/g, '_')}`,
                    type: 'company',
                    name: `${contactList[0].company} Team`,
                    description: `${contactList.length} contacts from ${contactList[0].company}`,
                    contactIds: contactList.map(c => c.id),
                    contacts: contactList,
                    confidence: contactList.length > 3 ? 'high' : 'medium',
                    reason: 'Same company'
                });
            }
        });

        // 2. Group by Location Proximity (same area)
        if (contactsWithLocation.length >= 2) {
            const locationClusters = clusterContactsByLocation(contactsWithLocation, 0.01); // ~1km radius
            locationClusters.forEach(cluster => {
                if (cluster.length >= 2) {
                    suggestions.push({
                        id: `location_${cluster[0].id}`,
                        type: 'location',
                        name: `Location Group`,
                        description: `${cluster.length} contacts in the same area`,
                        contactIds: cluster.map(c => c.id),
                        contacts: cluster,
                        confidence: 'medium',
                        reason: 'Same location area'
                    });
                }
            });
        }

        // 3. Group by Event (nearby events or same event info)
        if (nearbyEvents.length > 0) {
            nearbyEvents.forEach(event => {
                if (event.contactsNearby && event.contactsNearby.length >= 2) {
                    suggestions.push({
                        id: `event_${event.id}`,
                        type: 'event',
                        name: `${event.name} Attendees`,
                        description: `${event.contactsNearby.length} contacts from ${event.name}`,
                        contactIds: event.contactsNearby.map(c => c.id),
                        contacts: event.contactsNearby,
                        confidence: 'high',
                        reason: `Met at ${event.name}`,
                        eventData: event
                    });
                }
            });
        }

        // 4. Group by Date (same day contacts)
        const dateGroups = {};
        contacts.forEach(contact => {
            const date = new Date(contact.submittedAt || contact.createdAt).toDateString();
            if (!dateGroups[date]) {
                dateGroups[date] = [];
            }
            dateGroups[date].push(contact);
        });

        Object.entries(dateGroups).forEach(([date, contactList]) => {
            if (contactList.length >= 3) {
                suggestions.push({
                    id: `date_${date.replace(/\s+/g, '_')}`,
                    type: 'date',
                    name: `${new Date(date).toLocaleDateString()} Contacts`,
                    description: `${contactList.length} contacts met on ${new Date(date).toLocaleDateString()}`,
                    contactIds: contactList.map(c => c.id),
                    contacts: contactList,
                    confidence: contactList.length > 5 ? 'high' : 'medium',
                    reason: 'Met on the same day'
                });
            }
        });

        // Filter out suggestions that already exist as groups
        const existingGroupContactSets = groups.map(g => new Set(g.contactIds));
        const filteredSuggestions = suggestions.filter(suggestion => {
            const suggestionSet = new Set(suggestion.contactIds);
            return !existingGroupContactSets.some(existingSet => 
                suggestionSet.size === existingSet.size && 
                [...suggestionSet].every(id => existingSet.has(id))
            );
        });

        setSuggestedGroups(filteredSuggestions);
    }, [contacts, groups, nearbyEvents, contactsWithLocation]);

    // Cluster contacts by location proximity
    const clusterContactsByLocation = (contacts, threshold) => {
        const clusters = [];
        const used = new Set();

        contacts.forEach(contact => {
            if (used.has(contact.id)) return;

            const cluster = [contact];
            used.add(contact.id);

            contacts.forEach(otherContact => {
                if (used.has(otherContact.id)) return;

                const distance = calculateDistance(
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
    };

    // Calculate distance between two coordinates (in degrees)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    // Find nearby events for all contacts
    const findNearbyEvents = useCallback(async (contactLocations) => {
        if (!mapInstanceRef.current || contactLocations.length === 0) return;
        
        setLoadingEvents(true);
        const events = [];
        
        try {
            const service = new google.maps.places.PlacesService(mapInstanceRef.current);
            
            // Check each unique location for events
            const uniqueLocations = contactLocations.reduce((acc, contact) => {
                const key = `${contact.location.latitude.toFixed(4)},${contact.location.longitude.toFixed(4)}`;
                if (!acc[key]) {
                    acc[key] = {
                        lat: contact.location.latitude,
                        lng: contact.location.longitude,
                        contacts: [contact]
                    };
                } else {
                    acc[key].contacts.push(contact);
                }
                return acc;
            }, {});

            for (const locationKey of Object.keys(uniqueLocations)) {
                const location = uniqueLocations[locationKey];
                
                await new Promise((resolve) => {
                    const request = {
                        location: new google.maps.LatLng(location.lat, location.lng),
                        radius: 1000, // 1km radius
                        type: ['event_venue', 'conference_center', 'exhibition_center', 'convention_center', 'university']
                    };

                    service.nearbySearch(request, (results, status) => {
                        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                            results.forEach(place => {
                                if (place.name && place.geometry) {
                                    events.push({
                                        id: place.place_id,
                                        name: place.name,
                                        location: {
                                            lat: place.geometry.location.lat(),
                                            lng: place.geometry.location.lng()
                                        },
                                        types: place.types,
                                        rating: place.rating,
                                        vicinity: place.vicinity,
                                        contactsNearby: location.contacts,
                                        isActive: isEventActive(place)
                                    });
                                }
                            });
                        }
                        resolve();
                    });
                });
            }
            
            setNearbyEvents(events);
            
            // Auto-create event groups if enabled
            const autoEventGroups = events.filter(event => 
                event.contactsNearby.length >= 2 && event.isActive
            );
            
            if (autoEventGroups.length > 0 && onGroupCreate) {
                // Suggest auto-creation of event groups
                console.log('Auto-suggesting event groups:', autoEventGroups);
            }
            
        } catch (error) {
            console.error('Error finding nearby events:', error);
        } finally {
            setLoadingEvents(false);
        }
    }, [onGroupCreate]);

    // Check if event is currently active (basic heuristic)
    const isEventActive = (place) => {
        const eventTypes = ['event_venue', 'conference_center', 'exhibition_center', 'convention_center'];
        return place.types.some(type => eventTypes.includes(type)) && place.rating > 3.0;
    };

    // Get unique companies for filter
    const getUniqueCompanies = () => {
        const companies = [...new Set(contacts.map(c => c.company).filter(Boolean))];
        return companies.sort();
    };

    // Get contact counts by status and groups
    const contactCounts = {
        new: filteredContacts.filter(c => c.status === 'new').length,
        viewed: filteredContacts.filter(c => c.status === 'viewed').length,
        archived: filteredContacts.filter(c => c.status === 'archived').length,
        total: filteredContacts.length
    };

    // Get group statistics
    const groupStats = groups.map(group => ({
        ...group,
        contactCount: group.contactIds.filter(id => 
            filteredContacts.some(c => c.id === id)
        ).length
    }));

    // Custom marker colors for groups
    const getGroupColor = (groupId) => {
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
        ];
        const index = groups.findIndex(g => g.id === groupId);
        return colors[index % colors.length] || '#6B7280';
    };

    // Get marker color based on contact's groups
    const getMarkerColor = (contact) => {
        // Find the first group this contact belongs to
        const contactGroup = groups.find(group => 
            group.contactIds.includes(contact.id) && 
            selectedGroupIds.includes(group.id)
        );
        
        if (contactGroup) {
            return getGroupColor(contactGroup.id);
        }

        // Default color based on status
        switch (contact.status) {
            case 'new': return '#3B82F6';
            case 'viewed': return '#10B981';
            case 'archived': return '#6B7280';
            default: return '#3B82F6';
        }
    };

    // Handle marker selection for grouping
    const toggleMarkerSelection = (contact) => {
        setSelectedMarkers(prev => {
            const isSelected = prev.some(c => c.id === contact.id);
            if (isSelected) {
                return prev.filter(c => c.id !== contact.id);
            } else {
                return [...prev, contact];
            }
        });
    };

    // Start group creation mode
    const startGroupSelection = () => {
        setIsSelectingMode(true);
        setSelectedMarkers([]);
    };

    // Cancel group selection
    const cancelGroupSelection = () => {
        setIsSelectingMode(false);
        setSelectedMarkers([]);
    };

    // Create group from selected markers
    const createGroupFromSelection = () => {
        if (selectedMarkers.length > 0) {
            setShowGroupModal(true);
        }
    };

    // Accept auto-group suggestion
    const acceptAutoGroup = (suggestion) => {
        if (onGroupCreate) {
            onGroupCreate({
                id: suggestion.id,
                name: suggestion.name,
                type: suggestion.type,
                description: suggestion.description,
                contactIds: suggestion.contactIds,
                eventData: suggestion.eventData || null,
                autoGenerated: true,
                reason: suggestion.reason
            });
        }
        
        // Remove from suggestions
        setSuggestedGroups(prev => prev.filter(s => s.id !== suggestion.id));
    };

    // Dismiss auto-group suggestion
    const dismissAutoGroup = (suggestionId) => {
        setSuggestedGroups(prev => prev.filter(s => s.id !== suggestionId));
    };

    // Memoize the marker click handler
    const handleMarkerClick = useCallback((contact, markerElement, position, map) => {
        if (isSelectingMode) {
            toggleMarkerSelection(contact);
            // Update marker appearance for selection
            const isSelected = selectedMarkers.some(c => c.id === contact.id);
            markerElement.style.border = isSelected ? '4px solid #FFD700' : '3px solid white';
            return;
        }

        // Normal marker click behavior
        markersRef.current.forEach(m => {
            m.content?.classList.remove('selected');
        });
        
        markerElement.classList.add('selected');
        
        if (onMarkerClick) {
            onMarkerClick(contact);
        }
        
        map.panTo(position);
        if (map.getZoom() < 16) {
            map.setZoom(16);
        }
    }, [onMarkerClick, isSelectingMode, selectedMarkers, toggleMarkerSelection]);

    useEffect(() => {
        let isMounted = true;

        const initializeMap = async () => {
            try {
                const loader = new Loader({
                    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
                    version: 'weekly',
                    libraries: ['maps', 'marker', 'places']
                });

                const { Map } = await loader.importLibrary('maps');
                const { AdvancedMarkerElement } = await loader.importLibrary('marker');

                if (!isMounted || !mapRef.current) return;

                let centerLocation = { lat: 39.60128890889341, lng: -9.069839810859907 };
                let initialZoom = 15;

                if (contactsWithLocation.length > 0) {
                    if (contactsWithLocation.length === 1) {
                        centerLocation = {
                            lat: contactsWithLocation[0].location.latitude,
                            lng: contactsWithLocation[0].location.longitude
                        };
                        initialZoom = 16;
                    } else {
                        const avgLat = contactsWithLocation.reduce((sum, contact) =>
                            sum + contact.location.latitude, 0) / contactsWithLocation.length;
                        const avgLng = contactsWithLocation.reduce((sum, contact) =>
                            sum + contact.location.longitude, 0) / contactsWithLocation.length;
                        centerLocation = { lat: avgLat, lng: avgLng };
                        initialZoom = isMobile ? 12 : 10;
                    }
                }

                const mapOptions = {
                    center: centerLocation,
                    zoom: initialZoom,
                    mapId: 'DEMO_MAP_ID',
                    gestureHandling: 'greedy',
                    disableDefaultUI: isMobile,
                    mapTypeControl: !isMobile,
                    streetViewControl: !isMobile,
                    fullscreenControl: !isMobile,
                    zoomControl: true,
                    clickableIcons: false,
                    keyboardShortcuts: false,
                    mapTypeId: 'roadmap'
                };

                const map = new Map(mapRef.current, mapOptions);
                mapInstanceRef.current = map;

                // Clear existing markers
                markersRef.current.forEach(marker => {
                    if (marker.map) marker.map = null;
                });
                markersRef.current = [];

                // Clear existing event markers
                eventMarkersRef.current.forEach(marker => {
                    if (marker.map) marker.map = null;
                });
                eventMarkersRef.current = [];

                // Create markers for each contact
                contactsWithLocation.forEach((contact) => {
                    const position = {
                        lat: contact.location.latitude,
                        lng: contact.location.longitude
                    };

                    const markerElement = document.createElement('div');
                    markerElement.className = 'contact-marker';
                    if (selectedContactId === contact.id) {
                        markerElement.classList.add('selected');
                    }

                    const backgroundColor = getMarkerColor(contact);
                    const borderColor = isSelectingMode && selectedMarkers.some(c => c.id === contact.id) 
                        ? '#FFD700' : 'white';
                    const borderWidth = isSelectingMode && selectedMarkers.some(c => c.id === contact.id) 
                        ? '4px' : '3px';

                    // Find groups this contact belongs to
                    const contactGroups = groups.filter(group => 
                        group.contactIds.includes(contact.id)
                    );

                    const markerContent = `
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: ${backgroundColor};
                            border: ${borderWidth} solid ${borderColor};
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                            font-size: 14px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                            cursor: pointer;
                            transition: transform 0.2s;
                            position: relative;
                        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            ${contact.name.charAt(0).toUpperCase()}
                            ${contactGroups.length > 0 ? `
                                <div style="
                                    position: absolute;
                                    top: -8px;
                                    right: -8px;
                                    width: 16px;
                                    height: 16px;
                                    background: #FFD700;
                                    border: 2px solid white;
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 10px;
                                    color: #333;
                                    font-weight: bold;
                                ">${contactGroups.length}</div>
                            ` : ''}
                        </div>
                    `;

                    markerElement.innerHTML = markerContent;

                    const marker = new AdvancedMarkerElement({
                        map,
                        position,
                        content: markerElement,
                        title: `${contact.name} - ${contact.email}${contactGroups.length > 0 ? ` (${contactGroups.map(g => g.name).join(', ')})` : ''}`,
                    });

                    markerElement.addEventListener('click', () => {
                        handleMarkerClick(contact, markerElement, position, map);
                    });

                    markersRef.current.push(marker);
                });

                // Create event markers
                nearbyEvents.forEach((event) => {
                    const position = {
                        lat: event.location.lat,
                        lng: event.location.lng
                    };

                    const markerElement = document.createElement('div');
                    markerElement.className = 'event-marker';

                    const markerContent = `
                        <div style="
                            width: 30px;
                            height: 30px;
                            background: #8B5CF6;
                            border: 2px solid white;
                            border-radius: 4px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                            font-size: 12px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                            cursor: pointer;
                            transition: transform 0.2s;
                        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            📅
                        </div>
                    `;

                    markerElement.innerHTML = markerContent;

                    const marker = new AdvancedMarkerElement({
                        map,
                        position,
                        content: markerElement,
                        title: `Event: ${event.name} (${event.contactsNearby?.length || 0} contacts nearby)`,
                    });

                    eventMarkersRef.current.push(marker);
                });

                // Find nearby events
                findNearbyEvents(contactsWithLocation);

                // Fit bounds if multiple contacts
                if (contactsWithLocation.length > 1) {
                    const bounds = new google.maps.LatLngBounds();
                    contactsWithLocation.forEach(contact => {
                        bounds.extend({
                            lat: contact.location.latitude,
                            lng: contact.location.longitude
                        });
                    });
                    map.fitBounds(bounds, { padding: isMobile ? 20 : 50 });
                }

                map.addListener('idle', () => {
                    if (isMounted) setIsLoaded(true);
                });

                const handleResize = () => {
                    if (mapInstanceRef.current) {
                        google.maps.event.trigger(mapInstanceRef.current, 'resize');
                    }
                };
                window.addEventListener('resize', handleResize);

                return () => {
                    window.removeEventListener('resize', handleResize);
                };

            } catch (error) {
                console.error('Error loading Google Maps:', error);
                setError(t('contacts_map.failed_to_load', { error: error.message }) || `Failed to load Google Maps: ${error.message}`);
                setIsLoaded(true);
            }
        };

        if (mapRef.current) {
            initializeMap();
        }

        return () => {
            isMounted = false;
        };
    }, [contactsWithLocation, selectedContactId, isMobile, handleMarkerClick, t, groups, selectedGroupIds, isSelectingMode, selectedMarkers, findNearbyEvents, nearbyEvents]);

    if (contactsWithLocation.length === 0 && filteredContacts.length === 0) {
        return (
            <div className="h-[400px] w-full rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                <div className="text-center p-6 max-w-md">
                    <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                        {Object.values(filters).some(f => f !== 'all') 
                            ? 'No contacts match current filters'
                            : 'No location data available'
                        }
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        {Object.values(filters).some(f => f !== 'all')
                            ? 'Try adjusting your filters to see more contacts'
                            : 'No contacts with location found'
                        }
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[400px] w-full rounded-lg border border-red-200 bg-red-50 flex items-center justify-center">
                <div className="text-center p-6 max-w-md">
                    <div className="text-red-600 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-red-800 mb-2">
                        {t('contacts_map.loading_error_title') || 'Loading error'}
                    </h3>
                    <p className="text-red-600 text-sm mb-3">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            {!isLoaded && (
                <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
                    <div className="flex flex-col items-center space-y-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                        <span className="text-gray-500 text-sm font-medium">
                            {t('contacts_map.loading_contacts', { 
                                count: contactsWithLocation.length,
                                plural: contactsWithLocation.length !== 1 ? 's' : ''
                            }) || `Loading ${contactsWithLocation.length} contact${contactsWithLocation.length !== 1 ? 's' : ''}...`}
                        </span>
                    </div>
                </div>
            )}
            
            {/* Map Container */}
            <div 
                className="h-full w-full rounded-lg overflow-hidden border border-gray-200"
                ref={mapRef}
            />

            {/* Auto-Group Suggestions Floating Panel */}
            {isLoaded && suggestedGroups.length > 0 && (
                <div className="absolute top-4 left-4 z-30">
                    <div className="bg-white rounded-lg shadow-lg border border-purple-200 p-4 max-w-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h4 className="font-semibold text-sm text-gray-900">Smart Groups</h4>
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
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {suggestedGroups.slice(0, 3).map(suggestion => (
                                    <div key={suggestion.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                        suggestion.confidence === 'high' 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {suggestion.confidence}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {suggestion.type === 'company' && '🏢'}
                                                        {suggestion.type === 'event' && '📅'}
                                                        {suggestion.type === 'location' && '📍'}
                                                        {suggestion.type === 'date' && '📆'}
                                                    </span>
                                                </div>
                                                <h5 className="font-medium text-sm text-gray-900 truncate">
                                                    {suggestion.name}
                                                </h5>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {suggestion.description}
                                                </p>
                                                <p className="text-xs text-purple-600 mt-1">
                                                    {suggestion.reason}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => acceptAutoGroup(suggestion)}
                                                className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                            >
                                                Create Group
                                            </button>
                                            <button
                                                onClick={() => dismissAutoGroup(suggestion.id)}
                                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                
                                {suggestedGroups.length > 3 && (
                                    <div className="text-center pt-2">
                                        <span className="text-xs text-gray-500">
                                            +{suggestedGroups.length - 3} more suggestions
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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