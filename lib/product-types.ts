import { z } from 'zod';

export const jobStatuses = [
  'wishlist',
  'applied',
  'assessment',
  'interview',
  'offer',
  'closed',
] as const;

export const jobStatusLabels: Record<(typeof jobStatuses)[number], string> = {
  wishlist: '待投递',
  applied: '已投递',
  assessment: '笔试',
  interview: '面试',
  offer: 'Offer',
  closed: '结束',
};

export const aiSettingsSchema = z.object({
  reasoningEffort: z.enum(['low', 'medium']).default('low'),
  writingStyle: z.enum(['concise', 'balanced', 'detailed']).default('balanced'),
  suggestionLimit: z.union([z.literal(6), z.literal(10), z.literal(12)]).default(10),
  outputLanguage: z.enum(['auto', 'zh', 'en']).default('auto'),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const emptyAiSettings: AiSettings = {
  reasoningEffort: 'low',
  writingStyle: 'balanced',
  suggestionLimit: 10,
  outputLanguage: 'auto',
};

const datedEntry = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string(),
  highlights: z.array(z.string()),
});

export const profileSchema = z.object({
  identity: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    gender: z.string(),
    birthDate: z.string(),
    idNumber: z.string(),
  }),
  education: z.array(
    z.object({
      id: z.string(),
      school: z.string(),
      degree: z.string(),
      major: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      gpa: z.string(),
      rank: z.string(),
      highlights: z.array(z.string()),
    }),
  ),
  experiences: z.array(datedEntry),
  projects: z.array(datedEntry),
  skills: z.array(z.string()),
  certificates: z.array(z.string()),
  awards: z.array(z.string()),
  languages: z.array(z.string()),
  summaries: z.object({ zh: z.string(), en: z.string() }),
  preferences: z.object({
    desiredRoles: z.array(z.string()),
    desiredLocations: z.array(z.string()),
    availability: z.string(),
    expectedSalary: z.string(),
  }),
  customFields: z.array(
    z.object({
      id: z.string(),
      group: z.string(),
      label: z.string(),
      value: z.string(),
    }),
  ),
  aiSettings: aiSettingsSchema.default(emptyAiSettings),
});

export type Profile = z.infer<typeof profileSchema>;

export const emptyProfile: Profile = {
  identity: {
    name: '',
    email: '',
    phone: '',
    location: '',
    gender: '',
    birthDate: '',
    idNumber: '',
  },
  education: [],
  experiences: [],
  projects: [],
  skills: [],
  certificates: [],
  awards: [],
  languages: [],
  summaries: { zh: '', en: '' },
  preferences: {
    desiredRoles: [],
    desiredLocations: [],
    availability: '',
    expectedSalary: '',
  },
  customFields: [],
  aiSettings: emptyAiSettings,
};

export const resumeContentSchema = z.object({
  language: z.enum(['zh', 'en']),
  headline: z.string(),
  summary: z.string(),
  education: z.array(z.string()),
  experiences: z.array(
    z.object({
      heading: z.string(),
      meta: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      heading: z.string(),
      meta: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.array(z.string()),
  extras: z.array(z.string()),
});

export type ResumeContent = z.infer<typeof resumeContentSchema>;

export const jobInputSchema = z.object({
  company: z.string().trim().min(1, '请填写公司名称').max(120),
  role: z.string().trim().min(1, '请填写岗位名称').max(160),
  location: z.string().trim().max(120).default(''),
  jd: z.string().trim().min(30, '岗位描述至少需要 30 个字').max(40_000),
  sourceUrl: z.union([z.literal(''), z.url('请输入有效链接')]).default(''),
  deadline: z.string().default(''),
  language: z.enum(['zh', 'en']).default('zh'),
  resumeVersionId: z.string().optional(),
});

export const suggestionUpdateSchema = z.object({
  state: z.enum(['pending', 'accepted', 'rejected']),
  editedText: z.string().max(5000).optional(),
  confirmedByUser: z.boolean().optional(),
});

export const jobChatInputSchema = z.object({
  message: z.string().trim().min(1, '请输入想问 AI 的内容').max(3000),
  resumeVersionId: z.string().min(1),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000),
  })).max(12).default([]),
});

export const customAnswerInputSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  charLimit: z.number().int().min(20).max(5000).optional(),
});

export type JobStatus = (typeof jobStatuses)[number];

export type JobAnalysis = {
  score: number;
  summary: string;
  mustHave: string[];
  preferred: string[];
  keywords: string[];
  strengths: string[];
  gaps: string[];
};

export type TuneSuggestion = {
  id: string;
  sectionKey: string;
  originalText: string;
  proposedText: string;
  editedText: string | null;
  rationale: string;
  matchedRequirement: string;
  needsUserInput: boolean;
  state: 'pending' | 'accepted' | 'rejected';
};

export type MaterialField = {
  id: string;
  label: string;
  value: string;
  source: string;
  missing: boolean;
};

export type MaterialGroup = {
  id: string;
  title: string;
  fields: MaterialField[];
};

export type ApplicationPackContent = {
  groups: MaterialGroup[];
  selfIntroduction: string;
  motivation: string;
  missingFields: string[];
};
