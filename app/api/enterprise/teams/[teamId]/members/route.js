// app/api/enterprise/teams/[teamId]/members/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseTeamService } from '@/lib/services/enterpriseTeamService';
import { EnterprisePermissionService } from '@/lib/services/enterprisePermissionService';
import { EnterpriseOrganizationService } from '@/lib/services/enterpriseOrganizationService';

export async function POST(request, { params }) {
    try {
        const { teamId } = params;
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const { memberUserId, role } = await request.json();
        if (!memberUserId || !role) return NextResponse.json({ error: 'memberUserId and role are required' }, { status: 400 });

        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);
        const org = await EnterpriseOrganizationService.getOrganizationDetails(userContext.organizationId);
        const teamData = org.teams?.[teamId];
        if (!teamData) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        
        if (!EnterprisePermissionService.canManageTeamMembers(userContext, {id: teamId, ...teamData})) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        await EnterpriseTeamService.addMemberToTeam(decodedToken.uid, userContext.organizationId, teamId, memberUserId, role);

        return NextResponse.json({ success: true, message: 'Member added' }, { status: 201 });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE for removing a member would be in a file like /members/[memberId]/route.js
// but for simplicity, we can add it here expecting the memberId from the body.
export async function DELETE(request, { params }) {
     try {
        const { teamId } = params;
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const { memberIdToRemove } = await request.json();
        if (!memberIdToRemove) return NextResponse.json({ error: 'memberIdToRemove is required' }, { status: 400 });

        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);
        const org = await EnterpriseOrganizationService.getOrganizationDetails(userContext.organizationId);
        const teamData = org.teams?.[teamId];
        if (!teamData) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        
        if (!EnterprisePermissionService.canManageTeamMembers(userContext, {id: teamId, ...teamData})) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        
        await EnterpriseTeamService.removeMemberFromTeam(decodedToken.uid, userContext.organizationId, teamId, memberIdToRemove);
        
        return NextResponse.json({ success: true, message: 'Member removed' });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}