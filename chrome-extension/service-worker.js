/* global chrome */
const SITE = 'https://autumn-job-fast-apply.ddjsgzx.chatgpt.site';
const TRUSTED = [SITE, 'http://localhost:3000'];
// Dispatch the extension action normally, so activeTab is granted before the
// side panel opens. Direct panel behavior can bypass the action grant.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
chrome.action.onClicked.addListener(tab => { void chrome.sidePanel.open({ windowId: tab.windowId }); });
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ siteOrigin: SITE }));

async function bridge(path, method = 'GET', body) {
  const { siteOrigin = SITE } = await chrome.storage.local.get('siteOrigin');
  if (!TRUSTED.includes(siteOrigin)) throw new Error('网站地址不在可信列表。');
  if (!/^\/api\/(?:extension\/(?:bundle(?:\?jobId=[a-zA-Z0-9_-]+)?|capture)|jobs)$/.test(path)) throw new Error('不允许访问此接口。');
  const tabs = await chrome.tabs.query({ url: siteOrigin + '/*' });
  const tab = tabs.find(item => item.status === 'complete');
  if (!tab) throw new Error('请先打开并登录秋招速投网站，再点击同步资料。');
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: async (origin, route, verb, data) => {
    if (location.origin !== origin) return { error: '网站标签页已跳转，请重新登录。' };
    try {
      const response = await fetch(origin + route, { method: verb, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...(verb === 'GET' ? {} : { body: JSON.stringify(data) }) });
      if (!response.headers.get('content-type')?.includes('application/json')) return { error: '网站登录已过期，请回网站重新登录。' };
      const value = await response.json();
      return response.ok ? { value } : { error: value.error || `网站请求失败（${response.status}）` };
    } catch { return { error: '网站连接失败，请检查网络。' }; }
  }, args: [siteOrigin, path, method, body ?? null] });
  const result = results[0]?.result;
  if (!result || result.error) throw new Error(result?.error || '无法读取网站响应。');
  return result.value;
}

async function activePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('请切换到招聘或网申网页，再打开插件。');
  return tab;
}
async function pageCommand(tabId, command, payload = {}, frameId) {
  const target = frameId === undefined ? { tabId, allFrames: true } : { tabId, frameIds: [frameId] };
  await chrome.scripting.executeScript({ target, files: ['content-script.js'] });
  return chrome.scripting.executeScript({ target, func: (operation, data) => globalThis.__autumnApplyController.run(operation, data), args: [command, payload] });
}

async function handle(message) {
  if (message.type === 'openSite') {
    const { siteOrigin = SITE } = await chrome.storage.local.get('siteOrigin');
    if (!TRUSTED.includes(siteOrigin)) throw new Error('网站地址无效。');
    return chrome.tabs.create({ url: siteOrigin + (message.path === '/profile' ? '/profile' : '/browser-extension') });
  }
  if (message.type === 'sync') return bridge('/api/extension/bundle' + (message.jobId ? '?jobId=' + encodeURIComponent(message.jobId) : ''));
  if (message.type === 'saveJob') return bridge('/api/jobs', 'POST', message.job);
  if (message.type === 'capture') {
    const tab = await activePage();
    let captures;
    try { captures = await pageCommand(tab.id, 'capture'); }
    catch { throw new Error('请在当前招聘页面再次点击工具栏的插件图标，授予本页采集权限。'); }
    const top = captures.find(item => item.frameId === 0)?.result;
    if (!top) throw new Error('无法采集此网页。');
    let screenshot;
    try { screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 }); }
    catch { throw new Error('请在当前招聘页面再次点击工具栏的插件图标，授予本页截图权限。'); }
    const current = await chrome.tabs.get(tab.id);
    const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id || current.url !== tab.url) throw new Error('采集时页面发生变化，请重试。');
    const text = [top.text, ...captures.filter(item => item.frameId !== 0).map(item => item.result?.text || '')].join('\n').slice(0, 40_000);
    return { page: { text, title: top.title, url: tab.url }, screenshot };
  }
  if (message.type === 'extract') return bridge('/api/extension/capture', 'POST', message.page);
  if (message.type === 'scan') {
    const tab = await activePage();
    const scans = await pageCommand(tab.id, 'scan');
    return { tabId: tab.id, url: tab.url, fields: scans.flatMap(item => (item.result || []).map(field => ({ ...field, frameId: item.frameId, fingerprint: `${item.frameId}:${field.fingerprint}` }))) };
  }
  if (message.type === 'fill') {
    const tab = await activePage();
    if (tab.id !== message.tabId || tab.url !== message.url) throw new Error('页面已变更，请重新识别字段。');
    const frames = [...new Set(message.fields.map(field => field.frameId))];
    const output = [];
    for (const frameId of frames) {
      const results = await pageCommand(tab.id, 'fill', { fields: message.fields.filter(field => field.frameId === frameId), overwrite: message.overwrite }, frameId);
      output.push(...(results[0]?.result || []));
    }
    return output;
  }
  throw new Error('未知操作。');
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('sidepanel.html')) return false;
  handle(message).then(value => sendResponse({ ok: true, value })).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
