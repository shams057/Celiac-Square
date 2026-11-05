import app from './app.js';

const PORT = process.env.PORT || 5000;

// Last line of defence: a stray rejection is logged instead of taking the whole API down
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

app.listen(PORT, () => {
  console.log(`Celiac Square API running on http://localhost:${PORT} (health: /api/health)`);
});
