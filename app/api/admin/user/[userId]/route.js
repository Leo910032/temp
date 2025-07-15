// app/api/admin/users/[userId]/route.js

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'; // Use the central import
import { isServerAdmin } from '@/lib/serverAdminAuth';

export async function GET(request, { params }) {
    const { userId } = params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        if (!isServerAdmin(decodedToken.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const userDoc = await adminDb.collection('AccountData').doc(userId).get();

        if (!userDoc.exists) {
            // This is a specific "not found" for the data, not the route.
            return NextResponse.json({ error: `User document with ID ${userId} not found.` }, { status: 404 });
        }

        const userData = userDoc.data();
        
        // Return the user data as JSON
        return NextResponse.json({
            id: userDoc.id,
            ...userData,
            createdAt: userData.createdAt?.toDate?.().toISOString() || null,
        });

    } catch (error) {
        console.error(`API Error for /api/admin/user/${userId}:`, error);
        // This catch block is crucial. It prevents the server from crashing and sending HTML.
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}