// components/map/GroupClusterManager.js - Manages group visualization and zoom-based detail levels

export class GroupClusterManager {
    constructor(map, groups, contacts, options = {}) {
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
        
        console.log('🎯 GroupClusterManager initialized', {
            groups: this.groups.length,
            contacts: this.contacts.length,
            zoomThresholds: this.options.zoomThresholds
        });
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🚀 Initializing group cluster visualization');
        
        // Set up zoom change listener
        this.map.addListener('zoom_changed', () => {
            const newZoom = this.map.getZoom();
            if (Math.abs(newZoom - this.currentZoom) > 0.5) { // Prevent too frequent updates
                this.currentZoom = newZoom;
                this.updateMarkersForZoom();
            }
        });

        // Process groups and create visualizations
        await this.processGroups();
        await this.processUngroupedContacts();
        
        // Initial render based on current zoom
        this.updateMarkersForZoom();
        
        this.isInitialized = true;
        console.log('✅ Group cluster visualization initialized');
    }

    async processGroups() {
        console.log('📊 Processing groups for visualization');
        
        for (const [index, group] of this.groups.entries()) {
            const groupContacts = this.contacts.filter(contact => 
                group.contactIds.includes(contact.id)
            );
            
            const contactsWithLocation = groupContacts.filter(contact =>
                contact.location?.latitude && contact.location?.longitude
            );

            if (contactsWithLocation.length === 0) {
                console.log(`⚠️ Skipping group ${group.name} - no contacts with location`);
                continue;
            }

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
            
            console.log(`✅ Processed group: ${group.name}`, {
                contacts: contactsWithLocation.length,
                center: groupData.center,
                radius: groupData.radius
            });
        }
    }

    calculateGroupClusterData(group, contactsWithLocation, colorIndex) {
        // Calculate center point
        const center = this.calculateCenter(contactsWithLocation);
        
        // Calculate radius (maximum distance from center)
        const radius = this.calculateRadius(contactsWithLocation, center);
        
        // Get group color
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
        
        // Convert to reasonable visualization radius (minimum 50m, maximum 500m)
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
        const R = 6371000; // Earth's radius in meters
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
        const { Map } = await google.maps.importLibrary('maps');
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
        
        // Create cluster circle element
        const clusterElement = this.createClusterElement(groupData);
        
        // Create the marker
        const marker = new AdvancedMarkerElement({
            map: null, // Initially hidden
            position: groupData.center,
            content: clusterElement,
            title: `${groupData.group.name} (${groupData.memberCount} members)`,
        });

        // Add click handler to zoom into group
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

        // Create the circle
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

        // Add member count
        const count = document.createElement('span');
        count.textContent = groupData.memberCount.toString();
        count.style.cssText = `
            color: white;
            font-weight: bold;
            font-size: ${groupData.memberCount > 99 ? '10px' : '12px'};
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        circle.appendChild(count);

        // Create the popup label
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

        // Add arrow
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

        // Hover effects
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
                map: null, // Initially hidden
                position: { lat: contact.location.latitude, lng: contact.location.longitude },
                content: markerElement,
                title: contact.name,
            });

            // Add click handler
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

    createIndividualMarkerElement(contact, groupData) {
        const container = document.createElement('div');
        container.className = 'individual-contact-marker';
        container.style.cssText = `
            position: relative;
            cursor: pointer;
            transform: translateX(-50%) translateY(-50%);
        `;

        // Create the marker circle
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

        // Add initials
        const initials = document.createElement('span');
        initials.textContent = this.getInitials(contact.name);
        initials.style.cssText = `
            color: white;
            font-weight: bold;
            font-size: 10px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        circle.appendChild(initials);

        // Create the popup
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

        // Add arrow
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

        // Hover effects
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
        console.log('👤 Processing ungrouped contacts');
        
        // Find contacts that are not in any group
        const groupedContactIds = new Set();
        this.groups.forEach(group => {
            group.contactIds.forEach(id => groupedContactIds.add(id));
        });

        const ungroupedContacts = this.contacts.filter(contact => 
            !groupedContactIds.has(contact.id) &&
            contact.location?.latitude && contact.location?.longitude
        );

        if (ungroupedContacts.length === 0) {
            console.log('ℹ️ No ungrouped contacts to process');
            return;
        }

        // Create individual markers for ungrouped contacts
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

        console.log(`✅ Processed ${ungroupedContacts.length} ungrouped contacts`);
    }

