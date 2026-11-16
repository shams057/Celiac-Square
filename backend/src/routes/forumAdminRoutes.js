import { db, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { requireStaff } from '../middleware/adminAuth.js';
import { asyncRouter, clean, badRequest, UUID_RE } from '../utils/http.js';
import { containsPattern } from '../utils/regex.js';
import { audit } from '../services/audit.js';
import { publicName } from './forumRoutes.js';

/**
 * Forum moderation, for the team (STAFF) and admins: /api/admin/forum
 *   - the reports about forum posts, with the post they point to
 *   - every question and answer, with who wrote it
 *   - members: stop one from posting (for a time or until lifted), remove everything they wrote
 * Pinning, closing and deleting one post go through the public routes (forumRoutes.js), which let the team act on any post.
 * Tables: supabase/migrations/20261116100000_forum.sql and 20261116130000_forum_moderation.sql
 */
const router = asyncRouter();

router.use(requireStaff);

const PAGE_SIZE = 30;
const FORUM_TARGETS = ['FORUM_THREAD', 'FORUM_REPLY'];
const REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'];
export const BLOCK_DAYS = [1, 7, 30];
const MAX_REASON = 500;

class Unavailable extends Error {}

const rows = ({ data, error }) => {
  if (isMissingTable(error)) throw new Unavailable();
  if (error) throw new Error(error.message);
  return data;
};

const countOf = async (query) => {
  const { count, error } = await query;
  rows({ data: null, error });
  return count || 0;
};

const AUTHOR = 'id, full_name, email, role';
const THREAD_COLUMNS = `id, author_id, category, title, body, is_pinned, is_locked, accepted_reply_id, reply_count, like_count, view_count, last_activity_at, created_at, author:profiles!forum_threads_author_id_fkey(${AUTHOR})`;
const REPLY_COLUMNS = `id, thread_id, author_id, body, like_count, created_at, author:profiles!forum_replies_author_id_fkey(${AUTHOR}), thread:forum_threads!forum_replies_thread_id_fkey(id, title)`;

const excerpt = (text, max = 280) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
};

const isLive = (block) => Boolean(block) && (!block.expires_at || new Date(block.expires_at) > new Date());

const toBlock = (b) => (isLive(b) ? { reason: b.reason, until: b.expires_at, since: b.created_at } : null);

/** The team sees who wrote a post: the full name and the e-mail, not only "Amira S." */
const toMember = (p, block) =>
  p
    ? { _id: p.id, name: p.full_name || '', publicName: publicName(p.full_name), email: p.email, role: p.role, block: toBlock(block) }
    : null;

/** { userId: block row } for these accounts */
const blocksFor = async (userIds) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await db().from('forum_blocks').select('user_id, reason, expires_at, created_at').in('user_id', ids);
  if (isMissingTable(error)) return {};
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((b) => [b.user_id, b]));
};

const toThread = (r, blocks) => ({
  _id: r.id,
  category: r.category,
  title: r.title,
  excerpt: excerpt(r.body),
  isPinned: r.is_pinned,
  isLocked: r.is_locked,
  solved: Boolean(r.accepted_reply_id),
  replyCount: r.reply_count,
  likeCount: r.like_count,
  viewCount: r.view_count,
  lastActivityAt: r.last_activity_at,
  createdAt: r.created_at,
  author: toMember(r.author, blocks[r.author_id]),
});

const toReply = (r, blocks) => ({
  _id: r.id,
  threadId: r.thread_id,
  threadTitle: r.thread?.title || '',
  excerpt: excerpt(r.body),
  likeCount: r.like_count,
  createdAt: r.created_at,
  author: toMember(r.author, blocks[r.author_id]),
});

const pageOf = (req) => Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 500);

/** One page of a query built with { count: 'exact' }: { data, count, hasMore } (a page past the end is empty) */
const paged = async (query, page) => {
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error && error.code === 'PGRST103') return { data: [], count: count ?? 0, hasMore: false };
  rows({ data, error });
  return { data, count: count ?? data.length, hasMore: from + data.length < (count ?? 0) };
};

