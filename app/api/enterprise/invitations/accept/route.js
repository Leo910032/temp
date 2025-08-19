// app/api/enterprise/invitations/accept/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseInvitationService } from '@/lib/services/enterpriseInvitationService';

export async function POST(request) {
    try {
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await adminAuth.verifyIdToken(token);

        const { invitationId } = await request.json();
        if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });

        await EnterpriseInvitationService.acceptInvitation(decodedToken.uid, invitationId);

        return NextResponse.json({ success: true, message: 'Invitation accepted successfully.' });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}