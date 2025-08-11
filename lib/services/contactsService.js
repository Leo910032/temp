    // lib/services/contactsService.js - COMPLETE SERVER-SIDE CONTACTS SERVICE
    import { auth } from '@/important/firebase';

    const API_BASE = '/api/user/contacts';


    // Helper function to get auth headers
    const getAuthHeaders = async () => {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const token = await user.getIdToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    // Request deduplication and caching
    const requestCache = new Map();


    /**
     * Fonction pour tester la conversion d'image
     */
    export function testImageConversion(file) {
        console.log('🧪 Testing image conversion...');
        
        return convertFileToBase64(file)
            .then(base64 => {
                console.log('✅ Test successful:', {
                    base64Length: base64.length,
                    firstChars: base64.substring(0, 50),
                    isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(base64)
                });
                return base64;
            })
            .catch(error => {
                console.error('❌ Test failed:', error);
                throw error;
            });
    }

    /**
     * Base API call helper with token caching and request deduplication
     * ✅ SECURITY: Uses the AuthContext's cached token system
     */
    async function makeAuthenticatedRequest(url, options = {}) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        // Request deduplication for GET requests
        const isGetRequest = !options.method || options.method === 'GET';
        if (isGetRequest) {
            const cacheKey = `${url}_${user.uid}`;
            if (requestCache.has(cacheKey)) {
                console.log('🔄 Using cached request for:', url);
                return requestCache.get(cacheKey);
            }
        }

        const requestPromise = (async () => {
            try {
                // ✅ SECURITY: Use cached token to prevent quota exceeded errors
                const token = await user.getIdToken(false);
                
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                        ...options.headers,
                    },
                });

                if (!response.ok) {
                    let errorMessage = 'Request failed';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }
                    throw new Error(errorMessage);
                }

                const result = await response.json();
                
                // Cache GET requests for 30 seconds
                if (isGetRequest) {
                    const cacheKey = `${url}_${user.uid}`;
                    requestCache.set(cacheKey, result);
                    setTimeout(() => requestCache.delete(cacheKey), 30000);
                }
                
                return result;
            } catch (error) {
                console.error(`API Request failed for ${url}:`, error);
                
                // ✅ SECURITY: Token refresh retry logic for auth errors
                if (error.message.includes('auth/') && !options._retried) {
                    console.log('🔄 Retrying with fresh token...');
                    try {
                        const freshToken = await user.getIdToken(true);
                        return makeAuthenticatedRequest(url, { 
                            ...options, 
                            _retried: true,
                            headers: {
                                ...options.headers,
                                'Authorization': `Bearer ${freshToken}`
                            }
                        });
                    } catch (retryError) {
                        console.error('❌ Retry failed:', retryError);
                        throw retryError;
                    }
                }
                
                throw error;
            }
        })();

        // Cache the promise for GET requests
        if (isGetRequest) {
            const cacheKey = `${url}_${user.uid}`;
            requestCache.set(cacheKey, requestPromise);
        }

        return requestPromise;
    }

    /**
     * Clear cache when updating data
     */
    function clearContactsCache() {
        const user = auth.currentUser;
        if (user) {
            const cacheKeys = Array.from(requestCache.keys()).filter(key => 
                key.includes('/api/user/contacts') && key.includes(user.uid)
            );
            cacheKeys.forEach(key => requestCache.delete(key));
        }
    }

    // =============================================================================
    // CORE CONTACTS FUNCTIONS (for authenticated dashboard)
    // =============================================================================

    /**
     * Get all contacts with optional filtering
     */
    export async function getContacts(filters = {}) {
        const { status, search, limit = 100, offset = 0 } = filters;
        
        const params = new URLSearchParams();
        if (status && status !== 'all') params.append('status', status);
        if (search) params.append('search', search);
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        
        const url = `/api/user/contacts${params.toString() ? `?${params.toString()}` : ''}`;
        
        return makeAuthenticatedRequest(url, {
            method: 'GET'
        });
    }

    /**
     * Create a new contact
     */
    export async function createContact(contactData) {
        clearContactsCache();
        
        return makeAuthenticatedRequest('/api/user/contacts', {
            method: 'POST',
            body: JSON.stringify({
                action: 'create',
                contact: contactData
            })
        });
    }
    // ✅ NEW GROUP MANAGEMENT FUNCTIONS

    /**
     * Get all contact groups for the authenticated user
     */
    export async function getContactGroups() {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get contact groups');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting contact groups:', error);
            throw error;
        }
    }

    /**
     * Create a new contact group
     */
    export async function createContactGroup(groupData) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'create',
                    group: groupData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create contact group');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating contact group:', error);
            throw error;
        }
    }

    /**
     * Update an existing contact group
     */
    export async function updateContactGroup(groupData) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    action: 'update',
                    group: groupData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update contact group');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating contact group:', error);
            throw error;
        }
    }

    /**
     * Delete a contact group
     */
    export async function deleteContactGroup(groupId) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups/${groupId}`, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete contact group');
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting contact group:', error);
            throw error;
        }
    }

    /**
     * Add contacts to a group
     */
    export async function addContactsToGroup(groupId, contactIds) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups/${groupId}/contacts`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'add',
                    contactIds: contactIds
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add contacts to group');
            }

            return await response.json();
        } catch (error) {
            console.error('Error adding contacts to group:', error);
            throw error;
        }
    }

    /**
     * Remove contacts from a group
     */
    export async function removeContactsFromGroup(groupId, contactIds) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups/${groupId}/contacts`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({
                    action: 'remove',
                    contactIds: contactIds
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to remove contacts from group');
            }

            return await response.json();
        } catch (error) {
            console.error('Error removing contacts from group:', error);
            throw error;
        }
    }

    /**
     * Generate automatic groups based on contact data
     */
    export async function generateAutoGroups(options = {}) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups/auto-generate`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    options: {
                        groupByCompany: options.groupByCompany !== false, // default true
                        groupByLocation: options.groupByLocation !== false, // default true
                        groupByEvents: options.groupByEvents !== false, // default true
                        minGroupSize: options.minGroupSize || 2,
                        maxGroups: options.maxGroups || 50,
                        ...options
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate automatic groups');
            }

            return await response.json();
        } catch (error) {
            console.error('Error generating auto groups:', error);
            throw error;
        }
    }

    /**
     * Search for nearby events at contact locations
     */
    export async function findNearbyEvents(contactIds = []) {
        try {
            const headers = await getAuthHeaders();

            const params = new URLSearchParams();
            if (contactIds.length > 0) {
                params.append('contactIds', contactIds.join(','));
            }

            const response = await fetch(`${API_BASE}/events/nearby?${params.toString()}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to find nearby events');
            }

            return await response.json();
        } catch (error) {
            console.error('Error finding nearby events:', error);
            throw error;
        }
    }

    /**
     * Create event-based groups from location data
     */
    export async function createEventGroups(eventData, contactIds) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups/from-events`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    eventData: eventData,
                    contactIds: contactIds
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create event groups');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating event groups:', error);
            throw error;
        }
    }

    /**
     * Get group analytics and insights
     */
    export async function getGroupAnalytics() {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE}/groups/analytics`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get group analytics');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting group analytics:', error);
            throw error;
        }
    }

    // ✅ CLIENT-SIDE GROUP UTILITIES

    /**
     * Sort groups by various criteria
     */
    export function sortGroups(groups, sortBy = 'name', direction = 'asc') {
        const sortedGroups = [...groups].sort((a, b) => {
            let valueA, valueB;

            switch (sortBy) {
                case 'name':
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    break;
                case 'size':
                    valueA = a.contactIds.length;
                    valueB = b.contactIds.length;
                    break;
                case 'created':
                    valueA = new Date(a.createdAt);
                    valueB = new Date(b.createdAt);
                    break;
                case 'type':
                    valueA = a.type;
                    valueB = b.type;
                    break;
                default:
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
            }

            if (valueA < valueB) return direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sortedGroups;
    }

    /**
     * Filter groups by type, size, or other criteria
     */
    export function filterGroups(groups, filters = {}) {
        let filteredGroups = [...groups];

        if (filters.type) {
            filteredGroups = filteredGroups.filter(group => group.type === filters.type);
        }

        if (filters.minSize !== undefined) {
            filteredGroups = filteredGroups.filter(group => group.contactIds.length >= filters.minSize);
        }

        if (filters.maxSize !== undefined) {
            filteredGroups = filteredGroups.filter(group => group.contactIds.length <= filters.maxSize);
        }

        if (filters.searchTerm) {
            const searchTerm = filters.searchTerm.toLowerCase();
            filteredGroups = filteredGroups.filter(group => 
                group.name.toLowerCase().includes(searchTerm) ||
                (group.description && group.description.toLowerCase().includes(searchTerm))
            );
        }

        if (filters.hasEvents !== undefined) {
            filteredGroups = filteredGroups.filter(group => 
                filters.hasEvents ? !!group.eventData : !group.eventData
            );
        }

        return filteredGroups;
    }

    /**
     * Get contacts that belong to specific groups
     */
    export function getContactsByGroups(contacts, groups, groupIds) {
        if (!groupIds || groupIds.length === 0) return contacts;

        const targetGroups = groups.filter(group => groupIds.includes(group.id));
        const contactIds = new Set();

        targetGroups.forEach(group => {
            group.contactIds.forEach(id => contactIds.add(id));
        });

        return contacts.filter(contact => contactIds.has(contact.id));
    }

    /**
     * Get groups that contain specific contacts
     */
    export function getGroupsByContacts(groups, contactIds) {
        if (!contactIds || contactIds.length === 0) return [];

        return groups.filter(group => 
            contactIds.some(contactId => group.contactIds.includes(contactId))
        );
    }

    /**
     * Validate group data before creation/update
     */
    export function validateGroupData(groupData) {
        const errors = [];

        if (!groupData.name || groupData.name.trim().length === 0) {
            errors.push('Group name is required');
        }

        if (groupData.name && groupData.name.length > 100) {
            errors.push('Group name must be less than 100 characters');
        }

        if (groupData.description && groupData.description.length > 500) {
            errors.push('Group description must be less than 500 characters');
        }

        if (!groupData.contactIds || !Array.isArray(groupData.contactIds)) {
            errors.push('Contact IDs must be provided as an array');
        }

        if (groupData.contactIds && groupData.contactIds.length === 0) {
            errors.push('Group must contain at least one contact');
        }

        if (groupData.type && !['custom', 'auto', 'company', 'event'].includes(groupData.type)) {
            errors.push('Invalid group type');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Generate group suggestions based on contact data
     */
    export function generateGroupSuggestions(contacts) {
        const suggestions = [];

        // Company-based suggestions
        const companyCounts = {};
        contacts.forEach(contact => {
            if (contact.company && contact.company.trim()) {
                const company = contact.company.trim();
                companyCounts[company] = (companyCounts[company] || 0) + 1;
            }
        });

        Object.entries(companyCounts)
            .filter(([company, count]) => count >= 2)
            .forEach(([company, count]) => {
                suggestions.push({
                    type: 'company',
                    name: `${company} Team`,
                    description: `${count} contacts from ${company}`,
                    contactIds: contacts
                        .filter(c => c.company && c.company.trim() === company)
                        .map(c => c.id),
                    priority: count,
                    suggestedType: 'company'
                });
            });

        // Location-based suggestions
        const locationGroups = {};
        contacts
            .filter(contact => contact.location && contact.location.latitude)
            .forEach(contact => {
                const lat = Math.round(contact.location.latitude * 100) / 100;
                const lng = Math.round(contact.location.longitude * 100) / 100;
                const locationKey = `${lat},${lng}`;
                
                if (!locationGroups[locationKey]) {
                    locationGroups[locationKey] = [];
                }
                locationGroups[locationKey].push(contact);
            });

        Object.entries(locationGroups)
            .filter(([location, contacts]) => contacts.length >= 2)
            .forEach(([location, groupContacts]) => {
                suggestions.push({
                    type: 'location',
                    name: `Contacts at ${location}`,
                    description: `${groupContacts.length} contacts at the same location`,
                    contactIds: groupContacts.map(c => c.id),
                    priority: groupContacts.length,
                    suggestedType: 'auto'
                });
            });

        // Recent contacts suggestions
        const recentContacts = contacts
            .filter(contact => {
                const contactDate = new Date(contact.submittedAt);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return contactDate > weekAgo;
            });

        if (recentContacts.length >= 3) {
            suggestions.push({
                type: 'temporal',
                name: 'Recent Contacts',
                description: `${recentContacts.length} contacts from the past week`,
                contactIds: recentContacts.map(c => c.id),
                priority: recentContacts.length,
                suggestedType: 'auto'
            });
        }

        // Sort suggestions by priority (number of contacts)
        return suggestions.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Calculate group statistics
     */
    export function calculateGroupStats(groups, contacts) {
        const stats = {
            totalGroups: groups.length,
            totalContactsInGroups: 0,
            averageGroupSize: 0,
            largestGroup: null,
            smallestGroup: null,
            groupTypes: {
                custom: 0,
                auto: 0,
                company: 0,
                event: 0
            },
            ungroupedContacts: 0
        };

        if (groups.length === 0) {
            stats.ungroupedContacts = contacts.length;
            return stats;
        }

        // Calculate group type counts and sizes
        const groupSizes = [];
        const contactsInGroups = new Set();

        groups.forEach(group => {
            // Count group types
            stats.groupTypes[group.type] = (stats.groupTypes[group.type] || 0) + 1;
            
            // Track group sizes
            const size = group.contactIds.length;
            groupSizes.push(size);
            
            // Track contacts in groups
            group.contactIds.forEach(id => contactsInGroups.add(id));
            
            // Find largest and smallest groups
            if (!stats.largestGroup || size > stats.largestGroup.size) {
                stats.largestGroup = { name: group.name, size: size };
            }
            if (!stats.smallestGroup || size < stats.smallestGroup.size) {
                stats.smallestGroup = { name: group.name, size: size };
            }
        });

        stats.totalContactsInGroups = contactsInGroups.size;
        stats.averageGroupSize = groupSizes.length > 0 
            ? Math.round(groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length * 10) / 10 
            : 0;
        stats.ungroupedContacts = contacts.length - contactsInGroups.size;

        return stats;
    }

    /**
     * Export groups to various formats
     */
    export function exportGroups(groups, contacts, format = 'json') {
        const exportData = {
            timestamp: new Date().toISOString(),
            totalGroups: groups.length,
            groups: groups.map(group => ({
                ...group,
                contacts: contacts.filter(contact => group.contactIds.includes(contact.id))
            }))
        };

        switch (format.toLowerCase()) {
            case 'json':
                return {
                    format: 'json',
                    data: JSON.stringify(exportData, null, 2),
                    filename: `contact_groups_${new Date().toISOString().split('T')[0]}.json`
                };

            case 'csv':
                const csvRows = [];
                csvRows.push(['Group Name', 'Group Type', 'Contact Count', 'Contact Names', 'Description']);
                
                groups.forEach(group => {
                    const groupContacts = contacts.filter(c => group.contactIds.includes(c.id));
                    const contactNames = groupContacts.map(c => c.name).join('; ');
                    
                    csvRows.push([
                        group.name,
                        group.type,
                        group.contactIds.length.toString(),
                        contactNames,
                        group.description || ''
                    ]);
                });

                const csvContent = csvRows
                    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                    .join('\n');

                return {
                    format: 'csv',
                    data: csvContent,
                    filename: `contact_groups_${new Date().toISOString().split('T')[0]}.csv`
                };

            default:
                throw new Error('Unsupported export format');
        }
    }

    /**
     * Update an existing contact
     */
    export async function updateContact(contactData) {
        clearContactsCache();
        
        return makeAuthenticatedRequest('/api/user/contacts', {
            method: 'POST',
            body: JSON.stringify({
                action: 'update',
                contact: contactData
            })
        });
    }

    /**
     * Delete a contact
     */
    export async function deleteContact(contactId) {
        clearContactsCache();
        
        return makeAuthenticatedRequest('/api/user/contacts', {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete',
                contact: { id: contactId }
            })
        });
    }
    /**
     * Gestionnaire d'événement pour input file - Version corrigée
     */
    export function handleBusinessCardUpload(event, onSuccess, onError) {
        console.log('📤 handleBusinessCardUpload called');
        
        const file = event.target.files[0];
        
        if (!file) {
            console.warn('⚠️ No file selected');
            onError(new Error('No file selected'));
            return;
        }

        console.log('📁 File selected:', {
            name: file.name,
            size: file.size,
            type: file.type
        });

        // Tester d'abord la conversion
        testImageConversion(file)
            .then(base64 => {
                console.log('✅ Image conversion test passed, starting scan...');
                
                // Utiliser directement le File object
                return scanBusinessCard(file);
            })
            .then(result => {
                console.log('✅ Scan completed:', result);
                onSuccess(result);
            })
            .catch(error => {
                console.error('❌ Upload/scan failed:', error);
                onError(error);
            });
    }

    /**
     * Update contact status
     */
    export async function updateContactStatus(contactId, newStatus) {
        clearContactsCache();
        
        return makeAuthenticatedRequest('/api/user/contacts', {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateStatus',
                contact: { id: contactId, status: newStatus }
            })
        });
    }

    /**
     * Bulk update contacts (for Firebase compatibility)
     */
    export async function bulkUpdateContacts(contacts) {
        clearContactsCache();
        
        return makeAuthenticatedRequest('/api/user/contacts', {
            method: 'POST',
            body: JSON.stringify({
                action: 'bulkUpdate',
                contacts: contacts
            })
        });
    }

    // =============================================================================
    // BUSINESS CARD SCANNING
    // =============================================================================

    // Add this updated function to your contactsService.js

    // Fixed scanBusinessCard function for contactsService.js
    // Fixed scanBusinessCard function for contactsService.js
    /**
     * Fonction utilitaire pour convertir un File en base64
     */
    function convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided to convertFileToBase64'));
                return;
            }

            console.log('🔄 Converting file to base64:', {
                name: file.name,
                size: file.size,
                type: file.type
            });

            // Vérifications de base
            if (file.size === 0) {
                reject(new Error('File is empty (0 bytes)'));
                return;
            }

            if (file.size > 15 * 1024 * 1024) {
                reject(new Error('File too large (max 15MB)'));
                return;
            }

            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                reject(new Error(`Invalid file type: ${file.type}. Must be JPEG, PNG, WebP, or GIF.`));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = function(event) {
                try {
                    const result = event.target.result;
                    
                    if (!result) {
                        reject(new Error('FileReader returned empty result'));
                        return;
                    }

                    if (typeof result !== 'string') {
                        reject(new Error('FileReader result is not a string'));
                        return;
                    }

                    if (!result.startsWith('data:image/')) {
                        reject(new Error('FileReader result is not a data URL'));
                        return;
                    }

                    // Extraire la partie base64
                    const base64Part = result.split(',')[1];
                    
                    if (!base64Part) {
                        reject(new Error('Could not extract base64 part from data URL'));
                        return;
                    }

                    if (base64Part.length < 100) {
                        reject(new Error(`Base64 result too short: ${base64Part.length} chars`));
                        return;
                    }

                    console.log('✅ File converted to base64:', {
                        originalSize: file.size,
                        base64Length: base64Part.length,
                        estimatedSize: Math.round(base64Part.length * 0.75),
                        compression: Math.round((1 - (base64Part.length * 0.75) / file.size) * 100) + '%'
                    });

                    resolve(base64Part);
                    
                } catch (error) {
                    reject(new Error(`Error processing FileReader result: ${error.message}`));
                }
            };

            reader.onerror = function() {
                reject(new Error('FileReader failed to read the file'));
            };

            reader.onabort = function() {
                reject(new Error('FileReader was aborted'));
            };

            // Lire le fichier comme data URL
            reader.readAsDataURL(file);
        });
    }

    /**
     * VERSION FINALE COMPLÈTE de scanBusinessCard
     */
    export async function scanBusinessCard(imageData) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            // DEBUG: Logs détaillés
            console.log('🔍 DEBUGGING scanBusinessCard input:', {
                type: typeof imageData,
                constructor: imageData?.constructor?.name,
                length: imageData?.length,
                isFile: imageData instanceof File,
                isArray: Array.isArray(imageData),
                isEvent: imageData?.target !== undefined,
                keys: typeof imageData === 'object' ? Object.keys(imageData || {}) : 'not object',
                firstChars: typeof imageData === 'string' ? imageData.substring(0, 50) : 'not string'
            });

            let processedBase64 = '';

            // CAS 0: Array contenant des Files (drag & drop, multiple selection)
            if (Array.isArray(imageData)) {
                console.log('📂 Processing Array input, length:', imageData.length);
                
                if (imageData.length === 0) {
                    throw new Error('Array is empty, no file to process');
                }
                
                const file = imageData[0];
                if (!(file instanceof File)) {
                    throw new Error(`Array contains non-File object: ${typeof file}, constructor: ${file?.constructor?.name}`);
                }
                
                console.log('📁 Processing first file from array:', file.name, file.size, 'bytes');
                processedBase64 = await convertFileToBase64(file);
            }
            // CAS 1: File object direct
            else if (imageData instanceof File) {
                console.log('📁 Processing File object:', imageData.name, imageData.size, 'bytes');
                processedBase64 = await convertFileToBase64(imageData);
            }
            // CAS 2: Event object du file input
            else if (imageData?.target?.files?.[0]) {
                console.log('📂 Processing file from event');
                const file = imageData.target.files[0];
                console.log('📁 File from event:', file.name, file.size, 'bytes');
                processedBase64 = await convertFileToBase64(file);
            }
            // CAS 3: Data URL string
            else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                console.log('🔗 Processing data URL, length:', imageData.length);
                const base64Part = imageData.split(',')[1];
                if (!base64Part || base64Part.length < 100) {
                    throw new Error(`Data URL seems invalid - base64 part too short: ${base64Part?.length || 0} chars`);
                }
                processedBase64 = base64Part;
            }
            // CAS 4: Pure base64 string
            else if (typeof imageData === 'string' && imageData.length > 100) {
                console.log('📝 Processing pure base64 string');
                const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                if (!base64Regex.test(imageData)) {
                    throw new Error('String provided is not valid base64');
                }
                processedBase64 = imageData;
            }
            // CAS 5: Object avec propriété imageBase64
            else if (imageData?.imageBase64) {
                console.log('📦 Processing object with imageBase64 property');
                if (imageData.imageBase64.startsWith('data:image/')) {
                    const base64Part = imageData.imageBase64.split(',')[1];
                    if (!base64Part || base64Part.length < 100) {
                        throw new Error(`imageBase64 property seems invalid - too short: ${base64Part?.length || 0} chars`);
                    }
                    processedBase64 = base64Part;
                } else {
                    processedBase64 = imageData.imageBase64;
                }
            }
            // CAS 6: FileList object
            else if (imageData instanceof FileList) {
                console.log('📂 Processing FileList object, length:', imageData.length);
                
                if (imageData.length === 0) {
                    throw new Error('FileList is empty, no file to process');
                }
                
                const file = imageData[0];
                console.log('📁 Processing first file from FileList:', file.name, file.size, 'bytes');
                processedBase64 = await convertFileToBase64(file);
            }
            else {
                // ERREUR: Format non supporté
                throw new Error(`Unsupported input format. Got: ${typeof imageData}, constructor: ${imageData?.constructor?.name}, isArray: ${Array.isArray(imageData)}, has target: ${!!imageData?.target}, has files: ${!!imageData?.target?.files}`);
            }

            // ... le reste de votre fonction reste identique ...
            
            // Validation finale
            if (!processedBase64 || processedBase64.length < 100) {
                throw new Error(`Processed base64 is too short (${processedBase64?.length || 0} chars). This suggests the image wasn't processed correctly.`);
            }

            // Vérifier que c'est vraiment du base64 valide
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(processedBase64)) {
                throw new Error('Final processed string is not valid base64');
            }

            console.log('✅ Base64 processing successful:', {
                length: processedBase64.length,
                estimatedSizeKB: Math.round(processedBase64.length * 0.75 / 1024 * 100) / 100,
                firstChars: processedBase64.substring(0, 50),
                lastChars: processedBase64.substring(processedBase64.length - 10)
            });

            // Préparer la requête
            const requestPayload = {
                imageBase64: processedBase64
            };

            // Obtenir le token d'auth
            const token = await user.getIdToken(false);
            
            console.log('📡 Sending request to API...');
            
            // Faire la requête API
            const response = await fetch('/api/user/contacts/scan', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload)
            });

            console.log(`📡 API response status: ${response.status}`);

            if (!response.ok) {
                let errorMessage = 'Scan failed';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
                    console.error('❌ API error response:', errorData);
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    console.error('❌ Failed to parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            console.log('✅ Business card scan completed:', {
                success: result.success,
                fieldsFound: result.parsedFields?.length || 0,
                method: result.metadata?.processingMethod || 'unknown'
            });

            return result;
            
        } catch (error) {
            console.error('❌ scanBusinessCard error:', error);
            
            // Retourner une réponse d'erreur conviviale
            return {
                success: false,
                error: error.message,
                parsedFields: [
                    { label: 'Name', value: '', type: 'standard' },
                    { label: 'Email', value: '', type: 'standard' },
                    { label: 'Phone', value: '', type: 'standard' },
                    { label: 'Company', value: '', type: 'standard' },
                    { label: 'Job Title', value: '', type: 'custom' },
                    { label: 'Note', value: `Scan failed: ${error.message}. Please fill manually.`, type: 'custom' }
                ],
                metadata: {
                    hasQRCode: false,
                    fieldsCount: 6,
                    fieldsWithData: 1,
                    hasRequiredFields: false,
                    processedAt: new Date().toISOString(),
                    processingMethod: 'error_fallback',
                    note: `Scanning error: ${error.message}`
                }
            };
        }
    }


    /**
     * Helper function to validate image data before processing
     */
    export function validateImageDataInput(imageData) {
        if (!imageData) {
            return { isValid: false, error: 'No image data provided' };
        }
        
        try {
            let base64String = '';
            
            if (typeof imageData === 'string') {
                base64String = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
            } else if (typeof imageData === 'object' && imageData.imageBase64) {
                base64String = imageData.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
            } else if (typeof imageData === 'object' && imageData.data) {
                base64String = String(imageData.data).replace(/^data:image\/[a-z]+;base64,/, '');
            } else if (typeof imageData === 'object' && imageData.target && imageData.target.result) {
                base64String = imageData.target.result.replace(/^data:image\/[a-z]+;base64,/, '');
            } else {
                return { isValid: false, error: `Unsupported data type: ${typeof imageData}` };
            }
            
            if (!base64String || base64String.length === 0) {
                return { isValid: false, error: 'Empty base64 data' };
            }
            
            // Basic base64 validation
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(base64String)) {
                return { isValid: false, error: 'Invalid base64 format' };
            }
            
            // Size check (approximate)
            const sizeKB = base64String.length * 0.75 / 1024; // rough estimate
            if (sizeKB > 15000) { // 15MB limit
                return { isValid: false, error: 'Image too large' };
            }
            
            return { 
                isValid: true, 
                base64: base64String, 
                sizeKB: Math.round(sizeKB * 100) / 100 
            };
            
        } catch (error) {
            return { isValid: false, error: `Validation error: ${error.message}` };
        }
    }

    /**
     * Helper function to prepare image data for scanning
     */
    export function prepareImageDataForScanning(imageData) {
        const validation = validateImageDataInput(imageData);
        
        if (!validation.isValid) {
            throw new Error(validation.error);
        }
        
        console.log(`📏 Image prepared for scanning: ${validation.sizeKB}KB`);
        
        return {
            imageBase64: validation.base64
        };
    }

    /**
     * Create contact from scanned business card
     */
    export async function createContactFromScan(scannedFields) {
        // Find primary fields
        const nameField = scannedFields.find(f => 
            f.label.toLowerCase().includes('name')
        );
        const emailField = scannedFields.find(f => 
            f.label.toLowerCase().includes('email')
        );
        
        // Create contact object
        const contactData = {
            name: nameField ? nameField.value.trim() : 'Unnamed Contact',
            email: emailField ? emailField.value.trim().toLowerCase() : '',
            details: scannedFields.filter(f => f.value.trim() !== ''),
            status: 'new',
            submittedAt: new Date().toISOString(),
            source: 'business_card_scan'
        };

        // Extract other standard fields from details
        const phoneField = scannedFields.find(f => 
            f.label.toLowerCase().includes('phone') || f.label.toLowerCase().includes('tel')
        );
        const companyField = scannedFields.find(f => 
            f.label.toLowerCase().includes('company') || f.label.toLowerCase().includes('organization')
        );

        if (phoneField) contactData.phone = phoneField.value.trim();
        if (companyField) contactData.company = companyField.value.trim();

        return createContact(contactData);
    }

    // =============================================================================
    // CONTACT SHARING (Team Features)
    // =============================================================================

    /**
     * Share contacts with team members
     */
    export async function shareContactsWithTeam(contactIds, targetMembers = 'all') {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const token = await user.getIdToken(false);
        
        const response = await fetch('/api/user/contacts/share', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contactIds: contactIds,
                targetMembers: targetMembers
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to share contacts');
        }

        return response.json();
    }

    /**
     * Get team shared contacts

    export async function getTeamSharedContacts() {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        // Import the team sharing function dynamically to avoid circular dependencies
        const { getTeamSharedContacts: getSharedContacts } = await import('@/lib/teamContactSharing');
        return getSharedContacts(user.uid);
    }
    */
    /**
     * Check if contact sharing is enabled
     */
    export async function checkContactSharingEnabled() {
        try {
            const user = auth.currentUser;
            if (!user) {
                return false;
            }

            const token = await user.getIdToken(false);
            
            const response = await fetch('/api/user/contacts/share', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            return result.canShare || false;
        } catch (error) {
            console.error('Error checking contact sharing:', error);
            return false;
        }
    }

    /**
     * Get team members for sharing
     */
    export async function getTeamMembersForSharing() {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            const token = await user.getIdToken(false);
            
            const response = await fetch('/api/user/contacts/share', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get team members');
            }

            const result = await response.json();
            return result.teamMembers || [];
        } catch (error) {
            console.error('Error getting team members:', error);
            return [];
        }
    }

    // =============================================================================
    // CONTACT ANALYTICS AND STATISTICS
    // =============================================================================

    /**
     * Get contact statistics
     */
    export async function getContactStats() {
        try {
            const result = await getContacts({ limit: 1000 }); // Get all contacts for stats
            const contacts = result.contacts || [];
            
            const stats = {
                total: contacts.length,
                byStatus: {
                    new: contacts.filter(c => c.status === 'new').length,
                    viewed: contacts.filter(c => c.status === 'viewed').length,
                    archived: contacts.filter(c => c.status === 'archived').length
                },
                bySource: {},
                withLocation: contacts.filter(c => c.location && c.location.latitude).length,
                recentContacts: contacts
                    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                    .slice(0, 5),
                locationStats: result.locationStats || {
                    total: 0,
                    withLocation: 0,
                    withoutLocation: 0
                }
            };

            // Calculate sources
            contacts.forEach(contact => {
                const source = contact.source || 'manual';
                stats.bySource[source] = (stats.bySource[source] || 0) + 1;
            });

            return stats;
        } catch (error) {
            console.error('Error getting contact stats:', error);
            throw error;
        }
    }

    // =============================================================================
    // PUBLIC CONTACT SUBMISSION (for Exchange forms on public profiles)
    // =============================================================================

    /**
     * Submit contact to a profile owner (public API - no auth required)
     * Used by Exchange forms on public profiles
     */
    export async function submitContactToProfile(username, userId, contactData) {
        try {
            console.log('📤 Submitting contact to profile via server API...', {
                username,
                userId,
                hasLocation: !!(contactData.location)
            });

            const requestBody = {
                contact: contactData
            };

            // Use userId if available for fastest submission, otherwise username
            if (userId) {
                requestBody.userId = userId;
                console.log("⚡ Using direct user ID for ultra-fast submission:", userId);
            } else {
                requestBody.username = username;
                console.log("🔍 Using username lookup:", username);
            }

            const response = await fetch('/api/contacts/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Contact submitted successfully:', result);
            
            return result;
        } catch (error) {
            console.error('❌ Error submitting contact to profile:', error);
            throw error;
        }
    }

    /**
     * Check if a profile exists (for form validation)
     */
    export async function checkProfileExists(username, userId) {
        try {
            const params = new URLSearchParams();
            if (userId) {
                params.append('userId', userId);
            } else if (username) {
                params.append('username', username);
            } else {
                throw new Error('Either username or userId is required');
            }

            const response = await fetch(`/api/contacts/submit?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return { exists: false, error: 'Profile not found' };
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to check profile');
            }

            const result = await response.json();
            return {
                exists: true,
                profile: result.profile
            };
        } catch (error) {
            console.error('❌ Error checking profile existence:', error);
            return { exists: false, error: error.message };
        }
    }

    /**
     * Legacy function compatibility - redirect to new server-side API
     * This maintains compatibility with existing Exchange components
     */
    export async function addContactToProfile(profileUsername, contactData) {
        console.log('🔄 Legacy addContactToProfile called, redirecting to server API...');
        
        try {
            const result = await submitContactToProfile(profileUsername, null, contactData);
            return result.contactId;
        } catch (error) {
            console.error('❌ Legacy addContactToProfile error:', error);
            throw error;
        }
    }

    /**
     * Legacy function compatibility - redirect to new server-side API (with user ID)
     */
    export async function addContactToProfileByUserId(userId, contactData) {
        console.log('🔄 Legacy addContactToProfileByUserId called, redirecting to server API...');
        
        try {
            const result = await submitContactToProfile(null, userId, contactData);
            return result.contactId;
        } catch (error) {
            console.error('❌ Legacy addContactToProfileByUserId error:', error);
            throw error;
        }
    }

    // =============================================================================
    // ENHANCED CONTACT VALIDATION FOR PUBLIC FORMS
    // =============================================================================

    /**
     * Validate contact data for public submission
     */
    export function validatePublicContactData(contactData) {
        const errors = [];

        // Required fields
        if (!contactData.name || typeof contactData.name !== 'string' || contactData.name.trim().length === 0) {
            errors.push('Name is required');
        }

        if (!contactData.email || typeof contactData.email !== 'string' || contactData.email.trim().length === 0) {
            errors.push('Email is required');
        } else {
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactData.email.trim())) {
                errors.push('Invalid email format');
            }
        }

        // Optional field validation
        if (contactData.phone && contactData.phone.length > 0) {
            const phoneRegex = /^[\+]?[\d\s\-\(\)\.]{7,}$/;
            if (!phoneRegex.test(contactData.phone.trim())) {
                errors.push('Invalid phone format');
            }
        }

        // Length limits
        if (contactData.name && contactData.name.length > 100) {
            errors.push('Name must be less than 100 characters');
        }

        if (contactData.email && contactData.email.length > 100) {
            errors.push('Email must be less than 100 characters');
        }

        if (contactData.company && contactData.company.length > 100) {
            errors.push('Company name must be less than 100 characters');
        }

        if (contactData.message && contactData.message.length > 500) {
            errors.push('Message must be less than 500 characters');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Format contact data for public submission
     */
    export function formatContactForSubmission(rawContactData) {
        const sanitized = {
            name: rawContactData.name ? rawContactData.name.trim() : '',
            email: rawContactData.email ? rawContactData.email.trim().toLowerCase() : '',
            phone: rawContactData.phone ? rawContactData.phone.trim() : '',
            company: rawContactData.company ? rawContactData.company.trim() : '',
            message: rawContactData.message ? rawContactData.message.trim() : '',
            submittedAt: new Date().toISOString(),
            source: 'exchange_form'
        };

        // Handle location data
        if (rawContactData.location && typeof rawContactData.location === 'object') {
            if (typeof rawContactData.location.latitude === 'number' && 
                typeof rawContactData.location.longitude === 'number') {
                sanitized.location = {
                    latitude: rawContactData.location.latitude,
                    longitude: rawContactData.location.longitude,
                    accuracy: rawContactData.location.accuracy || null,
                    timestamp: rawContactData.location.timestamp || new Date().toISOString()
                };
            }
        }

        // Handle metadata
        if (rawContactData.userAgent) {
            sanitized.userAgent = rawContactData.userAgent.substring(0, 500);
        }
        if (rawContactData.referrer) {
            sanitized.referrer = rawContactData.referrer.substring(0, 500);
        }
        if (rawContactData.sessionId) {
            sanitized.sessionId = rawContactData.sessionId;
        }
        if (rawContactData.locationStatus) {
            sanitized.locationStatus = rawContactData.locationStatus;
        }

        return sanitized;
    }

    // =============================================================================
    // IMPORT/EXPORT FUNCTIONS
    // =============================================================================

    /**
     * Export contacts to various formats
     */
    export async function exportContacts(format = 'json') {
        try {
            const result = await getContacts({ limit: 1000 });
            const contacts = result.contacts || [];

            switch (format.toLowerCase()) {
                case 'json':
                    return {
                        format: 'json',
                        data: JSON.stringify(contacts, null, 2),
                        filename: `contacts_${new Date().toISOString().split('T')[0]}.json`
                    };
                
                case 'csv':
                    const csvHeaders = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Created'];
                    const csvRows = contacts.map(contact => [
                        contact.name || '',
                        contact.email || '',
                        contact.phone || '',
                        contact.company || '',
                        contact.status || '',
                        contact.submittedAt || ''
                    ]);
                    
                    const csvContent = [csvHeaders, ...csvRows]
                        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                        .join('\n');
                    
                    return {
                        format: 'csv',
                        data: csvContent,
                        filename: `contacts_${new Date().toISOString().split('T')[0]}.csv`
                    };
                
                case 'vcf':
                    const vcfContent = contacts.map(contact => {
                        let vcard = 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
                        if (contact.name) vcard += `FN:${contact.name}\r\n`;
                        if (contact.email) vcard += `EMAIL:${contact.email}\r\n`;
                        if (contact.phone) vcard += `TEL:${contact.phone}\r\n`;
                        if (contact.company) vcard += `ORG:${contact.company}\r\n`;
                        vcard += 'END:VCARD\r\n';
                        return vcard;
                    }).join('\r\n');
                    
                    return {
                        format: 'vcf',
                        data: vcfContent,
                        filename: `contacts_${new Date().toISOString().split('T')[0]}.vcf`
                    };
                
                default:
                    throw new Error('Unsupported export format');
            }
        } catch (error) {
            console.error('Error exporting contacts:', error);
            throw error;
        }
    }

    /**
     * Import contacts from various formats
     */
    export async function importContacts(data, format = 'json') {
        try {
            let contactsToImport = [];

            switch (format.toLowerCase()) {
                case 'json':
                    const jsonData = JSON.parse(data);
                    contactsToImport = Array.isArray(jsonData) ? jsonData : [jsonData];
                    break;
                
                case 'csv':
                    const lines = data.split('\n').filter(line => line.trim());
                    if (lines.length < 2) throw new Error('CSV must have headers and at least one data row');
                    
                    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
                    const nameIndex = headers.findIndex(h => h.includes('name'));
                    const emailIndex = headers.findIndex(h => h.includes('email'));
                    
                    if (nameIndex === -1 || emailIndex === -1) {
                        throw new Error('CSV must contain Name and Email columns');
                    }
                    
                    contactsToImport = lines.slice(1).map((line, index) => {
                        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
                        
                        return {
                            name: values[nameIndex] || `Contact ${index + 1}`,
                            email: values[emailIndex] || '',
                            phone: values[headers.findIndex(h => h.includes('phone'))] || '',
                            company: values[headers.findIndex(h => h.includes('company'))] || '',
                            status: 'new',
                            source: 'import_csv',
                            submittedAt: new Date().toISOString()
                        };
                    }).filter(contact => contact.email); // Only import contacts with email
                    break;
                
                default:
                    throw new Error('Unsupported import format');
            }

            // Validate and sanitize imported contacts
            const validContacts = contactsToImport
                .filter(contact => contact.name && contact.email)
                .map(contact => ({
                    ...contact,
                    id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: contact.name.trim(),
                    email: contact.email.trim().toLowerCase(),
                    phone: contact.phone ? contact.phone.trim() : '',
                    company: contact.company ? contact.company.trim() : '',
                    status: 'new',
                    source: contact.source || 'import',
                    submittedAt: contact.submittedAt || new Date().toISOString()
                }));

            if (validContacts.length === 0) {
                throw new Error('No valid contacts found in import data');
            }

            // Get existing contacts to check for duplicates
            const existingResult = await getContacts({ limit: 1000 });
            const existingContacts = existingResult.contacts || [];
            const existingEmails = new Set(existingContacts.map(c => c.email));

            // Filter out duplicates
            const newContacts = validContacts.filter(contact => !existingEmails.has(contact.email));
            
            if (newContacts.length === 0) {
                return {
                    success: true,
                    imported: 0,
                    duplicates: validContacts.length,
                    message: 'All contacts already exist'
                };
            }

            // Import new contacts in batches
            const batchSize = 50;
            let importedCount = 0;
            
            for (let i = 0; i < newContacts.length; i += batchSize) {
                const batch = newContacts.slice(i, i + batchSize);
                
                for (const contact of batch) {
                    try {
                        await createContact(contact);
                        importedCount++;
                    } catch (error) {
                        console.warn(`Failed to import contact ${contact.email}:`, error.message);
                    }
                }
            }

            return {
                success: true,
                imported: importedCount,
                duplicates: validContacts.length - newContacts.length,
                total: validContacts.length,
                message: `Successfully imported ${importedCount} contacts`
            };

        } catch (error) {
            console.error('Error importing contacts:', error);
            throw error;
        }
    }

    // =============================================================================
    // GEOLOCATION HELPERS FOR PUBLIC FORMS
    // =============================================================================

    /**
     * Request user's geolocation with enhanced error handling
     */
    export async function requestUserLocation(options = {}) {
        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };

        const finalOptions = { ...defaultOptions, ...options };

        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.warn("⚠️ Geolocation not supported");
                resolve({
                    success: false,
                    error: 'Geolocation not supported',
                    status: 'unavailable'
                });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date().toISOString()
                    };
                    
                    console.log("📍 Location obtained:", locationData);
                    resolve({
                        success: true,
                        location: locationData,
                        status: 'granted'
                    });
                },
                (error) => {
                    console.error("❌ Geolocation error:", error);
                    
                    let status = 'error';
                    let errorMessage = 'Failed to get location';
                    
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            status = 'denied';
                            errorMessage = 'Location permission denied';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            status = 'unavailable';
                            errorMessage = 'Location position unavailable';
                            break;
                        case error.TIMEOUT:
                            status = 'timeout';
                            errorMessage = 'Location request timeout';
                            break;
                    }
                    
                    resolve({
                        success: false,
                        error: errorMessage,
                        status: status
                    });
                },
                finalOptions
            );
        });
    }

    /**
     * Check geolocation permission status
     */
    export async function checkLocationPermission() {
        if (!navigator.permissions) {
            return { status: 'unavailable', message: 'Permissions API not supported' };
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return {
                status: result.state,
                message: `Geolocation permission is ${result.state}`
            };
        } catch (error) {
            console.warn("⚠️ Permission query failed:", error);
            return { status: 'unavailable', message: 'Failed to check permission' };
        }
    }

    // =============================================================================
    // SEARCH AND FILTERING
    // =============================================================================

    /**
     * Advanced contact search
     */
    export async function searchContacts(searchQuery, filters = {}) {
        try {
            const { status, hasLocation, source, dateRange } = filters;
            
            // Get all contacts first
            const result = await getContacts({ limit: 1000 });
            let contacts = result.contacts || [];

            // Apply search query
            if (searchQuery && searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                contacts = contacts.filter(contact => {
                    const searchableText = [
                        contact.name,
                        contact.email,
                        contact.phone,
                        contact.company,
                        contact.message,
                        ...(contact.details || []).map(d => `${d.label} ${d.value}`)
                    ].join(' ').toLowerCase();
                    
                    return searchableText.includes(query);
                });
            }

            // Apply filters
            if (status && status !== 'all') {
                contacts = contacts.filter(contact => contact.status === status);
            }

            if (hasLocation !== undefined) {
                contacts = contacts.filter(contact => {
                    const hasLoc = !!(contact.location && contact.location.latitude);
                    return hasLocation ? hasLoc : !hasLoc;
                });
            }

            if (source) {
                contacts = contacts.filter(contact => contact.source === source);
            }

            if (dateRange && dateRange.start && dateRange.end) {
                const startDate = new Date(dateRange.start);
                const endDate = new Date(dateRange.end);
                contacts = contacts.filter(contact => {
                    const contactDate = new Date(contact.submittedAt);
                    return contactDate >= startDate && contactDate <= endDate;
                });
            }

            return {
                success: true,
                contacts: contacts,
                count: contacts.length,
                query: searchQuery,
                filters: filters
            };

        } catch (error) {
            console.error('Error searching contacts:', error);
            throw error;
        }
    }

    // =============================================================================
    // RATE LIMITING HELPERS FOR CLIENT-SIDE
    // =============================================================================

    const clientRateLimits = new Map();

    /**
     * Simple client-side rate limiting
     */
    export function checkClientRateLimit(key, maxRequests = 5, windowMs = 60000) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!clientRateLimits.has(key)) {
            clientRateLimits.set(key, []);
        }
        
        const requests = clientRateLimits.get(key);
        
        // Remove old requests outside the window
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        
        if (validRequests.length >= maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: validRequests[0] + windowMs
            };
        }
        
        // Add current request
        validRequests.push(now);
        clientRateLimits.set(key, validRequests);
        
        return {
            allowed: true,
            remaining: maxRequests - validRequests.length,
            resetTime: now + windowMs
        };
    }

    // =============================================================================
    // ENHANCED ERROR HANDLING
    // =============================================================================

    /**
     * Enhanced error handler for contact submission
     */
    export function handleContactSubmissionError(error, context = {}) {
        console.error('❌ Contact submission error:', error, context);
        
        const errorMap = {
            'Profile not found': {
                userMessage: 'The profile you\'re trying to contact could not be found.',
                code: 'PROFILE_NOT_FOUND',
                severity: 'error'
            },
            'Invalid email format': {
                userMessage: 'Please enter a valid email address.',
                code: 'INVALID_EMAIL',
                severity: 'warning'
            },
            'Name is required': {
                userMessage: 'Please enter your name.',
                code: 'MISSING_NAME',
                severity: 'warning'
            },
            'Email is required': {
                userMessage: 'Please enter your email address.',
                code: 'MISSING_EMAIL',
                severity: 'warning'
            },
            'Too many': {
                userMessage: 'Too many requests. Please try again in a moment.',
                code: 'RATE_LIMITED',
                severity: 'warning'
            }
        };
        
        // Find matching error
        const errorKey = Object.keys(errorMap).find(key => 
            error.message && error.message.includes(key)
        );
        
        if (errorKey) {
            return {
                ...errorMap[errorKey],
                originalError: error.message,
                context
            };
        }
        
        // Default error
        return {
            userMessage: 'An unexpected error occurred. Please try again.',
            code: 'UNKNOWN_ERROR',
            severity: 'error',
            originalError: error.message,
            context
        };
    }

    // =============================================================================
    // ANALYTICS AND TRACKING
    // =============================================================================

    /**
     * Track contact submission events (client-side)
     */
    export function trackContactSubmission(eventData) {
        try {
            // Track with custom analytics (if available)
            if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('event', 'contact_submission', {
                    event_category: 'engagement',
                    event_label: eventData.source || 'exchange_form',
                    custom_parameter_profile_username: eventData.profileUsername,
                    custom_parameter_has_location: eventData.hasLocation || false,
                    custom_parameter_submission_method: eventData.submissionMethod || 'form'
                });
            }
            
            // Track with internal analytics
            console.log('📊 Contact submission tracked:', {
                timestamp: new Date().toISOString(),
                ...eventData
            });
            
        } catch (error) {
            console.warn('⚠️ Failed to track contact submission:', error);
            // Don't throw - analytics failures shouldn't break submission
        }
    }

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Validate contact data
     */
    export function validateContactData(contact) {
        const errors = [];

        if (!contact.name || contact.name.trim().length === 0) {
            errors.push('Name is required');
        }

        if (!contact.email || contact.email.trim().length === 0) {
            errors.push('Email is required');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact.email.trim())) {
                errors.push('Invalid email format');
            }
        }

        if (contact.phone && contact.phone.length > 0) {
            const phoneRegex = /^[\+]?[\d\s\-\(\)\.]{7,}$/;
            if (!phoneRegex.test(contact.phone.trim())) {
                errors.push('Invalid phone format');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Format contact for display
     */
    export function formatContactForDisplay(contact) {
        return {
            ...contact,
            displayName: contact.name || 'Unnamed Contact',
            displayEmail: contact.email || 'No email',
            displayPhone: contact.phone || 'No phone',
            displayCompany: contact.company || 'No company',
            isRecent: isRecentContact(contact.submittedAt),
            hasLocation: !!(contact.location && contact.location.latitude),
            statusColor: getStatusColor(contact.status),
            sourceIcon: getSourceIcon(contact.source)
        };
    }

    /**
     * Check if contact is recent (within last 7 days)
     */
    function isRecentContact(submittedAt) {
        if (!submittedAt) return false;
        
        const contactDate = new Date(submittedAt);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return contactDate > sevenDaysAgo;
    }

    /**
     * Get status color for UI
     */
    function getStatusColor(status) {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'viewed': return 'bg-green-100 text-green-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    /**
     * Get source icon for UI
     */
    function getSourceIcon(source) {
        switch (source) {
            case 'business_card_scan': return '📇';
            case 'manual': return '✏️';
            case 'import': return '📥';
            case 'import_csv': return '📊';
            case 'team_share': return '👥';
            default: return '📋';
        }
    }

    /**
     * Generate contact preview for sharing
     */
    export function generateContactPreview(contact) {
        return {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            company: contact.company,
            status: contact.status,
            hasLocation: !!(contact.location && contact.location.latitude),
            source: contact.source,
            submittedAt: contact.submittedAt
        };
    }

    /**
     * Generate session ID for contact submissions
     */
    export function generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get user agent information safely
     */
    export function getUserAgent() {
        if (typeof window === 'undefined') return '';
        return window.navigator.userAgent || '';
    }

    /**
     * Get referrer information safely
     */
    export function getReferrer() {
        if (typeof window === 'undefined') return '';
        return document.referrer || 'direct';
    }

    /**
     * Create contact metadata object
     */
    export function createContactMetadata() {
        return {
            userAgent: getUserAgent(),
            referrer: getReferrer(),
            sessionId: generateSessionId(),
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
            language: navigator.language || 'unknown'
        };
    }