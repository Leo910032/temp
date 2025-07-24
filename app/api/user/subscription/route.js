import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Helper function to determine feature access based on account type.
 * This remains unchanged as it's a pure function.
 */
function getFeatureAccess(accountType) {
    const baseFeatures = {
        analytics: false,
        customDomains: false,
        advancedThemes: false,
        prioritySupport: false,
        whiteLabel: false
    };

    switch (accountType) {
        case 'business':
            return { ...baseFeatures, analytics: true, customDomains: true, advancedThemes: true, prioritySupport: true, whiteLabel: true };
        case 'premium':
            return { ...baseFeatures, analytics: true, customDomains: true, advancedThemes: true };
        case 'pro':
            return { ...baseFeatures, analytics: true };
        case 'base':
        default:
            return baseFeatures;
    }
}

/**
 * GET /api/user/subscription
 * Get user's subscription information
 */
export async function GET(request) {
    // 🪵 Log 1: Request received
    const requestId = `sub-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();
    console.log(`[${requestId}] 🚀 GET /api/user/subscription - Request received.`);

    try {
        // --- Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            // 🪵 Log 2.1: Authentication failed (Missing Token)
            console.warn(`[${requestId}] 🛡️ Authentication failed: No Bearer token provided.`);
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;
        // 🪵 Log 2.2: Authentication successful
        console.log(`[${requestId}] 🛡️ Authentication successful for UID: ${uid}`);

        // --- Fetch User Account Data ---
        // 🪵 Log 3.1: Starting Firestore read
        console.log(`[${requestId}] Firestore: Fetching document from AccountData collection for UID: ${uid}`);
        const userDocRef = adminDb.collection('AccountData').doc(uid);
        const userDoc = await userDocRef.get();
        
        if (!userDoc.exists) {
            // 🪵 Log 3.2: User document not found
            console.warn(`[${requestId}]  Firestore: Document not found in AccountData for UID: ${uid}`);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        // 🪵 Log 3.3: User document found
        const userData = userDoc.data();
        const accountType = userData.accountType || 'base';
        console.log(`[${requestId}]  Firestore: Found user data. Account type determined as: "${accountType}"`);
        

        // --- Fetch Detailed Subscription Data (Optional) ---
        let subscriptionDetails = null;
        try {
            // 🪵 Log 4.1: Starting second Firestore read (optional)
            console.log(`[${requestId}] Firestore: Attempting to fetch detailed subscription from Subscriptions collection.`);
            const subscriptionDocRef = adminDb.collection('Subscriptions').doc(uid);
            const subscriptionDoc = await subscriptionDocRef.get();

            if (subscriptionDoc.exists) {
                subscriptionDetails = subscriptionDoc.data();
                // 🪵 Log 4.2: Detailed subscription found
                console.log(`[${requestId}] Firestore: Found detailed subscription data.`);
            } else {
                 // 🪵 Log 4.3: No detailed subscription found
                console.log(`[${requestId}] Firestore: No detailed subscription document found for UID: ${uid}. This is a normal scenario.`);
            }
        } catch (subError) {
            // 🪵 Log 4.4: Error fetching detailed subscription
            console.warn(`[${requestId}] Firestore: Error fetching from Subscriptions collection, proceeding without it. Error: ${subError.message}`);
        }

        // --- Process Feature Access ---
        // 🪵 Log 5: Processing features
        const features = getFeatureAccess(accountType);
        console.log(`[${requestId}] ⚙️ Processed feature access for account type "${accountType}". Analytics access: ${features.analytics}`);

        // --- Success Response ---
        const processingTime = Date.now() - startTime;
        // 🪵 Log 6: Sending successful response
        console.log(`[${requestId}] ✅ Success! Sending response. Total processing time: ${processingTime}ms`);

        return NextResponse.json({
            accountType,
            features,
            hasAnalyticsAccess: features.analytics,
            subscription: subscriptionDetails,
            user: {
                uid,
                email: userData.email,
                username: userData.username
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        // 🪵 Log 7: Unhandled error
        console.error(`[${requestId}] 💥 Unhandled API Error in /api/user/subscription:`, {
            errorMessage: error.message,
            errorCode: error.code,
            processingTime: `${processingTime}ms`,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined // Show stack trace in dev
        });
        
        // Return a specific error for expired tokens
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return NextResponse.json({ error: 'Token is invalid or expired. Please sign in again.' }, { status: 401 });
        }

        // Return a generic internal server error for all other cases
        return NextResponse.json({ 
            error: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}