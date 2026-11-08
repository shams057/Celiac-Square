import dotenv from 'dotenv';
import { db } from '../config/db.js';

/**
 * Gives an existing account a role. Use it once to create the first admin:
 *
 *   npm run set-role -- someone@example.com ADMIN
 *
 * The account must exist (sign up on the site first). Roles: ADMIN, STAFF, SELLER, CLIENT.
 */
dotenv.config();

const [email, role] = process.argv.slice(2);
const ROLES = ['ADMIN', 'STAFF', 'SELLER', 'CLIENT'];

if (!email || !ROLES.includes(String(role).toUpperCase())) {
  console.error('Usage: npm run set-role -- <email> <ADMIN|STAFF|SELLER|CLIENT>');
  process.exit(1);
}

const { data, error } = await db()
  .from('profiles')
  .update({ role: role.toUpperCase() })
  .eq('email', email.trim().toLowerCase())
  .select('email, role');

if (error) {
  console.error(`[Set Role] ${error.message}`);
  process.exitCode = 1;
} else if (!data.length) {
  console.error(`[Set Role] No account for ${email}. Sign up on the site first.`);
  process.exitCode = 1;
} else {
  console.log(`[Set Role] ${data[0].email} is now ${data[0].role}.`);
}
