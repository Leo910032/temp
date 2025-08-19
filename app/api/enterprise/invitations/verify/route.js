// app/api/enterprise/invitations/verify/route.js
import { NextResponse } from 'next/server';
import { EnterpriseInvitationService } from '@/lib/services/enterpriseInvitationService';

export async function POST(request) {
    try {
        const { email, code } = await request.json();
        if (!email || !code) return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });

        const invitation = await EnterpriseInvitationService.verifyInvitation(email, code);

        if (!invitation) {
            return NextResponse.json({ valid: false, error: 'Invalid code or email' }, { status: 404 });
        }

        return NextResponse.json({ valid: true, invitation });
    } catch (error) {
        return NextResponse.json({ valid: false, error: error.message }, { status: 410 });
    }
}