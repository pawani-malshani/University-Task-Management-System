// Comprehensive Test Suite for User Scoping, Team Project Collaboration & Admin Panels
const http = require('http');
const { startServer } = require('./server');

let targetPort = 5000;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: targetPort,
      path: `/api${path}`,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('🚀 Starting Verification of Project Scoping, Team Collaboration & Admin Panels...\n');

  let serverInstance = null;
  try {
    serverInstance = await startServer(0);
    targetPort = serverInstance.address().port;
  } catch (e) {
    console.error('Failed to start in-process server:', e.message);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request('GET', '/health');
    assert(health.status === 200, 'Backend API health check responds with 200 OK');

    // 2. Register Member 1 (Alice)
    const aliceEmail = `alice_${Date.now()}@example.com`;
    const regAlice = await request('POST', '/auth/register', {
      name: 'Alice Developer',
      email: aliceEmail,
      password: 'password123'
    });
    assert(regAlice.status === 201, 'Alice registers as a standard MEMBER');
    const aliceToken = regAlice.data?.data?.token;
    const aliceId = regAlice.data?.data?.user?.id;

    // 3. Register Member 2 (Bob)
    const bobEmail = `bob_${Date.now()}@example.com`;
    const regBob = await request('POST', '/auth/register', {
      name: 'Bob Designer',
      email: bobEmail,
      password: 'password123'
    });
    assert(regBob.status === 201, 'Bob registers as a standard MEMBER');
    const bobToken = regBob.data?.data?.token;
    const bobId = regBob.data?.data?.user?.id;

    // 4. Alice creates a private project
    const projRes = await request('POST', '/projects', {
      name: 'Alice Top Secret Project',
      description: 'Confidential project by Alice'
    }, aliceToken);
    assert(projRes.status === 201, 'Alice creates her private project');
    const aliceProjId = projRes.data?.data?.id;

    // 5. Test Scoping: Bob should NOT see Alice\'s project!
    const bobProjectsInitial = await request('GET', '/projects', null, bobToken);
    const bobCanSeeAliceProj = bobProjectsInitial.data?.data?.some(p => String(p.id) === String(aliceProjId));
    assert(!bobCanSeeAliceProj, 'Bob CANNOT view Alice\'s project (strict user project isolation)');

    // 6. Test Team Collaboration: Alice adds Bob as a collaborator to the same project!
    const addMemberRes = await request('POST', `/projects/${aliceProjId}/members`, {
      userId: bobId,
      name: 'Bob Designer',
      email: bobEmail,
      role: 'MEMBER'
    }, aliceToken);
    assert(addMemberRes.status === 200, 'Alice invites Bob to collaborate on her project');

    // 7. Verify Bob can now access and view the same project!
    const bobProjectsAfter = await request('GET', '/projects', null, bobToken);
    const bobSeesSharedProj = bobProjectsAfter.data?.data?.some(p => String(p.id) === String(aliceProjId));
    assert(bobSeesSharedProj, 'Bob can now view and work on the shared project!');

    // 8. Create tasks:
    // Alice creates a task assigned to herself
    const aliceTask = await request('POST', '/tasks', {
      title: 'Alice Backend API Task',
      description: 'Implement secure endpoints',
      status: 'TODO',
      priority: 'HIGH',
      project_id: aliceProjId,
      user_id: aliceId
    }, aliceToken);
    assert(aliceTask.status === 201, 'Alice creates a task assigned to herself');

    // Alice creates a task assigned to Bob in the shared project
    const bobTask = await request('POST', '/tasks', {
      title: 'Bob UI Design Task',
      description: 'Design Figma components',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      project_id: aliceProjId,
      user_id: bobId
    }, aliceToken);
    assert(bobTask.status === 201, 'Alice assigns a task to Bob in the shared project');

    // 9. Test Task Scoping: "make only user can their tasks only"
    // When Bob queries GET /tasks (default scope: my_tasks), Bob ONLY sees tasks assigned to him!
    const bobTasksDefault = await request('GET', '/tasks', null, bobToken);
    const bobSeesOnlyHisTasks = bobTasksDefault.data?.data?.every(t => String(t.user_id) === String(bobId));
    const bobHasHisTask = bobTasksDefault.data?.data?.some(t => t.title === 'Bob UI Design Task');
    assert(bobSeesOnlyHisTasks && bobHasHisTask, 'Bob only sees his own assigned tasks by default (My Tasks isolation)');

    // When Bob queries with scope=all_shared, he can see all collaboration tasks in the shared project
    const bobTasksShared = await request('GET', `/tasks?scope=all_shared&projectId=${aliceProjId}`, null, bobToken);
    const sharedCount = bobTasksShared.data?.data?.length;
    assert(sharedCount >= 2, 'In shared project view, team members can collaborate on all project tasks');

    // 10. Test Admin Governance & Panels:
    // Bootstrap Admin Login
    const adminLoginRes = await request('POST', '/auth/login', {
      email: 'admin@taskflow.local',
      password: 'Admin@123456'
    });
    assert(adminLoginRes.status === 200, 'Admin logs into Admin Governance Center');
    const adminToken = adminLoginRes.data?.data?.token;

    // Admin Panel 1: Stats & Overview
    const adminStats = await request('GET', '/admin/stats', null, adminToken);
    assert(adminStats.status === 200 && adminStats.data?.data?.users?.total >= 2, 'Admin Panel Overview stats work');

    // Admin Panel 2: User Management (List users)
    const adminUsers = await request('GET', '/admin/users', null, adminToken);
    assert(adminUsers.status === 200 && Array.isArray(adminUsers.data?.data), 'Admin Panel User Management list works');

    // Admin Panel 2b: Update User Role (Promote Bob to ADMIN)
    const promoteBob = await request('PATCH', `/admin/users/${bobId}/role`, { role: 'ADMIN' }, adminToken);
    assert(promoteBob.status === 200 && promoteBob.data?.data?.role === 'ADMIN', 'Admin Panel: update user role (promote to ADMIN) works');

    // Demote Bob back to MEMBER
    const demoteBob = await request('PATCH', `/admin/users/${bobId}/role`, { role: 'MEMBER' }, adminToken);
    assert(demoteBob.status === 200 && demoteBob.data?.data?.role === 'MEMBER', 'Admin Panel: update user role (revert to MEMBER) works');

    // Admin Panel 2c: Update User Status (Suspend & Reactivate)
    const suspendBob = await request('PATCH', `/admin/users/${bobId}/status`, { isActive: false }, adminToken);
    assert(suspendBob.status === 200 && suspendBob.data?.data?.is_active === false, 'Admin Panel: suspend user account works');

    const activateBob = await request('PATCH', `/admin/users/${bobId}/status`, { isActive: true }, adminToken);
    assert(activateBob.status === 200 && activateBob.data?.data?.is_active === true, 'Admin Panel: reactivate user account works');

    // Admin Panel 3: Invitations Flow
    const inviteEmail = `newadmin_${Date.now()}@example.com`;
    const createInvite = await request('POST', '/admin/invitations', { email: inviteEmail }, adminToken);
    assert(createInvite.status === 201 && createInvite.data?.data?.rawToken, 'Admin Panel: create administrator invitation works');
    const inviteToken = createInvite.data?.data?.rawToken;
    const inviteId = createInvite.data?.data?.invite?.id;

    // Accept invitation as new admin
    const acceptInvite = await request('POST', '/auth/accept-invite', {
      inviteToken,
      name: 'Second Admin',
      password: 'AdminPassword@123'
    });
    assert(acceptInvite.status === 200 && acceptInvite.data?.data?.user?.role === 'ADMIN', 'Invited user accepts invitation and becomes Administrator');

    // Revoke an invitation
    const invite2 = await request('POST', '/admin/invitations', { email: `revoke_${Date.now()}@example.com` }, adminToken);
    const deleteInviteRes = await request('DELETE', `/admin/invitations/${invite2.data?.data?.invite?.id}`, null, adminToken);
    assert(deleteInviteRes.status === 200, 'Admin Panel: revoke administrator invitation works');

    // Admin Panel 4: Security Audit Logs
    const auditLogs = await request('GET', '/admin/audit-logs', null, adminToken);
    assert(auditLogs.status === 200 && Array.isArray(auditLogs.data?.data) && auditLogs.data?.data?.length > 0, 'Admin Panel: Security Audit Logs records are tracked and visible');

    console.log(`\n==============================================`);
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==============================================\n`);

    if (serverInstance) serverInstance.close();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test execution error:', err);
    if (serverInstance) serverInstance.close();
    process.exit(1);
  }
}

run();
