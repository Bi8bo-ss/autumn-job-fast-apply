import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLikelySupplementalNoise, normalizeResumeContent, parseResumeText, resumeContentToText } from '../lib/resume-parser.ts';
import { applyResumeSuggestion } from '../lib/resume-suggestions.ts';
import { mergeResumeSkillLines, removesExistingSkills, removeExistingSkillNames, skillNames } from '../lib/resume-skills.ts';
import { buildResumeHtml, buildResumeTex, packResumeDocument } from '../lib/resume-export.ts';
import { buildResumePreviewContent } from '../lib/resume-preview.ts';

// Transcribed skill content from the user's original screenshot; no identity data.
const software = ['BigQuery', 'MySQL', 'SQL', 'Python', 'Looker Studio', 'Excel', 'Microsoft 办公', 'Power BI', 'R', 'HTML5', 'CSS'];
const professional = ['数据建模', 'ERD 与数据库设计', '数据挖掘', '业务流程建模', 'PRD', '项目管理', '招标书', 'Business Metrics Analysis', 'User Behavior Analysis', '数据驱动决策'];
const originalLines = [
  '语言：中文（母语），英语（精通，可用作工作语言）；',
  `软件：${software.join('，')}；`,
  `专业：${professional.join('，')}。`,
];
const source = `示例姓名\n技能\n${originalLines.join('\n')}`;
const original = () => parseResumeText(source, 'zh');
const normalized = () => normalizeResumeContent(original(), source);
const expectedNames = new Set(originalLines.flatMap(skillNames));

function allOriginalSkillsPresent(content) {
  const actual = new Set(content.skills.flatMap(skillNames));
  for (const name of expectedNames) assert.ok(actual.has(name), `Lost original skill: ${name}`);
}

await test('MySQL followed by SQL is not noise and must not erase the software row', () => {
  for (const separator of [', ', '，', '、']) {
    const line = `软件：${software.join(separator)}；`;
    assert.equal(isLikelySupplementalNoise(line, 'zh'), false);
    allOriginalSkillsPresent(parseResumeText(source.replace(originalLines[1], line), 'zh'));
  }
  assert.equal(isLikelySupplementalNoise('项目统筹统筹物流项目协调', 'zh'), true);
});

await test('import preserves all 11 software, 10 professional, and 2 language items', () => {
  assert.equal(expectedNames.size, 23);
  assert.equal(original().skills.length, 3);
  allOriginalSkillsPresent(original());
});

await test('PDF line wraps inside an English skill name preserve the complete name', () => {
  const wrapped = source.replace('User Behavior Analysis', 'User\nBehavior Analysis');
  allOriginalSkillsPresent(parseResumeText(wrapped, 'zh'));
});

await test('old imports with a missing software row recover from saved source text', () => {
  const damaged = original();
  damaged.skills = damaged.skills.filter((line) => !line.startsWith('软件'));
  const recovered = normalizeResumeContent(damaged, source);
  allOriginalSkillsPresent(recovered);
  assert.equal(recovered.skills.length, 3);
  assert.deepEqual(normalizeResumeContent(recovered, source), recovered);
});

await test('partial rows recover without repeating a software category or skill', () => {
  const damaged = original();
  damaged.skills = ['数据工具：SQL、Python、BigQuery、Looker Studio', originalLines[0]];
  const recovered = normalizeResumeContent(damaged, source);
  allOriginalSkillsPresent(recovered);
  assert.equal(recovered.skills.length, 3);
  assert.equal(recovered.skills.flatMap(skillNames).length, 23);
});

await test('replaying old destructive suggestions cannot remove original skills', () => {
  let content = normalized();
  const softwareLine = content.skills.find((line) => line.startsWith('软件'));
  const professionalLine = content.skills.find((line) => line.startsWith('专业'));
  content = applyResumeSuggestion(content, 'delete:skills', softwareLine, '');
  content = applyResumeSuggestion(content, 'skills', professionalLine, '专业：数据建模、PRD');
  content = applyResumeSuggestion(content, 'skills', softwareLine, '数据工具：SQL、Python');
  allOriginalSkillsPresent(content);
});

