// app/dashboard/(dashboard pages)/contacts/page.jsx - SERVER-SIDE VERSION
"use client"
import { useEffect, useState } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import BusinessCardScanner from './components/BusinessCardScanner';
import ContactReviewModal from './components/ContactReviewModal';
import { ShareContactsModal } from './components/ShareContactsModal';

// Import the new server-side service
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
    getContactStats
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

export default function ContactsPage() {
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
    
    // Stats and pagination
    const [contactStats, setContactStats] = useState({
        total: 0,
        byStatus: { new: 0, viewed: 0, archived: 0 },
        locationStats: { total: 0, withLocation: 0, withoutLocation: 0 }
    });
    const [pagination, setPagination] = useState({
        limit: 100,
        offset: 0,
        hasMore: false
    });

    // Filter contacts based on status and search term
    const filteredContacts = contacts.filter(contact => {
        const matchesFilter = filter === 'all' || contact.status === filter;
        const matchesSearch = !searchTerm || 
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase()));
        
        return matchesFilter && matchesSearch;
    });

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
            setContactStats({
                total: result.totalCount,
                byStatus: {
                    new: result.contacts.filter(c => c.status === 'new').length,
                    viewed: result.contacts.filter(c => c.status === 'viewed').length,
                    archived: result.contacts.filter(c => c.status === 'archived').length
                },
                locationStats: result.locationStats
            });

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

    // Initial load
    useEffect(() => {
        loadContacts();
        checkSharingPermissions();
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
            
            setShowReviewModal(false);
            setScannedFields(null);
            
        } catch (error) {
            console.error('Error saving scanned contact:', error);
            toast.error(t('contacts.failed_to_save') || 'Failed to save contact');
            throw error;
        }
    };
// ✅ CORRECT - Ce que vous devriez avoir :
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
            // ✅ PAS D'APPEL RÉCURSIF ICI !
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

    // Get counts for each status from current filtered contacts
    const counts = {
        all: contactStats.total,
        new: contactStats.byStatus.new,
        viewed: contactStats.byStatus.viewed,
        archived: contactStats.byStatus.archived
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
            <EditContactModal
                contact={editingContact}
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingContact(null);
                }}
                onSave={handleSaveEditedContact}
            />

            {/* Map Modal */}
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
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="p-3 sm:p-4">
                {/* Header */}
                <ContactsHeader
                    teamSharingEnabled={teamSharingEnabled}
                    selectionMode={selectionMode}
                    selectedContacts={selectedContacts}
                    onToggleSelectionMode={toggleSelectionMode}
                    onSelectAll={selectAllContacts}
                    onClearSelection={clearSelection}
                    onShareSelected={handleShareSelected}
                    onScanCard={() => setShowScanner(true)}
                />

                {/* Filters */}
                <MobileFilters
                    filter={filter}
                    setFilter={setFilter}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    counts={counts}
                    locationStats={contactStats.locationStats}
                    onMapView={openContactMap}
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
        // Cette fonction reçoit directement les fields parsés
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

// Header component (extracted for clarity)
function ContactsHeader({ 
    teamSharingEnabled, 
    selectionMode, 
    selectedContacts, 
    onToggleSelectionMode, 
    onSelectAll, 
    onClearSelection, 
    onShareSelected, 
    onScanCard 
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
                    </p>
                </div>
                
                <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                                        className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0"
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

// Mobile filters component
function MobileFilters({ 
    filter, 
    setFilter, 
    searchTerm, 
    setSearchTerm, 
    counts, 
    locationStats, 
    onMapView 
}) {
    const { t } = useTranslation();
    const [showFilters, setShowFilters] = useState(false);

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

            {/* Filter and Map buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                    </svg>
                    <span className="truncate">{t('contacts.filter_with_count', { count: counts[filter] }) || `Filter (${counts[filter]})`}</span>
                    <svg className={`w-4 h-4 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

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
                    <span className="truncate">{t('contacts.map_with_count', { count: locationStats.withLocation }) || `Map (${locationStats.withLocation})`}</span>
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
        </div>
    );
}

// Contacts list component
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
    loading
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

// Contact card component
function ContactCard({ contact, onEdit, onStatusUpdate, onDelete, onContactAction, onMapView }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

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
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{headerName}</h3>
                                <p className="text-xs text-gray-500 truncate">{headerEmail}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                                        {t(`contacts.status_${contact.status}`) || contact.status}
                                    </span>
                                    {contact.location && <span className="text-xs text-green-600">📍</span>}
                                    {isFromTeamMember && <span className="text-xs text-purple-600">👥</span>}
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

// Edit Contact Modal Component
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
            // Error is already handled in parent component
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