    createUngroupedMarkerElement(contact) {
        const container = document.createElement('div');
        container.className = 'ungrouped-contact-marker';
        container.style.cssText = `
            position: relative;
            cursor: pointer;
            transform: translateX(-50%) translateY(-50%);
        `;

        // Create the marker circle with a different style for ungrouped
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

        // Add initials
        const initials = document.createElement('span');
        initials.textContent = this.getInitials(contact.name);
        initials.style.cssText = `
            color: white;
            font-weight: bold;
            font-size: 9px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        circle.appendChild(initials);

        // Create popup (similar to grouped contacts)
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

        // Hover effects
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

        console.log(`🔍 Updating markers for zoom level ${zoom.toFixed(1)}`, {
            showGroupClusters,
            showIndividualMarkers,
            showMixed
        });

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
        // Show group cluster markers
        this.groupMarkers.forEach((groupInfo, groupId) => {
            if (!groupInfo.visible) {
                groupInfo.marker.map = this.map;
                groupInfo.visible = true;
            }
        });

        // Hide individual markers
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
        // Show both group clusters and individual markers with some logic
        // For now, show group clusters for groups with 3+ members, individual for smaller groups
        this.groupMarkers.forEach((groupInfo, groupId) => {
            const shouldShowCluster = groupInfo.data.memberCount >= 3;
            
            if (shouldShowCluster && !groupInfo.visible) {
                groupInfo.marker.map = this.map;
                groupInfo.visible = true;
                
                // Hide individual markers for this group
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
                
                // Show individual markers for this group
                const individualInfo = this.individualMarkers.get(groupId);
                if (individualInfo && !individualInfo.visible) {
                    individualInfo.markers.forEach(({ marker }) => {
                        marker.map = this.map;
                    });
                    individualInfo.visible = true;
                }
            }
        });

        // Always show ungrouped individual markers
        const ungroupedInfo = this.individualMarkers.get('ungrouped');
        if (ungroupedInfo && !ungroupedInfo.visible) {
            ungroupedInfo.markers.forEach(({ marker }) => {
                marker.map = this.map;
            });
            ungroupedInfo.visible = true;
        }
    }

    zoomToGroup(groupData) {
        console.log(`🎯 Zooming to group: ${groupData.group.name}`);
        
        // Fit map to group bounds with padding
        this.map.fitBounds(groupData.bounds, {
            padding: { top: 50, right: 50, bottom: 50, left: 50 }
        });
    }

    // Public method to set contact click handler
    setContactClickHandler(handler) {
        this.onContactClick = handler;
    }

    // Public method to update with new data
    async updateData(groups, contacts) {
        console.log('🔄 Updating group cluster manager with new data');
        
        // Clear existing markers
        this.cleanup();
        
        // Update data
        this.groups = groups;
        this.contacts = contacts;
        
        // Reinitialize
        this.isInitialized = false;
        await this.initialize();
    }

    cleanup() {
        // Remove all markers from map
        this.groupMarkers.forEach((groupInfo) => {
            groupInfo.marker.map = null;
        });
        
        this.individualMarkers.forEach((markerInfo) => {
            markerInfo.markers.forEach(({ marker }) => {
                marker.map = null;
            });
        });
        
        // Clear maps
        this.groupMarkers.clear();
        this.individualMarkers.clear();
    }

    // Public method to get current state
    getState() {
        return {
            currentZoom: this.currentZoom,
            groupMarkersVisible: Array.from(this.groupMarkers.values()).filter(g => g.visible).length,
            individualMarkersVisible: Array.from(this.individualMarkers.values())
                .reduce((total, markerInfo) => total + (markerInfo.visible ? markerInfo.markers.length : 0), 0)
        };
    }
}