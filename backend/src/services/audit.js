import { db } from '../config/db.js';

/**
 * Records an admin action in admin_audit_log (who, what, on which row).
 * Never fails the request: a missing log row is reported in the server logs instead.
 */
export const audit = async (req, action, targetId, details = {}) => {
  try {
    const { error } = await db()
      .from('admin_audit_log')
      .insert({ actor_id: req.user?.id ?? null, actor_email: req.user?.email ?? '', action, target_id: String(targetId ?? ''), details });
    if (error) console.error(`[Audit] ${action} ${targetId}: ${error.message}`);
  } catch (err) {
    console.error(`[Audit] ${action} ${targetId}: ${err.message}`);
  }
};
