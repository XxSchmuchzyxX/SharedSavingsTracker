// Local development config.
// For production on Vercel, /api/config.js will override these values from env vars.
window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, {
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
});
