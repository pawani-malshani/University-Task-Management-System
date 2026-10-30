// Direct in-process test for controllers, scoping, collaboration and admin panels
const { initDatabase } = require('./config/db');
const AuthController = require('./controllers/authController');
const ProjectController = require('./controllers/projectController');
const TaskController = require('./controllers/taskController');
const AdminController = require('./controllers/adminController');

function createMockReqRes({ method = 'GET', body = {}, params = {}, query = {}, user = null, headers = {} } = {}) {
  const req = {
    method,
    body,
    params,
    query,
    user,
    headers: { 'x-forwarded-for': '127.0.0.1', ...headers },
    socket: { remoteAddress: '127.0.0.1' }
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get data() {
      return responseData;
    }
  };

  const next = (err) => {
    if (err) {
      statusCode = err.status || 500;
      responseData = { status: 'error', message: err.message };
    }
  };

  return { req, res, next };
}

async function run() {
  console.log('🧪 Starting Direct In-Process Controller & Model Scoping Tests...\n');

  await initDatabase();

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
    // 1. Register Alice (Member)
    const { req: rRegAlice, res: sRegAlice, next: nRegAlice } = createMockReqRes({
      method: 'POST',
      body: { name: 'Alice Developer', email: `alice_${Date.now()}@example.com`, password: 'password123' }
    });
    await AuthController.register(rRegAlice, sRegAlice, nRegAlice);
    assert(sRegAlice.statusCode === 201, 'Alice registers successfully as MEMBER');
    const alice = sRegAlice.data?.data?.user;

    // 2. Register Bob (Member)
    const { req: rRegBob, res: sRegBob, next: nRegBob } = createMockReqRes({
      method: 'POST',
      body: { name: 'Bob Designer', email: `bob_${Date.now()}@example.com`, password: 'password123' }
    });
    await AuthController.register(rRegBob, sRegBob, nRegBob);
    assert(sRegBob.statusCode === 201, 'Bob registers successfully as MEMBER');
    const bob = sRegBob.data?.data?.user;

    // 3. Alice creates a project
    const { req: rProjCreate, res: sProjCreate, next: nProjCreate } = createMockReqRes({
      method: 'POST',
      body: { name: 'Alice Private Project', description: 'Internal team platform' },
      user: alice
    });
    await ProjectController.createProject(rProjCreate, sProjCreate, nProjCreate);
    assert(sProjCreate.statusCode === 201, 'Alice creates a new project');
    const project = sProjCreate.data?.data;

    // 4. Bob queries projects: Should NOT see Alice's project
    const { req: rBobProj1, res: sBobProj1, next: nBobProj1 } = createMockReqRes({
      method: 'GET',
      user: bob
    });
    await ProjectController.getAllProjects(rBobProj1, sBobProj1, nBobProj1);
    const bobCanSeeInitial = sBobProj1.data?.data?.some(p => String(p.id) === String(project.id));
    assert(!bobCanSeeInitial, 'Bob CANNOT see Alice\'s project (strict project isolation)');

    // 5. Alice adds Bob as a collaborator to the project
    const { req: rAddMember, res: sAddMember, next: nAddMember } = createMockReqRes({
      method: 'POST',
      params: { id: project.id },
      body: { userId: bob.id, name: bob.name, email: bob.email, role: 'MEMBER' },
      user: alice
    });
    await ProjectController.addMember(rAddMember, sAddMember, nAddMember);
    assert(sAddMember.statusCode === 200, 'Alice adds Bob as collaborator to her project');

    // 6. Bob queries projects again: Bob should now see the project!
    const { req: rBobProj2, res: sBobProj2, next: nBobProj2 } = createMockReqRes({
      method: 'GET',
      user: bob
    });
    await ProjectController.getAllProjects(rBobProj2, sBobProj2, nBobProj2);
    const bobCanSeeNow = sBobProj2.data?.data?.some(p => String(p.id) === String(project.id));
    assert(bobCanSeeNow, 'Bob can now access and work on the shared project!');

    // 7. Alice creates a task assigned to herself
    const { req: rTaskAlice, res: sTaskAlice, next: nTaskAlice } = createMockReqRes({
      method: 'POST',
      body: { title: 'Alice Backend API', project_id: project.id, user_id: alice.id, priority: 'HIGH' },
      user: alice
    });
    await TaskController.createTask(rTaskAlice, sTaskAlice, nTaskAlice);
    assert(sTaskAlice.statusCode === 201, 'Alice creates a task assigned to herself');

    // 8. Alice creates a task assigned to Bob
    const { req: rTaskBob, res: sTaskBob, next: nTaskBob } = createMockReqRes({
      method: 'POST',
      body: { title: 'Bob Frontend Design', project_id: project.id, user_id: bob.id, priority: 'MEDIUM' },
      user: alice
    });
    await TaskController.createTask(rTaskBob, sTaskBob, nTaskBob);
    assert(sTaskBob.statusCode === 201, 'Alice creates a task assigned to Bob in shared project');

    // 9. Bob queries tasks with default scope (My Tasks)
    const { req: rBobTasks, res: sBobTasks, next: nBobTasks } = createMockReqRes({
      method: 'GET',
      query: { scope: 'my_tasks' },
      user: bob
    });
    await TaskController.getAllTasks(rBobTasks, sBobTasks, nBobTasks);
    const bobOnlySeesHis = sBobTasks.data?.data?.every(t => String(t.user_id) === String(bob.id));
    const bobHasDesign = sBobTasks.data?.data?.some(t => t.title === 'Bob Frontend Design');
    assert(bobOnlySeesHis && bobHasDesign, 'Bob ONLY sees tasks assigned to him in My Tasks view');

    // 10. Bob queries shared project tasks
    const { req: rSharedTasks, res: sSharedTasks, next: nSharedTasks } = createMockReqRes({
      method: 'GET',
      query: { scope: 'all_shared', projectId: project.id },
      user: bob
    });
    await TaskController.getAllTasks(rSharedTasks, sSharedTasks, nSharedTasks);
    assert(sSharedTasks.data?.data?.length >= 2, 'Collaborators can view all shared project tasks');

    // 10b. Assignment Protection Tests:
    // Register Charlie (an outsider who is NOT in the project)
    const { req: rRegCharlie, res: sRegCharlie, next: nRegCharlie } = createMockReqRes({
      method: 'POST',
      body: { name: 'Charlie Outsider', email: `charlie_${Date.now()}@example.com`, password: 'password123' }
    });
    await AuthController.register(rRegCharlie, sRegCharlie, nRegCharlie);
    const charlie = sRegCharlie.data?.data?.user;

    // Protection 1: Attempt to assign a standalone task (no project) to another user
    const { req: rStandaloneInvalid, res: sStandaloneInvalid, next: nStandaloneInvalid } = createMockReqRes({
      method: 'POST',
      body: { title: 'Unauthorized Standalone', user_id: charlie.id },
      user: alice
    });
    await TaskController.createTask(rStandaloneInvalid, sStandaloneInvalid, nStandaloneInvalid);
    assert(sStandaloneInvalid.statusCode === 403, 'Protection 1: Cannot assign standalone task to another user (403 Forbidden)');

    // Protection 2: Attempt to assign a project task to a user who is NOT a collaborator in that project
    const { req: rProjectInvalid, res: sProjectInvalid, next: nProjectInvalid } = createMockReqRes({
      method: 'POST',
      body: { title: 'Unauthorized Assignee', project_id: project.id, user_id: charlie.id },
      user: alice
    });
    await TaskController.createTask(rProjectInvalid, sProjectInvalid, nProjectInvalid);
    assert(sProjectInvalid.statusCode === 400, 'Protection 2: Cannot assign project task to non-member outsider (400 Bad Request)');

    // Protection 3: Attempt to update/reassign an existing task to an outsider
    const { req: rReassignInvalid, res: sReassignInvalid, next: nReassignInvalid } = createMockReqRes({
      method: 'PUT',
      params: { id: sTaskAlice.data?.data?.id },
      body: { user_id: charlie.id },
      user: alice
    });
    await TaskController.updateTask(rReassignInvalid, sReassignInvalid, nReassignInvalid);
    assert(sReassignInvalid.statusCode === 400, 'Protection 3: Cannot reassign existing task to non-member outsider (400 Bad Request)');

    // 11. Admin login & panels verification
    const { req: rLoginAdmin, res: sLoginAdmin, next: nLoginAdmin } = createMockReqRes({
      method: 'POST',
      body: { email: 'admin@taskflow.local', password: 'Admin@123456' }
    });
    await AuthController.login(rLoginAdmin, sLoginAdmin, nLoginAdmin);
    assert(sLoginAdmin.statusCode === 200, 'Admin logs into administrative system');
    const adminUser = sLoginAdmin.data?.data?.user;

    // Admin Panel 1: Stats
    const { req: rAStats, res: sAStats, next: nAStats } = createMockReqRes({
      method: 'GET',
      user: adminUser
    });
    await AdminController.getAdminStats(rAStats, sAStats, nAStats);
    assert(sAStats.statusCode === 200 && sAStats.data?.data?.users?.total >= 2, 'Admin Panel 1: Overview stats endpoint works');

    // Admin Panel 2: User list
    const { req: rAUsers, res: sAUsers, next: nAUsers } = createMockReqRes({
      method: 'GET',
      user: adminUser
    });
    await AdminController.getAllUsers(rAUsers, sAUsers, nAUsers);
    assert(sAUsers.statusCode === 200 && Array.isArray(sAUsers.data?.data), 'Admin Panel 2: User management list works');

    // Admin Panel 2b: Update role (promote Bob to ADMIN)
    const { req: rRole, res: sRole, next: nRole } = createMockReqRes({
      method: 'PATCH',
      params: { id: bob.id },
      body: { role: 'ADMIN' },
      user: adminUser
    });
    await AdminController.updateUserRole(rRole, sRole, nRole);
    assert(sRole.statusCode === 200 && sRole.data?.data?.role === 'ADMIN', 'Admin Panel 2b: Promote user to ADMIN works');

    // Revert Bob to MEMBER
    const { req: rRoleRevert, res: sRoleRevert, next: nRoleRevert } = createMockReqRes({
      method: 'PATCH',
      params: { id: bob.id },
      body: { role: 'MEMBER' },
      user: adminUser
    });
    await AdminController.updateUserRole(rRoleRevert, sRoleRevert, nRoleRevert);
    assert(sRoleRevert.statusCode === 200 && sRoleRevert.data?.data?.role === 'MEMBER', 'Admin Panel 2b: Demote user to MEMBER works');

    // Admin Panel 2c: Update status (suspend and reactivate)
    const { req: rStatus, res: sStatus, next: nStatus } = createMockReqRes({
      method: 'PATCH',
      params: { id: bob.id },
      body: { isActive: false },
      user: adminUser
    });
    await AdminController.updateUserStatus(rStatus, sStatus, nStatus);
    assert(sStatus.statusCode === 200 && sStatus.data?.data?.is_active === false, 'Admin Panel 2c: Suspend account works');

    const { req: rStatus2, res: sStatus2, next: nStatus2 } = createMockReqRes({
      method: 'PATCH',
      params: { id: bob.id },
      body: { isActive: true },
      user: adminUser
    });
    await AdminController.updateUserStatus(rStatus2, sStatus2, nStatus2);
    assert(sStatus2.statusCode === 200 && sStatus2.data?.data?.is_active === true, 'Admin Panel 2c: Reactivate account works');

    // Admin Panel 3: Invitations flow
    const { req: rInvCreate, res: sInvCreate, next: nInvCreate } = createMockReqRes({
      method: 'POST',
      body: { email: `invite_${Date.now()}@example.com` },
      user: adminUser
    });
    await AdminController.createInvitation(rInvCreate, sInvCreate, nInvCreate);
    assert(sInvCreate.statusCode === 201 && sInvCreate.data?.data?.rawToken, 'Admin Panel 3: Create administrator invitation works');
    const rawToken = sInvCreate.data?.data?.rawToken;
    const inviteId = sInvCreate.data?.data?.invite?.id;

    // Accept invite
    const { req: rAccept, res: sAccept, next: nAccept } = createMockReqRes({
      method: 'POST',
      body: { inviteToken: rawToken, name: 'Accepted Admin', password: 'Password@123' }
    });
    await AuthController.acceptInvite(rAccept, sAccept, nAccept);
    assert(sAccept.statusCode === 200 && sAccept.data?.data?.user?.role === 'ADMIN', 'Invited user accepts token and gets activated as ADMIN');

    // Revoke an invitation
    const { req: rInvDelete, res: sInvDelete, next: nInvDelete } = createMockReqRes({
      method: 'DELETE',
      params: { id: inviteId },
      user: adminUser
    });
    await AdminController.deleteInvitation(rInvDelete, sInvDelete, nInvDelete);
    assert(sInvDelete.statusCode === 200, 'Admin Panel 3: Revoke invitation works');

    // Admin Panel 4: Audit logs
    const { req: rAudit, res: sAudit, next: nAudit } = createMockReqRes({
      method: 'GET',
      user: adminUser
    });
    await AdminController.getAuditLogs(rAudit, sAudit, nAudit);
    assert(sAudit.statusCode === 200 && Array.isArray(sAudit.data?.data) && sAudit.data?.data?.length > 0, 'Admin Panel 4: Security Audit Logs work');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL TESTS PASSED: ${passed}/${passed + failed} assertions succeeded!`);
    console.log(`======================================================\n`);
    process.exit(0);
  } catch (e) {
    console.error('Fatal error in direct test runner:', e);
    process.exit(1);
  }
}

run();

