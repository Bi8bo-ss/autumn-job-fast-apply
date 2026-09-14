/* global chrome */
import { formatValue, mappingScope, matchField } from './field-model.js';
const $ = id => document.getElementById(id);
let bundle = null, capture = null, scan = null, mapping = {}, scope = '', decisions = [];
const status = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'error' : ''; };
async function send(type, data = {}) {
  const result = await chrome.runtime.sendMessage({ type, ...data });
  if (!result?.ok) throw new Error(result?.error || '插件连接失败');
  return result.value;
}
async function run(button, task) {
  button.disabled = true;
  try { await task(); } catch (error) { status(error.message, true); }
  finally { button.disabled = false; }
}
function switchPane(name) {
  $('capture-pane').hidden = name !== 'capture'; $('fill-pane').hidden = name !== 'fill';
  $('capture-tab').classList.toggle('active', name === 'capture'); $('fill-tab').classList.toggle('active', name === 'fill');
}
$('capture-tab').onclick = () => switchPane('capture');
$('fill-tab').onclick = () => switchPane('fill');
$('open-site').onclick = () => run($('open-site'), () => send('openSite'));
$('profile').onclick = () => run($('profile'), () => send('openSite', { path: '/profile' }));
async function sync() {
  status('正在通过已登录的网站同步资料…');
  const jobId = $('job').value;
  bundle = await send('sync', { jobId });
  $('job').replaceChildren(new Option('仅使用个人档案', ''), ...bundle.jobs.map(job => new Option(`${job.company} · ${job.role}`, job.id)));
  $('job').value = jobId;
  $('sync-info').textContent = `已同步 ${bundle.facts.length} 项非空资料${bundle.resumeName ? ' · 简历：' + bundle.resumeName : ''} · ${new Date(bundle.updatedAt).toLocaleTimeString()}`;
  scan = null; $('fields').replaceChildren(); $('fill').disabled = true;
  status('资料已同步。选择本次岗位后，识别网申页面字段。');
}
$('sync').onclick = () => run($('sync'), sync);
$('job').onchange = () => run($('sync'), sync);
$('capture').onclick = () => run($('capture'), async () => {
  status('正在采集当前页面…');
  capture = await send('capture');
  $('screenshot').src = capture.screenshot; $('capture-preview').hidden = false;
  $('source-url').value = capture.page.url; $('jd').value = capture.page.text;
  $('company').value = ''; $('role').value = ''; $('location').value = ''; $('deadline').value = '';
  $('job-form').hidden = false;
  status('截图和正文已采集。可点击 AI 提取，或手动填写后保存。');
});
$('extract').onclick = () => run($('extract'), async () => {
  if (!capture) throw new Error('请先采集网页');
  status('正在提取岗位信息（本次截图和正文会发送到网站 AI）…');
  const result = await send('extract', { page: { ...capture.page, screenshot: capture.screenshot } });
  for (const key of ['company', 'role', 'location', 'deadline', 'jd']) $(key).value = result[key] || '';
  $('source-url').value = result.sourceUrl || capture.page.url;
  status('提取完成，请检查公司、岗位和 JD，再保存。未确定的信息留空。');
});
$('job-form').onsubmit = event => {
  event.preventDefault();
  void run($('save-job'), async () => {
    const jd = $('jd').value.trim();
    const result = await send('saveJob', { job: { company: $('company').value, role: $('role').value, location: $('location').value, deadline: $('deadline').value, jd, sourceUrl: $('source-url').value, language: /[\u4e00-\u9fff]/.test(jd) ? 'zh' : 'en' } });
    status(`已保存岗位。回网站的岗位列表继续匹配和定向改写。岗位编号：${result.job.id}`);
  });
};

