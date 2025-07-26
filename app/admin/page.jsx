// app/admin/page.jsx - ENHANCED WITH ANALYTICS DATA
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
        sensitiveContent: 0,
        withAnalytics: 0,
        totalViews: 0,
        totalClicks: 0,
        activeToday: 0,
        accountTypes: {
            base: 0,
            pro: 0,
            premium: 0,
            business: 0
        }
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            if (!currentUser) {
                console.error('❌ No current user found');
                return;
            }

            console.log('👤 Current user:', currentUser.email);
            
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
                setStats(data.stats);
            } else {
                const errorData = await response.json();
                console.error('❌ API Error:', response.status, errorData);
                
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

   // Enhanced fetchUserDetail function with comprehensive debugging
// Add this to your app/admin/page.jsx file, replacing the existing fetchUserDetail function

const fetchUserDetail = async (userId) => {
    console.log('🎯 fetchUserDetail called with userId:', userId);
    
    setUserDetailLoading(true);
    setSelectedUser(null);
    
    try {
        if (!currentUser) {
            console.error("❌ No currentUser available");
            throw new Error("Authentication context is not available.");
        }
        
        console.log('👤 Current user email:', currentUser.email);
        
        const token = await currentUser.getIdToken();
        console.log('🔑 Token obtained:', token ? 'Yes' : 'No');
        
        const apiUrl = `/api/admin/user/${userId}`;
        console.log('🌐 Making request to:', apiUrl);
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('📡 Response status:', response.status);
        console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
            const userData = await response.json();
            console.log('✅ User detail data received:', userData);
            setSelectedUser(userData);
        } else {
            const errorData = await response.text(); // Use text() first to see raw response
            console.error(`❌ Failed to fetch user ${userId}:`, {
                status: response.status,
                statusText: response.statusText,
                rawResponse: errorData
            });
            
            // Try to parse as JSON if possible
            let parsedError = errorData;
            try {
                parsedError = JSON.parse(errorData);
            } catch (e) {
                console.warn('⚠️ Response is not valid JSON');
            }
            
            alert(`Error loading user details: ${parsedError.error || parsedError || response.statusText}`);
        }
    } catch (error) {
        console.error('💥 Client-side error in fetchUserDetail:', {
            message: error.message,
            stack: error.stack,
            userId: userId
        });
        alert(`An unexpected error occurred: ${error.message}`);
    } finally {
        console.log('🏁 fetchUserDetail completed');
        setUserDetailLoading(false);
    }
};

    // ✅ NEW: Helper function to get traffic source icon
    const getTrafficSourceIcon = (source) => {
        const icons = {
            'instagram': '📸',
            'tiktok': '🎵',
            'twitter': '🐦',
            'facebook': '👤',
            'linkedin': '💼',
            'youtube': '📺',
            'google': '🔍',
            'direct': '🔗',
            'email': '📧',
            'localhost': '🏠'
        };
        return icons[source?.toLowerCase()] || '🌐';
    };

    // ✅ NEW: Helper function to format numbers
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
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

            {/* ✅ ENHANCED: Stats Cards with Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                    <div className="text-sm text-gray-600">Total Users</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-green-600">{formatNumber(stats.totalViews)}</div>
                    <div className="text-sm text-gray-600">Total Views</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-purple-600">{formatNumber(stats.totalClicks)}</div>
                    <div className="text-sm text-gray-600">Total Clicks</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-orange-600">{stats.activeToday}</div>
                    <div className="text-sm text-gray-600">Active Today</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-indigo-600">{stats.withAnalytics}</div>
                    <div className="text-sm text-gray-600">With Analytics</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-red-600">{stats.sensitiveContent}</div>
                    <div className="text-sm text-gray-600">Sensitive Content</div>
                </div>
            </div>

            {/* ✅ NEW: Account Types Breakdown */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Types</h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-xl font-bold text-gray-600">{stats.accountTypes?.base || 0}</div>
                        <div className="text-sm text-gray-500">Base</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">{stats.accountTypes?.pro || 0}</div>
                        <div className="text-sm text-gray-500">Pro</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-purple-600">{stats.accountTypes?.premium || 0}</div>
                        <div className="text-sm text-gray-500">Premium</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-gold-600">{stats.accountTypes?.business || 0}</div>
                        <div className="text-sm text-gray-500">Business</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ✅ ENHANCED: Users List with Analytics */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">All Users ({users.length})</h3>
                        <p className="text-sm text-gray-500">Sorted by engagement (views + clicks)</p>
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
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {user.displayName} (@{user.username})
                                            </p>
                                            {/* ✅ NEW: Account type badge */}
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                user.accountType === 'business' ? 'bg-yellow-100 text-yellow-800' :
                                                user.accountType === 'premium' ? 'bg-purple-100 text-purple-800' :
                                                user.accountType === 'pro' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {user.accountType || 'base'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                        
                                        {/* ✅ NEW: Analytics summary */}
                                        <div className="flex items-center space-x-3 mt-1">
                                            <div className="flex items-center space-x-1">
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                    👁️ {formatNumber(user.analytics?.totalViews || 0)}
                                                </span>
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    🖱️ {formatNumber(user.analytics?.totalClicks || 0)}
                                                </span>
                                            </div>
                                            {user.analytics?.topTrafficSource && (
                                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                                    {getTrafficSourceIcon(user.analytics.topTrafficSource.name)} {user.analytics.topTrafficSource.name}
                                                </span>
                                            )}
                                        </div>
                                        
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
                                            {(user.analytics?.todayViews > 0 || user.analytics?.todayClicks > 0) && (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                    🔥 Active
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ✅ ENHANCED: User Details with Analytics */}
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
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                selectedUser.accountType === 'business' ? 'bg-yellow-100 text-yellow-800' :
                                                selectedUser.accountType === 'premium' ? 'bg-purple-100 text-purple-800' :
                                                selectedUser.accountType === 'pro' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {selectedUser.accountType || 'base'} account
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ✅ NEW: Analytics Section */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h5 className="font-medium text-gray-900 mb-3">📊 Analytics Overview</h5>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {formatNumber(selectedUser.analytics?.totalViews || 0)}
                                            </div>
                                            <div className="text-sm text-gray-600">Total Views</div>
                                            {selectedUser.analytics?.todayViews > 0 && (
                                                <div className="text-xs text-green-500">
                                                    +{selectedUser.analytics.todayViews} today
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {formatNumber(selectedUser.analytics?.totalClicks || 0)}
                                            </div>
                                            <div className="text-sm text-gray-600">Total Clicks</div>
                                            {selectedUser.analytics?.todayClicks > 0 && (
                                                <div className="text-xs text-blue-500">
                                                    +{selectedUser.analytics.todayClicks} today
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {selectedUser.analytics?.topTrafficSource && (
                                        <div className="border-t pt-3">
                                            <div className="text-sm font-medium text-gray-700 mb-2">Top Traffic Source</div>
                                            <div className="flex items-center justify-between bg-white rounded p-3">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-lg">
                                                        {getTrafficSourceIcon(selectedUser.analytics.topTrafficSource.name)}
                                                    </span>
                                                    <div>
                                                        <div className="font-medium capitalize">
                                                            {selectedUser.analytics.topTrafficSource.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {selectedUser.analytics.topTrafficSource.medium}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold">
                                                        {selectedUser.analytics.topTrafficSource.views + selectedUser.analytics.topTrafficSource.clicks} total
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {selectedUser.analytics.topTrafficSource.views}v • {selectedUser.analytics.topTrafficSource.clicks}c
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-purple-600">
                                                {selectedUser.analytics?.linkCount || 0}
                                            </div>
                                            <div className="text-sm text-gray-600">Links Tracked</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-orange-600">
                                                {selectedUser.analytics?.trafficSourceCount || 0}
                                            </div>
                                            <div className="text-sm text-gray-600">Traffic Sources</div>
                                        </div>
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
                                        {selectedUser.emailVerified && (
                                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                                Email Verified
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