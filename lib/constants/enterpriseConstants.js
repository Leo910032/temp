// lib/constants/enterpriseConstants.js

/**
 * Defines the roles within an organization.
 */
export const ORGANIZATION_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
};

/**
 * Defines the roles within a specific team.
 */
export const TEAM_ROLES = {
  MANAGER: 'manager',
  TEAM_LEAD: 'team_lead',
  EMPLOYEE: 'employee'
};

/**
 * Defines all possible granular permissions for a user.
 */
export const PERMISSIONS = {
  CAN_VIEW_ALL_TEAM_CONTACTS: 'canViewAllTeamContacts',
  CAN_EDIT_TEAM_CONTACTS: 'canEditTeamContacts',
  CAN_SHARE_CONTACTS_WITH_TEAM: 'canShareContactsWithTeam',
  CAN_EXPORT_TEAM_DATA: 'canExportTeamData',
  CAN_INVITE_TEAM_MEMBERS: 'canInviteTeamMembers'
};

/**
 * Statuses for team invitations.
 */
export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

/**
 * Default permissions for each team role.
 */
export const DEFAULT_PERMISSIONS_BY_ROLE = {
  [TEAM_ROLES.EMPLOYEE]: {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: false,
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: false,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: false,
  },
  [TEAM_ROLES.TEAM_LEAD]: {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: true,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: true,
  },
  [TEAM_ROLES.MANAGER]: {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: true,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: true,
  }
};