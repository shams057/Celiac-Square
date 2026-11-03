import app from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Celiac Square Backend running on http://localhost:${PORT}`);
  console.log(`📍 Map endpoints:      http://localhost:${PORT}/api/map/spots`);
  console.log(`🔍 Product endpoints:  http://localhost:${PORT}/api/products/search`);
  console.log(`👁️ Vision endpoint:    http://localhost:${PORT}/api/vision/identify`);
  console.log(`=======================================================`);
});
