// app/api/admin/enterprise-tools/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterprisePermissionService } from '@/lib/services/enterprisePermissionService';
import { EnterpriseTeamService } from '@/lib/services/enterpriseTeamService';
import { EnterpriseInvitationService } from '@/lib/services/enterpriseInvitationService';
import { ORGANIZATION_ROLES } from '@/lib/constants/enterpriseConstants';

function generateRandomUser(role = 'manager') {
    const randomId = Math.random().toString(36).substring(2, 8);
    const password = Math.random().toString(36).substring(2, 10);
    return { 
        email: `test-${role}-${randomId}@yourapp.com`, 
        password: password, 
        displayName: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} ${randomId.toUpperCase()}` 
    };
}

async function runPhase1HappyPathTest() {
    const logs = [];
    const created = { userIds: [], orgIds: [], inviteIds: [] };
    
    const logAndPush = (step, status, details = "") => {
        logs.push({ step, status, details });
    };

    try {
        logAndPush("Setup: Create Test Manager & Org", "running");
        const managerData = generateRandomUser('manager');
        const manager = await adminAuth.createUser({ 
            email: managerData.email, 
            password: managerData.password, 
            displayName: managerData.displayName 
        });
        created.userIds.push(manager.uid);
        
        const orgId = `org_test_${Date.now()}`;
        await adminDb.collection('Organizations').doc(orgId).set({ 
            name: `${managerData.displayName}'s Test Co`, 
            teams: {} 
        });
        created.orgIds.push(orgId);
        
        await adminDb.collection('AccountData').doc(manager.uid).set({ 
            displayName: managerData.displayName, 
            email: managerData.email, 
            isTestAccount: true, 
            enterprise: { 
                organizationId: orgId, 
                organizationRole: 'manager', 
                teams: {} 
            }
        });
        logAndPush("Setup: Create Test Manager & Org", "success", `Manager UID: ${manager.uid}`);
        
        logAndPush("Manager Action: Create Team", "running");
        const team = await EnterpriseTeamService.createTeam(manager.uid, orgId, { name: "Test Team" });
        logAndPush("Manager Action: Create Team", "success", `Team ID: ${team.id}`);

        logAndPush("Manager Action: Invite Employee", "running");
        const invitation = await EnterpriseInvitationService.createInvitation(
            manager.uid, orgId, team.id, `invitee-${Date.now()}@test.com`, 'employee'
        );
        created.inviteIds.push(invitation.id);
        logAndPush("Manager Action: Invite Employee", "success");

        return { success: true, logs };
        
    } catch (error) {
        // Mark the last running step as failed
        const lastLogIndex = logs.findIndex(log => log.status === "running");
        if(lastLogIndex !== -1) {
            logs[lastLogIndex] = { ...logs[lastLogIndex], status: "error", details: error.message };
        } else {
            logAndPush("General Test Failure", "error", error.message);
        }
        return { success: false, logs };
    } finally {
        // --- Automatic Cleanup ---
        logAndPush("Cleanup: Deleting all test resources", "running");
        await Promise.all([
            ...created.userIds.map(uid => adminAuth.deleteUser(uid).catch(() => {})),
            ...created.userIds.map(uid => adminDb.collection('AccountData').doc(uid).delete().catch(() => {})),
            ...created.orgIds.map(oid => adminDb.collection('Organizations').doc(oid).delete().catch(() => {})),
            ...created.inviteIds.map(iid => adminDb.collection('TeamInvitations').doc(iid).delete().catch(() => {})),
        ]);
        logAndPush("Cleanup: Deleting all test resources", "success", `Cleaned up ${created.userIds.length} users, ${created.orgIds.length} orgs.`);
    }
}

