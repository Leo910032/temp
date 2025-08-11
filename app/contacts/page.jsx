// app/contacts/page.jsx - Updated with ContactTestPanel integration
"use client"
import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';

// Import your existing components
import ContactsMap from './components/ContactsMap';
import BusinessCardScanner from './components/BusinessCardScanner';
import ContactReviewModal from './components/ContactReviewModal';
import ShareContactsModal from './components/ShareContactsModal';

// Import the new test panel
import ContactTestPanel from './components/ContactTestPanel';

export default function ContactsPage() {
    const [user, loading, error] = useAuthState(auth);
    const [contacts, setContacts] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showTestPanel, setShowTestPanel] = useState(false);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);

    // Your existing contact loading logic
    useEffect(() => {
        if (user) {
            loadContacts();
        }
    }, [user]);

    const loadContacts = async () => {
        try {
            setIsLoadingContacts(true);
            // Your existing contact loading logic here
            // This should fetch contacts from your API/Firebase
            const token = await user.getIdToken();
            const response = await fetch('/api/user/contacts', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setContacts(data.contacts || []);
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
            toast.error('Failed to load contacts');
        } finally {
            setIsLoadingContacts(false);
        }
    };

    const handleContactsGenerated = (result) => {
        // Refresh contacts after generation
        loadContacts();
        
        // Optionally scroll to contacts or show success message
        toast.success(`Generated ${result.data.generated} test contacts!`, {
            duration: 4000
        });
    };

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Show login prompt if not authenticated
    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
                    <p className="text-gray-600 mb-6">Please log in to access your contacts.</p>
                    <a 
                        href="/auth/login" 
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Log In
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
                            <p className="mt-2 text-gray-600">
                                Manage your professional network
                                {contacts.length > 0 && (
                                    <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                        {contacts.length} contacts
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
                            {/* Development Mode Toggle */}
                            {process.env.NODE_ENV === 'development' && (
                                <button
                                    onClick={() => setShowTestPanel(!showTestPanel)}
                                    className={`px-4 py-2 rounded-lg border transition-colors ${
                                        showTestPanel 
                                            ? 'bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-150' 
                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    🧪 {showTestPanel ? 'Hide' : 'Show'} Test Panel
                                </button>
                            )}
                            <button
                                onClick={() => setShowShareModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Share Profile
                            </button>
                        </div>
                    </div>
                </div>

                {/* Development Test Panel */}
                {process.env.NODE_ENV === 'development' && showTestPanel && (
                    <div className="mb-8">
                        <ContactTestPanel 
                            onContactsGenerated={handleContactsGenerated}
                            className="shadow-lg"
                        />
                    </div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Contact Actions & Stats */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Business Card Scanner */}
                        <BusinessCardScanner 
                            onContactScanned={(contact) => {
                                // Handle scanned contact
                                loadContacts();
                            }}
                        />

                        {/* Contact Stats */}
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Contact Statistics
                            </h3>
                            
                            {isLoadingContacts ? (
                                <div className="space-y-3">
                                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Contacts</span>
                                        <span className="font-semibold text-blue-600">
                                            {contacts.length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">With Location</span>
                                        <span className="font-semibold text-green-600">
                                            {contacts.filter(c => c.location?.latitude).length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">From Events</span>
                                        <span className="font-semibold text-purple-600">
                                            {contacts.filter(c => c.eventInfo).length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">New Contacts</span>
                                        <span className="font-semibold text-orange-600">
                                            {contacts.filter(c => c.status === 'new').length}
                                        </span>
                                    </div>
                                    
                                    {contacts.length === 0 && (
                                        <div className="text-center py-6 text-gray-500">
                                            <div className="text-4xl mb-2">📱</div>
                                            <p className="text-sm">No contacts yet</p>
                                            {process.env.NODE_ENV === 'development' && (
                                                <p className="text-xs mt-1">
                                                    Use the test panel above to generate sample data
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Quick Actions
                            </h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        // Implement export functionality
                                        toast.info('Export feature coming soon!');
                                    }}
                                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="mr-3 text-lg">📤</span>
                                        <span className="font-medium">Export Contacts</span>
                                    </div>
                                    <span className="text-gray-400">→</span>
                                </button>
                                
                                <button
                                    onClick={() => {
                                        // Implement import functionality
                                        toast.info('Import feature coming soon!');
                                    }}
                                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="mr-3 text-lg">📥</span>
                                        <span className="font-medium">Import Contacts</span>
                                    </div>
                                    <span className="text-gray-400">→</span>
                                </button>

                                <button
                                    onClick={() => {
                                        // Implement auto-grouping
                                        toast.info('Auto-grouping feature coming soon!');
                                    }}
                                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="mr-3 text-lg">🎯</span>
                                        <span className="font-medium">Auto-Group Contacts</span>
                                    </div>
                                    <span className="text-gray-400">→</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Contact List & Map */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Contact Map */}
                        {contacts.filter(c => c.location?.latitude).length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="p-6 border-b border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Contact Locations
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {contacts.filter(c => c.location?.latitude).length} contacts with location data
                                    </p>
                                </div>
                                <div className="h-96">
                                    <ContactsMap 
                                        contacts={contacts.filter(c => c.location?.latitude)}
                                        onContactClick={setSelectedContact}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Contact List */}
                        <div className="bg-white rounded-xl shadow-sm border">
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Recent Contacts
                                    </h3>
                                    <div className="flex items-center space-x-2">
                                        <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                            <option>All Contacts</option>
                                            <option>New</option>
                                            <option>From Events</option>
                                            <option>With Location</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {isLoadingContacts ? (
                                    // Loading skeleton
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <div key={index} className="p-6 animate-pulse">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                                                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                                </div>
                                                <div className="w-20 h-6 bg-gray-200 rounded"></div>
                                            </div>
                                        </div>
                                    ))
                                ) : contacts.length === 0 ? (
                                    // Empty state
                                    <div className="p-12 text-center">
                                        <div className="text-6xl mb-4">👥</div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            No contacts yet
                                        </h3>
                                        <p className="text-gray-600 mb-6">
                                            Start building your professional network by scanning business cards or sharing your profile.
                                        </p>
                                        {process.env.NODE_ENV === 'development' && (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                                <p className="text-sm text-yellow-800">
                                                    <strong>Development Mode:</strong> Use the test panel above to generate sample contacts for testing.
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                            <button
                                                onClick={() => setShowShareModal(true)}
                                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                Share Your Profile
                                            </button>
                                            {process.env.NODE_ENV === 'development' && (
                                                <button
                                                    onClick={() => setShowTestPanel(true)}
                                                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                                >
                                                    Generate Test Data
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // Contact list
                                    contacts.slice(0, 20).map((contact) => (
                                        <div 
                                            key={contact.id || contact.email}
                                            className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() => setSelectedContact(contact)}
                                        >
                                            <div className="flex items-center space-x-4">
                                                {/* Avatar */}
                                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                                    {contact.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>

                                                {/* Contact Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                                                            {contact.name}
                                                        </h4>
                                                        {contact.status === 'new' && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                New
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600 truncate">
                                                        {contact.company && (
                                                            <span>{contact.company} • </span>
                                                        )}
                                                        {contact.email}
                                                    </p>
                                                    <div className="flex items-center space-x-4 mt-1">
                                                        {contact.eventInfo && (
                                                            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                                                📅 {contact.eventInfo.eventName}
                                                            </span>
                                                        )}
                                                        {contact.location && (
                                                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                                                📍 Location
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(contact.submittedAt || contact.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center space-x-2">
                                                    {contact.phone && (
                                                        <a
                                                            href={`tel:${contact.phone}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                            title="Call"
                                                        >
                                                            📞
                                                        </a>
                                                    )}
                                                    <a
                                                        href={`mailto:${contact.email}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Email"
                                                    >
                                                        ✉️
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Show more button */}
                                {contacts.length > 20 && (
                                    <div className="p-6 border-t bg-gray-50">
                                        <button className="w-full text-center text-blue-600 hover:text-blue-800 font-medium">
                                            Show {contacts.length - 20} more contacts
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {selectedContact && (
                <ContactReviewModal
                    contact={selectedContact}
                    onClose={() => setSelectedContact(null)}
                    onUpdate={(updatedContact) => {
                        // Handle contact update
                        loadContacts();
                        setSelectedContact(null);
                    }}
                />
            )}

            {showShareModal && (
                <ShareContactsModal
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
}