await test('right-side pasted software draft really applies, including Excel and R', () => {
  const content = original();
  content.skills = [originalLines[0], originalLines[2]];
  const draft = `工具技能：BigQuery，MySQL，SQL，Python，Looker Studio\nExcel，Microsoft 办公，Power BI，R，HTML5，CSS；`;
  const preview = applyResumeSuggestion(content, 'append:skills', '', draft);
  allOriginalSkillsPresent(preview);
  const saved = JSON.parse(JSON.stringify(preview));
  allOriginalSkillsPresent(normalizeResumeContent(saved, resumeContentToText(saved)));
});

await test('confirmed tools are merged into one existing software row without lowercasing', () => {
  const content = normalized();
  const preview = applyResumeSuggestion(content, 'append:skills', '', '工具技能：Excel、PPT、Tableau');
  allOriginalSkillsPresent(preview);
  assert.equal(preview.skills.length, 3);
  assert.ok(preview.skills.find((line) => line.startsWith('软件')).endsWith('PPT、Tableau'));
  assert.deepEqual(applyResumeSuggestion(preview, 'append:skills', '', '工具技能：Excel、PPT、Tableau'), preview);
});

await test('skill deduplication preserves identifier punctuation, case and parentheses', () => {
  const input = '工具：C++、C#、HTML/CSS、Excel（透视表，函数）、R';
  const merged = mergeResumeSkillLines([input, '工具：C++、Python'], 'zh');
  assert.deepEqual(merged, [`${input}、Python`]);
  assert.deepEqual(removeExistingSkillNames('工具：SQL、Tableau、Power BI', ['工具：SQL']), '工具：Tableau、Power BI');
});

await test('multiple categories on a single row are not truncated at the second colon', () => {
  const line = '数据工具：SQL、Python；方法：数据建模、统计检验；应用：PRD、项目管理';
  assert.equal(skillNames(line).length, 6);
  assert.equal(removesExistingSkills(line, '工具：SQL、Python'), true);
  assert.equal(mergeResumeSkillLines([line], 'zh').length, 3);
});

await test('new versions and repeated normalization retain the complete skill list', () => {
  let content = normalized();
  content = applyResumeSuggestion(content, 'append:skills', '', '工具技能：Tableau');
  for (let index = 0; index < 3; index += 1) {
    content = normalizeResumeContent(JSON.parse(JSON.stringify(content)), resumeContentToText(content));
    allOriginalSkillsPresent(content);
    assert.equal(content.skills.flatMap(skillNames).length, 24);
  }
});

await test('actual workspace preview restores the source and follows draft, accept and skip states', () => {
  const damaged = original();
  damaged.skills = [originalLines[0], originalLines[2]];
  const version = { contentJson: JSON.stringify(damaged), sourceText: source };
  const suggestion = {
    id: 'test-skill', sectionKey: 'append:skills', originalText: '',
    proposedText: '工具技能：Excel', editedText: null, rationale: '', matchedRequirement: '',
    needsUserInput: true, state: 'pending',
  };
  const drafts = { 'test-skill': '工具技能：Excel、Tableau、PPT' };
  const preview = buildResumePreviewContent(version, [suggestion], suggestion, drafts);
  allOriginalSkillsPresent(preview);
  assert.ok(preview.skills.join('\n').includes('Tableau'));
  const accepted = { ...suggestion, state: 'accepted', editedText: drafts['test-skill'] };
  assert.deepEqual(buildResumePreviewContent(version, [accepted], undefined, {}), preview);
  const skipped = buildResumePreviewContent(version, [{ ...suggestion, state: 'rejected' }], undefined, drafts);
  allOriginalSkillsPresent(skipped);
  assert.ok(!skipped.skills.join('\n').includes('Tableau'));
  allOriginalSkillsPresent(normalizeResumeContent(preview, resumeContentToText(preview)));
});

await test('HTML, LaTeX and DOCX exporters receive and include every original skill', async () => {
  const content = normalized();
  const html = buildResumeHtml(content, 'skill-regression');
  const tex = buildResumeTex(content);
  for (const skill of [...software, ...professional]) {
    assert.ok(html.includes(skill), `HTML missing ${skill}`);
    assert.ok(tex.includes(skill), `LaTeX missing ${skill}`);
  }
  // DOCX is ZIP; check the generated document XML, not only the input structure.
  const bytes = await packResumeDocument(content, null);
  const { default: mammoth } = await import('mammoth');
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  for (const skill of [...software, ...professional]) assert.ok(value.includes(skill), `DOCX missing ${skill}`);
});
