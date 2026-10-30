// ==============================================================================
// TaskFlow Private Bootstrap Admin Script
// Usage: node scripts/bootstrap-admin.js [email] [password] [name]
// Default: admin@taskflow.local / Admin@123456 / System Administrator
// ==============================================================================
const { initDatabase, getIsDbConnected } = require('../config/db');
const UserModel = require('../models/userModel');
const { hashPassword } = require('../utils/auth');
const { logAudit } = require('../utils/auditLogger');

async function bootstrapAdmin() {
  console.log('🛡️  [TaskFlow] Starting Private Administrator Provisioning...');

  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@taskflow.local').toLowerCase().trim();
  const password = args[1] || process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin@123456';
  const name = args[2] || process.env.ADMIN_BOOTSTRAP_NAME || 'System Administrator';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters long.');
    process.exit(1);
  }

  await initDatabase();

  try {
    const existingUser = await UserModel.findByEmail(email);
    const { salt, hash } = hashPassword(password);

    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        console.log(`ℹ️  User "${email}" already exists and has ADMIN privileges.`);
        console.log(`🔄 Updating password and activating account...`);
      } else {
        console.log(`⬆️  Promoting existing user "${email}" from ${existingUser.role} to ADMIN...`);
      }

      await UserModel.updateRole(existingUser.id, 'ADMIN');
      await UserModel.updateStatus(existingUser.id, true);
      await UserModel.update(existingUser.id, {
        name,
        password_hash: hash,
        salt
      });

      await logAudit({
        userId: existingUser.id,
        userEmail: email,
        action: 'ADMIN_BOOTSTRAP_PROMOTED',
        details: { name }
      });

      console.log(`✅ [Success] Administrator "${email}" is active with ADMIN role!`);
    } else {
      console.log(`➕ Creating initial administrator account: ${email}`);

      const newUser = await UserModel.create({
        name,
        email,
        password_hash: hash,
        salt,
        role: 'ADMIN'
      });

      await logAudit({
        userId: newUser.id,
        userEmail: email,
        action: 'ADMIN_BOOTSTRAP_CREATED',
        details: { name }
      });

      console.log(`✅ [Success] First administrator account successfully provisioned:`);
      console.log(`   - Name:  ${name}`);
      console.log(`   - Email: ${email}`);
      console.log(`   - Role:  ADMIN`);
    }

    console.log(`\n🎉 You can now log into TaskFlow with:`);
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Provisioning failed:', err.message);
    process.exit(1);
  }
}

bootstrapAdmin();
