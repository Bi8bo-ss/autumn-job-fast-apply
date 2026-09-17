import { env } from 'cloudflare:workers';

export type RuntimeEnv = Cloudflare.Env & {
  FILES?: R2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_FAST_MODEL?: string;
  SITE_URL?: string;
  APP_OWNER_USER_ID?: string;
  APP_OWNER_EMAIL?: string;
  RESUME_IMPORT_TOKEN?: string;
};

export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-terra';
export const DEFAULT_OPENAI_FAST_MODEL = 'gpt-5.6-luna';

export function getRuntimeEnv(): RuntimeEnv {
  return env as RuntimeEnv;
}

export function getOpenAiModels() {
  const runtime = getRuntimeEnv();
  const quality = runtime.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  return {
    quality,
    fast: runtime.OPENAI_FAST_MODEL || (runtime.OPENAI_MODEL ? quality : DEFAULT_OPENAI_FAST_MODEL),
  };
}

export function getFilesBucket() {
  const bucket = getRuntimeEnv().FILES;
  if (!bucket) throw new Error('文件存储暂不可用，请稍后再试。');
  return bucket;
}
