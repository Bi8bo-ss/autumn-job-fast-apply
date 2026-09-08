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
  const lines = prepareJobLines(jd).slice(0, 120);
  const company = firstLabeled(lines, [
    '公司名称', '招聘公司', '公司', '企业名称', '企业', '用人单位', '单位名称',
    '单位', 'company name', 'company', 'employer',
  ]);
  const role = firstLabeled(lines, [
    '岗位名称', '招聘岗位', '应聘职位', '职位名称', '职位类别', '职位', '岗位',
    'job title', 'position title', 'position', 'role',
  ]);
  const location = firstLabeled(lines, [
    '工作城市', '工作地点', '办公地点', '岗位地点', '工作地区', '所在城市',
    '地点', 'location', 'work location', 'city',
  ]);

  let inferredCompany = company;
  let inferredRole = role;
  if (!inferredCompany || !inferredRole) {
    for (const line of lines.slice(0, 24)) {
      const bracketed = line.match(/^[【[]([^\]】]{2,80})[\]】]\s*[-—|｜·:]?\s*(.{2,120})$/);
      const pair = bracketed || line.match(/^(.{2,80}?)\s*(?:[-—|｜·@])\s*(.{2,120})$/);
      if (!pair) continue;
      const left = trimValue(pair[1]);
      const right = trimValue(pair[2]);
      if (!inferredCompany && looksLikeCompany(left) && looksLikeRole(right)) inferredCompany = left;
      if (!inferredRole && looksLikeCompany(left) && looksLikeRole(right)) inferredRole = right;
      if (!inferredCompany && looksLikeRole(left) && looksLikeCompany(right)) inferredCompany = right;
      if (!inferredRole && looksLikeRole(left) && looksLikeCompany(right)) inferredRole = left;
      if (inferredCompany && inferredRole) break;
    }
  }
  if (!inferredCompany) inferredCompany = lines.slice(0, 30).find(looksLikeCompany) || '';
  if (!inferredRole) inferredRole = lines.slice(0, 30).find(looksLikeRole) || '';

  if (inferredRole && !inferredCompany) {
    const roleIndex = lines.findIndex((line) => trimValue(line) === trimValue(inferredRole));
    const nearby = roleIndex >= 0 ? lines.slice(Math.max(0, roleIndex - 3), roleIndex) : [];
    inferredCompany = [...nearby].reverse().find(looksLikeStandaloneCompany) || '';
  }

  return {
    company: cleanCompany(inferredCompany),
    role: cleanRole(inferredRole),
    location: cleanLocation(location),
    language: detectLanguage(jd),
  };
}

