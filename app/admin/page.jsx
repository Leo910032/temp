// app/admin/page.jsx
"use client"
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

export default function AdminDashboard() {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userDetailLoading, setUserDetailLoading] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        withLinks: 0,
        withSocials: 0,
        sensitiveContent: 0
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            // Debug: Check if user exists
            if (!currentUser) {
                console.error('❌ No current user found');
                return;
            }

            console.log('👤 Current user:', currentUser.email);
            
            // Get token with more detailed error handling
            const token = await currentUser.getIdToken();
            console.log('🔑 Token obtained:', token ? 'Yes' : 'No');
            
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log('📡 Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Data received:', data);
                setUsers(data.users);
                
                // Calculate stats
                const withLinks = data.users.filter(u => u.linksCount > 0).length;
                const withSocials = data.users.filter(u => u.socialsCount > 0).length;
                const sensitiveContent = data.users.filter(u => u.sensitiveStatus).length;
                
                setStats({
                    total: data.users.length,
                    withLinks,
                    withSocials,
                    sensitiveContent
                });
            } else {
                const errorData = await response.json();
                console.error('❌ API Error:', response.status, errorData);
                
                // Show user-friendly error
                if (response.status === 401) {
                    alert('Authentication failed. Please log out and log back in.');
                } else if (response.status === 403) {
                    alert('Access denied. You need admin privileges.');
                } else {
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            }
        } catch (error) {
            console.error('💥 Fetch error:', error);
            alert('Failed to load users. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

  // In file: app/admin/page.jsx

const fetchUserDetail = async (userId) => {
    setUserDetailLoading(true);
    setSelectedUser(null); // Clear previous user details immediately
    
    try {
        if (!currentUser) {
            throw new Error("Authentication context is not available.");
        }
        
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/admin/user/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const userData = await response.json();
            setSelectedUser(userData);
        } else {
            // Provide more specific feedback to the admin
            const errorData = await response.json();
            console.error(`Failed to fetch user ${userId}. Status: ${response.status}`, errorData);
            alert(`Error loading user details: ${errorData.error || response.statusText}`);
        }
    } catch (error) {
        console.error('A client-side error occurred in fetchUserDetail:', error);
        alert(`An unexpected error occurred: ${error.message}`);
    } finally {
        setUserDetailLoading(false);
    }
};

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                <Link 
                    href="/dashboard" 
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                    Back to Dashboard
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                    <div className="text-sm text-gray-600">Total Users</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-green-600">{stats.withLinks}</div>
                    <div className="text-sm text-gray-600">Users with Links</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-purple-600">{stats.withSocials}</div>
                    <div className="text-sm text-gray-600">Users with Socials</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-red-600">{stats.sensitiveContent}</div>
                    <div className="text-sm text-gray-600">Sensitive Content</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Users List */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">All Users ({users.length})</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => fetchUserDetail(user.id)}
                                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                                    selectedUser?.id === user.id ? 'bg-blue-50 border-blue-200' : ''
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        {user.profilePhoto ? (
                                            <Image
                                                src={user.profilePhoto}
                                                alt={user.displayName}
                                                width={40}
                                                height={40}
                                                className="rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {user.displayName?.charAt(0) || 'U'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {user.displayName} (@{user.username})
                                        </p>
                                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                                {user.linksCount} links
                                            </span>
                                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                                {user.selectedTheme}
                                            </span>
                                            {user.sensitiveStatus && (
                                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                                    Sensitive
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User Details */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
                    </div>
                    <div className="p-6">
                        {userDetailLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : selectedUser ? (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    {selectedUser.profilePhoto ? (
                                        <Image
                                            src={selectedUser.profilePhoto}
                                            alt={selectedUser.displayName}
                                            width={64}
                                            height={64}
                                            className="rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                                            <span className="text-xl font-semibold text-gray-600">
                                                {selectedUser.displayName?.charAt(0) || 'U'}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-xl font-bold">{selectedUser.displayName}</h4>
                                        <p className="text-gray-600">@{selectedUser.username}</p>
                                        <p className="text-sm text-gray-500">{selectedUser.email}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Bio</label>
                                        <p className="text-sm text-gray-900">{selectedUser.bio || 'No bio'}</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Theme</label>
                                        <p className="text-sm text-gray-900">{selectedUser.selectedTheme}</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Links ({selectedUser.links?.length || 0})</label>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {selectedUser.links?.length > 0 ? (
                                                selectedUser.links.map((link, index) => (
                                                    <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                                                        <div className="font-medium">{link.title}</div>
                                                        <div className="text-gray-600 truncate">{link.url}</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500">No links</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Social Links</label>
                                        <p className="text-sm text-gray-900">{selectedUser.socials?.length || 0} social accounts</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Created</label>
                                        <p className="text-sm text-gray-900">
                                            {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Unknown'}
                                        </p>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        {selectedUser.sensitiveStatus && (
                                            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                                Sensitive Content
                                            </span>
                                        )}
                                        {selectedUser.supportBannerStatus && (
                                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                                Support Banner
                                            </span>
                                        )}
                                    </div>

                                    <div className="pt-4">
                                        <a
                                            href={`/${selectedUser.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            View Public Profile →
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Select a user to view details
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}