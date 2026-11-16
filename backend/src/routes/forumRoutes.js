import { db, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { getRequestUser, requireUser } from '../middleware/auth.js';
import { limits } from '../middleware/rateLimit.js';
import { asyncRouter, clean, badRequest, UUID_RE } from '../utils/http.js';
import { containsPattern } from '../utils/regex.js';
import { audit } from '../services/audit.js';

/**
 * The forum: questions asked by signed-in users, answered by the others.
 * Reading is public; asking, answering, liking and saving need an account.
 * Tables: supabase/migrations/20261116100000_forum.sql
 */
const router = asyncRouter();

export const FORUM_CATEGORIES = ['DIAGNOSIS', 'PRODUCTS', 'PLACES', 'RECIPES', 'DAILY_LIFE', 'CHILDREN', 'TRAVEL', 'OTHER'];
export const FORUM_LIMITS = { titleMin: 8, title: 160, body: 5000, replyMin: 2, reply: 3000 };

const SORTS = ['recent', 'popular', 'unanswered'];
const VIEWS = ['all', 'saved', 'mine'];
const PAGE_SIZE = 20;
const MAX_REPLIES = 500;
const MAX_SAVED = 300;
// Per account, whatever the device: a real person asks a few questions a day
const MAX_THREADS_PER_DAY = 8;
const MAX_REPLIES_PER_HOUR = 30;
const EXCERPT = 220;

const THREAD_COLUMNS =
  'id, author_id, category, title, body, lang, is_pinned, is_locked, accepted_reply_id, reply_count, like_count, view_count, last_activity_at, edited_at, created_at, author:profiles!forum_threads_author_id_fkey(id, full_name, role)';
const REPLY_COLUMNS = 'id, thread_id, author_id, parent_id, body, like_count, edited_at, created_at, author:profiles!forum_replies_author_id_fkey(id, full_name, role)';

/** The forum's tables are missing (migration not applied): answered as "not available yet", not as a 500 */
class Unavailable extends Error {}

/** The data of a Supabase call; throws for a failed one */
const rows = ({ data, error }) => {
  if (isMissingTable(error)) throw new Unavailable();
  if (error) throw new Error(error.message);
  return data;
};

const notFound = (res, message = 'Question introuvable.') => res.status(404).json({ success: false, message });
const forbidden = (res) => res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Vous ne pouvez pas modifier ce message.' });

const isModerator = (user) => Boolean(user) && (user.role === 'ADMIN' || user.role === 'STAFF');

/**
 * The name shown next to a post: first name and the initial of the last name ("Amira B."),
 * so a full name given for orders is not published on the forum.
 */
export const publicName = (fullName) => {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].slice(0, 30);
  return parts.length === 1 ? first : `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

const toAuthor = (profile) => ({
  name: publicName(profile?.full_name),
  // Only what readers need: answers from the team and from sellers are marked as such
  badge: profile?.role === 'ADMIN' || profile?.role === 'STAFF' ? 'TEAM' : profile?.role === 'SELLER' ? 'SELLER' : null,
});

/** Text as typed, with line breaks kept: trailing spaces and runs of blank lines are trimmed */
export const cleanText = (v) =>
  clean(v)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

const cleanTitle = (v) => clean(v).replace(/\s+/g, ' ');

const excerptOf = (body) => {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT).trimEnd()}…` : flat;
};

const toThread = (r, user, { liked = false, saved = false, full = false } = {}) => ({
  _id: r.id,
  category: r.category,
  title: r.title,
  ...(full ? { body: r.body } : { excerpt: excerptOf(r.body) }),
  lang: r.lang,
  isPinned: r.is_pinned,
  isLocked: r.is_locked,
  acceptedReplyId: r.accepted_reply_id,
  solved: Boolean(r.accepted_reply_id),
  replyCount: r.reply_count,
  likeCount: r.like_count,
  viewCount: r.view_count,
  lastActivityAt: r.last_activity_at,
  editedAt: r.edited_at,
  createdAt: r.created_at,
  author: toAuthor(r.author),
  mine: Boolean(user) && r.author_id === user.id,
  liked,
  saved,
});

