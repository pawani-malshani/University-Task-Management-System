// Automated Backend API Verification Script
async function runTests() {
  const BASE_URL = 'http://localhost:5000/api';
  console.log('🧪 Starting API Verification against:', BASE_URL);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name} ->`, e.message);
      failed++;
    }
  }

  // 1. Health check
  await test('Health check endpoint', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const json = await res.json();
    if (res.status !== 200 || json.status !== 'OK') throw new Error(`Unexpected status: ${res.status}`);
  });

  // 2. GET all tasks
  let initialTaskCount = 0;
  await test('GET /api/tasks (list all)', async () => {
    const res = await fetch(`${BASE_URL}/tasks`);
    const json = await res.json();
    if (res.status !== 200 || !Array.isArray(json.data)) throw new Error('Failed to retrieve task list');
    initialTaskCount = json.data.length;
  });

  // 3. POST /api/tasks (create task)
  let createdId = null;
  await test('POST /api/tasks (create valid task)', async () => {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Automated Test Task',
        description: 'Verifying end-to-end task creation flow',
        status: 'TODO',
        priority: 'HIGH',
        dueDate: '2026-10-31',
        projectId: 1
      })
    });
    const json = await res.json();
    if (res.status !== 201 || !json.data || !json.data.id) throw new Error(`Failed to create task: ${JSON.stringify(json)}`);
    createdId = json.data.id;
    if (json.data.title !== 'Automated Test Task') throw new Error('Title mismatch');
  });

  // 4. GET /api/tasks/:id (view task)
  await test(`GET /api/tasks/${createdId} (view single task)`, async () => {
    const res = await fetch(`${BASE_URL}/tasks/${createdId}`);
    const json = await res.json();
    if (res.status !== 200 || json.data.id !== createdId) throw new Error('Task ID mismatch or not found');
  });

  // 5. PUT /api/tasks/:id (update task)
  await test(`PUT /api/tasks/${createdId} (update task)`, async () => {
    const res = await fetch(`${BASE_URL}/tasks/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Automated Test Task (Updated)',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM'
      })
    });
    const json = await res.json();
    if (res.status !== 200 || json.data.status !== 'IN_PROGRESS') throw new Error('Task update failed');
  });

  // 6. Validation: Empty title should return 400
  await test('POST /api/tasks validation (empty title returns 400)', async () => {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '   ',
        status: 'TODO'
      })
    });
    const json = await res.json();
    if (res.status !== 400 || !json.errors || !json.errors.title) {
      throw new Error(`Expected 400 validation error, got ${res.status}`);
    }
  });

  // 7. Validation: Invalid status should return 400
  await test('POST /api/tasks validation (invalid status returns 400)', async () => {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Valid Title',
        status: 'INVALID_STATUS'
      })
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 8. 404 for non-existent task
  await test('GET /api/tasks/999999 (returns 404 for missing task)', async () => {
    const res = await fetch(`${BASE_URL}/tasks/999999`);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // 9. Search & Filter
  await test('GET /api/tasks?search=Automated (search test)', async () => {
    const res = await fetch(`${BASE_URL}/tasks?search=Automated`);
    const json = await res.json();
    if (res.status !== 200 || json.data.length === 0) throw new Error('Search did not return matches');
  });

  // 10. Dashboard Stats
  await test('GET /api/dashboard/stats (dashboard statistics)', async () => {
    const res = await fetch(`${BASE_URL}/dashboard/stats`);
    const json = await res.json();
    if (res.status !== 200 || typeof json.data.totalTasks !== 'number') {
      throw new Error('Stats payload malformed');
    }
  });

  // 11. Projects List
  await test('GET /api/projects (projects list)', async () => {
    const res = await fetch(`${BASE_URL}/projects`);
    const json = await res.json();
    if (res.status !== 200 || !Array.isArray(json.data)) throw new Error('Failed to fetch projects');
  });

  // 12. DELETE /api/tasks/:id
  await test(`DELETE /api/tasks/${createdId} (delete task)`, async () => {
    const res = await fetch(`${BASE_URL}/tasks/${createdId}`, { method: 'DELETE' });
    if (res.status !== 200 && res.status !== 204) throw new Error(`Expected 200/204, got ${res.status}`);
  });

  // 13. Verify task is actually gone
  await test(`Verify deleted task returns 404`, async () => {
    const res = await fetch(`${BASE_URL}/tasks/${createdId}`);
    if (res.status !== 404) throw new Error('Task still exists after delete');
  });

  console.log(`\n🎉 Verification Complete: ${passed} passed, ${failed} failed.`);
}

runTests();
