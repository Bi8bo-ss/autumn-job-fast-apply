import OpenAI from 'openai';
import { z } from 'zod';
import type {
  ApplicationPackContent,
  AiSettings,
  JobAnalysis,
  Profile,
  ResumeContent,
} from '@/lib/product-types';
import { isLikelySupplementalNoise } from '@/lib/resume-parser';
import {
  applyResumeSuggestion,
  canEditResumeText,
  canMergeResumeTexts,
  encodeSuggestionSection,
  encodeMergeSourceTexts,
  hasResumeBulletLead,
  isResumeBulletLeadAligned,
  normalizeSuggestedResumeText,
  resumeBulletParts,
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
      operation: z.enum(['replace', 'append', 'delete', 'merge']),
      sectionKey: z.enum(['summary', 'experience', 'project', 'skills', 'extras']),
      originalText: z.string(),
      mergedOriginalTexts: z.array(z.string()),
      proposedText: z.string(),
      rationale: z.string(),
      matchedRequirement: z.string(),
      needsUserInput: z.boolean(),
    }),
  ),
});

type TuneOutput = z.infer<typeof tuneOutputSchema>;

const applicationNarrativesSchema = z.object({
  selfEvaluation: z.string().min(300, '自我评价至少需要 300 个字符。'),
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
            'mergedOriginalTexts',
            'proposedText',
            'rationale',
            'matchedRequirement',
            'needsUserInput',
          ],
          properties: {
            operation: { type: 'string', enum: ['replace', 'append', 'delete', 'merge'] },
            sectionKey: {
              type: 'string',
              enum: ['summary', 'experience', 'project', 'skills', 'extras'],
            },
            originalText: { type: 'string' },
            mergedOriginalTexts: { type: 'array', items: { type: 'string' } },
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
    required: ['selfEvaluation', 'selfIntroduction', 'motivation'],
    properties: {
      selfEvaluation: { type: 'string', minLength: 300 },
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

async function requestText(
  instructions: string,
  input: string,
  settings: AiSettings,
) {
  const client = createClient();
  const model = getRuntimeEnv().OPENAI_MODEL || 'gpt-5.6-luna';
  try {
    const response = await client.responses.create({
      model,
      store: false,
      reasoning: { effort: settings.reasoningEffort },
      instructions,
      input,
      max_output_tokens: 1400,
    });
    const answer = response.output_text?.trim();
    if (!answer) throw new Error('模型没有返回可用内容。');
    return answer;
  } catch (error) {
    console.error('OpenAI text response failed', error);
    throw new Error('AI 暂时没有回复，请稍后重试。');
  }
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
  const tuningInstructions = [
      '你是校园招聘简历定向编辑。目标是让简历明显向岗位靠拢，不限于同义词微调，但所有事实必须可靠。',
      '先在内部完成“岗位要求—候选人证据—内容主题”的聚类规划，再输出建议；禁止顺着原文逐条机械改写。每段经历最终只保留少数互不重复的核心主题，每条只讲清一条完整任务链。',
      '逐条审阅结构化简历中的每一条经历和项目要点，并在保留、改写、合并、删除、新增之间做明确判断。不要为了凑数量改写已经清晰且高度相关的内容。',
      '每条 replace 必须带来实质提升，至少做到以下一项：让职责更贴近 JD、前置可验证的岗位关键词、补强任务—行动—结果链路、合并重复信息、让工具与业务结果的联系更清楚。禁止只换同义词或机械塞关键词。',
      '允许重组已有要点、合并冗余、调整要点顺序感，并在已有事实支持下强化任务—行动—结果链路。优先把与 JD 最相关且证据最强的内容放在建议正文前部。',
      '如果 JD 明确强调某个行业或方向，可以在 skills 或 extras 新增一条简短的“行业关注 / 求职方向 / 学习关注”定位语。例如“行业关注：新能源汽车、智能出行与用户运营”。这种话只能表达关注或求职意向，不能写成“熟悉、精通、有经验、负责过”。',
      '如果候选人事实库明确提供了证据，才可以新增更具体的技能或行业陈述。JD 中的要求本身绝不是候选人事实。',
      '禁止编造或夸大经历、职责、项目、技能、数字和成果；没有证据的“熟悉、精通、具备经验、负责过”等表述必须 needsUserInput=true，并明确提示用户补充。',
      'operation=replace 时，originalText 必须逐字引用结构化简历中一段完整的现有文本；可用于 summary、experience、project、skills、extras。',
      'experience 和 project 的 proposedText 必须是一条完整的纯文本要点：不换行、不带项目符号、不使用 Markdown 或 LaTeX。不得把一条要点拆成多条。',
      '每条经历与项目的 proposedText 都必须严格使用“短标题：正文”格式。中文短标题建议 3 至 6 个字，英文短标题建议 2 至 4 个词。标题必须准确概括正文正在解决的具体问题、方法或成果，不能只写宽泛能力。',
      '严禁使用“数据分析、业务分析、工作内容、主要职责、核心贡献、综合能力、项目经验、相关经验、工作成果、成果产出、方案搭建、项目推进”作为短标题；英文同样禁用 Analysis、Analytics、Impact、Experience、Responsibilities、Contribution、Delivery 等泛标题。',
      '标题与正文必须能直接互证。例如正文若主要讲送装履约模式、服务链路和成本分配，应写“履约规划”或“服务模式”，不能写“数据分析”；正文若主要讲指标口径、核算和监控，应写“指标体系”；正文若主要讲自动化和耗时下降，应写“效率优化”。不要照抄示例，应根据该条真正的主线命名。',
      '冒号后的正文必须依次串起：业务场景或目标、候选人的关键动作、使用的方法或工具、对决策/运营/流程/用户/交付的结果。正文涉及多个动作时，它们必须服务同一个核心成果；不同主题必须拆开，重复或同链路碎片则必须合并。',
      '可以重写原有短标题，使它更准确地表达该条与 JD 的连接；同一段经历不要使用重复或近义短标题。原简历中没有短标题或短标题失真的要点，只要被保留，就应通过 replace 修正。',
      '禁止把一个完整成果拆成多个半句小点，也不要让一句只剩“搭建看板”“推进协同”“输出报告”这类动作。replace/append 的中文正文建议 72 至 140 字，merge 的中文正文建议 90 至 150 字；英文分别建议 28 至 58 词和 34 至 64 词，通常在简历中占 2 至 3 行。',
      '优先保留并前置原文中的量化证据，例如时间、效率、覆盖率和产出数量；合并或改写时不得丢失任何仍相关的数字。没有数字时要明确写出对决策、运营、流程、用户或交付的实际影响，但绝不能虚构数字。',
      '硬性结构目标：任何单段实习/工作经历接受全部建议后不得超过 5 条，最相关的核心经历应为 4 至 5 条，其他经历通常为 3 至 4 条；每个项目通常保留 1 条完整要点，确有两个独立成果时最多 2 条。若原文超出上限，必须用 merge/delete 给出足够的收敛建议，否则答案不合格。',
      '核心经历建议按互不重叠的主题组织，例如业务规划、指标体系、经营洞察、效率自动化、跨部门落地；这是结构示意，不是固定标题。严禁把同一项目重复拆成“数据分析、业务洞察、趋势归因、跨域洞察”等多个相互覆盖的小点。',
      'operation=append 可用于 experience、project、skills 或 extras。用于 skills/extras 时 originalText 必须为空字符串；用于 experience/project 时，originalText 必须逐字引用目标经历或项目中的一条现有要点，作为定位锚点，新要点会添加到同一段经历或项目末尾。',
      '新增经历或项目要点只能整合该段经历本身及候选人事实库中明确支持的事实，绝不能把另一段经历的职责或成果挪过来，也不能仅凭 JD 新造行业经验。证据不足时不要新增；确实值得询问用户时才设置 needsUserInput=true。',
      'operation=merge 只用于 experience 或 project。originalText 填第一条要合并的完整原文，mergedOriginalTexts 填同一段经历或项目中其余 1 至 4 条完整原文；proposedText 把同一任务链的事实合成一条更深入、更贴合 JD 的完整要点。不得遗漏有价值的数字、工具或结果，不得把无关主题硬塞进同一点，也不得跨公司或跨项目合并。',
      'operation=delete 时，originalText 必须逐字引用一条完整的现有概述、经历要点、项目要点、技能或其他信息，proposedText 必须为空字符串。仅删除与 JD 低相关、重复、空泛或挤占单页篇幅的内容；教育、姓名、经历标题和项目标题不能删除。',
      '技能和其他信息也必须保持整洁：主动删除重复词、解析残片、无意义关键词堆叠和无法构成完整信息的孤立短句，例如“项目统筹统筹物流项目协调”。新增或改写 skills/extras 时必须使用“类别：具体内容”格式，不能追加一行没有冒号的关键词。',
      '完成常规改写规划后，再逐项核对 JD 明确要求的命名技能、软件、平台、编程语言或分析方法。如果某项高价值技能（例如 Tableau）在原始简历和候选人已确认事实中都没有证据，但确认后能显著提高匹配度，必须追加一条“技能确认”建议：operation=append、sectionKey=skills、originalText=""、needsUserInput=true。proposedText 使用“类别：技能名”格式，只写待确认的真实技能名称，不得自行添加“精通、熟练”等程度；rationale 必须直接询问“岗位要求 X，但现有资料未体现，你是否确实会使用？”。最多询问 3 项，不要把同义技能重复提问。',
      '技能确认建议必须排在全部常规改写、合并、删除和新增建议之后。若原始简历或事实库已明确包含该技能，不得再次询问；若用户不确认，该技能不会进入简历。“技能确认”只允许作为界面状态，绝不能写进 proposedText 的类别或正文；应使用“工具技能”“研究与方法”“专业技能”等真实简历分类。',
      '优先使用 merge 完成“多条碎片合成一条”，不要用多条 replace 制造更多要点。不得因为 JD 没提某项就机械删除；只有删除或合并后能明显提升岗位针对性、内容深度或信息密度时才建议。',
      '除 merge 外，mergedOriginalTexts 必须为空数组。任何一个原始要点最多只能被一个 replace、merge 或 delete 建议使用，避免建议之间互相覆盖。',
      '不要输出、改写或引用邮箱、手机号、地址、证件号等联系方式，也不要把“已隐藏”占位符写入 proposedText。',
      '新增内容要克制：优先通过改写、合并和删除腾出篇幅；常规新增不超过两条，并确保最终仍适合一页简历。技能确认属于待用户回答的问题，可在常规新增之外最多输出三条。',
      `建议控制在 ${settings.suggestionLimit} 条以内，优先高影响项。`,
    ].join('\n');
  const tuningInput = `【岗位描述】\n${sanitizeForAi(jd)}\n\n【结构化简历】\n${sanitizeForAi(JSON.stringify(content))}\n\n【候选人已确认事实（不含联系方式）】\n${sanitizeForAi(JSON.stringify(tuningProfileFacts(profile)))}`;
  const tuningSettings: AiSettings = { ...settings, writingStyle: 'detailed' };
  const result = await requestStructured(
    'resume_tuning',
    JSON_SCHEMAS.tune,
    tuneOutputSchema,
    tuningInstructions,
    tuningInput,
    tuningSettings,
  );

  const confirmedFacts = JSON.stringify(tuningProfileFacts(profile));
  const knownSkillEvidence = `${JSON.stringify(content)} ${confirmedFacts}`.toLowerCase().replace(/\s+/g, '');
  const validateSuggestions = (candidateResult: TuneOutput) => {
    let appendCount = 0;
    let skillConfirmationCount = 0;
    const seen = new Set<string>();
    const claimedOriginals = new Set<string>();
    const suggestions = candidateResult.suggestions.filter((suggestion) => {
    const operation = suggestion.operation as ResumeSuggestionOperation;
    const section = suggestion.sectionKey as ResumeSuggestionSection;
    const rawProposedText = suggestion.proposedText;
    let qualitySourceTexts: string[] = [];
    if (operation !== 'merge' && suggestion.mergedOriginalTexts.length) return false;
    suggestion.proposedText = normalizeSuggestedResumeText(
      section,
      operation === 'merge' ? '' : suggestion.originalText,
      suggestion.proposedText,
      content.language,
    );
    if (operation !== 'delete' && !suggestion.proposedText) return false;
    if (operation !== 'delete' && (section === 'skills' || section === 'extras')) {
      if (!/^[^：:\n]{2,20}[：:]\s*\S+/.test(suggestion.proposedText)
        || isLikelySupplementalNoise(suggestion.proposedText, content.language)) return false;
    }
    if (operation !== 'delete' && suggestion.proposedText === suggestion.originalText.trim()) return false;
    if (/\[(?:邮箱|手机号|证件号|敏感字段)已隐藏\]/.test(suggestion.proposedText)) return false;
    if ((section === 'experience' || section === 'project')) {
      if (operation !== 'delete' && !hasResumeBulletLead(rawProposedText)) return false;
      const proposalLength = content.language === 'zh'
        ? suggestion.proposedText.length
        : suggestion.proposedText.split(/\s+/).filter(Boolean).length;
      const minimumLength = operation === 'merge'
        ? (content.language === 'zh' ? 90 : 34)
        : (content.language === 'zh' ? 72 : 28);
      if (operation !== 'delete'
        && (proposalLength < minimumLength
          || proposalLength > (content.language === 'zh' ? 165 : 66))) return false;
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
      if (section === 'skills') {
        const [category = '', body = ''] = suggestion.proposedText.split(/[：:]/, 2);
        const positioning = /行业关注|求职方向|学习关注|industry interest|career focus/i.test(category);
        const namedSkills = body.split(/[、,，/|+；;（）()]/)
          .map((item) => item.trim().toLowerCase().replace(/\s+/g, ''))
          .filter((item) => item.length >= 2);
        if (!positioning && namedSkills.some((skill) => !knownSkillEvidence.includes(skill))) {
          suggestion.needsUserInput = true;
          suggestion.rationale = `岗位需要 ${body.trim()}，但原始简历和事实库尚未体现。你是否确实会使用？`;
        }
      }
    } else if (operation === 'delete') {
      suggestion.proposedText = '';
      if (!suggestion.originalText
        || !resumeContainsExactText(content, suggestion.originalText)
        || !canEditResumeText(content, section, suggestion.originalText)) return false;
    } else if (operation === 'merge') {
      const sourceTexts = [suggestion.originalText, ...suggestion.mergedOriginalTexts]
        .map((text) => text.trim())
        .filter(Boolean);
      if (!canMergeResumeTexts(content, section, sourceTexts)) return false;
      qualitySourceTexts = sourceTexts;
      suggestion.originalText = encodeMergeSourceTexts(sourceTexts);
    } else if (!suggestion.originalText
      || !resumeContainsExactText(content, suggestion.originalText)
      || !canEditResumeText(content, section, suggestion.originalText)) {
      return false;
    } else {
      qualitySourceTexts = [suggestion.originalText];
    }
    if (operation !== 'delete' && (section === 'experience' || section === 'project')) {
      if (!isResumeBulletLeadAligned(suggestion.proposedText, content.language)) return false;
      if (!hasOutcomeSignal(suggestion.proposedText, content.language)) return false;
      const proposalForMetrics = suggestion.proposedText.replace(/\s+/g, '');
      if (numericEvidence(qualitySourceTexts.join(' ')).some((token) => !proposalForMetrics.includes(token))) {
        return false;
      }
      const knownEvidence = `${JSON.stringify(content)} ${confirmedFacts}`.replace(/\s+/g, '');
      if (numericEvidence(suggestion.proposedText).some((token) => !knownEvidence.includes(token))) {
        suggestion.needsUserInput = true;
      }
    }
    if ((operation === 'replace' || operation === 'merge')
      && suggestion.proposedText !== suggestion.originalText
      && resumeContainsExactText(content, suggestion.proposedText)) {
      return false;
    }
    const mutatedOriginals = operation === 'merge'
      ? JSON.parse(suggestion.originalText) as string[]
      : operation === 'replace' || operation === 'delete'
        ? [suggestion.originalText]
        : [];
    if (mutatedOriginals.some((text) => claimedOriginals.has(text))) return false;
    for (const text of mutatedOriginals) claimedOriginals.add(text);
    const key = `${operation}:${section}:${suggestion.originalText}:${suggestion.proposedText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (operation === 'append') {
      if (section === 'skills' && suggestion.needsUserInput) {
        skillConfirmationCount += 1;
        if (skillConfirmationCount > 3) return false;
      } else {
        appendCount += 1;
        if (appendCount > 2) return false;
      }
    }
      return true;
    });

    const confirmations = suggestions.filter((suggestion) => suggestion.operation === 'append'
      && suggestion.sectionKey === 'skills'
      && suggestion.needsUserInput);
    const regular = suggestions.filter((suggestion) => !confirmations.includes(suggestion));
    const confirmationSlots = Math.min(confirmations.length, Math.min(3, settings.suggestionLimit));
    return [
      ...regular.slice(0, Math.max(0, settings.suggestionLimit - confirmationSlots)),
      ...confirmations.slice(0, confirmationSlots),
    ];
  };

  let suggestions = validateSuggestions(result);
  const firstPlan = inspectResumeTuningPlan(content, suggestions);
  if (firstPlan.needsRevision) {
    try {
      const revisedResult = await requestStructured(
        'resume_tuning_revision',
        JSON_SCHEMAS.tune,
        tuneOutputSchema,
        [
          tuningInstructions,
          '上一版建议没有通过内容质量硬验收。请重新输出一套完整建议，不要输出对上一版的增量补丁。必须优先解决列点过多、泛标题、标题与正文错位和半句式要点。',
        ].join('\n'),
        `${tuningInput}\n\n【上一版未通过的原因】\n${firstPlan.issues.join('\n')}\n\n【上一版建议，仅用于发现问题，不可直接照抄】\n${sanitizeForAi(JSON.stringify(suggestions))}`,
        tuningSettings,
      );
      const revisedSuggestions = validateSuggestions(revisedResult);
      const revisedPlan = inspectResumeTuningPlan(content, revisedSuggestions);
      if (revisedPlan.score < firstPlan.score) suggestions = revisedSuggestions;
    } catch (error) {
      console.warn('Resume tuning quality revision failed; keeping first valid plan', error);
    }
  }

  return { suggestions };
}

export async function chatWithJobAi({
  jd,
  content,
  profile,
  message,
  history,
}: {
  jd: string;
  content: ResumeContent;
  profile: Profile;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const conversation = history
    .map((item) => `${item.role === 'user' ? '用户' : 'AI'}：${sanitizeForAi(item.content)}`)
    .join('\n');
  const answer = await requestText(
    [
      '你是岗位页面内的简历求职助手。围绕当前 JD、原始基础简历和候选人已确认事实回答用户问题。',
      '事实边界必须严格：明确区分“现有简历已证明”“事实库已确认”和“需要用户确认”；不得把 JD 要求当成候选人能力，不得编造技能、经历、数字或成果。',
      '你只能给出分析、提问或可直接复制的候选文本，不能声称已经修改简历。用户想新增未被证明的技能时，先用一句明确问题确认。',
      '涉及改写时遵守简历规则：经历要点使用“准确短标题：完整任务链”，标题与正文互证，保留相关量化证据，避免泛标题和碎片化小点。',
      '不要输出邮箱、手机号、详细地址或证件号。回答简洁、具体、可操作，默认使用中文。',
    ].join('\n'),
    `【岗位描述】\n${sanitizeForAi(jd)}\n\n【原始基础简历】\n${sanitizeForAi(JSON.stringify(content))}\n\n【候选人已确认事实】\n${sanitizeForAi(JSON.stringify(tuningProfileFacts(profile)))}\n\n【最近对话】\n${conversation || '无'}\n\n【用户当前问题】\n${sanitizeForAi(message)}`,
    profile.aiSettings,
  );
  return { answer: sanitizeForAi(answer) };
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
      '根据岗位描述、当前岗位版简历和候选人已确认事实，生成三个互不重复、可直接粘贴到招聘官网的文本：自我评价、个人自我介绍、岗位动机。',
      '先从 JD 中提取最重要的 2 至 3 个工作任务或能力要求，再只选择简历中有明确证据的经历、技能和结果与之对应。不要平均罗列所有经历。',
      language === 'zh'
        ? 'selfEvaluation 是简历/官网中的“自我评价”，不是经历摘要：必须写 300 至 420 个中文字符，分成 3 个自然段、5 至 7 句话。第一段概括职业方向、工作方式，以及与 JD 最相关的 2 至 3 项能力；第二段解释这些能力如何通过简历中已有的工作结果得到验证，但只能用不指名的方式点到为止；第三段说明这些能力如何转化为对目标岗位的具体贡献。'
        : 'selfEvaluation is a resume/profile summary, not a project history: write 180 to 260 words in 3 short paragraphs and 5 to 7 sentences. Paragraph one states the candidate\'s direction, working approach, and 2 to 3 capabilities most relevant to the JD; paragraph two briefly and anonymously grounds them in resume evidence; paragraph three explains the concrete value these capabilities can bring to the target role.',
      'selfEvaluation 必须体现“JD要求 → 候选人能力 → 简历事实支撑 → 岗位贡献”的匹配链路。不要只重复 JD，也不要只罗列个人优点；每一段都要解释为什么匹配。',
      'selfEvaluation 严禁直接提到任何项目名、实习单位、公司名、客户名或具体经历名称，也不要写“在某项目中”“在某段实习中”“在某公司期间”等经历复述。可以使用“在相关业务实践中”“在实际工作场景中”等不指名表达，但只能点到为止，不得展开成项目流水账。',
      'selfEvaluation 不要用分号串联多个场景，不要连续堆砌“指标、数据、看板、实验”等名词；要把并列概念改写成清楚的因果关系、工作方法和岗位价值。不得写“学习能力强、责任心强、沟通能力好”等没有事实支撑的套话。',
      'selfIntroduction 使用第一人称，适合官网填写或 60 秒口头介绍；中文 140 至 200 字，英文 90 至 130 词。开头直接说明当前方向，随后用 1 至 2 段最相关经历证明能力，结尾落到本岗位能解决什么问题；避免逐条复述简历。',
      'motivation 中文 100 至 170 字，英文 70 至 110 词；只说明候选人已有经历如何连接岗位任务，以及希望在岗位中继续贡献或验证什么，避免空泛赞美公司。',
      '三个文本都必须具体、克制、有岗位指向：每个文本至少出现一个来自 JD 的任务/能力方向，并至少对应一项简历事实；若没有足够证据，明确使用“接触过/参与过/希望继续提升”等表述。',
      '不得补充输入之外的公司事实、个人经历、技能、数字或成绩。不得把 JD 要求写成候选人已经掌握的能力。',
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

function numericEvidence(value: string) {
  return [...new Set(
    (value.match(/\d+(?:\.\d+)?(?:\s*(?:%|\+|分钟|小时|天|项|倍|万|亿|人|个))?/g) || [])
      .map((token) => token.replace(/\s+/g, '')),
  )];
}

function hasOutcomeSignal(value: string, language: ResumeContent['language']) {
  if (language === 'en') {
    return /support|enable|improv|reduc|accelerat|deliver|identify|inform|drive|streamlin|ensure|launch|complete|build/i.test(value);
  }
  return /支持|支撑|提升|降低|缩短|压缩|优化|实现|形成|沉淀|输出|识别|定位|保障|驱动|推进|落地|完成|减少|提高|助力|避免|闭环/.test(value);
}

function inspectResumeTuningPlan(content: ResumeContent, suggestions: TuneOutput['suggestions']) {
  let projected = structuredClone(content);
  for (const suggestion of suggestions) {
    projected = applyResumeSuggestion(
      projected,
      encodeSuggestionSection(suggestion.operation, suggestion.sectionKey),
      suggestion.originalText,
      suggestion.proposedText,
    );
  }

  const issues: string[] = [];
  let score = 0;
  projected.experiences.forEach((entry, index) => {
    const excess = Math.max(0, entry.bullets.length - 5);
    if (excess) {
      issues.push(`第 ${index + 1} 段经历仍有 ${entry.bullets.length} 条，必须收敛至 5 条以内。`);
      score += excess * 100;
    }

    const misaligned = entry.bullets.filter((bullet) => !isResumeBulletLeadAligned(bullet, projected.language));
    if (misaligned.length) {
      issues.push(`第 ${index + 1} 段经历仍有 ${misaligned.length} 条泛标题、无标题或标题正文不匹配。`);
      score += misaligned.length * 16;
    }

    const thin = entry.bullets.filter((bullet) => resumeBulletLength(bullet, projected.language) < (projected.language === 'zh' ? 65 : 24));
    if (thin.length) {
      issues.push(`第 ${index + 1} 段经历仍有 ${thin.length} 条内容过短，缺少完整任务链。`);
      score += thin.length * 5;
    }

    const leads = entry.bullets.map((bullet) => resumeBulletParts(bullet, projected.language).lead.toLowerCase());
    const duplicateLeads = leads.length - new Set(leads).size;
    if (duplicateLeads) {
      issues.push(`第 ${index + 1} 段经历仍有 ${duplicateLeads} 组重复或相同标题。`);
      score += duplicateLeads * 12;
    }
  });

  projected.projects.forEach((entry, index) => {
    const excess = Math.max(0, entry.bullets.length - 2);
    if (excess) {
      issues.push(`第 ${index + 1} 个项目仍有 ${entry.bullets.length} 条，必须收敛至 2 条以内。`);
      score += excess * 80;
    }
    const misaligned = entry.bullets.filter((bullet) => !isResumeBulletLeadAligned(bullet, projected.language));
    score += misaligned.length * 10;
  });

  return {
    issues,
    score,
    needsRevision: Boolean(
      projected.experiences.some((entry, index) => entry.bullets.length > 5
        || (index === 0 && entry.bullets.some((bullet) => !isResumeBulletLeadAligned(bullet, projected.language))))
      || projected.projects.some((entry) => entry.bullets.length > 2),
    ),
  };
}

function resumeBulletLength(value: string, language: ResumeContent['language']) {
  const body = resumeBulletParts(value, language).rest;
  return language === 'zh' ? body.length : body.split(/\s+/).filter(Boolean).length;
}
