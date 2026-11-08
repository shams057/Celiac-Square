import { asyncRouter } from '../utils/http.js';
import { validSignature, incomingMessages } from '../services/whatsapp.js';
import { handleReply } from '../services/orderConfirmation.js';

/**
 * Webhook for Meta's WhatsApp Cloud API: https://<site>/api/whatsapp/webhook
 * (Meta app → WhatsApp → Configuration: callback URL, WHATSAPP_VERIFY_TOKEN, subscribe to "messages").
 * The body arrives raw (see app.js) so its signature can be checked.
 */
const router = asyncRouter();

/** GET: Meta checks the URL once, with the verify token */
router.get('/webhook', (req, res) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === expected) {
    return res.status(200).type('text/plain').send(req.query['hub.challenge'] || '');
  }
  return res.sendStatus(403);
});

/**
 * POST: messages and delivery statuses. Unsigned or wrongly signed calls are refused.
 * Replies are handled before answering: on Vercel the function stops once it has answered.
 */
router.post('/webhook', async (req, res) => {
  if (!validSignature(req.body, req.headers['x-hub-signature-256'])) return res.sendStatus(401);

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.sendStatus(400);
  }

  for (const message of incomingMessages(payload)) {
    try {
      const outcome = await handleReply(message);
      if (outcome !== 'ignored') console.log(`[WhatsApp] ${message.id}: ${outcome}`);
    } catch (err) {
      // Logged and acknowledged: a retry from Meta would fail the same way
      console.error(`[WhatsApp] ${message.id}: ${err.message}`);
    }
  }
  return res.sendStatus(200);
});

export default router;
