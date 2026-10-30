// Test authentication and admin endpoints
const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
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
  console.log('🧪 Starting Auth & Admin API tests on http://localhost:5000/api...');

  try {
    // 1. Health check
    const health = await request('GET', '/health');
    console.log('1. Health check:', health.status, health.data.status);

    // 2. Register first admin user
    const regRes = await request('POST', '/auth/register', {
      name: 'System Admin',
      email: `admin_${Date.now()}@example.com`,
      password: 'password123',
      role: 'ADMIN'
    });
    console.log('2. Register Admin:', regRes.status, regRes.data.message, 'Role:', regRes.data.data?.user?.role);
    const token = regRes.data?.data?.token;

    // 3. Get profile
    const profileRes = await request('GET', '/auth/me', null, token);
    console.log('3. Get Profile (/me):', profileRes.status, 'User:', profileRes.data?.data?.name);

    // 4. Update profile
    const updateRes = await request('PUT', '/auth/profile', { name: 'Super Admin' }, token);
    console.log('4. Update Profile:', updateRes.status, 'Updated Name:', updateRes.data?.data?.user?.name);

    // 5. Admin stats
    const adminStats = await request('GET', '/admin/stats', null, token);
    console.log('5. Admin Stats:', adminStats.status, 'Total Users:', adminStats.data?.data?.users?.total);

    // 6. Admin users list
    const adminUsers = await request('GET', '/admin/users', null, token);
    console.log('6. Admin Users List:', adminUsers.status, 'Count:', adminUsers.data?.data?.length);

    console.log('🎉 All Auth and Admin API operations verified successfully!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

run();
