// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json)
// and handled by the same Express app that backend/src/server.js runs locally.
import app from '../backend/src/app.js';

export default app;