const toReply = (r, user, { liked = false, askerId = null } = {}) => ({
  _id: r.id,
  threadId: r.thread_id,
  parentId: r.parent_id,
  body: r.body,
  likeCount: r.like_count,
  editedAt: r.edited_at,
  createdAt: r.created_at,
  author: toAuthor(r.author),
  // Written by the person who asked the question
  byAsker: Boolean(askerId) && r.author_id === askerId,
  mine: Boolean(user) && r.author_id === user.id,
  liked,
});

/** Which of these rows the user liked or saved: a Set of ids */
const idsOf = async (table, column, user, ids) => {
  if (!user || ids.length === 0) return new Set();
  const data = rows(await db().from(table).select(column).eq('user_id', user.id).in(column, ids));
  return new Set(data.map((r) => r[column]));
};

const findThread = async (id) => {
  if (!UUID_RE.test(id)) return null;
  const [row] = rows(await db().from('forum_threads').select(THREAD_COLUMNS).eq('id', id).limit(1));
  return row || null;
};

const findReply = async (id) => {
  if (!UUID_RE.test(id)) return null;
  const [row] = rows(await db().from('forum_replies').select(REPLY_COLUMNS).eq('id', id).limit(1));
  return row || null;
};

/** One thread with the user's own marks, as the API returns it */
const threadFor = async (row, user, full = true) => {
  const [liked, saved] = await Promise.all([
    idsOf('forum_thread_likes', 'thread_id', user, [row.id]),
    idsOf('forum_saved_threads', 'thread_id', user, [row.id]),
  ]);
  return toThread(row, user, { liked: liked.has(row.id), saved: saved.has(row.id), full });
};

/** Checks a question's fields; returns { error } or the cleaned { title, body, category } */
const threadFields = (body = {}, { partial = false } = {}) => {
  const out = {};
  if (!partial || body.title !== undefined) {
    const title = cleanTitle(body.title);
    if (title.length < FORUM_LIMITS.titleMin) return { error: `Écrivez votre question en ${FORUM_LIMITS.titleMin} caractères au moins.` };
    if (title.length > FORUM_LIMITS.title) return { error: `La question dépasse ${FORUM_LIMITS.title} caractères : mettez les détails dessous.` };
    out.title = title;
  }
  if (!partial || body.body !== undefined) {
    const text = cleanText(body.body);
    if (text.length > FORUM_LIMITS.body) return { error: `Les détails dépassent ${FORUM_LIMITS.body} caractères.` };
    out.body = text;
  }
  if (!partial || body.category !== undefined) {
    const category = clean(body.category).toUpperCase();
    if (!FORUM_CATEGORIES.includes(category)) return { error: 'Choisissez une rubrique.' };
    out.category = category;
  }
  return out;
};

const replyBody = (value) => {
  const text = cleanText(value);
  if (text.length < FORUM_LIMITS.replyMin) return { error: 'Écrivez votre réponse.' };
  if (text.length > FORUM_LIMITS.reply) return { error: `La réponse dépasse ${FORUM_LIMITS.reply} caractères.` };
  return { text };
};

/** How many rows the user wrote in `table` since `since` */
const countSince = async (table, userId, since) => {
  const { count, error } = await db().from(table).select('id', { count: 'exact', head: true }).eq('author_id', userId).gte('created_at', since.toISOString());
  rows({ data: null, error });
  return count || 0;
};

// ---------------------------------------------------------------------------------------------
// Reading (public)
// ---------------------------------------------------------------------------------------------

/**
 * GET /api/forum/threads?category=&sort=recent|popular|unanswered&q=&view=all|saved|mine&page=1
 * Pinned questions first, then the chosen order. `saved` and `mine` need an account.
 */
