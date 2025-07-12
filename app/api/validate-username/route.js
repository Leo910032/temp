// app/api/validate-username/route.js - Enhanced with Firebase Authentication
import { fireApp } from '@/important/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { NextResponse } from 'next/server';

// For server-side Firebase Admin (you'll need to set this up)
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK (only once)
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

// Rate limiting storage
const rateLimitMap = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.lastReset > 5 * 60 * 1000) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000);

function getRateLimitKey(request, userId = null) {
    // Use userId for authenticated rate limiting, fallback to IP
    if (userId) {
        return `user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 
               request.headers.get('x-real-ip') || 
               'unknown';
    return `ip:${ip}`;
}

function isRateLimited(key, isAuthenticated = false) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    // Higher limits for authenticated users
    const maxRequests = isAuthenticated ? 20 : 5; // 20 for auth users, 5 for anonymous
    
    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, lastReset: now });
        return false;
    }
    
    const data = rateLimitMap.get(key);
    
    if (now - data.lastReset > windowMs) {
        data.count = 1;
        data.lastReset = now;
        return false;
    }
    
    if (data.count >= maxRequests) {
        return true;
    }
    
    data.count++;
    return false;
}

async function verifyFirebaseToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header');
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const decodedToken = await getAuth().verifyIdToken(token);
        return {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
        };
    } catch (error) {
        throw new Error(`Invalid token: ${error.message}`);
    }
}

export async function POST(request) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    try {
        // Get client info
        const clientIP = getRateLimitKey(request);
        const userAgent = request.headers.get('user-agent');
        const referer = request.headers.get('referer');
        const authHeader = request.headers.get('authorization');

        // 🔍 SERVER-SIDE LOG #1: Request received
        console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - Request received`);
        console.log(`   IP: ${clientIP}`);
        console.log(`   Has Auth Header: ${!!authHeader}`);
        console.log(`   User-Agent: ${userAgent?.substring(0, 100)}...`);
        console.log(`   Referer: ${referer}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);

        // ====================================================================
        // 🛡️ FIREBASE AUTHENTICATION VERIFICATION
        // ====================================================================
        
        let authenticatedUser = null;
        let isAuthenticated = false;
        
        try {
            if (authHeader) {
                authenticatedUser = await verifyFirebaseToken(authHeader);
                isAuthenticated = true;
                console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - AUTHENTICATED USER`);
                console.log(`   User ID: ${authenticatedUser.uid}`);
                console.log(`   Email: ${authenticatedUser.email}`);
                console.log(`   Email Verified: ${authenticatedUser.emailVerified}`);
            } else {
                console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - ANONYMOUS REQUEST`);
            }
        } catch (authError) {
            console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - AUTH FAILED: ${authError.message}`);
            
            return NextResponse.json(
                { 
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED',
                    serverProcessed: true,
                    requestId
                }, 
                { status: 401 }
            );
        }

        // ====================================================================
        // 🛡️ ENHANCED RATE LIMITING (PER USER + PER IP)
        // ====================================================================
        
        const rateLimitKey = getRateLimitKey(request, authenticatedUser?.uid);
        
        if (isRateLimited(rateLimitKey, isAuthenticated)) {
            console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - RATE LIMITED`);
            console.log(`   Rate Limit Key: ${rateLimitKey}`);
            console.log(`   Is Authenticated: ${isAuthenticated}`);
            
            return NextResponse.json(
                { 
                    error: isAuthenticated 
                        ? 'Too many requests. Please wait a moment.' 
                        : 'Too many requests. Please sign in for higher limits.',
                    rateLimited: true,
                    serverProcessed: true,
                    requestId,
                    maxRequests: isAuthenticated ? 20 : 5,
                    windowMs: 60000
                }, 
                { status: 429 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { username } = body;

        // 🔍 SERVER-SIDE LOG #2: Processing username
        console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - Processing username: "${username}"`);

        // ====================================================================
        // 🛡️ INPUT VALIDATION & SANITIZATION
        // ====================================================================
        
        if (!username || typeof username !== 'string') {
            console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - INVALID INPUT`);
            return NextResponse.json(
                { 
                    error: 'Username is required and must be a string',
                    serverProcessed: true,
                    requestId 
                }, 
                { status: 400 }
            );
        }

        const cleanUsername = username.trim().toLowerCase();
        
        // Enhanced username validation
        if (cleanUsername.length < 1) {
            return NextResponse.json(
                { error: 'Username cannot be empty', serverProcessed: true, requestId }, 
                { status: 400 }
            );
        }
        
        if (cleanUsername.length > 50) {
            return NextResponse.json(
                { error: 'Username too long (max 50 characters)', serverProcessed: true, requestId }, 
                { status: 400 }
            );
        }

        // Check for invalid characters (optional)
        const validUsernameRegex = /^[a-z0-9_.-]+$/;
        if (!validUsernameRegex.test(cleanUsername)) {
            return NextResponse.json(
                { error: 'Username contains invalid characters', serverProcessed: true, requestId }, 
                { status: 400 }
            );
        }

        // ====================================================================
        // 🔍 FIRESTORE DATABASE QUERY
        // ====================================================================
        
        console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - Querying Firestore for: "${cleanUsername}"`);
        
        const dbStartTime = Date.now();
        
        // Check if username exists in Firestore
        const accountsRef = collection(fireApp, "AccountData");
        const q = query(
            accountsRef, 
            where("username", "==", cleanUsername),
            limit(1) // Only need to know if at least one exists
        );
        
        const snapshot = await getDocs(q);
        const exists = !snapshot.empty;
        
        const dbEndTime = Date.now();
        const dbQueryTime = dbEndTime - dbStartTime;

        // 🔍 SERVER-SIDE LOG #3: Database result
        console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - Database query completed`);
        console.log(`   Username: "${cleanUsername}"`);
        console.log(`   Exists: ${exists}`);
        console.log(`   Query time: ${dbQueryTime}ms`);
        console.log(`   Documents found: ${snapshot.size}`);
        console.log(`   Authenticated: ${isAuthenticated}`);

        const totalTime = Date.now() - startTime;

        // 🔍 SERVER-SIDE LOG #4: Response sent
        console.log(`🔴 SERVER-SIDE VALIDATION [${requestId}] - Sending response`);
        console.log(`   Total processing time: ${totalTime}ms`);
        console.log(`   Result: ${exists ? 'USERNAME EXISTS' : 'USERNAME AVAILABLE'}`);
        console.log(`🔴 =====================================================`);

        // ====================================================================
        // 📤 ENHANCED RESPONSE WITH AUTH INFO
        // ====================================================================
        
        return NextResponse.json({ 
            exists,
            username: cleanUsername,
            serverProcessed: true,
            authenticated: isAuthenticated,
            user: isAuthenticated ? {
                uid: authenticatedUser.uid,
                email: authenticatedUser.email,
                emailVerified: authenticatedUser.emailVerified
            } : null,
            requestId,
            processingTime: totalTime,
            dbQueryTime,
            timestamp: new Date().toISOString(),
            serverLocation: process.env.VERCEL_REGION || 'local',
            rateLimit: {
                key: rateLimitKey,
                maxRequests: isAuthenticated ? 20 : 5,
                windowMs: 60000
            }
        });

    } catch (error) {
        const errorTime = Date.now() - startTime;
        
        // 🔍 SERVER-SIDE LOG #5: Error occurred
        console.error(`🔴 SERVER-SIDE VALIDATION [${requestId}] - ERROR OCCURRED`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Time until error: ${errorTime}ms`);
        console.error(`   Stack: ${error.stack}`);
        
        return NextResponse.json(
            { 
                error: 'Internal server error during username validation',
                serverProcessed: true,
                requestId,
                code: 'SERVER_ERROR'
            }, 
            { status: 500 }
        );
    }
}

// Handle other HTTP methods
export async function GET() {
    return NextResponse.json(
        { 
            error: 'Method not allowed. Use POST with authentication.',
            requiredHeaders: ['Authorization: Bearer <firebase-token>'],
            requiredBody: { username: 'string' }
        }, 
        { status: 405 }
    );
}

export async function PUT() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' }, 
        { status: 405 }
    );
}

export async function DELETE() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' }, 
        { status: 405 }
    );
}