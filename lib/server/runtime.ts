import { env } from 'cloudflare:workers';

export type RuntimeEnv = Cloudflare.Env & {
  FILES?: R2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  SITE_URL?: string;
  APP_OWNER_USER_ID?: string;
};

export function getRuntimeEnv(): RuntimeEnv {
  return env as RuntimeEnv;
}

export function getFilesBucket() {
  const bucket = getRuntimeEnv().FILES;
  if (!bucket) throw new Error('文件存储暂不可用，请稍后再试。');
  return bucket;
}
