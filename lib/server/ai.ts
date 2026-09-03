import OpenAI from 'openai';
import { z } from 'zod';
import type {
  ApplicationPackContent,
  JobAnalysis,
  Profile,
  ResumeContent,
} from '@/lib/product-types';
import { getRuntimeEnv } from './runtime';

const jobAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  mustHave: z.array(z.string()),
  preferred: z.array(z.string()),
  keywords: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

const tuneOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      sectionKey: z.string(),
      originalText: z.string(),
      proposedText: z.string(),
      rationale: z.string(),
      matchedRequirement: z.string(),
      needsUserInput: z.boolean(),
    }),
  ),
});

const motivationSchema = z.object({
  motivation: z.string(),
});

const customAnswerSchema = z.object({
  answer: z.string(),
});

const JSON_SCHEMAS = {
  jobAnalysis: {
    type: 'object',
    additionalProperties: false,
    required: [
      'score',
      'summary',
      'mustHave',
      'preferred',
      'keywords',
      'strengths',
      'gaps',
    ],
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
      mustHave: { type: 'array', items: { type: 'string' } },
      preferred: { type: 'array', items: { type: 'string' } },
      keywords: { type: 'array', items: { type: 'string' } },
      strengths: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
    },
  },
  tune: {
    type: 'object',
    additionalProperties: false,
    required: ['suggestions'],
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'sectionKey',
            'originalText',
            'proposedText',
            'rationale',
            'matchedRequirement',
            'needsUserInput',
          ],
          properties: {
            sectionKey: { type: 'string' },
            originalText: { type: 'string' },
            proposedText: { type: 'string' },
            rationale: { type: 'string' },
            matchedRequirement: { type: 'string' },
            needsUserInput: { type: 'boolean' },
          },
        },
      },
    },
  },
  motivation: {
    type: 'object',
    additionalProperties: false,
    required: ['motivation'],
    properties: { motivation: { type: 'string' } },
  },
  customAnswer: {
    type: 'object',
    additionalProperties: false,
    required: ['answer'],
    properties: { answer: { type: 'string' } },
  },
} as const;

function createClient() {
  const { OPENAI_API_KEY } = getRuntimeEnv();
  if (!OPENAI_API_KEY) {
    throw new Error(
      'AI 尚未配置。请在站点环境变量中设置 OPENAI_API_KEY 后重试。',
    );
  }
  return new OpenAI({ apiKey: OPENAI_API_KEY, timeout: 45_000, maxRetries: 0 });
}

async function requestStructured<T>(
  name: string,
  schema: Record<string, unknown>,
  validator: z.ZodType<T>,
  instructions: string,
  input: string,
): Promise<T> {
  const client = createClient();
  const model = getRuntimeEnv().OPENAI_MODEL || 'gpt-5.6-luna';
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create({
        model,
        store: false,
        reasoning: { effort: 'low' },
        instructions,
        input,
        text: {
          format: {
            type: 'json_schema',
            name,
            strict: true,
            schema,
          },
        },
      });
      if (!response.output_text) throw new Error('模型没有返回可用内容。');
      return validator.parse(JSON.parse(response.output_text));
    } catch (error) {
      lastError = error;
    }
  }

  console.error('OpenAI structured response failed', lastError);
  throw new Error('AI 返回格式异常，已安全保留现有内容，请稍后重试。');
}

export function sanitizeForAi(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱已隐藏]')
    .replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, '[手机号已隐藏]')
    .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g, '[证件号已隐藏]')
    .replace(/^.*(?:详细地址|家庭住址|身份证号|证件号码).*$/gim, '[敏感字段已隐藏]');
}

export async function analyzeJobWithAi({
  jd,
  resumeText,
}: {
  jd: string;
  resumeText: string;
}): Promise<JobAnalysis> {
  return requestStructured(
    'job_analysis',
    JSON_SCHEMAS.jobAnalysis,
    jobAnalysisSchema,
    [
      '你是严谨的校园招聘岗位匹配分析助手。',
      '只能使用用户给出的岗位描述和简历事实；不得编造经历、技能、数字或公司信息。',
      '分数反映简历当前证据与岗位要求的匹配程度。',
      '缺口必须明确写成待补充或未体现，不能推测。',
      '使用岗位描述所用的语言，表达简洁。',
    ].join('\n'),
    `【岗位描述】\n${sanitizeForAi(jd)}\n\n【简历正文】\n${sanitizeForAi(resumeText)}`,
  );
}

export async function tuneResumeWithAi({
  jd,
  content,
}: {
  jd: string;
  content: ResumeContent;
}) {
  return requestStructured(
    'resume_tuning',
    JSON_SCHEMAS.tune,
    tuneOutputSchema,
    [
      '你是校园招聘简历编辑。',
      '只做微调：突出已有事实、调整顺序、改善动词与关键词，不得新增或夸大事实。',
      '每条建议都必须精确引用一段原文；若需要数字或事实而输入中没有，保持原文并将 needsUserInput 设为 true。',
      'sectionKey 使用 summary、experience、project、skills 或 extras。',
      '建议控制在 12 条以内，优先高影响项。',
    ].join('\n'),
    `【岗位描述】\n${sanitizeForAi(jd)}\n\n【结构化简历】\n${sanitizeForAi(JSON.stringify(content))}`,
  );
}

export async function generateMotivationWithAi({
  profile,
  jd,
  language,
}: {
  profile: Profile;
  jd: string;
  language: 'zh' | 'en';
}) {
  return requestStructured(
    'application_motivation',
    JSON_SCHEMAS.motivation,
    motivationSchema,
    [
      '根据候选人事实和岗位描述撰写 180 至 260 字的求职动机。',
      '不得补充输入之外的公司事实、个人经历或成绩。',
      '避免空泛赞美，重点说明已有经历与岗位任务的连接。',
      `输出语言：${language === 'zh' ? '中文' : '英文'}。`,
    ].join('\n'),
    `【岗位描述】\n${sanitizeForAi(jd)}\n\n【候选人事实】\n${sanitizeForAi(JSON.stringify(profile))}`,
  );
}

export async function generateCustomAnswerWithAi({
  profile,
  jd,
  question,
  charLimit,
  existingPack,
}: {
  profile: Profile;
  jd: string;
  question: string;
  charLimit?: number;
  existingPack: ApplicationPackContent;
}) {
  return requestStructured(
    'custom_application_answer',
    JSON_SCHEMAS.customAnswer,
    customAnswerSchema,
    [
      '回答招聘官网开放题。',
      '只能使用候选人事实、岗位描述和已经确认的材料，不得编造。',
      charLimit
        ? `答案不得超过 ${charLimit} 个字符。`
        : '答案应直接、具体、简洁。',
      '若问题要求的信息没有提供，明确说明需要用户补充，不要猜测。',
    ].join('\n'),
    `【问题】\n${question}\n\n【岗位描述】\n${sanitizeForAi(jd)}\n\n【候选人事实】\n${sanitizeForAi(JSON.stringify(profile))}\n\n【已确认材料】\n${sanitizeForAi(JSON.stringify(existingPack))}`,
  );
}
