module.exports = function handler(req, res) {
  const config = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(
    "window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, " +
      JSON.stringify(config) +
      ");"
  );
};
