// lib/services/enterprisePermissionService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { ORGANIZATION_ROLES } from '@/lib/constants/enterpriseConstants';

export class EnterprisePermissionService {

  static async getUserContext(userId) {
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) throw new Error('User not found');
    const userData = userDoc.data();
    return {
      userId,
      userData,
      isSystemAdmin: userData.isAdmin === true,
      enterprise: userData.enterprise || {},
      organizationId: userData.enterprise?.organizationId,
      organizationRole: userData.enterprise?.organizationRole,
      teams: userData.enterprise?.teams || {}
    };
  }
  
  static isOrgAdmin(userContext) {
    return [ORGANIZATION_ROLES.OWNER, ORGANIZATION_ROLES.MANAGER].includes(userContext.organizationRole);
  }

  static canManageTeam(userContext, teamData) {
    if (this.isOrgAdmin(userContext)) return true;
    const userTeamRole = userContext.teams[teamData.id]?.role;
    return teamData.managerId === userContext.userId || userTeamRole === 'manager';
  }
  
  static canManageTeamMembers(userContext, teamData) {
    if (this.isOrgAdmin(userContext)) return true;
    const userTeamData = userContext.teams[teamData.id];
    if (!userTeamData) return false;
    return userTeamData.role === 'manager' || userTeamData.role === 'team_lead' || userTeamData.permissions?.canInviteTeamMembers;
  }

  static canViewAuditLogs(userContext) {
    return this.isOrgAdmin(userContext);
  }
}