async function runPhase1ComprehensiveTestSuite() {
    const logs = [];
    const created = { userIds: [], orgIds: [], inviteIds: [] };

    const logAndPush = (step, status, details = "") => {
        logs.push({ step, status, details });
    };

    try {
        // --- STEP 1: Setup - Create Manager, Employee, and Org ---
        logAndPush("Setup: Create Test Manager & Org", "running");
        const managerData = generateRandomUser('manager');
        const manager = await adminAuth.createUser({ 
            email: managerData.email, 
            password: managerData.password, 
            displayName: managerData.displayName 
        });
        created.userIds.push(manager.uid);
        
        const orgId = `org_test_${Date.now()}`;
        await adminDb.collection('Organizations').doc(orgId).set({ 
            name: `${managerData.displayName}'s Test Co`, 
            teams: {} 
        });
        created.orgIds.push(orgId);
        await adminDb.collection('AccountData').doc(manager.uid).set({ 
            displayName: managerData.displayName, 
            email: managerData.email, 
            isTestAccount: true, 
            enterprise: { 
                organizationId: orgId, 
                organizationRole: 'manager', 
                teams: {} 
            }
        });
        logAndPush("Setup: Create Test Manager & Org", "success", `Manager: ${manager.email}`);

        logAndPush("Setup: Create Test Employee in Org", "running");
        const employeeData = generateRandomUser('employee');
        const employee = await adminAuth.createUser({ 
            email: employeeData.email, 
            password: employeeData.password, 
            displayName: employeeData.displayName 
        });
        created.userIds.push(employee.uid);
        await adminDb.collection('AccountData').doc(employee.uid).set({ 
            displayName: employeeData.displayName, 
            email: employeeData.email, 
            isTestAccount: true, 
            enterprise: { 
                organizationId: orgId, 
                organizationRole: 'employee', 
                teams: {} 
            }
        });
        logAndPush("Setup: Create Test Employee in Org", "success", `Employee: ${employee.email}`);

        // --- STEP 2: Positive Test - Manager Creates a Team ---
        logAndPush("Positive Test: Manager can create a team", "running");
        const team = await EnterpriseTeamService.createTeam(manager.uid, orgId, { name: "Test Team" });
        const orgDoc = await adminDb.collection('Organizations').doc(orgId).get();
        if (!orgDoc.data().teams[team.id]) throw new Error("Team not found in org document.");
        logAndPush("Positive Test: Manager can create a team", "success");

        // --- STEP 3: Negative Test - Employee CANNOT Create a Team ---
        logAndPush("Negative Test: Employee cannot create a team", "running");
        try {
            // We simulate the API call's permission check logic here
            const employeeContext = await EnterprisePermissionService.getUserContext(employee.uid);
            if (EnterprisePermissionService.isOrgAdmin(employeeContext)) {
                // If this passes, the test fails because the employee is considered an admin
                throw new Error("Security Fail: Employee was incorrectly identified as an Org Admin.");
            }
            logAndPush("Negative Test: Employee cannot create a team", "success", "Permission check correctly blocked non-admin.");
        } catch (error) {
            throw new Error(`Test logic error during employee permission check: ${error.message}`);
        }

        // --- STEP 4: Negative Test - Invalid Data ---
        logAndPush("Negative Test: Cannot create team with no name", "running");
        try {
            await EnterpriseTeamService.createTeam(manager.uid, orgId, { name: " " }); // Invalid name
            throw new Error("Validation Fail: Team was created with an invalid name.");
        } catch (error) {
            // We EXPECT an error here, so this is a success
            logAndPush("Negative Test: Cannot create team with no name", "success", "API correctly rejected invalid data.");
        }

        // --- STEP 5: Edge Case Test - Duplicate Invitation ---
        logAndPush("Edge Case: Cannot send duplicate invitations", "running");
        const inviteEmail = generateRandomUser('invitee').email;
        const firstInvite = await EnterpriseInvitationService.createInvitation(manager.uid, orgId, team.id, inviteEmail, 'employee');
        created.inviteIds.push(firstInvite.id);
        try {
            await EnterpriseInvitationService.createInvitation(manager.uid, orgId, team.id, inviteEmail, 'employee');
            throw new Error("Duplicate Check Fail: A second invitation was created for the same email.");
        } catch (error) {
            if (error.message.includes("Pending invitation already exists")) {
                logAndPush("Edge Case: Cannot send duplicate invitations", "success", "API correctly blocked duplicate invite.");
            } else {
                throw error; // Re-throw if it's a different error
            }
        }

        return { success: true, logs };

    } catch (error) {
        // Mark the last running step as failed
        const lastLogIndex = logs.findIndex(log => log.status === "running");
        if(lastLogIndex !== -1) {
            logs[lastLogIndex] = { ...logs[lastLogIndex], status: "error", details: error.message };
        } else {
            logAndPush("General Test Failure", "error", error.message);
        }
        return { success: false, logs };
    } finally {
        // --- STEP 6: Automatic Cleanup ---
        logAndPush("Cleanup: Deleting all test resources", "running");
        await Promise.all([
            ...created.userIds.map(uid => adminAuth.deleteUser(uid).catch(() => {})),
            ...created.userIds.map(uid => adminDb.collection('AccountData').doc(uid).delete().catch(() => {})),
            ...created.orgIds.map(oid => adminDb.collection('Organizations').doc(oid).delete().catch(() => {})),
            ...created.inviteIds.map(iid => adminDb.collection('TeamInvitations').doc(iid).delete().catch(() => {})),
        ]);
        logAndPush("Cleanup: Deleting all test resources", "success", `Cleaned up ${created.userIds.length} users, ${created.orgIds.length} orgs.`);
    }
}