/**
 * GET /api/admin/forum/overview
 * The figures at the top of the page, and the badge on the back-office tab.
 */
router.get('/overview', async (req, res) => {
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const head = (table, column = 'id') => db().from(table).select(column, { count: 'exact', head: true });
  const [threads, replies, threadsWeek, repliesWeek, openReports, blocks] = await Promise.all([
    countOf(head('forum_threads')),
    countOf(head('forum_replies')),
    countOf(head('forum_threads').gte('created_at', week)),
    countOf(head('forum_replies').gte('created_at', week)),
    countOf(head('reports').in('target_type', FORUM_TARGETS).eq('status', 'OPEN')),
    db()
      .from('forum_blocks')
      .select('expires_at')
      .then(({ data, error }) => (isMissingTable(error) ? [] : rows({ data, error }))),
  ]);
  return res.json({
    success: true,
    data: { threads, replies, threadsWeek, repliesWeek, openReports, blocked: blocks.filter(isLive).length },
  });
});

/**
 * GET /api/admin/forum/reports?status=OPEN|RESOLVED|DISMISSED|ALL
 * Reports about forum posts, newest first, each with the post it points to (null once deleted).
 */
router.get('/reports', async (req, res) => {
  const status = clean(req.query.status).toUpperCase() || 'OPEN';
  let query = db()
    .from('reports')
    .select('*, reporter:profiles!reports_reporter_id_fkey(email, full_name)')
    .in('target_type', FORUM_TARGETS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (REPORT_STATUSES.includes(status)) query = query.eq('status', status);
  const reports = rows(await query);

  // target_id is the question's id, or "<question id>:<reply id>" for a reply
  const threadIdOf = (r) => r.target_id.slice(0, 36);
  const replyIdOf = (r) => r.target_id.slice(37);
  const threadIds = [...new Set(reports.map(threadIdOf).filter((id) => UUID_RE.test(id)))];
  const replyIds = [...new Set(reports.filter((r) => r.target_type === 'FORUM_REPLY').map(replyIdOf).filter((id) => UUID_RE.test(id)))];
  const [threads, replies] = await Promise.all([
    threadIds.length ? db().from('forum_threads').select(THREAD_COLUMNS).in('id', threadIds).then(rows) : [],
    replyIds.length ? db().from('forum_replies').select(REPLY_COLUMNS).in('id', replyIds).then(rows) : [],
  ]);
  const blocks = await blocksFor([...threads, ...replies].map((p) => p.author_id));
  const threadById = Object.fromEntries(threads.map((th) => [th.id, th]));
  const replyById = Object.fromEntries(replies.map((rp) => [rp.id, rp]));

  const data = reports.map((r) => {
    const thread = threadById[threadIdOf(r)];
    const reply = r.target_type === 'FORUM_REPLY' ? replyById[replyIdOf(r)] : null;
    const post = r.target_type === 'FORUM_REPLY' ? reply : thread;
    return {
      _id: r.id,
      kind: r.target_type === 'FORUM_REPLY' ? 'reply' : 'thread',
      reason: r.reason,
      message: r.message,
      status: r.status,
      label: r.target_label,
      reporter: r.reporter ? { email: r.reporter.email, fullName: r.reporter.full_name } : null,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      threadId: thread ? thread.id : null,
      threadTitle: thread?.title || '',
      // The reported post as it is now; null when it has already been deleted
      post: post ? { _id: post.id, text: r.target_type === 'FORUM_REPLY' ? excerpt(post.body, 600) : excerpt(`${post.title}\n${post.body}`, 600), author: toMember(post.author, blocks[post.author_id]) } : null,
    };
  });
  return res.json({ success: true, count: data.length, data });
});

/**
 * PATCH /api/admin/forum/reports/:id
 * Body: { status: OPEN | RESOLVED | DISMISSED }. Forum reports only: the other reports stay with the admins.
 */
router.patch('/reports/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Signalement introuvable.' });
  const status = clean(req.body?.status).toUpperCase();
  if (!REPORT_STATUSES.includes(status)) return badRequest(res, 'Statut inconnu.');
  const closed = status !== 'OPEN';
  const data = rows(
    await db()
      .from('reports')
      .update({ status, resolved_at: closed ? new Date().toISOString() : null, resolved_by: closed ? req.user.id : null })
      .eq('id', req.params.id)
      .in('target_type', FORUM_TARGETS)
      .select('id, target_label')
  );
  if (!data[0]) return res.status(404).json({ success: false, message: 'Signalement introuvable.' });
  await audit(req, `report.${status.toLowerCase()}`, data[0].id, { target: data[0].target_label, forum: true });
  const messages = { OPEN: 'Signalement rouvert.', RESOLVED: 'Signalement marqué comme traité.', DISMISSED: 'Signalement classé sans suite.' };
  return res.json({ success: true, message: messages[status] });
});

