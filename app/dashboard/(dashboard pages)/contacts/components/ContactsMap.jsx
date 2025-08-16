// components/ContactsMap.jsx - Main ContactsMap Component (Refactored)
'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useTranslation } from "@/lib/translation/useTranslation";

// Import all sub-components from the ContactsMap subfolder
import GroupClusterManager from './ContactsMap/GroupClusterManager';
import MapControls from './ContactsMap/MapControls';
import ContactProfileModal from './ContactsMap/ContactProfileModal';
import GroupCreationModal from './ContactsMap/GroupCreationModal';
import { MapLegend } from './ContactsMap/MapLegend';
import { SmartGroupSuggestions } from './ContactsMap/SmartGroupSuggestions';
import { ZoomIndicator } from './ContactsMap/ZoomIndicator';
import { MapFilters } from './ContactsMap/MapFilters';
import { getUniqueCompanies, getGroupColor } from './ContactsMap/utils';

// Cache keys and storage
const CACHE_PREFIX = 'contacts_map_';
const EVENTS_CACHE_KEY = `${CACHE_PREFIX}events`;

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
    const groupClusterManagerRef = useRef(null);
    const placesClientRef = useRef(null);
    
    // State management
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [selectedMarkers, setSelectedMarkers] = useState([]);
    const [isSelectingMode, setIsSelectingMode] = useState(false);
    const [nearbyEvents, setNearbyEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [suggestedGroups, setSuggestedGroups] = useState([]);
    const [showAutoGroupSuggestions, setShowAutoGroupSuggestions] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(12);
    const [showFilters, setShowFilters] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [selectedContact, setSelectedContact] = useState(null);
    const [showContactProfile, setShowContactProfile] = useState(false);
    
    // Filter state
    const [filters, setFilters] = useState({
        status: 'all',
        company: 'all',
        hasLocation: 'all',
        hasEvent: 'all',
        dateRange: 'all'
    });

    // Debug effect to track state changes
    useEffect(() => {
        console.log('📊 Modal state changed:', { showContactProfile, selectedContact: selectedContact?.name });
    }, [showContactProfile, selectedContact]);

    // Check if device is mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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

            return true;
        });
    }, [contacts, selectedGroupIds, groups, filters]);

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

    const filteredGroups = useMemo(() => {
        return groups.filter(group => {
            if (selectedGroupIds.length > 0) {
                return selectedGroupIds.includes(group.id);
            }
            return true;
        }).map(group => ({
            ...group,
            contactIds: group.contactIds.filter(contactId =>
                filteredContacts.some(contact => contact.id === contactId)
            )
        })).filter(group => group.contactIds.length > 0);
    }, [groups, selectedGroupIds, filteredContacts]);

    // Map initialization effect
    useEffect(() => {
        let isMounted = true;

        const initializeMap = async () => {
            if (!mapRef.current) return;
            
            console.log('🗺️ Initializing enhanced map with group clustering');

            try {
                const loader = new Loader({
                    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
                    version: 'weekly',
                    libraries: ['maps', 'marker', 'places']
                });

                const { Map } = await loader.importLibrary('maps');

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
                    
                    if (filteredGroups.length > 5) {
                        zoom = 10;
                    } else if (filteredGroups.length > 0) {
                        zoom = 12;
                    } else {
                        zoom = 14;
                    }
                }

                const map = new Map(mapRef.current, {
                    center,
                    zoom,
                    mapId: 'DEMO_MAP_ID',
                    gestureHandling: 'greedy',
                    disableDefaultUI: isMobile
                });
                
                mapInstanceRef.current = map;
                setCurrentZoom(zoom);

                map.addListener('zoom_changed', () => {
                    const newZoom = map.getZoom();
                    setCurrentZoom(newZoom);
                });

                console.log('🎯 Initializing GroupClusterManager', {
                    groups: filteredGroups.length,
                    contacts: contactsWithLocation.length
                });

                const clusterManager = new GroupClusterManager(
                    map,
                    filteredGroups,
                    contactsWithLocation,
                    {
                        zoomThresholds: {
                            groupClusters: 11,
                            individualMarkers: 14
                        }
                    }
                );

                clusterManager.setContactClickHandler((contact) => {
                    console.log('📍 Contact clicked (initial):', contact.name);
                    
                    // Set modal states directly
                    setSelectedContact(contact);
                    setShowContactProfile(true);
                    
                    // Call original onMarkerClick if provided
                    if (onMarkerClick) {
                        onMarkerClick(contact);
                    }
                });

                await clusterManager.initialize();
                groupClusterManagerRef.current = clusterManager;

                map.addListener('idle', () => {
                    if (isMounted) {
                        setIsLoaded(true);
                        console.log('✅ Enhanced map with group clustering ready');
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
            if (groupClusterManagerRef.current) {
                groupClusterManagerRef.current.cleanup();
            }
        };
    }, [filteredGroups, contactsWithLocation, isMobile, onMarkerClick]);

    useEffect(() => {
        if (groupClusterManagerRef.current && isLoaded) {
            console.log('🔄 Updating cluster manager with new data');
            groupClusterManagerRef.current.updateData(filteredGroups, contactsWithLocation);
            
            // FIXED: Re-set the contact click handler after updating data
            console.log('🔧 Re-setting contact click handler after data update');
            groupClusterManagerRef.current.setContactClickHandler((contact) => {
                console.log('📍 Contact clicked after update:', contact.name, contact);
                console.log('📍 About to set selectedContact and showContactProfile (update)');
                
                // IMPORTANT: Set both modal states directly
                setSelectedContact(contact);
                setShowContactProfile(true);
                
                console.log('📍 State setters called (update)');
                
                // Also call the original onMarkerClick if provided
                if (onMarkerClick) {
                    onMarkerClick(contact);
                }
            });
        }
    }, [filteredGroups, contactsWithLocation, isLoaded, onMarkerClick]);

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
        return filteredGroups.map(group => ({
            ...group,
            contactCount: group.contactIds.length
        }));
    }, [filteredGroups]);

    const contactCounts = useMemo(() => {
        return {
            new: filteredContacts.filter(c => c.status === 'new').length,
            viewed: filteredContacts.filter(c => c.status === 'viewed').length,
            archived: filteredContacts.filter(c => c.status === 'archived').length,
            total: filteredContacts.length,
            withLocation: contactsWithLocation.length
        };
    }, [filteredContacts, contactsWithLocation]);

    // Get current cluster manager state for debugging
    const clusterState = useMemo(() => {
        if (!groupClusterManagerRef.current) return null;
        return groupClusterManagerRef.current.getState();
    }, [currentZoom, isLoaded]);

    return (
        <div className="relative h-full w-full">
            {/* Loading state */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
                    <div className="flex flex-col items-center space-y-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                        <span className="text-gray-500 text-sm font-medium">
                            Setting up smart group visualization...
                        </span>
                        <span className="text-purple-600 text-xs">
                            Loading {contactsWithLocation.length} contacts in {filteredGroups.length} groups
                        </span>
                    </div>
                </div>
            )}
            
            {/* Map Container */}
            <div 
                className="h-full w-full rounded-lg overflow-hidden border border-gray-200"
                ref={mapRef}
            />

            {/* Zoom Level Indicator */}
            <ZoomIndicator 
                isLoaded={isLoaded}
                currentZoom={currentZoom}
                clusterState={clusterState}
            />

            {/* Smart Group Suggestions */}
            <SmartGroupSuggestions
                isLoaded={isLoaded}
                suggestedGroups={suggestedGroups}
                showAutoGroupSuggestions={showAutoGroupSuggestions}
                setShowAutoGroupSuggestions={setShowAutoGroupSuggestions}
                acceptAutoGroup={acceptAutoGroup}
                dismissAutoGroup={dismissAutoGroup}
            />

            {/* Map Controls */}
            <MapControls
                isLoaded={isLoaded}
                isMobile={isMobile}
                isSelectingMode={isSelectingMode}
                selectedMarkers={selectedMarkers}
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                filters={filters}
                loadingEvents={loadingEvents}
                startGroupSelection={startGroupSelection}
                cancelGroupSelection={cancelGroupSelection}
                createGroupFromSelection={createGroupFromSelection}
            />

            {/* Filters Dropdown */}
            <MapFilters
                showFilters={showFilters}
                isLoaded={isLoaded}
                isMobile={isMobile}
                filters={filters}
                setFilters={setFilters}
                setShowFilters={setShowFilters}
                getUniqueCompanies={() => getUniqueCompanies(contacts)}
            />

            {/* Map Legend */}
            <MapLegend
                isLoaded={isLoaded}
                isMobile={isMobile}
                showFilters={showFilters}
                showLegend={showLegend}
                setShowLegend={setShowLegend}
                groupStats={groupStats}
                contactCounts={contactCounts}
                filters={filters}
                onGroupToggle={onGroupToggle}
                getGroupColor={(groupId) => getGroupColor(groupId, groups)}
                contactsWithLocation={contactsWithLocation}
            />

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

            {/* Contact Profile Modal */}
            <ContactProfileModal
                isOpen={showContactProfile}
                onClose={() => {
                    console.log('📍 Modal closing');
                    setShowContactProfile(false);
                    setSelectedContact(null);
                }}
                contact={selectedContact}
                groups={groups}
                onContactUpdate={onContactsUpdate}
            />

            {/* Enhanced Helper Text */}
            {isLoaded && !isMobile && contactsWithLocation.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow border text-xs text-gray-500 max-w-56 z-20">
                    <div className="font-medium text-gray-700 mb-1">
                        💡 Smart Map Guide
                    </div>
                    {currentZoom < 11 && (
                        <div>Showing group clusters. Zoom in to see members.</div>
                    )}
                    {currentZoom >= 11 && currentZoom < 14 && (
                        <div>Mixed view: Large groups as clusters, small as individuals.</div>
                    )}
                    {currentZoom >= 14 && (
                        <div>Individual view: All contacts visible as separate markers.</div>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div>🟦 Group clusters • 👤 Individual contacts</div>
                        <div>Click clusters to zoom in • Click markers for details</div>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-50 border border-red-200 rounded-lg p-4 z-50">
                    <div className="flex items-center gap-2 text-red-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="font-medium">Map Error</span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                    <button
                        onClick={() => setError(null)}
                        className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200 transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}