export async function matchResumeVersion(userId: string, jd: string, language: 'zh' | 'en') {
  const result = await db().prepare(`SELECT r.id AS resumeId, r.name AS resumeName,
    rv.id AS resumeVersionId, r.language, rv.source_text AS sourceText
    FROM resumes r JOIN resume_versions rv ON rv.id = (
      SELECT original.id FROM resume_versions original
      WHERE original.user_id = r.user_id AND original.resume_id = r.id
        AND original.job_id IS NULL AND original.parent_version_id IS NULL
      ORDER BY original.version_number ASC, original.created_at ASC LIMIT 1
    )
    WHERE r.user_id = ?`).bind(userId).all<MatchedResume>();
  if (!result.results.length) return null;

  const jdLower = jd.toLowerCase();
  const jdWords = new Set(jdLower.match(/[a-z][a-z0-9+#.-]{1,}/g) || []);
  const ranked = result.results.map((resume) => {
    const text = `${resume.resumeName}\n${resume.sourceText}`.toLowerCase();
    const resumeWords = new Set(text.match(/[a-z][a-z0-9+#.-]{1,}/g) || []);
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
      const match = line.match(
        new RegExp(`^(?:[【[])?${escapeRegExp(label)}(?:[\\]】])?\\s*(?:[:：=|｜]|\\s+)\\s*(.+)$`, 'i'),
      );
      if (match?.[1]) return match[1];
    }
  }
  return '';
}

function cleanLine(line: string) {
  return line
    .replace(/&nbsp;|&#x20;|\u00a0/gi, ' ')
    .replace(/[\t\u2002-\u200b]+/g, ' ')
    .trim()
    .replace(/^[•·●○▪▫◆◇►▶★☆✓✔➤»>\-—]+\s*/, '')
    .trim();
}

function prepareJobLines(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map(cleanLine)
    .flatMap((line) => line.split(/\s+(?=(?:公司名称|招聘公司|岗位名称|招聘岗位|职位名称|工作地点|办公地点|company|job title|location)\s*[:：=])/i))
    .map(cleanLine)
    .filter(Boolean);
}

function trimValue(value: string) {
  return value
    .replace(/^[\s:：=|｜·\-—]+|[\s|｜]+$/g, '')
    .replace(/\s+(?:岗位职责|职位描述|工作职责|任职要求|职位要求|岗位要求|job description|responsibilities|requirements).*$/i, '')
    .trim()
    .slice(0, 160);
}

function cleanCompany(value: string) {
  return trimValue(value)
    .replace(/^(?:招聘单位|招聘公司|公司名称|企业名称|company)\s*[:：]?\s*/i, '')
    .replace(/\s*(?:招聘官网|招聘主页|招聘)$|\s*[-—|｜]\s*(?:职位详情|校园招聘).*$/i, '')
    .trim()
    .slice(0, 120);
}

function cleanRole(value: string) {
  return trimValue(value)
    .replace(/^(?:招聘岗位|岗位名称|应聘职位|职位名称|职位|岗位|job title|position)\s*[:：]?\s*/i, '')
    .replace(/\s*[-—|｜]\s*(?:职位详情|校园招聘|社会招聘|立即申请|申请职位).*$/i, '')
    .replace(/\s*[（(]?(?:职位编号|岗位编号|job id)\s*[:：#]?\s*[\w-]+[）)]?$/i, '')
    .trim()
    .slice(0, 160);
}

function cleanLocation(value: string) {
  return trimValue(value)
    .replace(/^(?:工作城市|工作地点|办公地点|岗位地点|地点|location|city)\s*[:：]?\s*/i, '')
    .replace(/\s+(?:职位类别|岗位职责|招聘人数).*$/i, '')
    .trim()
    .slice(0, 120);
}

function looksLikeCompany(value: string) {
  return /(?:有限公司|有限责任公司|股份公司|股份有限公司|集团|科技|网络|信息技术|智能|银行|证券|保险|咨询|事务所|研究院|实验室|大学|学院|中心|company|inc\.?|ltd\.?|corp\.?|corporation|group|technology)/i.test(value)
    && value.length >= 2
    && value.length <= 100
    && !looksLikeSection(value);
}

function looksLikeStandaloneCompany(value: string) {
  const cleaned = cleanCompany(value);
  return (looksLikeCompany(cleaned)
    || (/^[\p{L}\p{N}][\p{L}\p{N}&+.·（）()\- ]{1,39}$/u.test(cleaned)
      && !looksLikeRole(cleaned)))
    && !looksLikeSection(cleaned)
    && !/[¥￥$]|\d+[kK万][-–—~至]/.test(cleaned);
}

function looksLikeRole(value: string) {
  return /(?:实习生|管培生|工程师|分析师|设计师|产品经理|产品岗|运营|顾问|研究员|开发|研发|算法|测试|销售|市场|策划|专员|助理|经理|管理培训|数据分析|商业分析|用户研究|intern(?:ship)?|engineer|analyst|designer|manager|developer|consultant|researcher|specialist|assistant|trainee)/i.test(value)
    && value.length >= 2
    && value.length <= 120
    && !looksLikeSection(value);
}

function looksLikeSection(value: string) {
  return /^(?:岗位职责|职位描述|工作职责|任职要求|职位要求|岗位要求|公司介绍|公司简介|关于我们|福利待遇|职位信息|招聘信息|申请方式|job description|responsibilities|requirements|about us)$/i.test(trimValue(value));
}

function detectLanguage(value: string): 'zh' | 'en' {
  const chinese = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (value.match(/[a-z]/gi) || []).length;
  return chinese >= latin * 0.15 ? 'zh' : 'en';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
