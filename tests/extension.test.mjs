import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExtensionCatalog } from '../lib/extension-catalog.ts';
import { emptyProfile } from '../lib/product-types.ts';
import { formatValue, mappingScope, matchField } from '../chrome-extension/field-model.js';
import { readFile } from 'node:fs/promises';

// node:test registration returns a promise; the test runner owns its lifecycle.
/* oxlint-disable typescript/no-floating-promises */

function fixture() {
  const profile = structuredClone(emptyProfile);
  profile.identity = { ...profile.identity, name: 'Test Candidate', email: 'fixture@example.invalid', gender: 'Female', birthDate: '2000-02-29' };
  profile.education = [0, 1].map(index => ({ id: `edu-${index}`, school: `Fixture University ${index}`, degree: 'Master', major: 'Information', startDate: '2021-09', endDate: '2023-06', gpa: '3.9', rank: '', highlights: [] }));
  profile.experiences = [0, 1].map(index => ({ id: `exp-${index}`, organization: `Fixture Employer ${index}`, title: 'Analyst', startDate: '2023-05', endDate: '2023-08', location: 'Toronto', highlights: ['Verified achievement'] }));
  profile.customFields = [{ id: 'nationality', label: '国籍', group: '', value: '已核实的值' }];
  profile.skills = ['SQL'];
  return buildExtensionCatalog(profile, { skills: ['SQL', 'Excel', 'PRD', '招标书'] });
}
const field = (label, extra = {}) => ({ label, name: '', placeholder: '', autocomplete: '', context: '', fingerprint: label, type: 'text', recordIndex: 0, ...extra });
test('Chinese and English identity fields match verified facts', () => {
  for (const label of ['姓名', 'full name', 'candidate name']) assert.equal(matchField(field(label), fixture()).fact?.key, 'identity.name');
  for (const label of ['邮箱', 'email address']) assert.equal(matchField(field(label), fixture()).fact?.key, 'identity.email');
});
test('autocomplete supplies semantics without guessing first/last name', () => {
  assert.equal(matchField(field('无标签', { autocomplete: 'email' }), fixture()).fact?.key, 'identity.email');
  assert.equal(matchField(field('first name'), fixture()).fact, null);
  assert.equal(matchField(field('last name'), fixture()).fact, null);
});
test('repeat records use section and index, not the first row everywhere', () => {
  assert.equal(matchField(field('School', { context: 'Education', recordIndex: 1 }), fixture()).fact?.value, 'Fixture University 1');
  assert.equal(matchField(field('Company', { context: 'Work experience', recordIndex: 1 }), fixture()).fact?.value, 'Fixture Employer 1');
  assert.equal(matchField(field('School', { name: 'education[1].school' }), fixture()).fact?.value, 'Fixture University 1');
  assert.equal(matchField(field('School', { context: 'Education', recordIndex: 2 }), fixture()).fact, null);
});
test('generic company and dates without context stay blank', () => {
  assert.equal(matchField(field('Company'), fixture()).fact, null);
  assert.equal(matchField(field('Start date'), fixture()).fact, null);
  assert.equal(matchField(field('Start date', { context: 'Education' }), fixture()).fact?.key, 'education.0.startDate');
});
test('target company, consent, passwords and unknown questions stay blank', () => {
  for (const label of ['应聘公司', '申请职位', '密码', '同意隐私协议', 'captcha', 'citizenship', 'work authorization', 'your mothers name']) assert.equal(matchField(field(label), fixture()).fact, null, label);
});
test('explicit custom facts match; absent facts are not manufactured', () => {
  assert.equal(matchField(field('国籍'), fixture()).fact?.value, '已核实的值');
  assert.equal(matchField(field('手机'), fixture()).fact, null);
});
test('remembered corrections and explicit leave-blank override matcher', () => {
  assert.equal(matchField(field('特殊姓名字段'), fixture(), { 特殊姓名字段: 'identity.name' }).fact?.value, 'Test Candidate');
  assert.equal(matchField(field('姓名'), fixture(), { 姓名: '' }).fact, null);
});
test('missing day is never invented; invalid dates rejected', () => {
  assert.equal(formatValue({ type: 'date' }, '2023-06'), null);
  assert.equal(formatValue({ type: 'date' }, '2023-02-29'), null);
  assert.equal(formatValue({ type: 'date' }, '2000-2-29'), '2000-02-29');
  assert.equal(formatValue({ type: 'month' }, '2023.6'), '2023-06');
  assert.equal(formatValue({ type: 'month' }, '2023-13'), null);
});
test('all original skill categories survive catalog export', () => {
  const skills = fixture().find(fact => fact.key === 'profile.skills').value;
  for (const skill of ['SQL', 'Excel', 'PRD', '招标书']) assert.ok(skills.includes(skill));
});
test('ambiguous custom aliases do not win silently', () => {
  const facts = fixture(); facts.push({ ...facts[0], key: 'custom.other-name' });
  assert.equal(matchField(field('姓名'), facts).fact, null);
});
test('remembered form mappings survive a different job URL but not a different site', () => {
  assert.equal(mappingScope('https://fixture.invalid/jobs/abc12/apply'), mappingScope('https://fixture.invalid/jobs/xyz99/apply'));
  assert.notEqual(mappingScope('https://fixture.invalid/jobs/abc12/apply'), mappingScope('https://other.invalid/jobs/abc12/apply'));
});
test('phone components are not filled with the entire phone number', () => {
  assert.equal(matchField(field('phone code'), fixture()).fact, null);
});
test('extension uses user-triggered injections, no automatic submit or broad default grants', async () => {
  const manifest = JSON.parse(await readFile(new URL('../chrome-extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.content_scripts, undefined);
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  const content = await readFile(new URL('../chrome-extension/content-script.js', import.meta.url), 'utf8');
  assert.ok(!/requestSubmit\(|\.submit\(/.test(content));
});