/**
 * GET /api/admin/forum/threads?q=&filter=all|pinned|locked|unanswered&author=<id>&page=1
 * Every question, newest first, with its author.
 */
router.get('/threads', async (req, res) => {
  const q = clean(req.query.q).slice(0, 100);
  const filter = clean(req.query.filter);
  const author = clean(req.query.author);
  let query = db().from('forum_threads').select(THREAD_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false });
  if (q) query = query.ilike('search_text', containsPattern(q));
  if (filter === 'pinned') query = query.eq('is_pinned', true);
  if (filter === 'locked') query = query.eq('is_locked', true);
  if (filter === 'unanswered') query = query.eq('reply_count', 0);
  if (UUID_RE.test(author)) query = query.eq('author_id', author);
  const page = pageOf(req);
  const { data, count, hasMore } = await paged(query, page);
  const blocks = await blocksFor(data.map((r) => r.author_id));
  return res.json({ success: true, count, page, hasMore, data: data.map((r) => toThread(r, blocks)) });
});

/**
 * GET /api/admin/forum/replies?q=&author=<id>&page=1
 * Every answer, newest first, with its author and its question.
 */
router.get('/replies', async (req, res) => {
  // Commas, parentheses and quotes would break PostgREST's filter syntax
  const q = clean(req.query.q).replace(/[,()"]/g, ' ').trim().slice(0, 100);
  const author = clean(req.query.author);
  let query = db().from('forum_replies').select(REPLY_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false });
  if (q) query = query.ilike('body', `%${q.replace(/\*/g, '').replace(/[\\%_]/g, '\\$&')}%`);
  if (UUID_RE.test(author)) query = query.eq('author_id', author);
  const page = pageOf(req);
  const { data, count, hasMore } = await paged(query, page);
  const blocks = await blocksFor(data.map((r) => r.author_id));
  return res.json({ success: true, count, page, hasMore, data: data.map((r) => toReply(r, blocks)) });
});

const MEMBER_COLUMNS = `${AUTHOR}, created_at, threads:forum_threads!forum_threads_author_id_fkey(count), replies:forum_replies!forum_replies_author_id_fkey(count)`;

const toMemberRow = (p, block) => ({
  ...toMember(p, block),
  joinedAt: p.created_at,
  threadCount: p.threads?.[0]?.count ?? 0,
  replyCount: p.replies?.[0]?.count ?? 0,
});

/**
 * GET /api/admin/forum/members?q=
 * With q: accounts whose name or e-mail matches (to block someone before they post again).
 * Without: the members who are blocked now.
 */
router.get('/members', async (req, res) => {
  const q = clean(req.query.q).replace(/[,()"]/g, ' ').trim().slice(0, 100);
  let profiles;
  if (q) {
    profiles = rows(
      await db()
        .from('profiles')
        .select(MEMBER_COLUMNS)
        .or(`email.ilike.${containsPattern(q)},full_name.ilike.${containsPattern(q)}`)
        .order('created_at', { ascending: false })
        .limit(30)
    );
  } else {
    const { data, error } = await db().from('forum_blocks').select('user_id, expires_at').order('created_at', { ascending: false }).limit(200);
    const live = isMissingTable(error) ? [] : rows({ data, error }).filter(isLive);
    profiles = live.length ? rows(await db().from('profiles').select(MEMBER_COLUMNS).in('id', live.map((b) => b.user_id))) : [];
  }
  const blocks = await blocksFor(profiles.map((p) => p.id));
  const data = profiles.map((p) => toMemberRow(p, blocks[p.id]));
  return res.json({ success: true, count: data.length, data });
});

const findProfile = async (id) => {
  if (!UUID_RE.test(id)) return null;
  const [row] = rows(await db().from('profiles').select(AUTHOR).eq('id', id).limit(1));
  return row || null;
};

const noMember = (res) => res.status(404).json({ success: false, message: 'Compte introuvable.' });

/**
 * PUT /api/admin/forum/blocks/:userId
 * Body: { reason?, days? }: days is 1, 7 or 30; without it the block lasts until it is lifted.
 * The member keeps reading, liking and saving; asking, answering and editing are refused.
 * Blocking again replaces the reason and the end date.
 */
router.put('/blocks/:userId', async (req, res) => {
  const member = await findProfile(req.params.userId);
  if (!member) return noMember(res);
  if (member.id === req.user.id) return badRequest(res, 'Vous ne pouvez pas vous bloquer vous-même.');
  if (member.role === 'ADMIN' || member.role === 'STAFF') return badRequest(res, 'Un membre de l’équipe ne peut pas être bloqué : changez d’abord son rôle.');

  const reason = clean(req.body?.reason).replace(/\s+/g, ' ');
  if (reason.length > MAX_REASON) return badRequest(res, `Le motif dépasse ${MAX_REASON} caractères.`);
  const days = req.body?.days === null || req.body?.days === undefined || req.body?.days === '' ? null : Number(req.body.days);
  if (days !== null && !BLOCK_DAYS.includes(days)) return badRequest(res, 'Durée inconnue.');
  const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;

  const [block] = rows(
    await db()
      .from('forum_blocks')
      .upsert({ user_id: member.id, reason, blocked_by: req.user.id, expires_at: expiresAt, created_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('user_id, reason, expires_at, created_at')
  );
  await audit(req, 'forum.block', member.id, { email: member.email, days, reason });
  return res.json({ success: true, message: 'Ce membre ne peut plus publier sur le forum.', data: toMember(member, block) });
});

/**
 * DELETE /api/admin/forum/blocks/:userId
 * Lifts the block.
 */
router.delete('/blocks/:userId', async (req, res) => {
  const member = await findProfile(req.params.userId);
  if (!member) return noMember(res);
  const removed = rows(await db().from('forum_blocks').delete().eq('user_id', member.id).select('user_id'));
  if (removed.length) await audit(req, 'forum.unblock', member.id, { email: member.email });
  return res.json({ success: true, message: 'Ce membre peut de nouveau publier.', data: toMember(member, null) });
});

/**
 * DELETE /api/admin/forum/members/:userId/posts
 * Removes every question and answer this member wrote (the answers given to their questions go with them).
 */
router.delete('/members/:userId/posts', async (req, res) => {
  const member = await findProfile(req.params.userId);
  if (!member) return noMember(res);
  if (member.role === 'ADMIN' || member.role === 'STAFF') return badRequest(res, 'Les messages de l’équipe se suppriment un par un.');

  // Questions first: their answers, whoever wrote them, are removed with them
  const threads = rows(await db().from('forum_threads').delete().eq('author_id', member.id).select('id'));
  const replies = rows(await db().from('forum_replies').delete().eq('author_id', member.id).select('id'));
  await audit(req, 'forum.purge', member.id, { email: member.email, threads: threads.length, replies: replies.length });
  return res.json({
    success: true,
    message: `${threads.length} question${threads.length > 1 ? 's' : ''} et ${replies.length} réponse${replies.length > 1 ? 's' : ''} supprimée${threads.length + replies.length > 1 ? 's' : ''}.`,
    data: { threads: threads.length, replies: replies.length },
  });
});

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => (err instanceof Unavailable ? res.status(503).json(FEATURE_UNAVAILABLE) : next(err)));

export default router;
