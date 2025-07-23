// lib/services/settingsService.js
import { auth } from '@/important/firebase';

// ✅ ADD: Request deduplication to prevent multiple simultaneous calls
const requestCache = new Map();

/**
 * Base API call helper with authentication and request deduplication
 */
async function makeAuthenticatedRequest(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    // ✅ ADD: Request deduplication for GET requests
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
            // Use cached token instead of forcing refresh
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
            
            // ✅ ADD: Cache GET requests for 30 seconds
            if (isGetRequest) {
                const cacheKey = `${url}_${user.uid}`;
                requestCache.set(cacheKey, result);
                setTimeout(() => requestCache.delete(cacheKey), 30000);
            }
            
            return result;
        } catch (error) {
            console.error(`API Request failed for ${url}:`, error);
            
            // ✅ ADD: Token refresh retry logic for auth errors
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

// =============================================================================
// BULK UPDATE FUNCTION
// =============================================================================

export async function updateSettingsData(settingsData) {
    // ✅ ADD: Clear cache when updating data
    const user = auth.currentUser;
    if (user) {
        const cacheKey = `/api/user/settings_${user.uid}`;
        requestCache.delete(cacheKey);
    }
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify(settingsData),
    });
}

// =============================================================================
// DATA FETCHING
// =============================================================================

export async function getSettingsData() {
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'GET',
    });
}

// =============================================================================
// INDIVIDUAL SETTING FUNCTIONS
// =============================================================================

export async function updateSocials(socials) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/settings_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSocials',
            data: { socials }
        }),
    });
}

export async function updateSocialPosition(position) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/settings_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSocialPosition',
            data: { position }
        }),
    });
}

export async function updateSupportBanner(supportBanner, supportBannerStatus) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/settings_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSupportBanner',
            data: { supportBanner, supportBannerStatus }
        }),
    });
}

export async function updateSensitiveStatus(status) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/settings_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSensitiveStatus',
            data: { status }
        }),
    });
}

export async function updateSensitiveType(type) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/settings_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSensitiveType',
            data: { type }
        }),
    });
}

export async function updateMetaData(title, description) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/settings_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateMetaData',
            data: { title, description }
        }),
    });
}
