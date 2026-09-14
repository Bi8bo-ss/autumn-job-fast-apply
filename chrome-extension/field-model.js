export const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_*:：()（）\-./[\]0-9]/g, '');

export function inferSection(value) {
  const text = String(value).toLowerCase();
  if (/education|academic|学校|教育|学历|院校|学业/.test(text)) return 'education';
  if (/project|项目/.test(text)) return 'projects';
  if (/experience|employment|work history|工作经历|实习经历|工作经验|任职/.test(text)) return 'experiences';
  return '';
}

const autocompleteKeys = { name: 'identity.name', email: 'identity.email', tel: 'identity.phone', bday: 'identity.birthDate' };
export function matchField(field, facts, mapping = {}) {
  if (Object.hasOwn(mapping, field.fingerprint)) {
    const fact = facts.find(item => item.key === mapping[field.fingerprint]);
    return { fact: fact || null, confidence: fact ? 1 : 0, reason: fact ? '网站已记住的对应关系' : '已设为留空 / 资料不存在' };
  }
  const label = normalize(field.label);
  const name = normalize(field.name);
  if (/password|密码|验证码|captcha|同意|agreement|consent|subscribe|隐私|招聘公司|应聘公司|申请公司|申请职位|应聘岗位|desiredcompany|区号|国家代码|countrycode|dialcode|phonecode|分机/.test(label + name)) return { fact: null, confidence: 0, reason: '需要本人操作' };
  const explicitSection = /^(学历|学位|学校|院校|毕业院校|专业名称|school|university|college|degree|major)$/.test(label) ? 'education' : /^(项目名称|projectname|projecttitle)$/.test(label) ? 'projects' : '';
  const section = field.section || inferSection(field.context + ' ' + field.name) || explicitSection;
  const explicitIndex = field.name.match(/(?:education|experiences?|projects?|employment)[._[]([0-9]+)/i);
  const index = explicitIndex ? Number(explicitIndex[1]) : (field.recordIndex || 0);
  const ranked = facts.map(fact => {
    const repeated = ['education', 'experiences', 'projects'].includes(fact.section);
    if (repeated && (fact.index !== index || (section && section !== fact.section))) return { fact, score: 0 };
    if (section && ['education', 'experiences', 'projects'].includes(section) && !repeated && fact.section !== 'custom') return { fact, score: 0 };
    let score = autocompleteKeys[field.autocomplete] === fact.key ? 100 : 0;
    for (const alias of fact.aliases) {
      const term = normalize(alias);
      if (!term) continue;
      if (label === term) score = Math.max(score, 100);
      // Only allow compound labels with a small qualifier, not prose containing
      // unrelated words. Short English tokens such as "to" never substring-match.
      else if (term.length >= 4 && term !== 'name' && label.includes(term) && label.length <= term.length + 8) score = Math.max(score, 86);
      if (name === term) score = Math.max(score, 82);
      if (normalize(field.placeholder) === term) score = Math.max(score, 84);
    }
    if (repeated && !section && !/学校|院校|school|university|gpa|专业|major|毕业|入学/.test(field.label.toLowerCase())) score = Math.min(score, 65);
    return { fact, score };
  }).sort((a, b) => b.score - a.score);
  const first = ranked[0], second = ranked[1];
  if (!first || first.score < 80 || (second && first.score - second.score < 12)) return { fact: null, confidence: 0, reason: first?.score ? '对应关系不确定，请指定资料' : '没有已知资料，留空' };
  return { fact: first.fact, confidence: first.score / 100, reason: '字段含义与资料匹配' };
}

export function formatValue(field, value) {
  if (field.type === 'date' || field.type === 'month') {
    const parts = String(value).trim().match(/^(\d{4})[-./年](\d{1,2})(?:[-./月](\d{1,2})日?)?$/);
    if (!parts || Number(parts[2]) < 1 || Number(parts[2]) > 12) return null;
    if (field.type === 'date' && (!parts[3] || Number(parts[3]) < 1 || Number(parts[3]) > new Date(Number(parts[1]), Number(parts[2]), 0).getDate())) return null;
    return `${parts[1]}-${parts[2].padStart(2, '0')}${field.type === 'date' ? '-' + parts[3].padStart(2, '0') : ''}`;
  }
  return String(value);
}

export function mappingScope(pageUrl) {
  const url = new URL(pageUrl);
  const path = url.pathname.replace(/\/(jobs?|positions?|requisitions?)\/[^/]+/gi, '/$1/:job').replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id').replace(/\b\d+\b/g, ':id');
  return 'mapping:' + url.origin + path;
}
