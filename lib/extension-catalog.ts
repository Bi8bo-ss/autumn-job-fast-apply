import type { ApplicationPackContent, Profile, ResumeContent } from './product-types';

export type ExtensionFact = {
  key: string; label: string; aliases: string[]; value: string;
  section: string; index: number; source: string;
};

// Only verified profile values and saved material are exported. No inference of
// nationality, work authorization, dates, degree equivalence or consent.
export function buildExtensionCatalog(profile: Profile, resume?: ResumeContent | null, pack?: ApplicationPackContent | null, useResumeEntries = false) {
  const facts: ExtensionFact[] = [];
  const add = (key: string, label: string, aliases: string[], value: string, section = 'identity', index = 0, source = '个人档案') => {
    if (value.trim()) facts.push({ key, label, aliases, value: value.trim(), section, index, source });
  };
  add('identity.name', '姓名', ['姓名', '您的姓名', '全名', 'full name', 'candidate name', 'name'], profile.identity.name);
  add('identity.email', '邮箱', ['邮箱', '电子邮箱', '电子邮件', 'email', 'e-mail', 'email address'], profile.identity.email);
  add('identity.phone', '手机', ['手机', '手机号', '手机号码', '联系电话', 'mobile', 'phone', 'telephone', 'phone number'], profile.identity.phone);
  add('identity.location', '现居地', ['现居地', '居住城市', 'current location', 'current city', 'address'], profile.identity.location);
  add('identity.gender', '性别', ['性别', 'gender'], profile.identity.gender);
  add('identity.birthDate', '出生日期', ['出生日期', '生日', 'date of birth', 'birth date', 'dob'], profile.identity.birthDate);
  add('identity.idNumber', '证件号码', ['身份证号', '身份证号码', 'id number'], profile.identity.idNumber);
  profile.education.forEach((entry, index) => {
    const put = (key: string, label: string, aliases: string[], value: string) => add(`education.${index}.${key}`, `教育 ${index + 1} · ${label}`, aliases, value, 'education', index);
    put('school', '学校', ['学校', '学校名称', '毕业院校', '院校', 'school', 'university', 'institution', 'college'], entry.school);
    put('degree', '学历', ['学历', '学位', 'degree', 'qualification'], entry.degree);
    put('major', '专业', ['专业', '专业名称', 'major', 'field of study'], entry.major);
    put('startDate', '入学日期', ['入学日期', '入学时间', '开始日期', 'start date', 'from'], entry.startDate);
    put('endDate', '毕业日期', ['毕业日期', '毕业时间', '结束日期', 'end date', 'graduation date', 'to'], entry.endDate);
    put('gpa', 'GPA', ['gpa', '绩点'], entry.gpa);
    put('rank', '排名', ['排名', 'ranking', 'rank'], entry.rank);
    put('description', '教育描述', ['教育描述', '课程', 'education description', 'coursework'], entry.highlights.join('\n'));
  });
  for (const section of ['experiences', 'projects'] as const) {
    profile[section].forEach((entry, index) => {
      const put = (key: string, label: string, aliases: string[], value: string) => add(`${section}.${index}.${key}`, `${section === 'experiences' ? '经历' : '项目'} ${index + 1} · ${label}`, aliases, value, section, index);
      put('organization', '单位', section === 'experiences' ? ['公司名称', '工作单位', '实习单位', 'employer', 'company', 'organization'] : ['项目单位', '项目组织', 'organization'], entry.organization);
      put('title', section === 'experiences' ? '职位' : '项目名称', section === 'experiences' ? ['职位', '职务', '岗位名称', 'job title', 'position', 'title'] : ['项目名称', 'project name', 'project title'], entry.title);
      put('location', '地点', ['工作地点', '地点', 'location'], entry.location);
      put('startDate', '开始日期', ['开始日期', '开始时间', '入职日期', 'start date', 'from'], entry.startDate);
      put('endDate', '结束日期', ['结束日期', '结束时间', '离职日期', 'end date', 'to'], entry.endDate);
      const compact = (text: string) => text.toLowerCase().replace(/\s+/g, '');
      const organization = compact(entry.organization), title = compact(entry.title);
      const savedEntries = useResumeEntries && organization.length >= 2 ? (resume?.[section] || []).filter(item => compact(item.heading).includes(organization) && (!title || compact(item.heading).includes(title))) : [];
      const description = savedEntries.length === 1 ? savedEntries[0].bullets.join('\n') : entry.highlights.join('\n');
      add(`${section}.${index}.description`, `${section === 'experiences' ? '经历' : '项目'} ${index + 1} · 描述`, ['职责描述', '工作内容', '工作描述', '项目描述', '主要职责', 'description', 'responsibilities', 'duties'], description, section, index, savedEntries.length === 1 ? '已保存岗位简历' : '个人档案');
    });
  }
  add('profile.skills', '技能（完整保留）', ['技能', '专业技能', 'skills', 'technical skills'], [...new Set([...profile.skills, ...(resume?.skills || [])])].join('\n'), 'profile');
  add('profile.languages', '语言', ['语言能力', '语言', 'languages'], profile.languages.join('\n'), 'profile');
  add('profile.certificates', '证书', ['证书', '资格证书', 'certifications', 'certificates'], profile.certificates.join('\n'), 'profile');
  add('profile.awards', '奖项', ['奖项', '获奖情况', 'awards'], profile.awards.join('\n'), 'profile');
  // Two languages are intentionally separate: the matcher must not guess which
  // self-introduction a company expects.
  add('profile.summary.zh', '自我介绍（中文）', ['中文自我介绍', '中文个人简介'], profile.summaries.zh, 'profile');
  add('profile.summary.en', 'Self introduction (English)', ['english self introduction', 'english summary'], profile.summaries.en, 'profile');
  add('preferences.availability', '到岗时间', ['到岗时间', '可入职时间', 'availability', 'available start date'], profile.preferences.availability, 'preferences');
  add('preferences.expectedSalary', '期望薪资', ['期望薪资', '期望薪酬', 'expected salary', 'salary expectation'], profile.preferences.expectedSalary, 'preferences');
  add('preferences.desiredLocations', '意向地点', ['意向地点', '意向城市', 'preferred locations'], profile.preferences.desiredLocations.join('、'), 'preferences');
  add('preferences.desiredRoles', '意向岗位', ['意向岗位', 'preferred roles'], profile.preferences.desiredRoles.join('、'), 'preferences');
  profile.customFields.forEach(entry => add(`custom.${entry.id}`, entry.label, [entry.label], entry.value, 'custom'));
  if (pack) {
    add('material.selfEvaluation', '岗位自我评价', ['自我评价', 'self evaluation'], pack.selfEvaluation, 'material', 0, '已保存岗位材料');
    add('material.selfIntroduction', '岗位自我介绍', ['自我介绍', '个人简介', 'self introduction', 'personal statement'], pack.selfIntroduction, 'material', 0, '已保存岗位材料');
    add('material.motivation', '申请动机', ['申请动机', '求职动机', 'why this role', 'motivation', 'why our company'], pack.motivation, 'material', 0, '已保存岗位材料');
  }
  return facts;
}
