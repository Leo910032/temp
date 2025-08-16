// components/ContactsMap.jsx - Enhanced with Group Clustering Visualization
'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useTranslation } from "@/lib/translation/useTranslation";
import { improvedEventDetectionService } from '@/lib/services/improvedEventDetectionService';
import { IMPROVED_EVENT_DETECTION_CONFIG } from '@/lib/config/improvedEventDetectionConfig';
import { createOptimizedPlacesApiClient } from '@/lib/services/placesApiClient';

// Cache keys and storage
const CACHE_PREFIX = 'contacts_map_';
const EVENTS_CACHE_KEY = `${CACHE_PREFIX}events`;

export default function ContactsMap({ 
    contacts = [], 
    selectedContactId = null, 
    onMarkerClick = null,
    groups = [],
    selectedGroupIds = [],  // ✅ FIXED: This should be the array of selected group IDs
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
            if (selectedGroupIds.length > 0) {  // ✅ FIXED: Use selectedGroupIds array
                const hasSelectedGroup = selectedGroupIds.some(groupId => {  // ✅ FIXED: Use selectedGroupIds array
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
    }, [contacts, selectedGroupIds, groups, filters]);  // ✅ FIXED: Use selectedGroupIds in dependency array


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
 // ✅ FIXED: Use selectedGroupIds in the filteredGroups memo too
    const filteredGroups = useMemo(() => {
        return groups.filter(group => {
            if (selectedGroupIds.length > 0) {  // ✅ FIXED: Use selectedGroupIds array
                return selectedGroupIds.includes(group.id);  // ✅ FIXED: Use selectedGroupIds array
            }
            return true;
        }).map(group => ({
            ...group,
            contactIds: group.contactIds.filter(contactId =>
                filteredContacts.some(contact => contact.id === contactId)
            )
        })).filter(group => group.contactIds.length > 0);
    }, [groups, selectedGroupIds, filteredContacts]);  // ✅ FIXED: Use selectedGroupIds in dependency array

    // Group Cluster Manager Class - VERSION 2.0
    class GroupClusterManager {
        constructor(map, groups, contacts, options = {}) {
            console.log('🆕 GroupClusterManager v2.0 constructor called');
            this.map = map;
            this.groups = groups;
            this.contacts = contacts;
            this.options = {
                groupColors: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
                ],
                zoomThresholds: {
                    groupClusters: 12,  // Below zoom 12: show group clusters
                    individualMarkers: 15 // Above zoom 15: show individual markers
                },
                ...options
            };
            
            this.groupMarkers = new Map();
            this.individualMarkers = new Map();
            this.currentZoom = this.map.getZoom();
            this.isInitialized = false;
        }

        async initialize() {
            console.log('🚀 Initializing group cluster visualization v2.0');
            console.log('🆕 VERSION 2.0 - Enhanced with detailed logging');
            console.log('🔍 Current initialization state:', this.isInitialized);
            
            if (this.isInitialized) {
                console.log('⚠️ Already initialized, skipping...');
                return;
            }
            
            // Set up zoom change listener
            this.map.addListener('zoom_changed', () => {
                const newZoom = this.map.getZoom();
                if (Math.abs(newZoom - this.currentZoom) > 0.5) {
                    this.currentZoom = newZoom;
                    this.updateMarkersForZoom();
                }
            });

            await this.processGroups();
            await this.processUngroupedContacts();
            this.updateMarkersForZoom();
            
            this.isInitialized = true;
            console.log('✅ Group cluster visualization initialized');
        }

        async processGroups() {
            const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
            
            for (const [index, group] of this.groups.entries()) {
                const groupContacts = this.contacts.filter(contact => 
                    group.contactIds.includes(contact.id)
                );
                
                const contactsWithLocation = groupContacts.filter(contact =>
                    contact.location?.latitude && contact.location?.longitude
                );

                if (contactsWithLocation.length === 0) continue;

                const groupData = this.calculateGroupClusterData(group, contactsWithLocation, index);
                
                // Create group cluster marker
                const groupClusterMarker = await this.createGroupClusterMarker(groupData);
                
                // Create individual markers for this group
                const individualMarkers = await this.createIndividualMarkersForGroup(groupData);
                
                this.groupMarkers.set(group.id, {
                    marker: groupClusterMarker,
                    data: groupData,
                    visible: false
                });
                
                this.individualMarkers.set(group.id, {
                    markers: individualMarkers,
                    data: groupData,
                    visible: false
                });
            }
        }

        calculateGroupClusterData(group, contactsWithLocation, colorIndex) {
            const center = this.calculateCenter(contactsWithLocation);
            const radius = this.calculateRadius(contactsWithLocation, center);
            const color = this.options.groupColors[colorIndex % this.options.groupColors.length];
            
            return {
                group: group,
                contacts: contactsWithLocation,
                center: center,
                radius: radius,
                color: color,
                memberCount: contactsWithLocation.length,
                bounds: this.calculateBounds(contactsWithLocation)
            };
        }

        calculateCenter(contacts) {
            const avgLat = contacts.reduce((sum, contact) => sum + contact.location.latitude, 0) / contacts.length;
            const avgLng = contacts.reduce((sum, contact) => sum + contact.location.longitude, 0) / contacts.length;
            return { lat: avgLat, lng: avgLng };
        }

        calculateRadius(contacts, center) {
            let maxDistance = 0;
            contacts.forEach(contact => {
                const distance = this.calculateDistance(
                    center.lat, center.lng,
                    contact.location.latitude, contact.location.longitude
                );
                maxDistance = Math.max(maxDistance, distance);
            });
            return Math.max(50, Math.min(500, maxDistance));
        }

        calculateBounds(contacts) {
            const bounds = new google.maps.LatLngBounds();
            contacts.forEach(contact => {
                bounds.extend({
                    lat: contact.location.latitude,
                    lng: contact.location.longitude
                });
            });
            return bounds;
        }

        calculateDistance(lat1, lng1, lat2, lng2) {
            const R = 6371000;
            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180;
            const Δλ = (lng2 - lng1) * Math.PI / 180;

            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c;
        }

        async createGroupClusterMarker(groupData) {
            const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
            
            const clusterElement = this.createClusterElement(groupData);
            
            const marker = new AdvancedMarkerElement({
                map: null,
                position: groupData.center,
                content: clusterElement,
                title: `${groupData.group.name} (${groupData.memberCount} members)`,
            });

            clusterElement.addEventListener('click', () => {
                this.zoomToGroup(groupData);
            });

            return marker;
        }

        createClusterElement(groupData) {
            const container = document.createElement('div');
            container.className = 'group-cluster-container';
            container.style.cssText = `
                position: relative;
                cursor: pointer;
                transform: translateX(-50%) translateY(-50%);
            `;

            const circle = document.createElement('div');
            circle.className = 'group-cluster-circle';
            circle.style.cssText = `
                width: ${Math.max(40, Math.min(80, groupData.memberCount * 8))}px;
                height: ${Math.max(40, Math.min(80, groupData.memberCount * 8))}px;
                background: ${groupData.color};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            `;

            const count = document.createElement('span');
            count.textContent = groupData.memberCount.toString();
            count.style.cssText = `
                color: white;
                font-weight: bold;
                font-size: ${groupData.memberCount > 99 ? '10px' : '12px'};
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            `;
            circle.appendChild(count);

            const popup = document.createElement('div');
            popup.className = 'group-cluster-popup';
            popup.style.cssText = `
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: white;
                padding: 6px 10px;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                font-size: 12px;
                font-weight: 500;
                color: #374151;
                white-space: nowrap;
                margin-bottom: 8px;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
                z-index: 1000;
            `;

            const arrow = document.createElement('div');
            arrow.style.cssText = `
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 4px solid transparent;
                border-top-color: white;
            `;
            popup.appendChild(arrow);

            popup.innerHTML = `${groupData.group.name}<br><small>${groupData.memberCount} members</small>` + popup.innerHTML;

            container.addEventListener('mouseenter', () => {
                circle.style.transform = 'scale(1.1)';
                popup.style.opacity = '1';
            });

            container.addEventListener('mouseleave', () => {
                circle.style.transform = 'scale(1)';
                popup.style.opacity = '0';
            });

            container.appendChild(circle);
            container.appendChild(popup);

            return container;
        }

        async createIndividualMarkersForGroup(groupData) {
            const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
            const markers = [];

            for (const contact of groupData.contacts) {
                const markerElement = this.createIndividualMarkerElement(contact, groupData);
                
                const marker = new AdvancedMarkerElement({
                    map: null,
                    position: { lat: contact.location.latitude, lng: contact.location.longitude },
                    content: markerElement,
                    title: contact.name,
                });

                markerElement.addEventListener('click', () => {
                    this.onContactClick?.(contact);
                });

                markers.push({
                    marker: marker,
                    contact: contact,
                    element: markerElement
                });
            }

            return markers;
        }
// In your GroupClusterManager class, update the createIndividualMarkerElement method:

createIndividualMarkerElement(contact, groupData) {
    const container = document.createElement('div');
    container.className = 'individual-contact-marker NEW_MARKER';
    container.setAttribute('data-contact-id', contact.id);
    container.style.cssText = `
        position: relative;
        cursor: pointer;
        transform: translateX(-50%) translateY(-50%);
    `;

    const circle = document.createElement('div');
    circle.style.cssText = `
        width: 32px;
        height: 32px;
        background: ${groupData.color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    `;

    const initials = document.createElement('span');
    initials.textContent = this.getInitials(contact.name);
    initials.style.cssText = `
        color: white;
        font-weight: bold;
        font-size: 10px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    `;
    circle.appendChild(initials);

    const popup = document.createElement('div');
    popup.className = 'contact-popup';
    popup.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 8px 12px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        font-size: 12px;
        color: #374151;
        white-space: nowrap;
        margin-bottom: 8px;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
        z-index: 1000;
    `;

    const arrow = document.createElement('div');
    arrow.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: white;
    `;
    popup.appendChild(arrow);

    popup.innerHTML = `
        <div style="font-weight: 500;">${contact.name}</div>
        ${contact.company ? `<div style="font-size: 10px; color: #6B7280;">${contact.company}</div>` : ''}
    ` + popup.innerHTML;

    // FIXED: Bind the click event properly
    container.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('📍 Marker clicked directly:', contact.name);
        if (this.onContactClick) {
            this.onContactClick(contact);
        }
    });

    container.addEventListener('mouseenter', () => {
        circle.style.transform = 'scale(1.2)';
        popup.style.opacity = '1';
    });

    container.addEventListener('mouseleave', () => {
        circle.style.transform = 'scale(1)';
        popup.style.opacity = '0';
    });

    container.appendChild(circle);
    container.appendChild(popup);

    return container;
}

        async processUngroupedContacts() {
            const groupedContactIds = new Set();
            this.groups.forEach(group => {
                group.contactIds.forEach(id => groupedContactIds.add(id));
            });

            const ungroupedContacts = this.contacts.filter(contact => 
                !groupedContactIds.has(contact.id) &&
                contact.location?.latitude && contact.location?.longitude
            );

            if (ungroupedContacts.length === 0) return;

            const ungroupedMarkers = [];
            for (const contact of ungroupedContacts) {
                const markerElement = this.createUngroupedMarkerElement(contact);
                
                const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
                const marker = new AdvancedMarkerElement({
                    map: null,
                    position: { lat: contact.location.latitude, lng: contact.location.longitude },
                    content: markerElement,
                    title: contact.name,
                });

                markerElement.addEventListener('click', () => {
                    this.onContactClick?.(contact);
                });

                ungroupedMarkers.push({
                    marker: marker,
                    contact: contact,
                    element: markerElement
                });
            }

            this.individualMarkers.set('ungrouped', {
                markers: ungroupedMarkers,
                data: { contacts: ungroupedContacts },
                visible: false
            });
        }

        
createUngroupedMarkerElement(contact) {
    const container = document.createElement('div');
    container.className = 'ungrouped-contact-marker NEW_MARKER';
    container.setAttribute('data-contact-id', contact.id);
    container.style.cssText = `
        position: relative;
        cursor: pointer;
        transform: translateX(-50%) translateY(-50%);
    `;

    const circle = document.createElement('div');
    circle.style.cssText = `
        width: 28px;
        height: 28px;
        background: #6B7280;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    `;

    const initials = document.createElement('span');
    initials.textContent = this.getInitials(contact.name);
    initials.style.cssText = `
        color: white;
        font-weight: bold;
        font-size: 9px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    `;
    circle.appendChild(initials);

    const popup = document.createElement('div');
    popup.className = 'contact-popup';
    popup.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 8px 12px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        font-size: 12px;
        color: #374151;
        white-space: nowrap;
        margin-bottom: 8px;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
        z-index: 1000;
    `;

    const arrow = document.createElement('div');
    arrow.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: white;
    `;
    popup.appendChild(arrow);

    popup.innerHTML = `
        <div style="font-weight: 500;">${contact.name}</div>
        ${contact.company ? `<div style="font-size: 10px; color: #6B7280;">${contact.company}</div>` : ''}
        <div style="font-size: 10px; color: #9CA3AF;">No group</div>
    ` + popup.innerHTML;

    // FIXED: Bind the click event properly
    container.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('📍 Ungrouped marker clicked directly:', contact.name);
        if (this.onContactClick) {
            this.onContactClick(contact);
        }
    });

    container.addEventListener('mouseenter', () => {
        circle.style.transform = 'scale(1.2)';
        popup.style.opacity = '1';
    });

    container.addEventListener('mouseleave', () => {
        circle.style.transform = 'scale(1)';
        popup.style.opacity = '0';
    });

    container.appendChild(circle);
    container.appendChild(popup);

    return container;
}

        getInitials(name) {
            return name
                .split(' ')
                .map(word => word.charAt(0).toUpperCase())
                .slice(0, 2)
                .join('');
        }

        updateMarkersForZoom() {
            const zoom = this.currentZoom;
            const showGroupClusters = zoom < this.options.zoomThresholds.groupClusters;
            const showIndividualMarkers = zoom >= this.options.zoomThresholds.individualMarkers;
            const showMixed = zoom >= this.options.zoomThresholds.groupClusters && zoom < this.options.zoomThresholds.individualMarkers;

            if (showGroupClusters) {
                this.showGroupClusters();
                this.hideIndividualMarkers();
            } else if (showIndividualMarkers) {
                this.hideGroupClusters();
                this.showIndividualMarkers();
            } else if (showMixed) {
                this.showMixedView();
            }
        }

        showGroupClusters() {
            this.groupMarkers.forEach((groupInfo, groupId) => {
                if (!groupInfo.visible) {
                    groupInfo.marker.map = this.map;
                    groupInfo.visible = true;
                }
            });
            this.hideIndividualMarkers();
        }

        hideGroupClusters() {
            this.groupMarkers.forEach((groupInfo, groupId) => {
                if (groupInfo.visible) {
                    groupInfo.marker.map = null;
                    groupInfo.visible = false;
                }
            });
        }

        showIndividualMarkers() {
            this.individualMarkers.forEach((markerInfo, groupId) => {
                if (!markerInfo.visible) {
                    markerInfo.markers.forEach(({ marker }) => {
                        marker.map = this.map;
                    });
                    markerInfo.visible = true;
                }
            });
        }

        hideIndividualMarkers() {
            this.individualMarkers.forEach((markerInfo, groupId) => {
                if (markerInfo.visible) {
                    markerInfo.markers.forEach(({ marker }) => {
                        marker.map = null;
                    });
                    markerInfo.visible = false;
                }
            });
        }

        showMixedView() {
            this.groupMarkers.forEach((groupInfo, groupId) => {
                const shouldShowCluster = groupInfo.data.memberCount >= 3;
                
                if (shouldShowCluster && !groupInfo.visible) {
                    groupInfo.marker.map = this.map;
                    groupInfo.visible = true;
                    
                    const individualInfo = this.individualMarkers.get(groupId);
                    if (individualInfo?.visible) {
                        individualInfo.markers.forEach(({ marker }) => {
                            marker.map = null;
                        });
                        individualInfo.visible = false;
                    }
                } else if (!shouldShowCluster && groupInfo.visible) {
                    groupInfo.marker.map = null;
                    groupInfo.visible = false;
                    
                    const individualInfo = this.individualMarkers.get(groupId);
                    if (individualInfo && !individualInfo.visible) {
                        individualInfo.markers.forEach(({ marker }) => {
                            marker.map = this.map;
                        });
                        individualInfo.visible = true;
                    }
                }
            });

            const ungroupedInfo = this.individualMarkers.get('ungrouped');
            if (ungroupedInfo && !ungroupedInfo.visible) {
                ungroupedInfo.markers.forEach(({ marker }) => {
                    marker.map = this.map;
                });
                ungroupedInfo.visible = true;
            }
        }

        zoomToGroup(groupData) {
            this.map.fitBounds(groupData.bounds, {
                padding: { top: 50, right: 50, bottom: 50, left: 50 }
            });
        }

        setContactClickHandler(handler) {
            this.onContactClick = handler;
        }

        async updateData(groups, contacts) {
            this.cleanup();
            this.groups = groups;
            this.contacts = contacts;
            this.isInitialized = false;
            await this.initialize();
        }

        cleanup() {
            this.groupMarkers.forEach((groupInfo) => {
                groupInfo.marker.map = null;
            });
            
            this.individualMarkers.forEach((markerInfo) => {
                markerInfo.markers.forEach(({ marker }) => {
                    marker.map = null;
                });
            });
            
            this.groupMarkers.clear();
            this.individualMarkers.clear();
        }

        getState() {
            return {
                currentZoom: this.currentZoom,
                groupMarkersVisible: Array.from(this.groupMarkers.values()).filter(g => g.visible).length,
                individualMarkersVisible: Array.from(this.individualMarkers.values())
                    .reduce((total, markerInfo) => total + (markerInfo.visible ? markerInfo.markers.length : 0), 0)
            };
        }
    }

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
            

            {/* Enhanced Smart Group Suggestions */}
            {isLoaded && suggestedGroups.length > 0 && (
                <div className="absolute top-4 right-4 z-30 max-w-sm">
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
                                    <p className="text-xs text-gray-500">AI-detected clusters</p>
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
                                                <h5 className="font-medium text-sm text-gray-900 truncate">
                                                    {suggestion.name}
                                                </h5>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {suggestion.description}
                                                </p>
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
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Map Controls */}
            {isLoaded && !isMobile && (
                <div className="absolute top-20 right-4 z-20">
                    {!isSelectingMode ? (
                        <div className="flex flex-col gap-2">
                            {/* Filters Button */}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
                            
                            {/* Create Group Button */}
                            <button
                                onClick={startGroupSelection}
                                className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Create Group
                            </button>
                            
                            {/* Loading Events Indicator */}
                            {loadingEvents && (
                                <div className="bg-white p-2 rounded-lg shadow-lg border flex items-center gap-2 text-xs text-gray-600">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                    Detecting events...
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
                                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createGroupFromSelection}
                                    disabled={selectedMarkers.length === 0}
                                    className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
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
                <div className="absolute top-32 right-4 z-30 bg-white rounded-lg shadow-lg border p-4 w-80">
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
                        Contact Groups
                    </h4>
                    
                    {/* Groups Section */}
                    {groupStats.length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Active Groups
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

                    {/* Visualization Guide */}
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">5</span>
                                </div>
                                <span className="text-gray-600">Group clusters</span>
                            </div>
                            <span className="text-xs text-gray-500">Zoom &lt; 11</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">J</span>
                                </div>
                                <span className="text-gray-600">Individual contacts</span>
                            </div>
                            <span className="text-xs text-gray-500">Zoom &gt; 14</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-white shadow flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">A</span>
                                </div>
                                <span className="text-gray-600">Ungrouped contacts</span>
                            </div>
                            <span className="text-xs text-gray-500">Always visible</span>
                        </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                            Total: {contactCounts.total} contact{contactCounts.total !== 1 ? 's' : ''}
                            {Object.values(filters).some(f => f !== 'all') && (
                                <span className="text-blue-600"> (filtered)</span>
                            )}
                        </div>
                        <div className="text-xs text-purple-600 mt-1">
                            📍 {contactCounts.withLocation} with location data
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Legend Toggle */}
            {isLoaded && isMobile && (
                <button
                    onClick={() => setShowLegend(!showLegend)}
                    className="absolute top-20 left-4 bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 z-20"
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
                <div className="absolute inset-x-4 top-32 bg-white p-4 rounded-lg shadow-lg border z-30 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm">Contact Groups</h4>
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
                    
                    <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                        <div className="text-xs text-gray-500">
                            Total: {contactCounts.total} contact{contactCounts.total !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-purple-600 mt-1">
                            📍 {contactCounts.withLocation} with location
                        </div>
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

            {/* Contact Profile Modal */}
            {console.log('🔍 Rendering ContactProfileModal:', { isOpen: showContactProfile, contact: selectedContact?.name })}
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

// Contact Profile Modal Component
function ContactProfileModal({ isOpen, onClose, contact, groups, onContactUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContact, setEditedContact] = useState(null);

    useEffect(() => {
        if (contact) {
            setEditedContact({ ...contact });
        }
    }, [contact]);

    if (!isOpen || !contact) return null;

    const contactGroups = groups.filter(group => 
        group.contactIds.includes(contact.id)
    );

    const handleSave = () => {
        if (onContactUpdate) {
            onContactUpdate(editedContact);
        }
        setIsEditing(false);
    };

    const handleStatusChange = (newStatus) => {
        const updatedContact = { ...editedContact, status: newStatus };
        setEditedContact(updatedContact);
        if (onContactUpdate) {
            onContactUpdate(updatedContact);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'viewed': return 'bg-green-100 text-green-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                            {getInitials(contact.name)}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{contact.name}</h3>
                            <p className="text-sm text-gray-600">{contact.company || 'No company'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {/* Status */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <div className="flex gap-2">
                            {['new', 'viewed', 'archived'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        contact.status === status 
                                            ? getStatusColor(status)
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                        {/* Email */}
                        {contact.email && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:text-blue-800 text-sm">
                                        {contact.email}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Phone */}
                        {contact.phone && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <a href={`tel:${contact.phone}`} className="text-blue-600 hover:text-blue-800 text-sm">
                                        {contact.phone}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Location */}
                        {contact.location && contact.location.latitude && contact.location.longitude && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <span className="text-sm text-gray-600">
                                        {contact.location.address || `${contact.location.latitude.toFixed(4)}, ${contact.location.longitude.toFixed(4)}`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Groups */}
                        {contactGroups.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Groups</label>
                                <div className="flex flex-wrap gap-2">
                                    {contactGroups.map((group) => (
                                        <span
                                            key={group.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            {group.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {contact.notes && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-sm text-gray-700">{contact.notes}</p>
                                </div>
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                                <div>
                                    <span className="font-medium">Added:</span>
                                    <br />
                                    {new Date(contact.createdAt || contact.submittedAt).toLocaleDateString()}
                                </div>
                                {contact.lastInteraction && (
                                    <div>
                                        <span className="font-medium">Last Contact:</span>
                                        <br />
                                        {new Date(contact.lastInteraction).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                    {contact.email && (
                        <button
                            onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                        </button>
                    )}
                    {contact.phone && (
                        <button
                            onClick={() => window.open(`tel:${contact.phone}`, '_blank')}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Call
                        </button>
                    )}
                </div>
            </div>
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