async function grantCurrentOrigin() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/^https?:\/\//.test(tab?.url || '')) throw new Error('请切换到网申网页。');
  const origin = new URL(tab.url).origin + '/*';
  if (!(await chrome.permissions.contains({ origins: [origin] })) && !(await chrome.permissions.request({ origins: [origin] }))) throw new Error('此网页未授权，无法填写。');
}
$('grant-frame').onclick = () => run($('grant-frame'), async () => {
  const url = new URL($('frame-origin').value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('请输入 https:// 或 http:// 域名');
  const granted = await chrome.permissions.request({ origins: [url.origin + '/*'] });
  status(granted ? '域名已授权，请重新识别页面。' : '没有授权，嵌入表单仍留给你手动填写。');
});
function renderFields() {
  $('fields').replaceChildren(); decisions = [];
  for (const field of scan.fields) {
    const matched = matchField(field, bundle.facts, mapping);
    const container = document.createElement('div'); container.className = 'field';
    const title = document.createElement('strong'); title.textContent = field.label || field.name || '未命名字段';
    const details = document.createElement('small'); details.textContent = [field.context, `第 ${field.recordIndex + 1} 项`, field.type, matched.reason, field.value ? '已有内容，默认保留' : ''].filter(Boolean).join(' · ');
    const select = document.createElement('select'); select.setAttribute('aria-label', `为 ${title.textContent} 指定资料`);
    select.append(new Option('留空 / 暂不填写', ''), ...bundle.facts.map(fact => new Option(fact.label, fact.key)));
    select.value = matched.fact?.key || '';
    const preview = document.createElement('textarea'); preview.rows = 2; preview.readOnly = true; preview.setAttribute('aria-label', `${title.textContent} 待填内容`);
    const decision = { field, select, preview };
    const update = () => {
      const fact = bundle.facts.find(item => item.key === select.value);
      const value = fact ? formatValue(field, fact.value) : '';
      preview.value = value === null ? '资料日期不够完整或格式不适用，留空；可回网站补充。' : value;
    };
    select.onchange = async () => {
      update(); mapping[field.fingerprint] = select.value;
      await chrome.storage.local.set({ [scope]: mapping });
    };
    update(); decisions.push(decision); container.append(title, details, select, preview); $('fields').append(container);
  }
  $('fill').disabled = !scan.fields.length;
}
$('scan').onclick = () => run($('scan'), async () => {
  if (!bundle) throw new Error('请先同步网站资料。');
  await grantCurrentOrigin(); status('正在识别字段及所在分组…');
  scan = await send('scan');
  scope = mappingScope(scan.url);
  const stored = await chrome.storage.local.get(scope); mapping = stored[scope] || {};
  renderFields(); $('results').replaceChildren();
  status(`识别到 ${scan.fields.length} 个字段。检查对应关系后点击填写；不确定的字段默认留空。`);
});
$('forget').onclick = () => run($('forget'), async () => {
  if (!scope || !scan) throw new Error('请先识别当前页面。');
  await chrome.storage.local.remove(scope); mapping = {}; renderFields(); status('此网站对应关系已清除。');
});
$('fill').onclick = () => run($('fill'), async () => {
  if (!scan || !bundle) throw new Error('请重新同步并识别页面。');
  const fields = decisions.flatMap(({ field, select }) => {
    const fact = bundle.facts.find(item => item.key === select.value);
    const value = fact ? formatValue(field, fact.value) : null;
    return value ? [{ ...field, value }] : [];
  });
  if (!fields.length) throw new Error('没有可填写字段。请指定资料，或先回网站补充。');
  status('正在填写，不会点击提交…');
  const results = await send('fill', { tabId: scan.tabId, url: scan.url, fields, overwrite: $('overwrite').checked });
  $('results').replaceChildren(...results.map(result => { const p = document.createElement('p'); p.textContent = `${result.label}：${result.status}`; return p; }));
  status(`已填写 ${results.filter(result => result.status === '已填写').length} / ${fields.length} 个所选字段。请在网页检查，并手动提交。`);
});
