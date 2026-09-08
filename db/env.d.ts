declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    SITE_URL?: string;
    APP_OWNER_USER_ID?: string;
    APP_OWNER_EMAIL?: string;
  }
}
