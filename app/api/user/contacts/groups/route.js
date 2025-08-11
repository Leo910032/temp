// app/api/user/contacts/groups/route.js - Contact Groups Management API
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';


// ✅ GET - Fetch all contact groups for user
export async function GET(request) {
    try {
        console.log('📊 GET /api/user/contacts/groups - Fetching contact groups');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Get user's contact groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        if (!groupsDoc.exists) {
            return NextResponse.json({
                success: true,
                groups: [],
                totalGroups: 0
            });
        }

        const groupsData = groupsDoc.data();
        const groups = groupsData.groups || [];

        console.log('✅ Contact groups fetched:', {
            userId,
            groupCount: groups.length
        });

        return NextResponse.json({
            success: true,
            groups: groups,
            totalGroups: groups.length,
            lastUpdated: groupsData.lastUpdated
        });

    } catch (error) {
        console.error('❌ Error fetching contact groups:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch contact groups' 
        }, { status: 500 });
    }
}

// ✅ POST - Create new contact group
export async function POST(request) {
    try {
        console.log('📝 POST /api/user/contacts/groups - Creating contact group');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const { action, group } = body;

        if (action !== 'create') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Validate group data
        if (!group || !group.name || !group.contactIds || !Array.isArray(group.contactIds)) {
            return NextResponse.json({ 
                error: 'Invalid group data. Name and contactIds are required.' 
            }, { status: 400 });
        }

        if (group.contactIds.length === 0) {
            return NextResponse.json({ 
                error: 'Group must contain at least one contact' 
            }, { status: 400 });
        }

        // Create new group object
        const newGroup = {
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: group.name.trim(),
            type: group.type || 'custom',
            description: group.description?.trim() || '',
            contactIds: [...new Set(group.contactIds)], // Remove duplicates
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            eventData: group.eventData || null
        };

        // Get existing groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        let existingGroups = [];
        if (groupsDoc.exists) {
            existingGroups = groupsDoc.data().groups || [];
        }

        // Check for duplicate group names
        if (existingGroups.some(g => g.name.toLowerCase() === newGroup.name.toLowerCase())) {
            return NextResponse.json({ 
                error: 'A group with this name already exists' 
            }, { status: 409 });
        }

        // Add new group
        const updatedGroups = [...existingGroups, newGroup];

        // Save to database
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length
        }, { merge: true });

        console.log('✅ Contact group created:', {
            userId,
            groupId: newGroup.id,
            groupName: newGroup.name,
            contactCount: newGroup.contactIds.length
        });

        return NextResponse.json({
            success: true,
            groupId: newGroup.id,
            group: newGroup,
            message: 'Group created successfully'
        });

    } catch (error) {
        console.error('❌ Error creating contact group:', error);
        return NextResponse.json({ 
            error: 'Failed to create contact group' 
        }, { status: 500 });
    }
}

// ✅ PUT - Update existing contact group
export async function PUT(request) {
    try {
        console.log('✏️ PUT /api/user/contacts/groups - Updating contact group');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const { action, group } = body;

        if (action !== 'update') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (!group || !group.id) {
            return NextResponse.json({ 
                error: 'Group ID is required for update' 
            }, { status: 400 });
        }

        // Get existing groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        if (!groupsDoc.exists) {
            return NextResponse.json({ 
                error: 'No groups found for user' 
            }, { status: 404 });
        }

        const existingGroups = groupsDoc.data().groups || [];
        const groupIndex = existingGroups.findIndex(g => g.id === group.id);

        if (groupIndex === -1) {
            return NextResponse.json({ 
                error: 'Group not found' 
            }, { status: 404 });
        }

        // Update group
        const updatedGroup = {
            ...existingGroups[groupIndex],
            ...group,
            lastModified: new Date().toISOString()
        };

        // Replace in array
        const updatedGroups = [...existingGroups];
        updatedGroups[groupIndex] = updatedGroup;

        // Save to database
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length
        }, { merge: true });

        console.log('✅ Contact group updated:', {
            userId,
            groupId: group.id,
            groupName: updatedGroup.name
        });

        return NextResponse.json({
            success: true,
            group: updatedGroup,
            message: 'Group updated successfully'
        });

    } catch (error) {
        console.error('❌ Error updating contact group:', error);
        return NextResponse.json({ 
            error: 'Failed to update contact group' 
        }, { status: 500 });
    }
}