router.get('/threads', async (req, res) => {
  const user = await getRequestUser(req);
  const category = clean(req.query.category).toUpperCase();
  const sort = SORTS.includes(clean(req.query.sort)) ? clean(req.query.sort) : 'recent';
  const view = VIEWS.includes(clean(req.query.view)) ? clean(req.query.view) : 'all';
  const q = clean(req.query.q).slice(0, 100);
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 500);

  const empty = { success: true, count: 0, page, pageSize: PAGE_SIZE, hasMore: false, data: [] };
  if (view !== 'all' && !user) {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Connectez-vous pour continuer.' });
  }

  let query = db().from('forum_threads').select(THREAD_COLUMNS, { count: 'exact' });

  if (view === 'saved') {
    const saved = rows(
      await db().from('forum_saved_threads').select('thread_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(MAX_SAVED)
    );
    if (saved.length === 0) return res.json(empty);
    query = query.in('id', saved.map((s) => s.thread_id));
  }
  if (view === 'mine') query = query.eq('author_id', user.id);
  if (FORUM_CATEGORIES.includes(category)) query = query.eq('category', category);
  if (q) query = query.ilike('search_text', containsPattern(q));

  if (sort === 'unanswered') query = query.eq('reply_count', 0).order('created_at', { ascending: false });
  else if (sort === 'popular') query = query.order('like_count', { ascending: false }).order('reply_count', { ascending: false }).order('last_activity_at', { ascending: false });
  else query = query.order('is_pinned', { ascending: false }).order('last_activity_at', { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  // Asking for a page past the end is not an error
  if (error && error.code === 'PGRST103') return res.json(empty);
  rows({ data, error });

  const ids = data.map((r) => r.id);
  const [liked, saved] = await Promise.all([idsOf('forum_thread_likes', 'thread_id', user, ids), idsOf('forum_saved_threads', 'thread_id', user, ids)]);

  return res.json({
    success: true,
    count: count ?? data.length,
    page,
    pageSize: PAGE_SIZE,
    hasMore: from + data.length < (count ?? 0),
    data: data.map((r) => toThread(r, user, { liked: liked.has(r.id), saved: saved.has(r.id) })),
  });
});

/**
 * GET /api/forum/threads/:id
 * The question and its answers, oldest first (the page puts the accepted answer on top).
 */
router.get('/threads/:id', async (req, res) => {
  const user = await getRequestUser(req);
  const row = await findThread(req.params.id);
  if (!row) return notFound(res);

  const replies = rows(await db().from('forum_replies').select(REPLY_COLUMNS).eq('thread_id', row.id).order('created_at').limit(MAX_REPLIES));
  const [thread, likedReplies] = await Promise.all([
    threadFor(row, user),
    idsOf('forum_reply_likes', 'reply_id', user, replies.map((r) => r.id)),
  ]);

  // One more read; never worth failing the page for
  db()
    .rpc('forum_bump_views', { p_thread: row.id })
    .then(({ error }) => error && console.error(`[Forum] view count: ${error.message}`), () => {});

  return res.json({
    success: true,
    data: {
      ...thread,
      canModerate: isModerator(user),
      replies: replies.map((r) => toReply(r, user, { liked: likedReplies.has(r.id), askerId: row.author_id })),
    },
  });
});

// ---------------------------------------------------------------------------------------------
// Writing (signed-in accounts)
// ---------------------------------------------------------------------------------------------

/**
 * POST /api/forum/threads
 * Body: { title, body?, category, lang? }
 */
router.post('/threads', limits.forumPosts, requireUser, async (req, res) => {
  const fields = threadFields(req.body);
  if (fields.error) return badRequest(res, fields.error);

  const today = await countSince('forum_threads', req.user.id, new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (today >= MAX_THREADS_PER_DAY) return badRequest(res, 'Vous avez déjà posé plusieurs questions aujourd’hui. Réessayez demain.');

  const [row] = rows(
    await db()
      .from('forum_threads')
      .insert({ ...fields, author_id: req.user.id, lang: clean(req.body?.lang) === 'ar' ? 'ar' : 'fr' })
      .select(THREAD_COLUMNS)
  );
  return res.status(201).json({ success: true, message: 'Question publiée.', data: toThread(row, req.user, { full: true }) });
});

/**
 * PATCH /api/forum/threads/:id
 * Body: { title?, body?, category? } for the author; the team can also set { isPinned, isLocked }.
 */
router.patch('/threads/:id', requireUser, async (req, res) => {
  const row = await findThread(req.params.id);
  if (!row) return notFound(res);
  const moderator = isModerator(req.user);
  if (row.author_id !== req.user.id && !moderator) return forbidden(res);

  const fields = threadFields(req.body, { partial: true });
  if (fields.error) return badRequest(res, fields.error);
  const changes = { ...fields };
  if (Object.keys(fields).length > 0) changes.edited_at = new Date().toISOString();
  if (moderator) {
    if (typeof req.body?.isPinned === 'boolean') changes.is_pinned = req.body.isPinned;
    if (typeof req.body?.isLocked === 'boolean') changes.is_locked = req.body.isLocked;
  }
  if (Object.keys(changes).length === 0) return badRequest(res, 'Rien à modifier.');

  const [updated] = rows(await db().from('forum_threads').update(changes).eq('id', row.id).select(THREAD_COLUMNS));
  if (moderator && row.author_id !== req.user.id) await audit(req, 'forum.thread.update', row.id, { title: row.title, changes: Object.keys(changes) });
  return res.json({ success: true, message: 'Question mise à jour.', data: { ...(await threadFor(updated, req.user)), canModerate: moderator } });
});

/**
 * DELETE /api/forum/threads/:id
 * The author, or the team. The answers go with it.
 */
router.delete('/threads/:id', requireUser, async (req, res) => {
  const row = await findThread(req.params.id);
  if (!row) return notFound(res);
  const moderator = isModerator(req.user);
  if (row.author_id !== req.user.id && !moderator) return forbidden(res);

  rows(await db().from('forum_threads').delete().eq('id', row.id).select('id'));
  if (moderator && row.author_id !== req.user.id) await audit(req, 'forum.thread.delete', row.id, { title: row.title });
  return res.json({ success: true, message: 'Question supprimée.' });
});

/**
 * POST /api/forum/threads/:id/replies
 * Body: { body, parentId? }: parentId is the reply being answered, in the same question.
 */
router.post('/threads/:id/replies', limits.forumPosts, requireUser, async (req, res) => {
  const thread = await findThread(req.params.id);
  if (!thread) return notFound(res);
  if (thread.is_locked && !isModerator(req.user)) return badRequest(res, 'Cette discussion est fermée : elle n’accepte plus de réponses.');

  const { text, error } = replyBody(req.body?.body);
  if (error) return badRequest(res, error);

  let parentId = null;
  if (req.body?.parentId) {
    const parent = await findReply(clean(req.body.parentId));
    if (!parent || parent.thread_id !== thread.id) return badRequest(res, 'La réponse citée est introuvable.');
    parentId = parent.id;
  }

  const lastHour = await countSince('forum_replies', req.user.id, new Date(Date.now() - 60 * 60 * 1000));
  if (lastHour >= MAX_REPLIES_PER_HOUR) return badRequest(res, 'Vous avez beaucoup répondu en peu de temps. Réessayez un peu plus tard.');

  const [row] = rows(
    await db().from('forum_replies').insert({ thread_id: thread.id, author_id: req.user.id, parent_id: parentId, body: text }).select(REPLY_COLUMNS)
  );
  return res.status(201).json({ success: true, message: 'Réponse publiée.', data: toReply(row, req.user, { askerId: thread.author_id }) });
});

/**
 * PATCH /api/forum/replies/:id
 * Body: { body }
 */
router.patch('/replies/:id', requireUser, async (req, res) => {
  const row = await findReply(req.params.id);
  if (!row) return notFound(res, 'Réponse introuvable.');
  const moderator = isModerator(req.user);
  if (row.author_id !== req.user.id && !moderator) return forbidden(res);

  const { text, error } = replyBody(req.body?.body);
  if (error) return badRequest(res, error);

  const [updated] = rows(await db().from('forum_replies').update({ body: text, edited_at: new Date().toISOString() }).eq('id', row.id).select(REPLY_COLUMNS));
  if (moderator && row.author_id !== req.user.id) await audit(req, 'forum.reply.update', row.id, { thread: row.thread_id });
  const [liked, thread] = await Promise.all([idsOf('forum_reply_likes', 'reply_id', req.user, [row.id]), findThread(row.thread_id)]);
  return res.json({ success: true, message: 'Réponse mise à jour.', data: toReply(updated, req.user, { liked: liked.has(row.id), askerId: thread?.author_id }) });
});

/**
 * DELETE /api/forum/replies/:id
 */
router.delete('/replies/:id', requireUser, async (req, res) => {
  const row = await findReply(req.params.id);
  if (!row) return notFound(res, 'Réponse introuvable.');
  const moderator = isModerator(req.user);
  if (row.author_id !== req.user.id && !moderator) return forbidden(res);

  rows(await db().from('forum_replies').delete().eq('id', row.id).select('id'));
  if (moderator && row.author_id !== req.user.id) await audit(req, 'forum.reply.delete', row.id, { thread: row.thread_id });
  return res.json({ success: true, message: 'Réponse supprimée.' });
});

/**
 * PUT /api/forum/threads/:id/accepted
 * Body: { replyId }: the answer that solved the question, or null to unmark it.
 * The person who asked decides (or the team).
 */
router.put('/threads/:id/accepted', requireUser, async (req, res) => {
  const thread = await findThread(req.params.id);
  if (!thread) return notFound(res);
  if (thread.author_id !== req.user.id && !isModerator(req.user)) return forbidden(res);

  let replyId = null;
  if (req.body?.replyId) {
    const reply = await findReply(clean(req.body.replyId));
    if (!reply || reply.thread_id !== thread.id) return badRequest(res, 'Réponse introuvable.');
    replyId = reply.id;
  }
  rows(await db().from('forum_threads').update({ accepted_reply_id: replyId }).eq('id', thread.id).select('id'));
  return res.json({ success: true, message: replyId ? 'Réponse marquée comme solution.' : 'Solution retirée.', data: { acceptedReplyId: replyId } });
});

// ---------------------------------------------------------------------------------------------
// Likes and saved questions
// ---------------------------------------------------------------------------------------------

/** PUT and DELETE on a like or save row: both are safe to repeat */
const toggleRoutes = ({ path, find, table, column, missing, ownMessage, countOf }) => {
  const handler = (on) => async (req, res) => {
    const target = await find(req.params.id);
    if (!target) return notFound(res, missing);
    if (on && ownMessage && target.author_id === req.user.id) return badRequest(res, ownMessage);

    if (on) {
      if (table === 'forum_saved_threads') {
        const { count, error } = await db().from(table).select('thread_id', { count: 'exact', head: true }).eq('user_id', req.user.id);
        rows({ data: null, error });
        if (count >= MAX_SAVED) return badRequest(res, `Vous avez déjà enregistré ${MAX_SAVED} discussions. Retirez-en avant d’en ajouter.`);
      }
      rows(await db().from(table).upsert({ [column]: target.id, user_id: req.user.id }, { onConflict: `${column},user_id`, ignoreDuplicates: true }).select(column));
    } else {
      rows(await db().from(table).delete().eq(column, target.id).eq('user_id', req.user.id).select(column));
    }
    return res.json({ success: true, data: { on, ...(countOf ? { likeCount: await countOf(target.id) } : {}) } });
  };
  router.put(path, requireUser, handler(true));
  router.delete(path, requireUser, handler(false));
};

const likeCount = (table) => async (id) => {
  const [row] = rows(await db().from(table).select('like_count').eq('id', id).limit(1));
  return row?.like_count ?? 0;
};

// "I have the same question"
toggleRoutes({
  path: '/threads/:id/like',
  find: findThread,
  table: 'forum_thread_likes',
  column: 'thread_id',
  ownMessage: 'C’est votre question.',
  countOf: likeCount('forum_threads'),
});

// "This answer helped me"
toggleRoutes({
  path: '/replies/:id/like',
  find: findReply,
  table: 'forum_reply_likes',
  column: 'reply_id',
  missing: 'Réponse introuvable.',
  ownMessage: 'C’est votre réponse.',
  countOf: likeCount('forum_replies'),
});

// Saved questions ("Enregistrées")
toggleRoutes({ path: '/threads/:id/save', find: findThread, table: 'forum_saved_threads', column: 'thread_id' });

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => (err instanceof Unavailable ? res.status(503).json(FEATURE_UNAVAILABLE) : next(err)));

export default router;
