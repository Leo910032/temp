// app/api/enterprise/teams/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseTeamService } from '@/lib/services/enterpriseTeamService';
import { EnterprisePermissionService } from '@/lib/services/enterprisePermissionService';

export async function POST(request) {
    try {
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
        }
        const decodedToken = await adminAuth.verifyIdToken(token);

        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);

        // --- ROBUSTNESS CHECK ADDED HERE ---
        // First, check if the user is even part of an organization.
        if (!userContext.organizationId) {
            return NextResponse.json({ error: 'User is not part of any organization.' }, { status: 403 });
        }
        // Then, check if they have the right role.
        if (!EnterprisePermissionService.isOrgAdmin(userContext)) {
             return NextResponse.json({ error: 'Insufficient permissions to create a team.' }, { status: 403 });
        }
        // --- END OF NEW CHECK ---

        const body = await request.json();
        // Pass the organizationId from the now-validated userContext
        const newTeam = await EnterpriseTeamService.createTeam(decodedToken.uid, userContext.organizationId, body);

        return NextResponse.json(newTeam, { status: 201 });
    } catch (error) {
        console.error("❌ API Error in POST /api/enterprise/teams:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// You should add the GET method here as well for the UI to function
export async function GET(request) {
    try {
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);
        if (!userContext.organizationId) {
            // A user not in an org just has no teams. Return an empty list.
            return NextResponse.json({ teams: {}, organizationId: null, userRole: null });
        }

        const orgDoc = await adminDb.collection('Organizations').doc(userContext.organizationId).get();
        if (!orgDoc.exists) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const teamsData = orgDoc.data().teams || {};
        const accessibleTeams = {};
        
        for (const [teamId, teamData] of Object.entries(teamsData)) {
            accessibleTeams[teamId] = {
                ...teamData,
                id: teamId,
                memberCount: Object.keys(teamData.members || {}).length,
            };
        }

        return NextResponse.json({
            teams: accessibleTeams,
            organizationId: userContext.organizationId,
            userRole: userContext.organizationRole
        });
    } catch (error) {
        console.error("❌ API Error in GET /api/enterprise/teams:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}