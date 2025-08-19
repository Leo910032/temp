// lib/services/enterpriseSecurityService.js
import { adminDb } from '@/lib/firebaseAdmin';

export class EnterpriseSecurityService {

  static async logAuditEvent(eventDetails) {
    try {
      if (!eventDetails.userId || !eventDetails.action) {
        console.warn('Audit log event missing required fields (userId, action).');
        return;
      }
      const auditLog = {
        timestamp: new Date().toISOString(),
        severity: 'info',
        ...eventDetails,
      };
      await adminDb.collection('AuditLogs').add(auditLog);
    } catch (error) {
      console.error('CRITICAL: Failed to log audit event.', error);
    }
  }
}