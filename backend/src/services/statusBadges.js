/**
 * Badge texts for the local guides, one per status. Every status has its own wording:
 * "unknown" or "to check" must never read as "cross-contamination".
 */
const BADGES = {
  ASSOCIATION: {
    SAFE: ['Sans gluten (autorisé ATC)', 'خالٍ من الغلوتين (مرخص ATC)'],
    UNSAFE: ['Contient du gluten (interdit ATC)', 'يحتوي على الغلوتين (ممنوع ATC)'],
    CROSS_CONTAMINATION_RISK: ['Risque de contamination croisée', 'خطر التلوث المتبادل'],
    WARNING: ['À vérifier', 'للتثبت'],
    UNKNOWN: ['Statut inconnu', 'الحالة غير معروفة'],
  },
};

export const associationBadge = (status) => BADGES.ASSOCIATION[status] || BADGES.ASSOCIATION.UNKNOWN;

/** ATMC guide statuses mapped to the app's statuses */
export const atmcToStatus = (status) => (status === 'ALLOWED' ? 'SAFE' : status === 'NOT_ALLOWED' ? 'UNSAFE' : 'WARNING');
