// app/api/user/contacts/groups/auto-generate/route.js

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// Helper function to create groups
const createGroups = (contacts, options) => {
    const groups = {};

    // Group by company
    if (options.groupByCompany) {
        contacts.forEach(contact => {
            if (contact.company) {
                const companyName = contact.company.trim();
                if (!groups[companyName]) {
                    groups[companyName] = { name: companyName, type: 'company', contactIds: new Set() };
                }
                groups[companyName].contactIds.add(contact.id);
            }
        });
    }
    
    // Group by location (simplified example, can be made more complex)
    if (options.groupByLocation) {
        contacts.forEach(contact => {
            if (contact.location?.city) {
                const locationName = `${contact.location.city}, ${contact.location.country || ''}`.trim();
                if (!groups[locationName]) {
                    groups[locationName] = { name: locationName, type: 'auto', contactIds: new Set() };
                }
                groups[locationName].contactIds.add(contact.id);
            }
        });
    }

    // Group by events
    if (options.groupByEvents) {
        contacts.forEach(contact => {
            if (contact.eventInfo?.eventName) {
                const eventName = contact.eventInfo.eventName.trim();
                if (!groups[eventName]) {
                    groups[eventName] = { name: eventName, type: 'event', contactIds: new Set() };
                }
                groups[eventName].contactIds.add(contact.id);
            }
        });
    }

    // Filter out small groups and format the output
    return Object.values(groups)
        .filter(group => group.contactIds.size >= options.minGroupSize)
        .map(group => ({
            ...group,
            contactIds: Array.from(group.contactIds),
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        }))
        .slice(0, options.maxGroups);
};


// The main POST handler for this route
export async function POST(request) {
    try {
        console.log('🤖 POST /api/user/contacts/groups/auto-generate - Starting auto-generation');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const options = body.options || {};
        
        // --- 1. Fetch all user contacts ---
        const contactsRef = adminDb.collection('Contacts').doc(userId);
        const contactsDoc = await contactsRef.get();
        if (!contactsDoc.exists) {
            return NextResponse.json({ success: true, groupsCreated: 0, message: 'No contacts to group.' });
        }
        const allContacts = contactsDoc.data().contacts || [];
        
        // --- 2. Generate new groups based on contacts and options ---
       // const newGroups = createGroups(allContacts, options);
        if (newGroups.length === 0) {
            return NextResponse.json({ success: true, groupsCreated: 0, message: 'No new groups could be generated.' });
        }

        // --- 3. Fetch existing groups to avoid duplicates ---
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();
        let existingGroups = [];
        if (groupsDoc.exists) {
            existingGroups = groupsDoc.data().groups || [];
        }
        const existingGroupNames = new Set(existingGroups.map(g => g.name.toLowerCase()));

        // --- 4. Filter out any new groups that already exist by name ---
        const uniqueNewGroups = newGroups.filter(g => !existingGroupNames.has(g.name.toLowerCase()));
        if (uniqueNewGroups.length === 0) {
            return NextResponse.json({ success: true, groupsCreated: 0, message: 'All potential groups already exist.' });
        }

        // --- 5. Merge and save ---
        const updatedGroups = [...existingGroups, ...uniqueNewGroups];
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length,
        }, { merge: true });

        console.log('✅ Auto-generation complete:', { userId, groupsCreated: uniqueNewGroups.length });

        return NextResponse.json({
            success: true,
            groupsCreated: uniqueNewGroups.length,
            newGroups: uniqueNewGroups,
            message: `Successfully generated ${uniqueNewGroups.length} new groups.`
        });

    } catch (error) {
        console.error('❌ Error in auto-group generation:', error);
        return NextResponse.json({ 
            error: 'Failed to auto-generate groups',
            details: error.message 
        }, { status: 500 });
    }
}