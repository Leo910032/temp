// lib/services/enterpriseInvitationService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { enterpriseConfig } from '../config/enterpriseConfig';
import { EnterpriseSecurityService } from './enterpriseSecurityService';
import { DEFAULT_PERMISSIONS_BY_ROLE, INVITATION_STATUS } from '../constants/enterpriseConstants';
import crypto from 'crypto';

export class EnterpriseInvitationService {
    
  static _generateInviteCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  static async createInvitation(inviterId, organizationId, teamId, invitedEmail, role) {
    // Check for existing pending invitation
    const existingInviteQuery = await adminDb.collection('TeamInvitations')
      .where('teamId', '==', teamId)
      .where('invitedEmail', '==', invitedEmail.toLowerCase())
      .where('status', '==', INVITATION_STATUS.PENDING)
      .get();
    if (!existingInviteQuery.empty) {
      throw new Error('Pending invitation already exists for this email');
    }

    const inviteCode = this._generateInviteCode();
    const expiresAt = new Date(Date.now() + enterpriseConfig.invitations.expirationDays * 24 * 60 * 60 * 1000);
    const permissions = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.employee;

    const newInvitation = {
      organizationId,
      teamId,
      invitedEmail: invitedEmail.toLowerCase(),
      invitedBy: inviterId,
      inviteCode,
      role,
      permissions,
      status: INVITATION_STATUS.PENDING,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    };

    const docRef = await adminDb.collection('TeamInvitations').add(newInvitation);

    // In a real app, you would trigger an email here.
    console.log(`📧 Sending invitation email to ${invitedEmail} with code ${inviteCode}`);

    await EnterpriseSecurityService.logAuditEvent({
        userId: inviterId,
        organizationId,
        action: 'invitation_sent',
        resourceType: 'invitation',
        resourceId: docRef.id,
        details: { invitedEmail, teamId, role }
    });
    
    return { id: docRef.id, ...newInvitation };
  }

  static async verifyInvitation(email, code) {
    const inviteQuery = await adminDb.collection('TeamInvitations')
      .where('invitedEmail', '==', email.toLowerCase())
      .where('inviteCode', '==', code.toUpperCase())
      .limit(1)
      .get();
    
    if (inviteQuery.empty) return null;
    
    const inviteDoc = inviteQuery.docs[0];
    const invitation = { id: inviteDoc.id, ...inviteDoc.data() };

    if (invitation.status !== INVITATION_STATUS.PENDING) {
        throw new Error(`Invitation is no longer valid. Status: ${invitation.status}`);
    }
    if (new Date() > invitation.expiresAt.toDate()) {
        await inviteDoc.ref.update({ status: INVITATION_STATUS.EXPIRED });
        throw new Error('Invitation has expired');
    }

    return invitation;
  }

  static async acceptInvitation(accepterId, invitationId) {
    const inviteRef = adminDb.collection('TeamInvitations').doc(invitationId);
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) throw new Error('Invitation not found.');

    const invitation = inviteDoc.data();
    const { organizationId, teamId, role, permissions } = invitation;

    // Use a transaction to ensure atomicity
    await adminDb.runTransaction(async (transaction) => {
        const orgRef = adminDb.collection('Organizations').doc(organizationId);
        const userRef = adminDb.collection('AccountData').doc(accepterId);

        // Add user to team in Organization doc
        transaction.update(orgRef, {
            [`teams.${teamId}.members.${accepterId}`]: {
                role,
                joinedAt: FieldValue.serverTimestamp(),
                invitedBy: invitation.invitedBy,
                permissions
            }
        });

        // Add team to user's profile
        transaction.update(userRef, {
            'enterprise.organizationId': organizationId,
            [`enterprise.teams.${teamId}`]: {
                role,
                permissions,
                joinedAt: FieldValue.serverTimestamp()
            }
        });
        
        // Update invitation status
        transaction.update(inviteRef, {
            status: INVITATION_STATUS.ACCEPTED,
            acceptedAt: FieldValue.serverTimestamp(),
            acceptedBy: accepterId
        });
    });

    await EnterpriseSecurityService.logAuditEvent({
        userId: accepterId,
        organizationId,
        action: 'invitation_accepted',
        resourceType: 'invitation',
        resourceId: invitationId,
        details: { teamId, role }
    });
  }
}