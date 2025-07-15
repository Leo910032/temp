// app/api/admin/users/route.js

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Server-side admin authorization check
 * @param {string} email - User's email address
 * @returns {boolean} - Whether the user is an admin
 */
function isServerAdmin(email) {
    if (!email) return false;
    
    // Get admin emails from environment variables (secure, server-only)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    return adminEmails
        .map(e => e.toLowerCase().trim())
        .includes(email.toLowerCase().trim());
}

/**
 * Verify Firebase Auth token and check admin status
 * @param {string} token - Firebase ID token
 * @returns {Promise<{isValid: boolean, email?: string, isAdmin: boolean, error?: string}>}
 */
async function verifyAdminToken(token) {
    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        return {
            isValid: true,
            email: decodedToken.email,
            isAdmin: isServerAdmin(decodedToken.email),
            uid: decodedToken.uid
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        return { 
            isValid: false, 
            isAdmin: false, 
            error: error.code || 'Invalid token' 
        };
    }
}

/**
 * Sanitize user data for admin view (remove sensitive fields if needed)
 * @param {object} userData - Raw user data from Firestore
 * @param {string} docId - Document ID
 * @returns {object} - Sanitized user data
 */
function sanitizeUserData(userData, docId) {
    return {
        id: docId,
        username: userData.username || 'N/A',
        displayName: userData.displayName || 'N/A',
        email: userData.email || 'N/A',
        selectedTheme: userData.selectedTheme || 'N/A',
        linksCount: userData.links?.length || 0,
        socialsCount: userData.socials?.length || 0,
        createdAt: userData.createdAt?.toDate?.()?.toISOString?.() || null,
        profilePhoto: userData.profilePhoto || null,
        sensitiveStatus: userData.sensitiveStatus || false,
        supportBannerStatus: userData.supportBannerStatus || false,
        lastLogin: userData.lastLogin?.toDate?.()?.toISOString?.() || null,
        emailVerified: userData.emailVerified || false,
        // Add other safe fields as needed
    };
}

/**
 * GET /api/admin/users
 * Fetch all users for admin dashboard
 */
export async function GET(request) {
    const startTime = Date.now();
    
    try {
        // --- 1. Extract Authorization Token ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('🚨 Admin API access attempted without valid authorization header');
            return NextResponse.json(
                { error: 'Unauthorized: No valid token provided' }, 
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];

        // --- 2. Verify Token and Check Admin Status ---
        const { isValid, email, isAdmin, error } = await verifyAdminToken(token);

        if (!isValid) {
            console.warn(`🚨 Admin API access attempted with invalid token: ${error}`);
            return NextResponse.json(
                { error: `Unauthorized: ${error}` }, 
                { status: 401 }
            );
        }

        if (!isAdmin) {
            // 🔥 CRITICAL: Log unauthorized admin access attempts
            console.warn(`🚨 UNAUTHORIZED ADMIN ACCESS ATTEMPT by user: ${email}`);
            return NextResponse.json(
                { error: 'Forbidden: You do not have admin privileges' }, 
                { status: 403 }
            );
        }

        // --- 3. Authorized - Log and Proceed ---
        console.log(`✅ Authorized admin access by: ${email}`);

        // --- 4. Fetch Users Data ---
        const usersSnapshot = await adminDb.collection('AccountData').get();
        
        if (usersSnapshot.empty) {
            return NextResponse.json({ 
                users: [], 
                total: 0,
                message: 'No users found',
                timestamp: new Date().toISOString()
            });
        }

        // --- 5. Process and Sanitize User Data ---
        const users = [];
        const errors = [];

        usersSnapshot.forEach(doc => {
            try {
                const userData = doc.data();
                const sanitizedUser = sanitizeUserData(userData, doc.id);
                users.push(sanitizedUser);
            } catch (error) {
                console.error(`Error processing user document ${doc.id}:`, error);
                errors.push(`Failed to process user ${doc.id}`);
            }
        });

        // --- 6. Sort Users (most recent first) ---
        users.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        // --- 7. Calculate Statistics ---
        const stats = {
            total: users.length,
            withLinks: users.filter(u => u.linksCount > 0).length,
            withSocials: users.filter(u => u.socialsCount > 0).length,
            sensitiveContent: users.filter(u => u.sensitiveStatus).length,
            supportBanners: users.filter(u => u.supportBannerStatus).length,
            emailVerified: users.filter(u => u.emailVerified).length
        };

        const processingTime = Date.now() - startTime;

        // --- 8. Return Success Response ---
        const response = {
            users,
            stats,
            total: users.length,
            timestamp: new Date().toISOString(),
            processingTimeMs: processingTime,
            adminUser: email
        };

        // Include errors if any occurred during processing
        if (errors.length > 0) {
            response.warnings = errors;
        }

        console.log(`✅ Admin users API completed successfully for ${email} (${processingTime}ms, ${users.length} users)`);
        
        return NextResponse.json(response);

    } catch (error) {
        // --- 9. Error Handling ---
        const processingTime = Date.now() - startTime;
        console.error('💥 Admin users API error:', {
            error: error.message,
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            processingTime
        });

        // Different error responses based on error type
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json(
                { error: 'Unauthorized: Token expired, please log in again' }, 
                { status: 401 }
            );
        }

        if (error.code === 'auth/argument-error') {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid token format' }, 
                { status: 401 }
            );
        }

        // Generic server error (don't expose internal details)
        return NextResponse.json(
            { 
                error: 'Internal server error',
                timestamp: new Date().toISOString(),
                ...(process.env.NODE_ENV === 'development' && { 
                    details: error.message 
                })
            }, 
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/users
 * Handle admin actions on users (future: ban, unban, etc.)
 */
export async function POST(request) {
    try {
        // Similar authentication flow
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const { isValid, email, isAdmin } = await verifyAdminToken(token);

        if (!isValid || !isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { action, userId, data } = body;

        // Handle different admin actions
        switch (action) {
            case 'updateUser':
                // Implementation for updating user data
                // Add validation and sanitization
                break;
            case 'suspendUser':
                // Implementation for suspending users
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Placeholder response
        return NextResponse.json({ 
            message: 'Admin action completed',
            action,
            userId,
            adminUser: email,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Admin POST API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' }, 
            { status: 500 }
        );
    }
}