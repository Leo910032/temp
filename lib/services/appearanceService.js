// lib/services/appearanceService.js - FIXED API PATHS
import { auth } from '@/important/firebase';

/**
 * Base API call helper with authentication
 */
async function makeAuthenticatedRequest(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
    }

    return response.json();
}

/**
 * Upload file (profile image, background image/video)
 */
async function uploadFile(file, uploadType) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', uploadType);

    // ✅ FIXED: Correct API path
    const response = await fetch('/api/user/appearance/upload/', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
    }

    return response.json();
}

// =============================================================================
// THEME FUNCTIONS
// =============================================================================

export async function updateTheme(theme, themeColor = '#000') {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateTheme',
            data: { theme, themeColor }
        }),
    });
}

export async function updateThemeBackground(type) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateBackground',
            data: { type }
        }),
    });
}

export async function updateThemeBackgroundColor(color) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateBackgroundColor',
            data: { color }
        }),
    });
}

export async function updateThemeButton(btnType) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButton',
            data: { btnType }
        }),
    });
}

export async function updateThemeBtnColor(color) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButtonColor',
            data: { color }
        }),
    });
}

export async function updateThemeBtnFontColor(color) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButtonFontColor',
            data: { color }
        }),
    });
}

export async function updateThemeBtnShadowColor(color) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButtonShadowColor',
            data: { color }
        }),
    });
}

export async function updateThemeTextColour(color) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateTextColor',
            data: { color }
        }),
    });
}

export async function updateThemeGradientDirection(direction) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateGradientDirection',
            data: { direction }
        }),
    });
}

export async function updateThemeFont(fontType) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateFont',
            data: { fontType }
        }),
    });
}

export async function updateChristmasAccessory(accessoryType) {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateChristmasAccessory',
            data: { accessoryType }
        }),
    });
}

// =============================================================================
// FILE UPLOAD FUNCTIONS
// =============================================================================

export async function uploadProfileImage(file) {
    return uploadFile(file, 'profile');
}

export async function uploadBackgroundImage(file) {
    return uploadFile(file, 'backgroundImage');
}

export async function uploadBackgroundVideo(file) {
    return uploadFile(file, 'backgroundVideo');
}

export async function removeProfileImage() {
    return makeAuthenticatedRequest('/api/user/appearance/upload', {
        method: 'DELETE',
        body: JSON.stringify({
            deleteType: 'profile'
        }),
    });
}

export async function removeBackgroundImage() {
    return makeAuthenticatedRequest('/api/user/appearance/upload', {
        method: 'DELETE',
        body: JSON.stringify({
            deleteType: 'backgroundImage'
        }),
    });
}

export async function removeBackgroundVideo() {
    return makeAuthenticatedRequest('/api/user/appearance/upload', {
        method: 'DELETE',
        body: JSON.stringify({
            deleteType: 'backgroundVideo'
        }),
    });
}

// =============================================================================
// DATA FETCHING
// =============================================================================

export async function getAppearanceData() {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'GET',
    });
}

// =============================================================================
// PROFILE TEXT UPDATES
// =============================================================================

export async function updateDisplayName(displayName) {
    return makeAuthenticatedRequest('/api/user/appearance/profile/text', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateDisplayName',
            data: { displayName }
        }),
    });
}

export async function updateBio(bio) {
    return makeAuthenticatedRequest('/api/user/appearance/profile/text', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateBio',
            data: { bio }
        }),
    });
}