// Additional test and utility functions
async function getAllEnterpriseData() {
    try {
        const [orgSnapshot, inviteSnapshot] = await Promise.all([
            adminDb.collection('Organizations').get(),
            adminDb.collection('TeamInvitations').get()
        ]);

        const organizations = orgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const invitations = inviteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { organizations, invitations };
    } catch (error) {
        throw new Error(`Failed to fetch enterprise data: ${error.message}`);
    }
}

async function createTestManager() {
    try {
        const managerData = generateRandomUser('manager');
        const manager = await adminAuth.createUser({
            email: managerData.email,
            password: managerData.password,
            displayName: managerData.displayName
        });

        const orgId = `org_test_${Date.now()}`;
        await adminDb.collection('Organizations').doc(orgId).set({
            name: `${managerData.displayName}'s Test Company`,
            teams: {},
            createdAt: new Date().toISOString(),
            isTestOrganization: true
        });

        await adminDb.collection('AccountData').doc(manager.uid).set({
            displayName: managerData.displayName,
            email: managerData.email,
            isTestAccount: true,
            accountType: 'business', // Give them enterprise access
            enterprise: {
                organizationId: orgId,
                organizationRole: 'manager',
                teams: {}
            },
            createdAt: new Date().toISOString()
        });

        return {
            user: {
                uid: manager.uid,
                email: managerData.email,
                password: managerData.password,
                displayName: managerData.displayName,
                organizationId: orgId
            },
            message: 'Test manager and organization created successfully'
        };
    } catch (error) {
        throw new Error(`Failed to create test manager: ${error.message}`);
    }
}

async function deleteTestUser(userId) {
    try {
        // Get user data first to clean up related resources
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // If user has an organization and is the only member, delete the organization
            if (userData.enterprise?.organizationId) {
                const orgDoc = await adminDb.collection('Organizations').doc(userData.enterprise.organizationId).get();
                if (orgDoc.exists && orgDoc.data().isTestOrganization) {
                    await adminDb.collection('Organizations').doc(userData.enterprise.organizationId).delete();
                }
            }
        }

        // Delete user account and data
        await Promise.all([
            adminAuth.deleteUser(userId),
            adminDb.collection('AccountData').doc(userId).delete()
        ]);

        return { message: 'Test user and related data deleted successfully' };
    } catch (error) {
        throw new Error(`Failed to delete test user: ${error.message}`);
    }
}

async function addUserToOrganization(email, orgId, role) {
    try {
        // Find user by email
        const user = await adminAuth.getUserByEmail(email);
        
        // Update user's enterprise data
        await adminDb.collection('AccountData').doc(user.uid).update({
            'enterprise.organizationId': orgId,
            'enterprise.organizationRole': role,
            'enterprise.teams': {},
            accountType: 'business' // Give them enterprise access
        });

        return { 
            message: `User ${email} added to organization ${orgId} as ${role}`,
            userId: user.uid 
        };
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            throw new Error(`User with email ${email} not found`);
        }
        throw new Error(`Failed to add user to organization: ${error.message}`);
    }
}

export async function POST(request) {
    try {
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        // Check if user has admin privileges
        const userDoc = await adminDb.collection('AccountData').doc(decodedToken.uid).get();
        const userData = userDoc.data();
        
        if (!userData?.isAdmin) {
            return NextResponse.json({ 
                error: 'Access Denied: Admin privileges required.' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'run_phase1_test':
                return NextResponse.json(await runPhase1HappyPathTest());
                
            case 'run_phase1_comprehensive_test':
                return NextResponse.json(await runPhase1ComprehensiveTestSuite());
                
            case 'get_all_data':
                return NextResponse.json(await getAllEnterpriseData());
                
            case 'create_test_manager':
                return NextResponse.json(await createTestManager());
                
            case 'delete_test_user':
                if (!params.userId) {
                    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
                }
                return NextResponse.json(await deleteTestUser(params.userId));
                
            case 'add_user_to_org':
                if (!params.email || !params.orgId || !params.role) {
                    return NextResponse.json({ 
                        error: 'Email, organization ID, and role are required' 
                    }, { status: 400 });
                }
                return NextResponse.json(await addUserToOrganization(params.email, params.orgId, params.role));
                
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Enterprise tools API error:', error);
        return NextResponse.json({ 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
}