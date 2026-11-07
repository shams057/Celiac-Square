import { db, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { getRequestUser } from '../middleware/auth.js';
import { limits } from '../middleware/rateLimit.js';
import { asyncRouter, clean, badRequest, MAX_LEN } from '../utils/http.js';

const router = asyncRouter();

export const REPORT_TARGETS = ['ATMC_PRODUCT', 'ASSOCIATION_PRODUCT', 'OFF_PRODUCT', 'SPOT', 'SCAN'];
export const REPORT_REASONS = ['LABEL_CHANGED', 'WRONG_STATUS', 'CLOSED', 'NO_LONGER_GLUTEN_FREE', 'WRONG_INFO', 'REACTION', 'OTHER'];

// Reasons that make sense for each kind of target
const REASONS_BY_TARGET = {
  SPOT: ['CLOSED', 'NO_LONGER_GLUTEN_FREE', 'WRONG_INFO', 'REACTION', 'OTHER'],
  SCAN: ['WRONG_STATUS', 'WRONG_INFO', 'OTHER'],
  default: ['LABEL_CHANGED', 'WRONG_STATUS', 'WRONG_INFO', 'REACTION', 'OTHER'],
};

const OK = { success: true, message: 'Merci ! Votre signalement a été transmis à l’équipe.' };

/**
 * POST /api/reports
 * Public: "this product's label changed", "this place closed"… Lands in the admin inbox.
 * Body: { targetType, targetId?, targetLabel?, reason, message? }
 * A signed-in reporter is recorded, so the team can tell repeated reports from one person apart.
 */
router.post('/', limits.submissions, async (req, res) => {
  // Hidden field that people never see: bots fill it in
  if (clean(req.body?.website)) return res.status(201).json(OK);

  const targetType = clean(req.body?.targetType).toUpperCase();
  const reason = clean(req.body?.reason).toUpperCase();
  const targetId = clean(req.body?.targetId);
  const targetLabel = clean(req.body?.targetLabel);
  const message = clean(req.body?.message);

  if (!REPORT_TARGETS.includes(targetType)) return badRequest(res, 'Élément signalé inconnu.');
  if (!(REASONS_BY_TARGET[targetType] || REASONS_BY_TARGET.default).includes(reason)) return badRequest(res, 'Choisissez la raison du signalement.');
  if (targetId.length > 80 || targetLabel.length > 300) return badRequest(res, 'Signalement invalide.');
  if (message.length > MAX_LEN.notes) return badRequest(res, `Le message dépasse ${MAX_LEN.notes} caractères.`);
  if ((reason === 'OTHER' || targetType === 'SCAN') && message.length < 5) {
    return badRequest(res, 'Décrivez le problème en quelques mots.');
  }

  const user = await getRequestUser(req);
  const { error } = await db()
    .from('reports')
    .insert({ target_type: targetType, target_id: targetId, target_label: targetLabel, reason, message, reporter_id: user?.id ?? null });
  if (isMissingTable(error)) return res.status(503).json(FEATURE_UNAVAILABLE);
  if (error) throw new Error(error.message);
  return res.status(201).json(OK);
});

export default router;
