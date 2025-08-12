// app/dashboard/(dashboard pages)/contacts/page.jsx - FIXED VERSION
"use client"
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import BusinessCardScanner from './components/BusinessCardScanner';
import ContactReviewModal from './components/ContactReviewModal';
import { ShareContactsModal } from './components/ShareContactsModal';
import ContactTestPanel from './components/ContactTestPanel';

// Import the enhanced server-side service
import {
    getContacts,
    createContact,
    updateContact,
    deleteContact,
    updateContactStatus,
    scanBusinessCard,
    createContactFromScan,
    checkContactSharingEnabled,
    getTeamMembersForSharing,
    shareContactsWithTeam,
    getContactStats,
    // Enhanced group management functions
    getContactGroups,
    createContactGroup,
    updateContactGroup,
    deleteContactGroup,
    // Legacy auto-groups function (we'll enhance this)
    generateAutoGroups
} from '@/lib/services/contactsService';

// Create a loading component for the map
function MapLoadingComponent() {
    const { t } = useTranslation();
    
    return (
        <div className="h-[300px] w-full rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                <span className="text-gray-500 text-xs">{t('contacts.loading_map')}</span>
            </div>
        </div>
    );
}

export default function EnhancedContactsPage() {
    const { t } = useTranslation();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);

    // Business Card Scanner States
    const [showScanner, setShowScanner] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [scannedFields, setScannedFields] = useState(null);

    // Team sharing states
    const [showShareModal, setShowShareModal] = useState(false);
    const [teamSharingEnabled, setTeamSharingEnabled] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    
    // Map and edit states
    const [showMap, setShowMap] = useState(false);
    const [selectedContactForMap, setSelectedContactForMap] = useState(null);
    const [editingContact, setEditingContact] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    
    // Group management states
    const [groups, setGroups] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [showGroupManager, setShowGroupManager] = useState(false);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [autoGroupsEnabled, setAutoGroupsEnabled] = useState(true);

    // Test panel state
    const [showTestPanel, setShowTestPanel] = useState(false);
    
    // Stats and pagination
    const [contactStats, setContactStats] = useState({
        total: 0,
        byStatus: { new: 0, viewed: 0, archived: 0 },
        locationStats: { total: 0, withLocation: 0, withoutLocation: 0 },
        groupStats: { total: 0, autoGroups: 0, customGroups: 0 }
    });
    const [pagination, setPagination] = useState({
        limit: 100,
        offset: 0,
        hasMore: false
    });

    // Enhanced filter contacts based on status, search term, and groups
    const filteredContacts = contacts.filter(contact => {
        const matchesFilter = filter === 'all' || contact.status === filter;
        const matchesSearch = !searchTerm || 
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Group filtering
        let matchesGroup = true;
        if (selectedGroupIds.length > 0) {
            matchesGroup = selectedGroupIds.some(groupId => {
                const group = groups.find(g => g.id === groupId);
                return group && group.contactIds.includes(contact.id);
            });
        }
        
        return matchesFilter && matchesSearch && matchesGroup;
    });

    // Load contact groups
    const loadGroups = async () => {
        try {
            setGroupsLoading(true);
            console.log('🔄 Loading contact groups...');
            
            const result = await getContactGroups();
            setGroups(result.groups || []);
            
            // Update group stats
            setContactStats(prev => ({
                ...prev,
                groupStats: {
                    total: result.groups?.length || 0,
                    autoGroups: result.groups?.filter(g => g.type === 'auto' || g.type === 'company').length || 0,
                    customGroups: result.groups?.filter(g => g.type === 'custom').length || 0
                }
            }));

            console.log('✅ Groups loaded:', result.groups?.length || 0);
        } catch (error) {
            console.error('❌ Error loading groups:', error);
            toast.error(t('contacts.failed_to_load_groups') || 'Failed to load groups');
        } finally {
            setGroupsLoading(false);
        }
    };

    // Generate automatic groups
    const generateAutomaticGroups = async () => {
        try {
            setGroupsLoading(true);
            toast.loading('Generating automatic groups...', { id: 'auto-groups' });
            
            const result = await generateAutoGroups();
            
            toast.dismiss('auto-groups');
            
            if (result.success) {
                toast.success(`Generated ${result.groupsCreated} automatic groups!`);
                await loadGroups(); // Reload groups
            } else {
                toast.error(result.error || 'Failed to generate groups');
            }
        } catch (error) {
            toast.dismiss('auto-groups');
            console.error('Error generating auto groups:', error);
            toast.error('Failed to generate automatic groups');
        } finally {
            setGroupsLoading(false);
        }
    };

    // Handle group creation from map
    const handleGroupCreation = async (groupData) => {
        try {
            console.log('📝 Creating new group:', groupData);
            
            const result = await createContactGroup(groupData);
            
            if (result.success) {
                toast.success(`Group "${groupData.name}" created successfully!`);
                await loadGroups(); // Reload groups
                return result.groupId;
            } else {
                throw new Error(result.error || 'Failed to create group');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            toast.error(error.message || 'Failed to create group');
            throw error;
        }
    };

    // Handle group toggle (show/hide on map)
    const handleGroupToggle = (groupId) => {
        setSelectedGroupIds(prev => {
            if (prev.includes(groupId)) {
                return prev.filter(id => id !== groupId);
            } else {
                return [...prev, groupId];
            }
        });
    };

    // Delete group
    const handleDeleteGroup = async (groupId) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        if (!confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteContactGroup(groupId);
            toast.success('Group deleted successfully');
            await loadGroups(); // Reload groups
            
            // Remove from selected groups if it was selected
            setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
        } catch (error) {
            console.error('Error deleting group:', error);
            toast.error('Failed to delete group');
        }
    };

    // Load contacts from server
    const loadContacts = async (options = {}) => {
        try {
            setLoading(true);
            console.log('🔄 Loading contacts from server...');
            
            const filters = {
                status: filter !== 'all' ? filter : undefined,
                search: searchTerm || undefined,
                limit: pagination.limit,
                offset: options.append ? pagination.offset : 0
            };

            const result = await getContacts(filters);
            
            if (options.append) {
                setContacts(prev => [...prev, ...result.contacts]);
            } else {
                setContacts(result.contacts);
            }
            
            setPagination(prev => ({
                ...prev,
                offset: options.append ? prev.offset + result.count : result.count,
                hasMore: result.pagination?.hasMore || false
            }));

            // Update stats
            setContactStats(prev => ({
                ...prev,
                total: result.totalCount,
                byStatus: {
                    new: result.contacts.filter(c => c.status === 'new').length,
                    viewed: result.contacts.filter(c => c.status === 'viewed').length,
                    archived: result.contacts.filter(c => c.status === 'archived').length
                },
                locationStats: result.locationStats
            }));

            console.log('✅ Contacts loaded:', {
                count: result.count,
                total: result.totalCount,
                withLocation: result.locationStats.withLocation
            });

        } catch (error) {
            console.error('❌ Error loading contacts:', error);
            toast.error(t('contacts.failed_to_load') || 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    };

    // Check team sharing permissions
    const checkSharingPermissions = async () => {
        try {
            const enabled = await checkContactSharingEnabled();
            setTeamSharingEnabled(enabled);
        } catch (error) {
            console.error('Error checking sharing permissions:', error);
            setTeamSharingEnabled(false);
        }
    };

    // Handle test contacts generation
    const handleContactsGenerated = async (result) => {
        // Refresh contacts and groups after generation
        await Promise.all([
            loadContacts(),
            loadGroups()
        ]);
        
        // Trigger auto-grouping if enabled
        if (autoGroupsEnabled && result.data.generated > 10) {
            setTimeout(() => {
                generateAutomaticGroups();
            }, 2000);
        }
        
        toast.success(
            `✅ Generated ${result.data.generated} test contacts!\n` +
            `📊 ${result.data.insights.contactsFromEvents} from events, ` +
            `📍 ${result.data.insights.contactsWithLocation} with location`,
            { duration: 5000 }
        );
    };

    // Enhanced initialization with groups
    useEffect(() => {
        const initializeData = async () => {
            await Promise.all([
                loadContacts(),
                loadGroups(),
                checkSharingPermissions()
            ]);
        };
        
        initializeData();
    }, []);

    // Reload when filter or search changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadContacts();
        }, 300); // Debounce search

        return () => clearTimeout(timeoutId);
    }, [filter, searchTerm]);

    // Save scanned contact to server
    const saveScannedContact = async (fields) => {
        try {
            console.log('💾 Saving scanned contact to server...');
            
            const result = await createContactFromScan(fields);
            
            toast.success(t('contacts.contact_created') || 'Contact created successfully!');
            
            // Reload contacts to show the new one
            await loadContacts();
            
            // Check for auto-grouping opportunities
            if (autoGroupsEnabled) {
                setTimeout(() => {
                    generateAutomaticGroups();
                }, 1000);
            }
            
            setShowReviewModal(false);
            setScannedFields(null);
            
        } catch (error) {
            console.error('Error saving scanned contact:', error);
            toast.error(t('contacts.failed_to_save') || 'Failed to save contact');
            throw error;
        }
    };

    const handleBusinessCardScan = async (imageBase64) => {
        try {
            console.log('📷 Processing business card...');
            toast.loading(t('business_card_scanner.scanning_card') || 'Scanning business card...', { id: 'scanning-toast' });
            
            const result = await scanBusinessCard(imageBase64);
            
            toast.dismiss('scanning-toast');
            
            if (result.success) {
                setScannedFields(result.parsedFields);
                setShowReviewModal(true);
                setShowScanner(false);
                toast.success(t('business_card_scanner.scan_complete') || 'Scan complete!');
            } else {
                toast.error(result.error || t('business_card_scanner.scan_failed') || 'Scan failed');
            }
        } catch (error) {
            toast.dismiss('scanning-toast');
            console.error('Business card scan error:', error);
            toast.error(t('business_card_scanner.processing_failed') || 'Processing failed');
        }
    };

    // Contact actions
    const handleContactAction = (action, contact) => {
        switch (action) {
            case 'email':
                window.open(`mailto:${contact.email}`, '_blank');
                break;
            case 'phone':
                if (contact.phone) {
                    window.open(`tel:${contact.phone}`, '_blank');
                }
                break;
            default:
                break;
        }
    };

    const handleEditContact = (contact) => {
        setEditingContact(contact);
        setShowEditModal(true);
    };

    const handleSaveEditedContact = async (updatedContact) => {
        try {
            await updateContact(updatedContact);
            toast.success(t('contacts.contact_updated') || 'Contact updated successfully');
            
            // Update the contact in the list
            setContacts(prevContacts => 
                prevContacts.map(contact => 
                    contact.id === updatedContact.id ? updatedContact : contact
                )
            );
            
            setShowEditModal(false);
            setEditingContact(null);

            // Check for auto-grouping opportunities after edit
            if (autoGroupsEnabled) {
                setTimeout(() => {
                    generateAutomaticGroups();
                }, 1000);
            }
        } catch (error) {
            console.error('Error updating contact:', error);
            toast.error(t('contacts.failed_to_update') || 'Failed to update contact');
            throw error;
        }
    };

    const handleStatusUpdate = async (contactId, newStatus) => {
        try {
            await updateContactStatus(contactId, newStatus);
            
            // Update the contact in the list
            setContacts(prevContacts => 
                prevContacts.map(contact => 
                    contact.id === contactId 
                        ? { ...contact, status: newStatus, lastModified: new Date().toISOString() }
                        : contact
                )
            );
            
            toast.success(t('contacts.status_updated') || 'Status updated');
        } catch (error) {
            console.error('Error updating contact status:', error);
            toast.error(t('contacts.failed_to_update_status') || 'Failed to update status');
        }
    };

    const handleDeleteContact = async (contactId) => {
        if (!confirm(t('contacts.confirm_delete') || 'Are you sure you want to delete this contact?')) {
            return;
        }

        try {
            await deleteContact(contactId);
            
            // Remove the contact from the list
            setContacts(prevContacts => 
                prevContacts.filter(contact => contact.id !== contactId)
            );
            
            toast.success(t('contacts.contact_deleted') || 'Contact deleted');

            // Update groups after contact deletion
            await loadGroups();
        } catch (error) {
            console.error('Error deleting contact:', error);
            toast.error(t('contacts.failed_to_delete') || 'Failed to delete contact');
        }
    };

    // Selection mode functions
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedContacts([]);
    };

    const toggleContactSelection = (contactId) => {
        setSelectedContacts(prev => 
            prev.includes(contactId) 
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    const selectAllContacts = () => {
        const selectableContacts = filteredContacts.filter(contact => !contact.isSharedContact);
        setSelectedContacts(selectableContacts.map(contact => contact.id));
    };

    const clearSelection = () => {
        setSelectedContacts([]);
    };

    const handleShareSelected = () => {
        if (selectedContacts.length === 0) {
            toast.error(t('contacts.select_contacts_to_share') || 'Please select contacts to share');
            return;
        }
        setShowShareModal(true);
    };

    // Map functions
    const openContactMap = (contact = null) => {
        setSelectedContactForMap(contact);
        setShowMap(true);
    };

    const closeMap = () => {
        setShowMap(false);
        setSelectedContactForMap(null);
    };

    // Load more contacts (pagination)
    const loadMoreContacts = () => {
        if (!loading && pagination.hasMore) {
            loadContacts({ append: true });
        }
    };

    // Get enhanced counts including groups
    const counts = {
        all: contactStats.total,
        new: contactStats.byStatus.new,
        viewed: contactStats.byStatus.viewed,
        archived: contactStats.byStatus.archived,
        groups: contactStats.groupStats.total,
        withLocation: contactStats.locationStats.withLocation
    };

    if (loading && contacts.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 min-h-[400px]">
                <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <span className="text-sm text-gray-600">
                        {t('contacts.loading') || 'Loading contacts...'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pb-20">
            {/* Edit Contact Modal */}

               {showTestPanel && (
                <div className="p-3 sm:p-4 pb-0">
                    <ContactTestPanel 
                        onContactsGenerated={handleContactsGenerated}
                        className="mb-4 shadow-lg border-2 border-orange-200"
                    />
                </div>
            )}
            <EditContactModal
                contact={editingContact}
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingContact(null);
                }}
                onSave={handleSaveEditedContact}
            />
            
         

            {/* Group Manager Modal */}
            <GroupManagerModal
                isOpen={showGroupManager}
                onClose={() => setShowGroupManager(false)}
                groups={groups}
                contacts={contacts}
                onCreateGroup={handleGroupCreation}
                onDeleteGroup={handleDeleteGroup}
                onGenerateAutoGroups={generateAutomaticGroups}
                loading={groupsLoading}
            />

            {/* Enhanced Map Modal */}
            {showMap && (
                <div className="fixed inset-0 bg-white z-[9999] flex flex-col md:bg-black md:bg-opacity-50 md:items-center md:justify-center md:p-2">
                    <div className="bg-white w-full h-full rounded-xl md:shadow-xl md:max-w-[98vw] md:max-h-[90vh] flex flex-col mt-14 md:mt-20">
                        <div className="flex items-center justify-between p-4 border-b flex-shrink-0 bg-white">
                            <h2 className="text-lg font-semibold">
                                {selectedContactForMap 
                                    ? t('contacts.location_for_contact', { name: selectedContactForMap.name })
                                    : t('contacts.all_contact_locations')
                                }
                            </h2>
                            <button
                                onClick={closeMap}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 p-2 md:p-4 min-h-0">
                            <ContactsMap
                                contacts={selectedContactForMap ? [selectedContactForMap] : contacts.filter(c => c.location?.latitude)}
                                selectedContact={selectedContactForMap}
                                groups={groups}
                                selectedGroupIds={selectedGroupIds}
                                onGroupToggle={handleGroupToggle}
                                onCreateGroup={handleGroupCreation}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="p-3 sm:p-4">
                {/* Enhanced Header */}
                <ContactsHeader
                    teamSharingEnabled={teamSharingEnabled}
                    selectionMode={selectionMode}
                    selectedContacts={selectedContacts}
                    onToggleSelectionMode={toggleSelectionMode}
                    onSelectAll={selectAllContacts}
                    onClearSelection={clearSelection}
                    onShareSelected={handleShareSelected}
                    onScanCard={() => setShowScanner(true)}
                    onOpenGroupManager={() => setShowGroupManager(true)}
                    groupsCount={groups.length}
                    autoGroupsEnabled={autoGroupsEnabled}
                    onGenerateAutoGroups={generateAutomaticGroups}
                    groupsLoading={groupsLoading}
                    showTestPanel={showTestPanel}
                    onToggleTestPanel={() => setShowTestPanel(!showTestPanel)}
                />

                {/* Enhanced Filters */}
                <MobileFilters
                    filter={filter}
                    setFilter={setFilter}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    counts={counts}
                    locationStats={contactStats.locationStats}
                    onMapView={openContactMap}
                    groups={groups}
                    selectedGroupIds={selectedGroupIds}
                    onGroupToggle={handleGroupToggle}
                />

                {/* Contacts List */}
                <ContactsList
                    contacts={filteredContacts}
                    selectionMode={selectionMode}
                    selectedContacts={selectedContacts}
                    onToggleSelection={toggleContactSelection}
                    onEdit={handleEditContact}
                    onStatusUpdate={handleStatusUpdate}
                    onDelete={handleDeleteContact}
                    onContactAction={handleContactAction}
                    onMapView={openContactMap}
                    hasMore={pagination.hasMore}
                    onLoadMore={loadMoreContacts}
                    loading={loading}
                    groups={groups}
                />
            </div>
            
            {/* Modals */}
            <ShareContactsModal
                isOpen={showShareModal}
                onClose={() => {
                    setShowShareModal(false);
                    setSelectionMode(false);
                    setSelectedContacts([]);
                }}
                contacts={contacts}
                selectedContactIds={selectedContacts}
                onShare={shareContactsWithTeam}
                onGetTeamMembers={getTeamMembersForSharing}
            />
            
            <BusinessCardScanner
                isOpen={showScanner}
                onClose={() => setShowScanner(false)}
                onContactParsed={(parsedFields) => {
                    setScannedFields(parsedFields);
                    setShowReviewModal(true);
                    setShowScanner(false);
                    toast.success(t('business_card_scanner.scan_complete') || 'Scan complete!');
                }}
            />
            
            <ContactReviewModal
                isOpen={showReviewModal}
                onClose={() => {
                    setShowReviewModal(false);
                    setScannedFields(null);
                }}
                parsedFields={scannedFields}
                onSave={saveScannedContact}
            />
        </div>
    );
}

// Dynamic import for map component
const ContactsMap = dynamic(() => import('./components/ContactsMap'), {
    ssr: false,
    loading: () => <MapLoadingComponent />
});

// Enhanced Header component with group management
function ContactsHeader({ 
    teamSharingEnabled, 
    selectionMode, 
    selectedContacts, 
    onToggleSelectionMode, 
    onSelectAll, 
    onClearSelection, 
    onShareSelected, 
    onScanCard,
    onOpenGroupManager,
    groupsCount,
    autoGroupsEnabled,
    onGenerateAutoGroups,
    groupsLoading,
    showTestPanel,
    onToggleTestPanel
}) {
    const { t } = useTranslation();

    return (
        <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 truncate">
                        {t('contacts.title') || 'Contacts'}
                    </h1>
                    <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">
                        {t('contacts.subtitle') || 'Manage your contact list'}
                        {groupsCount > 0 && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                                {groupsCount} group{groupsCount !== 1 ? 's' : ''}
                            </span>
                        )}
                    </p>
                </div>
                
                <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {/* Test Panel button */}
                        <button
                            onClick={onToggleTestPanel}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                                showTestPanel 
                                    ? 'bg-orange-100 border border-orange-300 text-orange-800 hover:bg-orange-150' 
                                    : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                        >
                            <span>🧪</span>
                            <span className="hidden xs:inline">
                                {showTestPanel ? 'Hide Test Panel' : 'Test Panel'}
                            </span>
                            <span className="xs:hidden">Test</span>
                        </button>

                        {/* Group Manager button */}
                        <button
                            onClick={onOpenGroupManager}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="hidden xs:inline">Groups</span>
                            {groupsCount > 0 && (
                                <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                    {groupsCount}
                                </span>
                            )}
                        </button>

                        {/* Auto Groups button */}
                        {autoGroupsEnabled && (
                            <button
                                onClick={onGenerateAutoGroups}
                                disabled={groupsLoading}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0"
                            >
                                {groupsLoading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                )}
                                <span className="hidden xs:inline">🤖 Auto</span>
                                <span className="xs:hidden">🤖</span>
                            </button>
                        )}
                        
                        {/* Scan card button */}
                        <button
                            onClick={onScanCard}
                            className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            </svg>
                            <span className="hidden xs:inline">📇 {t('business_card_scanner.scan') || 'Scan'}</span>
                            <span className="xs:hidden">📇</span>
                        </button>
                        
                        {/* Team sharing controls */}
                        {teamSharingEnabled && (
                            <>
                                {!selectionMode ? (
                                    <button
                                        onClick={onToggleSelectionMode}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                        </svg>
                                        <span className="hidden sm:inline">{t('contacts.share_with_team') || 'Share with Team'}</span>
                                        <span className="sm:hidden">{t('contacts.share') || 'Share'}</span>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-gray-600 whitespace-nowrap">
                                            {selectedContacts.length} {t('contacts.selected') || 'selected'}
                                        </span>
                                        <button
                                            onClick={onSelectAll}
                                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors whitespace-nowrap"
                                        >
                                            {t('contacts.all') || 'All'}
                                        </button>
                                        <button
                                            onClick={onClearSelection}
                                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors whitespace-nowrap"
                                        >
                                            {t('contacts.clear') || 'Clear'}
                                        </button>
                                        <button
                                            onClick={onShareSelected}
                                            disabled={selectedContacts.length === 0}
                                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex-shrink-0"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                            </svg>
                                            <span>({selectedContacts.length})</span>
                                        </button>
                                        <button
                                            onClick={onToggleSelectionMode}
                                            className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Enhanced Mobile filters with group support
function MobileFilters({ 
    filter, 
    setFilter, 
    searchTerm, 
    setSearchTerm, 
    counts, 
    locationStats, 
    onMapView,
    groups,
    selectedGroupIds,
    onGroupToggle
}) {
    const { t } = useTranslation();
    const [showFilters, setShowFilters] = useState(false);
    const [showGroups, setShowGroups] = useState(false);

    const activeGroupsCount = selectedGroupIds.length;
    const totalContactsInGroups = selectedGroupIds.reduce((total, groupId) => {
        const group = groups.find(g => g.id === groupId);
        return total + (group ? group.contactIds.length : 0);
    }, 0);

    return (
        <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4 mb-4">
            {/* Search bar */}
            <div className="relative mb-3">
                <input
                    type="text"
                    placeholder={t('contacts.search_placeholder') || 'Search contacts...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
                <svg className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            {/* Filter, Groups and Map buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                    </svg>
                    <span className="truncate">Filter ({counts[filter]})</span>
                    <svg className={`w-4 h-4 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Groups button */}
                {groups.length > 0 && (
                    <button
                        onClick={() => setShowGroups(!showGroups)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            activeGroupsCount > 0
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="truncate">
                            {activeGroupsCount > 0 ? `${activeGroupsCount} Groups` : `Groups (${groups.length})`}
                        </span>
                        <svg className={`w-4 h-4 transform transition-transform ${showGroups ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}

                {/* Map button */}
                <button
                    onClick={() => onMapView()}
                    disabled={locationStats.withLocation === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    title={locationStats.withLocation === 0 ? t('contacts.no_location_data') : t('contacts.view_all_locations')}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">Map ({locationStats.withLocation})</span>
                </button>
            </div>         

            {/* Filter options */}
            {showFilters && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                        { id: 'all', label: t('contacts.filter_all') || 'All', count: counts.all },
                        { id: 'new', label: t('contacts.filter_new') || 'New', count: counts.new },
                        { id: 'viewed', label: t('contacts.filter_viewed') || 'Viewed', count: counts.viewed },
                        { id: 'archived', label: t('contacts.filter_archived') || 'Archived', count: counts.archived }
                    ].map((filterOption) => (
                        <button
                            key={filterOption.id}
                            onClick={() => {
                                setFilter(filterOption.id);
                                setShowFilters(false);
                            }}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                filter === filterOption.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <span className="truncate">{filterOption.label} ({filterOption.count})</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Groups options */}
            {showGroups && groups.length > 0 && (
                <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Select Groups to View</span>
                        {activeGroupsCount > 0 && (
                            <button
                                onClick={() => setSelectedGroupIds([])}
                                className="text-xs text-purple-600 hover:text-purple-800"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {groups.map(group => (
                            <button
                                key={group.id}
                                onClick={() => onGroupToggle && onGroupToggle(group.id)}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                                    selectedGroupIds.includes(group.id)
                                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div 
                                        className="w-3 h-3 rounded-full border-2 border-white shadow flex-shrink-0"
                                        style={{ backgroundColor: getGroupColor(group.id, groups) }}
                                    />
                                    <span className="truncate">{group.name}</span>
                                    {group.type === 'auto' && <span className="text-xs">🤖</span>}
                                    {group.type === 'event' && <span className="text-xs">📅</span>}
                                </div>
                                <span className="font-medium flex-shrink-0 ml-2">
                                    {group.contactIds.length}
                                </span>
                            </button>
                        ))}
                    </div>
                    {activeGroupsCount > 0 && (
                        <div className="text-xs text-gray-600 pt-2 border-t">
                            Showing {totalContactsInGroups} contacts from {activeGroupsCount} group{activeGroupsCount !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Helper function to get group colors consistently
function getGroupColor(groupId, groups) {
    const colors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
    ];
    const index = groups.findIndex(g => g.id === groupId);
    return colors[index % colors.length] || '#6B7280';
}

// Enhanced Contacts list with group indicators
function ContactsList({ 
    contacts, 
    selectionMode, 
    selectedContacts, 
    onToggleSelection, 
    onEdit, 
    onStatusUpdate, 
    onDelete, 
    onContactAction, 
    onMapView,
    hasMore,
    onLoadMore,
    loading,
    groups = []
}) {
    const { t } = useTranslation();

    if (contacts.length === 0) {
        return (
            <div className="p-6 sm:p-8 text-center bg-white rounded-lg border">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                    {t('contacts.no_contacts_found') || 'No contacts found'}
                </h3>
                <p className="text-gray-500 text-sm">
                    {t('contacts.try_adjusting_filters') || 'Try adjusting your filters or add your first contact'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {contacts.map((contact) => (
                <div key={contact.id} className={`relative ${selectionMode && !contact.isSharedContact ? 'pl-10 sm:pl-12' : ''}`}>
                    {/* Selection checkbox */}
                    {selectionMode && !contact.isSharedContact && (
                        <div className="absolute left-2 sm:left-3 top-4 z-10">
                            <input
                                type="checkbox"
                                checked={selectedContacts.includes(contact.id)}
                                onChange={() => onToggleSelection(contact.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                    )}
                    
                    <ContactCard
                        contact={contact}
                        onEdit={onEdit}
                        onStatusUpdate={onStatusUpdate}
                        onDelete={onDelete}
                        onContactAction={onContactAction}
                        onMapView={onMapView}
                        groups={groups}
                    />
                </div>
            ))}

            {/* Load more button */}
            {hasMore && (
                <div className="flex justify-center py-4">
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        {loading ? (t('contacts.loading') || 'Loading...') : (t('contacts.load_more') || 'Load More')}
                    </button>
                </div>
            )}
        </div>
    );
}

// Enhanced Contact card with group indicators
function ContactCard({ contact, onEdit, onStatusUpdate, onDelete, onContactAction, onMapView, groups = [] }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    // Find groups this contact belongs to
    const contactGroups = groups.filter(group => 
        group.contactIds && group.contactIds.includes(contact.id)
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'viewed': return 'bg-green-100 text-green-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    const isDynamicContact = Array.isArray(contact.details);
    const headerName = contact.name || 'No Name';
    const headerEmail = contact.email || 'No Email';

    const displayDetails = isDynamicContact
        ? contact.details.filter(d => 
              !d.label.toLowerCase().includes('name') && 
              !d.label.toLowerCase().includes('email')
          )
        : [
              contact.phone && { label: t('contacts.phone') || 'Phone', value: contact.phone },
              contact.company && { label: t('contacts.company') || 'Company', value: contact.company },
          ].filter(Boolean);

    const isFromTeamMember = contact.sharedBy || contact.teamMemberSource;

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-3">
            {/* Header */}
            <div className="p-3 sm:p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                            isFromTeamMember ? 'bg-gradient-to-br from-purple-400 to-blue-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'
                        }`}>
                            {headerName.charAt(0).toUpperCase()}
                        </div>
                        {/* Group indicator */}
                        {contactGroups.length > 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 border-2 border-white rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{contactGroups.length}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{headerName}</h3>
                                <p className="text-xs text-gray-500 truncate">{headerEmail}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                                        {t(`contacts.status_${contact.status}`) || contact.status}
                                    </span>
                                    {contact.location && <span className="text-xs text-green-600">📍</span>}
                                    {isFromTeamMember && <span className="text-xs text-purple-600">👥</span>}
                                    {/* Group badges */}
                                    {contactGroups.slice(0, 2).map((group, index) => (
                                        <span 
                                            key={group.id}
                                            className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800"
                                            title={group.description || group.name}
                                        >
                                            {group.type === 'auto' && '🤖'}
                                            {group.type === 'event' && '📅'}
                                            {group.type === 'company' && '🏢'}
                                            {group.type === 'custom' && '👥'}
                                            <span className="ml-1 truncate max-w-16">{group.name}</span>
                                        </span>
                                    ))}
                                    {contactGroups.length > 2 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                            +{contactGroups.length - 2} more
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="ml-2">
                                <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t border-gray-100">
                    <div className="p-3 sm:p-4 space-y-3">
                        {/* Group information */}
                        {contactGroups.length > 0 && (
                            <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span className="text-sm font-medium text-purple-900">
                                        Member of {contactGroups.length} group{contactGroups.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {contactGroups.map((group) => (
                                        <div key={group.id} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded-full border border-white"
                                                    style={{ backgroundColor: getGroupColor(group.id, groups) }}
                                                />
                                                <span className="text-purple-800 font-medium">{group.name}</span>
                                                {group.type === 'auto' && <span title="Auto-generated">🤖</span>}
                                                {group.type === 'event' && <span title="Event-based">📅</span>}
                                                {group.type === 'company' && <span title="Company group">🏢</span>}
                                            </div>
                                            <span className="text-purple-600">
                                                {group.contactIds.length} contact{group.contactIds.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dynamic details */}
                        {displayDetails.map((detail, index) => (
                            <div key={index} className="flex items-center gap-2 sm:gap-3 text-sm">
                                <FieldIcon label={detail.label} />
                                <div className="font-medium text-gray-500 text-xs w-16 sm:w-24 truncate" title={detail.label}>
                                    {detail.label}
                                </div>
                                <div className="text-gray-700 flex-1 min-w-0 truncate text-xs sm:text-sm" title={detail.value}>
                                    {detail.value}
                                </div>
                            </div>
                        ))}
                        
                        {/* Message field for non-dynamic contacts */}
                        {!isDynamicContact && contact.message && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-700 italic">"{contact.message}"</p>
                            </div>
                        )}

                        {/* Date and source info */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100 mt-3">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{t('contacts.added') || 'Added'} {formatDate(contact.submittedAt)}</span>
                            {contact.source && (
                                <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
                                    {contact.source}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="p-3 sm:p-4 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {/* Edit button */}
                            {(!isFromTeamMember || contact.canEdit) && (
                                <button
                                    onClick={() => onEdit(contact)}
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    {t('contacts.edit') || 'Edit'}
                                </button>
                            )}

                            {/* Status buttons */}
                            {contact.status === 'new' && (
                                <button
                                    onClick={() => onStatusUpdate(contact.id, 'viewed')}
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.mark_as_viewed') || 'Mark as Viewed'}</span>
                                    <span className="sm:hidden">{t('contacts.viewed') || 'Viewed'}</span>
                                </button>
                            )}
                            
                            {contact.status !== 'archived' && (
                                <button
                                    onClick={() => onStatusUpdate(contact.id, 'archived')}
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 6-6m-3 10l4-4 6 6-6 6-4-4" />
                                    </svg>
                                    {t('contacts.archive') || 'Archive'}
                                </button>
                            )}
                            
                            {contact.status === 'archived' && (
                                <button
                                    onClick={() => onStatusUpdate(contact.id, 'viewed')}
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    {t('contacts.restore') || 'Restore'}
                                </button>
                            )}

                            {/* Delete button */}
                            {(!isFromTeamMember || contact.canEdit) && (
                                <button
                                    onClick={() => onDelete(contact.id)}
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors col-span-2"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    {t('contacts.delete') || 'Delete'}
                                </button>
                            )}
                        </div>

                        {/* Communication buttons */}
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            <button
                                onClick={() => onContactAction('email', contact)}
                                className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="hidden sm:inline">{t('contacts.email') || 'Email'}</span>
                                <span className="sm:hidden">✉️</span>
                            </button>
                            
                            {contact.phone && (
                                <button
                                    onClick={() => onContactAction('phone', contact)}
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.call') || 'Call'}</span>
                                    <span className="sm:hidden">📞</span>
                                </button>
                            )}
                            
                            {contact.location?.latitude && (
                                <button
                                    onClick={() => onMapView(contact)}
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.map_button') || 'Map'}</span>
                                    <span className="sm:hidden">📍</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Group Manager Modal Component
function GroupManagerModal({ isOpen, onClose, groups, contacts, onCreateGroup, onDeleteGroup, onGenerateAutoGroups, loading }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('overview');
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState('custom');
    const [selectedContacts, setSelectedContacts] = useState([]);

    const groupStats = {
        total: groups.length,
        custom: groups.filter(g => g.type === 'custom').length,
        auto: groups.filter(g => g.type === 'auto' || g.type === 'company').length,
        event: groups.filter(g => g.type === 'event').length
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim() || selectedContacts.length === 0) return;

        try {
            await onCreateGroup({
                name: newGroupName.trim(),
                type: newGroupType,
                contactIds: selectedContacts,
                description: `${newGroupType === 'custom' ? 'Custom' : 'Auto-generated'} group with ${selectedContacts.length} contacts`
            });
            
            // Reset form
            setNewGroupName('');
            setNewGroupType('custom');
            setSelectedContacts([]);
            setActiveTab('overview');
        } catch (error) {
            // Error handling is done in parent component
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">📊 Group Manager</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 text-sm font-medium ${
                            activeTab === 'overview'
                                ? 'border-b-2 border-purple-500 text-purple-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        📈 Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`px-4 py-2 text-sm font-medium ${
                            activeTab === 'groups'
                                ? 'border-b-2 border-purple-500 text-purple-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        👥 Groups ({groups.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-2 text-sm font-medium ${
                            activeTab === 'create'
                                ? 'border-b-2 border-purple-500 text-purple-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        ➕ Create Group
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Statistics */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                    <div className="text-2xl font-bold text-blue-600">{groupStats.total}</div>
                                    <div className="text-sm text-blue-800">Total Groups</div>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                    <div className="text-2xl font-bold text-purple-600">{groupStats.custom}</div>
                                    <div className="text-sm text-purple-800">Custom Groups</div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <div className="text-2xl font-bold text-green-600">{groupStats.auto}</div>
                                    <div className="text-sm text-green-800">Auto Groups</div>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                    <div className="text-2xl font-bold text-orange-600">{groupStats.event}</div>
                                    <div className="text-sm text-orange-800">Event Groups</div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={onGenerateAutoGroups}
                                        disabled={loading}
                                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                                        ) : (
                                            <span className="text-lg">🤖</span>
                                        )}
                                        <div className="text-left">
                                            <div className="font-medium text-gray-900">Generate Auto Groups</div>
                                            <div className="text-sm text-gray-600">Group contacts by company, location, etc.</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('create')}
                                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                                    >
                                        <span className="text-lg">➕</span>
                                        <div className="text-left">
                                            <div className="font-medium text-gray-900">Create Custom Group</div>
                                            <div className="text-sm text-gray-600">Manually select contacts for grouping</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Recent Groups */}
                            {groups.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Recent Groups</h4>
                                    <div className="space-y-2">
                                        {groups.slice(0, 5).map(group => (
                                            <div key={group.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div 
                                                        className="w-4 h-4 rounded-full border-2 border-white shadow"
                                                        style={{ backgroundColor: getGroupColor(group.id, groups) }}
                                                    />
                                                    <div>
                                                        <div className="font-medium text-gray-900">{group.name}</div>
                                                        <div className="text-sm text-gray-600">
                                                            {group.contactIds.length} contact{group.contactIds.length !== 1 ? 's' : ''} • 
                                                            {group.type === 'auto' && ' 🤖 Auto-generated'}
                                                            {group.type === 'custom' && ' 👥 Custom'}
                                                            {group.type === 'event' && ' 📅 Event-based'}
                                                            {group.type === 'company' && ' 🏢 Company'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onDeleteGroup(group.id)}
                                                    className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Groups Tab */}
                    {activeTab === 'groups' && (
                        <div className="space-y-4">
                            {groups.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Yet</h3>
                                    <p className="text-gray-500 mb-4">Create your first group to organize your contacts</p>
                                    <button
                                        onClick={() => setActiveTab('create')}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                    >
                                        Create First Group
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {groups.map(group => (
                                        <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div 
                                                        className="w-6 h-6 rounded-full border-2 border-white shadow flex-shrink-0"
                                                        style={{ backgroundColor: getGroupColor(group.id, groups) }}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-medium text-gray-900">{group.name}</h4>
                                                        <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            <span>{group.contactIds.length} contact{group.contactIds.length !== 1 ? 's' : ''}</span>
                                                            <span>
                                                                {group.type === 'auto' && '🤖 Auto-generated'}
                                                                {group.type === 'custom' && '👥 Custom'}
                                                                {group.type === 'event' && '📅 Event-based'}
                                                                {group.type === 'company' && '🏢 Company'}
                                                            </span>
                                                            {group.createdAt && (
                                                                <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onDeleteGroup(group.id)}
                                                    className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 flex-shrink-0"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                            
                                            {/* Group members preview */}
                                            {group.contactIds.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {group.contactIds.slice(0, 5).map(contactId => {
                                                            const contact = contacts.find(c => c.id === contactId);
                                                            if (!contact) return null;
                                                            return (
                                                                <div key={contactId} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">
                                                                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                                                        {contact.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <span className="text-xs text-gray-700">{contact.name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                        {group.contactIds.length > 5 && (
                                                            <span className="text-xs text-gray-500">
                                                                +{group.contactIds.length - 5} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Create Group Tab */}
                    {activeTab === 'create' && (
                        <form onSubmit={handleCreateGroup} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Group Name *
                                </label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="Enter group name..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Group Type
                                </label>
                                <select
                                    value={newGroupType}
                                    onChange={(e) => setNewGroupType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    <option value="custom">👥 Custom Group</option>
                                    <option value="company">🏢 Company/Organization</option>
                                    <option value="event">📅 Event-based</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Contacts ({selectedContacts.length} selected)
                                </label>
                                <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                                    {contacts.map(contact => (
                                        <label key={contact.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedContacts.includes(contact.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedContacts(prev => [...prev, contact.id]);
                                                    } else {
                                                        setSelectedContacts(prev => prev.filter(id => id !== contact.id));
                                                    }
                                                }}
                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 mr-3"
                                            />
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                                    {contact.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{contact.name}</div>
                                                    <div className="text-sm text-gray-600">{contact.email}</div>
                                                    {contact.company && (
                                                        <div className="text-xs text-gray-500">{contact.company}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewGroupName('');
                                        setNewGroupType('custom');
                                        setSelectedContacts([]);
                                        setActiveTab('overview');
                                    }}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newGroupName.trim() || selectedContacts.length === 0}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Create Group ({selectedContacts.length})
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// Edit Contact Modal Component (unchanged)
function EditContactModal({ contact, isOpen, onClose, onSave }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        message: '',
        status: 'new'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (contact) {
            setFormData({
                name: contact.name || '',
                email: contact.email || '',
                phone: contact.phone || '',
                company: contact.company || '',
                message: contact.message || '',
                status: contact.status || 'new'
            });
        }
    }, [contact]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const updatedContact = {
                ...contact,
                ...formData,
                lastModified: new Date().toISOString()
            };
            
            await onSave(updatedContact);
            onClose();
        } catch (error) {
            console.error('Error updating contact:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-0 z-[10000] sm:items-center sm:p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {t('contacts.edit_contact') || 'Edit Contact'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Name Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('contacts.name') || 'Name'} *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Email Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('contacts.email') || 'Email'} *
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Phone Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('contacts.phone') || 'Phone'}
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Company Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('contacts.company') || 'Company'}
                        </label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Status Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('contacts.status') || 'Status'}
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            disabled={isSubmitting}
                        >
                            <option value="new">{t('contacts.status_new') || 'New'}</option>
                            <option value="viewed">{t('contacts.status_viewed') || 'Viewed'}</option>
                            <option value="archived">{t('contacts.status_archived') || 'Archived'}</option>
                        </select>
                    </div>

                    {/* Message Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('contacts.message') || 'Message'}
                        </label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical text-base"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-base font-medium"
                            disabled={isSubmitting}
                        >
                            {t('common.cancel') || 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-medium"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            )}
                            {isSubmitting ? (t('contacts.saving') || 'Saving...') : (t('contacts.save_changes') || 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Field icon helper component
const FieldIcon = ({ label }) => {
    const l = label.toLowerCase();
    if (l.includes('name')) return <span className="text-gray-400">👤</span>;
    if (l.includes('email')) return <span className="text-gray-400">✉️</span>;
    if (l.includes('phone') || l.includes('tel') || l.includes('mobile')) return <span className="text-gray-400">📞</span>;
    if (l.includes('company') || l.includes('organisation')) return <span className="text-gray-400">🏢</span>;
    if (l.includes('website') || l.includes('url')) return <span className="text-gray-400">🌐</span>;
    if (l.includes('qr')) return <span className="text-gray-400">🔳</span>;
    if (l.includes('linkedin')) return <span className="text-gray-400">💼</span>;
    if (l.includes('address') || l.includes('location')) return <span className="text-gray-400">📍</span>;
    if (l.includes('twitter')) return <svg className="w-3 h-3 text-gray-400" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6904H306.615L611.412 515.685L658.88 583.579L1055.08 1150.31H892.476L569.165 687.854V687.828Z" fill="currentColor"/></svg>;
    return <span className="text-gray-400">📄</span>;
};