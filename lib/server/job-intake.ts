import { db } from './data';

type MatchedResume = {
  resumeId: string;
  resumeName: string;
  resumeVersionId: string;
  language: 'zh' | 'en';
  sourceText: string;
};

const skillTerms = [
  'python', 'java', 'javascript', 'typescript', 'react', 'vue', 'sql', 'excel',
  'tableau', 'power bi', 'pytorch', 'tensorflow', 'c++', 'golang', 'node.js',
  '数据分析', '数据科学', '机器学习', '深度学习', '产品经理', '用户研究',
  '增长', '运营', '市场', '咨询', '金融', '投研', '量化', '风控', '供应链',
  '前端', '后端', '算法', '测试', '设计', '交互', '商业分析', '项目管理',
];

export function extractJobMetadata(jd: string) {
  const lines = jd.split(/\r?\n/).map(cleanLine).filter(Boolean).slice(0, 80);
  const company = firstLabeled(lines, ['公司名称', '招聘公司', '公司', '企业名称', '单位', 'company', 'employer']);
  const role = firstLabeled(lines, ['岗位名称', '招聘岗位', '职位名称', '职位', '岗位', 'job title', 'position', 'role']);
  const location = firstLabeled(lines, ['工作地点', '办公地点', '岗位地点', '地点', 'location', 'city']);

  let inferredCompany = company;
  let inferredRole = role;
  if (!inferredCompany || !inferredRole) {
    for (const line of lines.slice(0, 10)) {
      const pair = line.match(/^(.{2,50}?)\s*(?:[-—|｜·])\s*(.{2,80})$/);
      if (!pair) continue;
      if (!inferredCompany && looksLikeCompany(pair[1])) inferredCompany = pair[1];
      if (!inferredRole && looksLikeRole(pair[2])) inferredRole = pair[2];
      if (inferredCompany && inferredRole) break;
    }
  }
  if (!inferredCompany) inferredCompany = lines.slice(0, 12).find(looksLikeCompany) || '';
  if (!inferredRole) inferredRole = lines.slice(0, 16).find(looksLikeRole) || '';

  return {
    company: trimValue(inferredCompany),
    role: trimValue(inferredRole),
    location: trimValue(location),
    language: detectLanguage(jd),
  };
}

export async function matchResumeVersion(userId: string, jd: string, language: 'zh' | 'en') {
  const result = await db().prepare(`SELECT r.id AS resumeId, r.name AS resumeName,
    r.current_version_id AS resumeVersionId, r.language, rv.source_text AS sourceText
    FROM resumes r JOIN resume_versions rv ON rv.id = r.current_version_id
    WHERE r.user_id = ? AND r.current_version_id IS NOT NULL`).bind(userId).all<MatchedResume>();
  if (!result.results.length) return null;

  const jdLower = jd.toLowerCase();
  const jdWords = new Set(jdLower.match(/[a-z][a-z0-9+#.\-]{1,}/g) || []);
  const ranked = result.results.map((resume) => {
    const text = `${resume.resumeName}\n${resume.sourceText}`.toLowerCase();
    const resumeWords = new Set(text.match(/[a-z][a-z0-9+#.\-]{1,}/g) || []);
    let score = resume.language === language ? 30 : 0;
    for (const word of jdWords) if (word.length >= 3 && resumeWords.has(word)) score += 1;
    for (const term of skillTerms) if (jdLower.includes(term) && text.includes(term)) score += 6;
    for (const namePart of resume.resumeName.toLowerCase().split(/[\s_\-·|｜]+/)) {
      if (namePart.length >= 2 && jdLower.includes(namePart)) score += 8;
    }
    return { ...resume, score };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return best ? {
    resumeId: best.resumeId,
    resumeName: best.resumeName,
    resumeVersionId: best.resumeVersionId,
    language: best.language,
    score: best.score,
  } : null;
}

function firstLabeled(lines: string[], labels: string[]) {
  for (const line of lines) {
    for (const label of labels) {
      const match = line.match(new RegExp(`^${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`, 'i'));
      if (match?.[1]) return match[1];
    }
  }
  return '';
}

function cleanLine(line: string) {
  return line.trim().replace(/^[•·●○▪▫◆◇►▶★☆\-—]+\s*/, '').trim();
}

function trimValue(value: string) {
  return value.replace(/\s+(?:岗位职责|职位描述|工作职责|任职要求).*$/i, '').trim().slice(0, 160);
}

function looksLikeCompany(value: string) {
  return /(?:有限公司|有限责任公司|集团|科技|银行|证券|咨询|事务所|研究院|实验室|大学|company|inc\.?|ltd\.?|corp\.?)/i.test(value) && value.length <= 80;
}

function looksLikeRole(value: string) {
  return /(?:实习生|管培生|工程师|分析师|设计师|产品经理|运营|顾问|研究员|开发|算法|测试|销售|市场|招聘|intern|engineer|analyst|designer|manager|developer|consultant|researcher)/i.test(value) && value.length <= 100;
}

function detectLanguage(value: string): 'zh' | 'en' {
  const chinese = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (value.match(/[a-z]/gi) || []).length;
  return chinese >= latin * 0.15 ? 'zh' : 'en';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
