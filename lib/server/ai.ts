import OpenAI from 'openai';
import { z } from 'zod';
import type {
  ApplicationPackContent,
  AiSettings,
  JobAnalysis,
  Profile,
  ResumeContent,
} from '@/lib/product-types';
import {
  canEditResumeText,
  hasResumeBulletLead,
  normalizeSuggestedResumeText,
  resumeContainsExactText,
  type ResumeSuggestionOperation,
  type ResumeSuggestionSection,
} from '@/lib/resume-suggestions';
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
      operation: z.enum(['replace', 'append', 'delete']),
      sectionKey: z.enum(['summary', 'experience', 'project', 'skills', 'extras']),
      originalText: z.string(),
      proposedText: z.string(),
      rationale: z.string(),
      matchedRequirement: z.string(),
      needsUserInput: z.boolean(),
    }),
  ),
});

const applicationNarrativesSchema = z.object({
  selfIntroduction: z.string(),
  motivation: z.string(),
});

const jobMetadataSchema = z.object({
  company: z.string().max(120),
  role: z.string().max(160),
  location: z.string().max(120),
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
            'operation',
            'sectionKey',
            'originalText',
            'proposedText',
            'rationale',
            'matchedRequirement',
            'needsUserInput',
          ],
          properties: {
            operation: { type: 'string', enum: ['replace', 'append', 'delete'] },
            sectionKey: {
              type: 'string',
              enum: ['summary', 'experience', 'project', 'skills', 'extras'],
            },
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
  applicationNarratives: {
    type: 'object',
    additionalProperties: false,
    required: ['selfIntroduction', 'motivation'],
    properties: {
      selfIntroduction: { type: 'string' },
      motivation: { type: 'string' },
    },
  },
  jobMetadata: {
    type: 'object',
    additionalProperties: false,
    required: ['company', 'role', 'location'],
    properties: {
      company: { type: 'string', maxLength: 120 },
      role: { type: 'string', maxLength: 160 },
      location: { type: 'string', maxLength: 120 },
    },
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
  settings: AiSettings,
): Promise<T> {
  const client = createClient();
  const model = getRuntimeEnv().OPENAI_MODEL || 'gpt-5.6-luna';
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create({
        model,
        store: false,
        reasoning: { effort: settings.reasoningEffort },
        instructions: [
          instructions,
          settings.writingStyle === 'concise'
            ? '表达风格：高度精炼，优先短句和可直接使用的内容。'
            : settings.writingStyle === 'detailed'
              ? '表达风格：信息完整，但避免重复和空泛措辞。'
              : '表达风格：专业、自然，兼顾信息密度与可读性。',
          settings.outputLanguage === 'zh'
            ? '除非题目明确要求英文，否则使用中文。'
            : settings.outputLanguage === 'en'
              ? 'Unless the prompt explicitly requires Chinese, respond in English.'
              : '跟随岗位描述和问题所使用的语言。',
        ].join('\n'),
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
  settings,
}: {
  jd: string;
  resumeText: string;
  settings: AiSettings;
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
    settings,
  );
}

export async function extractJobMetadataWithAi({
  jd,
  settings,
}: {
  jd: string;
  settings: AiSettings;
}) {
  return requestStructured(
    'job_metadata',
    JSON_SCHEMAS.jobMetadata,
    jobMetadataSchema,
    [
      '从招聘信息中提取公司名称、岗位名称和工作地点。',
      '只能提取文本明确出现或可由标题直接确定的内容，不得根据业务描述猜测公司。',
      '去掉“招聘”“职位详情”“岗位职责”“任职要求”等页面标签，以及薪资、福利和编号。',
      '保留公司、岗位和地点在原文中的语言与正式写法，不翻译名称。',
      '岗位名称保留职级、方向及实习/校招属性，但不要把部门、地点、公司拼入岗位名。',
      '地点只保留城市或明确办公地点。远程岗位可以填写“远程”。',
      '无法可靠判断的字段返回空字符串。',
    ].join('\n'),
    `【招聘信息】\n${sanitizeForAi(jd)}`,
    settings,
  );
}

export async function tuneResumeWithAi({
  jd,
  content,
  profile,
  settings,
}: {
  jd: string;
  content: ResumeContent;
  profile: Profile;
  settings: AiSettings;
}) {
  const result = await requestStructured(
    'resume_tuning',
    JSON_SCHEMAS.tune,
    tuneOutputSchema,
    [
      '你是校园招聘简历定向编辑。目标是让简历明显向岗位靠拢，不限于同义词微调，但所有事实必须可靠。',
      '逐条审阅结构化简历中的每一条经历和项目要点，并在保留、改写、删除、新增之间做明确判断。不要为了凑数量改写已经清晰且高度相关的内容。',
      '每条 replace 必须带来实质提升，至少做到以下一项：让职责更贴近 JD、前置可验证的岗位关键词、补强任务—行动—结果链路、合并重复信息、让工具与业务结果的联系更清楚。禁止只换同义词或机械塞关键词。',
      '允许重组已有要点、合并冗余、调整要点顺序感，并在已有事实支持下强化任务—行动—结果链路。优先把与 JD 最相关且证据最强的内容放在建议正文前部。',
      '如果 JD 明确强调某个行业或方向，可以在 skills 或 extras 新增一条简短的“行业关注 / 求职方向 / 学习关注”定位语。例如“行业关注：新能源汽车、智能出行与用户运营”。这种话只能表达关注或求职意向，不能写成“熟悉、精通、有经验、负责过”。',
      '如果候选人事实库明确提供了证据，才可以新增更具体的技能或行业陈述。JD 中的要求本身绝不是候选人事实。',
      '禁止编造或夸大经历、职责、项目、技能、数字和成果；没有证据的“熟悉、精通、具备经验、负责过”等表述必须 needsUserInput=true，并明确提示用户补充。',
      'operation=replace 时，originalText 必须逐字引用结构化简历中一段完整的现有文本；可用于 summary、experience、project、skills、extras。',
      'experience 和 project 的 proposedText 必须是一条完整的纯文本要点：不换行、不带项目符号、不使用 Markdown 或 LaTeX。不得把一条要点拆成多条。',
      '每条经历与项目的 proposedText 都必须严格使用“短标题：正文”格式。中文短标题建议 2 至 6 个字，英文短标题建议 1 至 4 个词；短标题必须概括该条最有价值且最贴合 JD 的能力或成果，例如“指标体系：”“效率优化：”“业务洞察：”“跨域协同：”。冒号后的正文必须从行动或任务开始。',
      '可以重写原有短标题，使它更准确地表达该条与 JD 的连接；同一段经历不要连续使用含义相同的短标题。禁止使用“工作内容：”“主要职责：”“核心贡献：”等没有信息量的标题。',
      '原简历中没有短标题的经历或项目要点，只要被保留，就应通过 replace 补上有信息量的短标题。',
      '同一段经历避免重复描述相同任务、指标和结果。单条中文建议尽量控制在 45 至 110 字，英文建议尽量控制在 18 至 40 词；信息过多时先合并重复内容或提出删除建议。',
      'operation=append 可用于 experience、project、skills 或 extras。用于 skills/extras 时 originalText 必须为空字符串；用于 experience/project 时，originalText 必须逐字引用目标经历或项目中的一条现有要点，作为定位锚点，新要点会添加到同一段经历或项目末尾。',
      '新增经历或项目要点只能整合该段经历本身及候选人事实库中明确支持的事实，绝不能把另一段经历的职责或成果挪过来，也不能仅凭 JD 新造行业经验。证据不足时不要新增；确实值得询问用户时才设置 needsUserInput=true。',
      'operation=delete 时，originalText 必须逐字引用一条完整的现有概述、经历要点、项目要点、技能或其他信息，proposedText 必须为空字符串。仅删除与 JD 低相关、重复、空泛或挤占单页篇幅的内容；教育、姓名、经历标题和项目标题不能删除。',
      '允许用一条 replace 加一条 delete 完成合并：先把有效信息并入保留项，再删除重复项。不得因为 JD 没提某项就机械删除；只有删除后能明显提升岗位针对性或信息密度时才建议删除。',
      '不要输出、改写或引用邮箱、手机号、地址、证件号等联系方式，也不要把“已隐藏”占位符写入 proposedText。',
      '新增内容要克制：优先通过改写、合并和删除腾出篇幅；总新增不超过三条，并确保最终仍适合一页简历。',
      `建议控制在 ${settings.suggestionLimit} 条以内，优先高影响项。`,
    ].join('\n'),
    `【岗位描述】\n${sanitizeForAi(jd)}\n\n【结构化简历】\n${sanitizeForAi(JSON.stringify(content))}\n\n【候选人已确认事实（不含联系方式）】\n${sanitizeForAi(JSON.stringify(tuningProfileFacts(profile)))}`,
    settings,
  );

  let appendCount = 0;
  const seen = new Set<string>();
  const confirmedFacts = JSON.stringify(tuningProfileFacts(profile));
  const suggestions = result.suggestions.filter((suggestion) => {
    const operation = suggestion.operation as ResumeSuggestionOperation;
    const section = suggestion.sectionKey as ResumeSuggestionSection;
    const rawProposedText = suggestion.proposedText;
    suggestion.proposedText = normalizeSuggestedResumeText(
      section,
      suggestion.originalText,
      suggestion.proposedText,
      content.language,
    );
    if (operation !== 'delete' && !suggestion.proposedText) return false;
    if (operation !== 'delete' && suggestion.proposedText === suggestion.originalText.trim()) return false;
    if (/\[(?:邮箱|手机号|证件号|敏感字段)已隐藏\]/.test(suggestion.proposedText)) return false;
    if ((section === 'experience' || section === 'project')) {
      if (operation !== 'delete' && !hasResumeBulletLead(rawProposedText)) return false;
      const proposalLength = content.language === 'zh'
        ? suggestion.proposedText.length
        : suggestion.proposedText.split(/\s+/).filter(Boolean).length;
      if (proposalLength > (content.language === 'zh' ? 140 : 55)) return false;
    }
    if (operation === 'append') {
      if (section === 'skills' || section === 'extras') {
        suggestion.originalText = '';
      } else if (section === 'experience' || section === 'project') {
        if (!suggestion.originalText
          || !resumeContainsExactText(content, suggestion.originalText)
          || !canEditResumeText(content, section, suggestion.originalText)) return false;
      } else {
        return false;
      }
      if (/(?:熟悉|精通|具备.+经验|负责过|主导过|掌握|proficient|experienced in|led\b)/i.test(suggestion.proposedText)
        && !confirmedFacts.includes(suggestion.proposedText)) {
        suggestion.needsUserInput = true;
      }
    } else if (operation === 'delete') {
      suggestion.proposedText = '';
      if (!suggestion.originalText
        || !resumeContainsExactText(content, suggestion.originalText)
        || !canEditResumeText(content, section, suggestion.originalText)) return false;
    } else if (!suggestion.originalText
      || !resumeContainsExactText(content, suggestion.originalText)
      || !canEditResumeText(content, section, suggestion.originalText)) {
      return false;
    }
    if (operation === 'replace'
      && suggestion.proposedText !== suggestion.originalText
      && resumeContainsExactText(content, suggestion.proposedText)) {
      return false;
    }
    const key = `${operation}:${section}:${suggestion.originalText}:${suggestion.proposedText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (operation === 'append') {
      appendCount += 1;
      if (appendCount > 3) return false;
    }
    return true;
  });

  return { suggestions: suggestions.slice(0, settings.suggestionLimit) };
}

export async function generateApplicationNarrativesWithAi({
  profile,
  resume,
  jd,
  language,
}: {
  profile: Profile;
  resume: ResumeContent | null;
  jd: string;
  language: 'zh' | 'en';
}) {
  return requestStructured(
    'application_narratives',
    JSON_SCHEMAS.applicationNarratives,
    applicationNarrativesSchema,
    [
      '根据候选人已确认事实、简历和岗位描述，同时生成个人自我介绍与求职动机。',
      'selfIntroduction 使用第一人称，适合官网填写或 60 秒口头介绍；中文 180 至 280 字，英文 110 至 170 词。依次覆盖教育/方向、最匹配经历、核心能力、岗位连接，避免逐条复述简历。',
      'motivation 中文 150 至 240 字，英文 100 至 160 词；重点说明已有经历与岗位任务的连接，避免空泛赞美。',
      '不得补充输入之外的公司事实、个人经历或成绩。',
      '不得输出邮箱、手机号、地址、证件号等联系方式；证据不足时使用克制表述，不得猜测。',
      `输出语言：${language === 'zh' ? '中文' : '英文'}。`,
    ].join('\n'),
    `【岗位描述】\n${sanitizeForAi(jd)}\n\n【候选人已确认事实】\n${sanitizeForAi(JSON.stringify(tuningProfileFacts(profile)))}\n\n【当前简历】\n${sanitizeForAi(JSON.stringify(resume))}`,
    profile.aiSettings,
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
    `【问题】\n${question}\n\n【岗位描述】\n${sanitizeForAi(jd)}\n\n【候选人事实】\n${sanitizeForAi(JSON.stringify(profileFacts(profile)))}\n\n【已确认材料】\n${sanitizeForAi(JSON.stringify(existingPack))}`,
    profile.aiSettings,
  );
}

function profileFacts(profile: Profile) {
  const { aiSettings: _aiSettings, ...facts } = profile;
  return facts;
}

function tuningProfileFacts(profile: Profile) {
  return {
    education: profile.education,
    experiences: profile.experiences,
    projects: profile.projects,
    skills: profile.skills,
    certificates: profile.certificates,
    awards: profile.awards,
    languages: profile.languages,
    summaries: profile.summaries,
    preferences: profile.preferences,
    customFields: profile.customFields,
  };
}
