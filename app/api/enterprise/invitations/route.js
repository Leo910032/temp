// app/api/enterprise/invitations/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseInvitationService } from '@/lib/services/enterpriseInvitationService';
import { EnterprisePermissionService } from '@/lib/services/enterprisePermissionService';

export async function POST(request) {
    try {
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const { teamId, invitedEmail, role } = await request.json();
        if (!teamId || !invitedEmail || !role) {
            return NextResponse.json({ error: 'teamId, invitedEmail, and role are required' }, { status: 400 });
        }

        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);
        // Add permission check here: can user invite to this team?

        const invitation = await EnterpriseInvitationService.createInvitation(
            decodedToken.uid,
            userContext.organizationId,
            teamId,
            invitedEmail,
            role
        );
        
        return NextResponse.json(invitation, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: error.message.includes('exists') ? 409 : 500 });
    }
}