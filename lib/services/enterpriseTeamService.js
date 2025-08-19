// lib/services/enterpriseTeamService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { EnterpriseSecurityService } from './enterpriseSecurityService';
import { DEFAULT_PERMISSIONS_BY_ROLE, TEAM_ROLES } from '../constants/enterpriseConstants';

export class EnterpriseTeamService {

  static async createTeam(creatorId, organizationId, teamDetails) {
    const { name, description = '', settings = {} } = teamDetails;

    const teamId = `team_${Date.now()}`;
    const managerPermissions = DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.MANAGER];
    const newTeamData = {
      name: name.trim(),
      description: description.trim(),
      managerId: creatorId,
      teamLeads: [],
      members: {
        [creatorId]: {
          role: TEAM_ROLES.MANAGER,
          joinedAt: FieldValue.serverTimestamp(),
          invitedBy: creatorId,
          permissions: managerPermissions
        }
      },
      settings: settings,
      createdAt: FieldValue.serverTimestamp(),
      lastModified: FieldValue.serverTimestamp()
    };

    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}`]: newTeamData });
    const userRef = adminDb.collection('AccountData').doc(creatorId);
    batch.update(userRef, {
      [`enterprise.teams.${teamId}`]: {
        role: TEAM_ROLES.MANAGER,
        joinedAt: FieldValue.serverTimestamp(),
        permissions: managerPermissions
      }
    });
    await batch.commit();

    await EnterpriseSecurityService.logAuditEvent({
      userId: creatorId,
      organizationId,
      action: 'team_created',
      resourceType: 'team',
      resourceId: teamId,
      details: { name: newTeamData.name }
    });

    return { id: teamId, ...newTeamData };
  }

  static async updateTeam(updaterId, organizationId, teamId, updates) {
    const allowedFields = ['name', 'description', 'settings', 'teamLeads'];
    const updateObject = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateObject[`teams.${teamId}.${key}`] = value;
      }
    }
    if (Object.keys(updateObject).length === 0) {
      throw new Error('No valid update fields provided.');
    }
    updateObject[`teams.${teamId}.lastModified`] = FieldValue.serverTimestamp();
    await adminDb.collection('Organizations').doc(organizationId).update(updateObject);

    await EnterpriseSecurityService.logAuditEvent({
      userId: updaterId,
      organizationId,
      action: 'team_updated',
      resourceType: 'team',
      resourceId: teamId,
      details: { updatedFields: Object.keys(updates) }
    });
    return updates;
  }

  static async deleteTeam(deleterId, organizationId, teamId) {
    const memberIds = await this.getTeamMemberIds(organizationId, teamId);
    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}`]: FieldValue.delete() });

    for (const memberId of memberIds) {
      const memberRef = adminDb.collection('AccountData').doc(memberId);
      batch.update(memberRef, { [`enterprise.teams.${teamId}`]: FieldValue.delete() });
    }
    await batch.commit();

    await EnterpriseSecurityService.logAuditEvent({
      userId: deleterId,
      organizationId,
      action: 'team_deleted',
      resourceType: 'team',
      resourceId: teamId,
      severity: 'warning'
    });
  }

  static async getTeamMemberIds(organizationId, teamId) {
    const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
    const teamData = orgDoc.data()?.teams?.[teamId];
    return teamData ? Object.keys(teamData.members || {}) : [];
  }

  static async addMemberToTeam(adderId, organizationId, teamId, newMemberId, role) {
    const permissions = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.employee;
    const memberData = {
        role,
        joinedAt: FieldValue.serverTimestamp(),
        invitedBy: adderId,
        permissions
    };

    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}.members.${newMemberId}`]: memberData });
    const userRef = adminDb.collection('AccountData').doc(newMemberId);
    batch.update(userRef, { [`enterprise.teams.${teamId}`]: { role, permissions } });
    await batch.commit();

    await EnterpriseSecurityService.logAuditEvent({
        userId: adderId,
        organizationId,
        action: 'member_added',
        resourceType: 'team',
        resourceId: teamId,
        details: { addedUserId: newMemberId, role }
    });
  }

  static async removeMemberFromTeam(removerId, organizationId, teamId, memberIdToRemove) {
    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}.members.${memberIdToRemove}`]: FieldValue.delete() });
    const userRef = adminDb.collection('AccountData').doc(memberIdToRemove);
    batch.update(userRef, { [`enterprise.teams.${teamId}`]: FieldValue.delete() });
    await batch.commit();

     await EnterpriseSecurityService.logAuditEvent({
        userId: removerId,
        organizationId,
        action: 'member_removed',
        resourceType: 'team',
        resourceId: teamId,
        details: { removedUserId: memberIdToRemove }
    });
  }
}