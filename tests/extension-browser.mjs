import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { matchField, formatValue } from '../chrome-extension/field-model.js';
import { build } from 'vite';
const compiled = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' }, build: { write: false, minify: false, lib: { entry: resolve('tests/extension-react-fixture.jsx'), formats: ['iife'], name: 'ApplicationFixture' } } });
const compiledResult = Array.isArray(compiled) ? compiled[0] : compiled;
const reactScript = compiledResult.output.find(item => item.type === 'chunk').code;
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const { chromium } = playwright;
const chromePath = process.env.CHROME_PATH || (process.platform === 'win32' ? join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') : undefined);
const profilePath = await mkdtemp(join(tmpdir(), 'autumn-extension-test-'));
if (dirname(resolve(profilePath)) !== resolve(tmpdir()) || !basename(profilePath).startsWith('autumn-extension-test-')) throw new Error('Unexpected owned test profile path');
let browser;
const fixtures = {
  '/': '<main><h1>Fixture hiring — Test Analyst</h1><p>Fixture Company. Responsibilities: build verified reports and dashboards. Requirements: SQL and Excel.</p><a href="/form">Apply</a></main>',
  '/form': `<form onsubmit="window.submitted=true;return false"><label>Full name<input name="full-name"></label><label>Email address<input name="email" value="already@fixture.invalid"></label><label>Date of birth<input name="birth" type="date"></label><fieldset><legend>Education</legend>${[0,1].map(i=>`<div><label>School<input name="education[${i}].school"></label><label>Degree<select name="education[${i}].degree"><option value="">Choose</option><option value="master">Master</option></select></label><label>Start date<input type="month" name="education[${i}].startDate"></label></div>`).join('')}</fieldset><fieldset><legend>Work experience</legend><label>Company<input name="experience[0].organization"></label><label>Description<textarea name="duties"></textarea></label></fieldset><label>Citizenship<input name="citizenship"></label><label>Short answer<textarea name="short" maxlength="4"></textarea></label><div id="shadow"></div><iframe src="/frame"></iframe><label><input type="checkbox" name="consent">Agree to privacy policy</label><input type="password" name="password"><button type="submit">Submit application</button></form><script>document.getElementById('shadow').attachShadow({mode:'open'}).innerHTML='<label>Phone<input name="phone"></label>'</script>`,
  '/frame': '<label>Email<input name="frame-email"></label>',
};
const facts = [
  {key:'identity.name',aliases:['full name','姓名'],value:'Test Candidate',section:'identity',index:0},
  {key:'identity.email',aliases:['email','email address'],value:'test@fixture.invalid',section:'identity',index:0},
  {key:'identity.birthDate',aliases:['date of birth'],value:'2000-02-29',section:'identity',index:0},
  {key:'identity.phone',aliases:['phone'],value:'+1 0000000000',section:'identity',index:0},
  ...[0,1].flatMap(i=>[
    {key:`education.${i}.school`,aliases:['school'],value:`Test School ${i}`,section:'education',index:i},
    {key:`education.${i}.degree`,aliases:['degree'],value:'Master',section:'education',index:i},
    {key:`education.${i}.startDate`,aliases:['start date'],value:'2021-09',section:'education',index:i},
  ]),
  {key:'experiences.0.organization',aliases:['company'],value:'Test Employer',section:'experiences',index:0},
  {key:'experiences.0.description',aliases:['description'],value:'Verified achievement',section:'experiences',index:0},
].map(fact=>({...fact,label:fact.key}));
const server = createServer((request,response)=>{
  if (request.url === '/react.js') { response.setHeader('content-type','application/javascript'); response.end(reactScript); return; }
  if (request.url === '/react') { response.setHeader('content-type','text/html; charset=utf-8'); response.end('<title>Application Fixture</title><style>.form-row{display:flex;margin:20px}.field-label{width:140px}.ant-select input{width:1px;opacity:0}.ant-select-selector{border:1px solid #ccc;padding:5px;min-width:200px}[role=option]{padding:10px}</style><div id="root"></div><script src="/react.js"></script>'); return; }
  if(request.url?.startsWith('/api/extension/bundle')) { response.setHeader('content-type','application/json'); response.end(JSON.stringify({facts,jobs:[],updatedAt:new Date().toISOString()})); return; }
  if(request.url==='/api/jobs') { let body=''; request.on('data',chunk=>body+=chunk); request.on('end',()=>{ const job=JSON.parse(body); assert.equal(job.company,'Fixture Company'); response.setHeader('content-type','application/json'); response.end(JSON.stringify({job:{id:'job_fixture'}})); }); return; }
  response.setHeader('content-type','text/html'); response.end(fixtures[request.url] || fixtures['/']);
});
await new Promise(resolveListen=>server.listen(3000,'127.0.0.1',resolveListen));
try {
  browser = await chromium.launchPersistentContext(profilePath,{executablePath:chromePath,channel:chromePath ? undefined : 'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const cdp = await browser.browser().newBrowserCDPSession();
  const loaded = await cdp.send('Extensions.loadUnpacked',{path:resolve('chrome-extension')});
  assert.ok(loaded.id); console.log('PASS Chrome loads actual MV3 extension');
  const page = await browser.newPage(); await page.goto('http://localhost:3000/form');
  const panel = await browser.newPage(); await panel.goto(`chrome-extension://${loaded.id}/sidepanel.html`); await page.bringToFront();
  const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
  const tabTarget = targetInfos.find(target => target.url === page.url());
  assert.ok(tabTarget, 'Chrome exposes a tab target for extension action');
  await cdp.send('Extensions.triggerAction', { id: loaded.id, targetId: tabTarget.targetId });
  await panel.evaluate(()=>chrome.storage.local.set({siteOrigin:'http://localhost:3000'}));
  const sync = await panel.evaluate(()=>chrome.runtime.sendMessage({type:'sync'})); assert.ok(sync.ok,sync.error); assert.equal(sync.value.facts.length,facts.length); console.log('PASS website authenticated-tab bridge sync');
  const captured = await panel.evaluate(()=>chrome.runtime.sendMessage({type:'capture'}));
  assert.ok(captured.ok, captured.error); assert.ok(captured.value.screenshot.startsWith('data:image/jpeg'));
  console.log('PASS actual screenshot and page capture after toolbar action');
  const scanned = await panel.evaluate(()=>chrome.runtime.sendMessage({type:'scan'})); assert.ok(scanned.ok,scanned.error);
  const fields = scanned.value.fields;
  assert.ok(fields.some(field=>field.name==='phone')); assert.ok(fields.some(field=>field.name==='frame-email'));
  assert.ok(!fields.some(field=>['password','consent'].includes(field.name)));
  const fillFields = fields.flatMap(field=>{ const fact=matchField(field,facts).fact; const value=fact ? formatValue(field,fact.value) : null; return value ? [{...field,value}] : []; });
  const filled = await panel.evaluate(data=>chrome.runtime.sendMessage({type:'fill',...data}),{...scanned.value,fields:fillFields,overwrite:false});
  assert.ok(filled.ok,filled.error);
  assert.equal(await page.locator('input[name="full-name"]').inputValue(),'Test Candidate');
  assert.equal(await page.locator('input[name="email"]').inputValue(),'already@fixture.invalid');
  assert.equal(await page.locator('input[name="education[1].school"]').inputValue(),'Test School 1');
  assert.equal(await page.locator('select[name="education[0].degree"]').inputValue(),'master');
  assert.equal(await page.locator('input[name="experience[0].organization"]').inputValue(),'Test Employer');
  assert.equal(await page.locator('input[name="citizenship"]').inputValue(),'');
  assert.equal(await page.locator('input[name="phone"]').inputValue(),'+1 0000000000');
  assert.equal(await page.frameLocator('iframe').locator('input').inputValue(),'test@fixture.invalid');
  assert.equal(await page.locator('input[name="consent"]').isChecked(),false);
  assert.equal(await page.evaluate(()=>Boolean(window.submitted)),false);
  console.log('PASS native forms, repeated education, experience, Shadow DOM, iframe, existing-value preservation, missing blank and no submit');
  await panel.evaluate(()=>document.getElementById('sync').click());
  await panel.waitForFunction(()=>document.getElementById('sync-info').textContent.includes('已同步'));
  await panel.evaluate(()=>document.getElementById('capture').click());
  await panel.waitForFunction(()=>!document.getElementById('job-form').hidden);
  await panel.evaluate(()=>{ document.getElementById('company').value='Fixture Company'; document.getElementById('role').value='Test Analyst'; document.getElementById('source-url').value='http://localhost:3000/'; document.getElementById('jd').value='Fixture responsibilities: verified reports. Requirements: SQL and Excel.'; document.getElementById('job-form').dispatchEvent(new Event('submit',{cancelable:true})); });
  await panel.waitForFunction(()=>document.getElementById('status').textContent.includes('已保存岗位'));
  console.log('PASS side panel sync, screenshot preview and user-confirmed job save UI');
  const overflowScan = await panel.evaluate(()=>chrome.runtime.sendMessage({type:'scan'}));
  const short = overflowScan.value.fields.find(field=>field.name==='short');
  const overflow = await panel.evaluate(data=>chrome.runtime.sendMessage({type:'fill',...data}),{...overflowScan.value,fields:[{...short,value:'Too long for this field'}],overwrite:false});
  assert.ok(overflow.value[0].status.includes('超过')); assert.equal(await page.locator('textarea[name="short"]').inputValue(),'');
  console.log('PASS field length limit does not silently truncate facts');
  await page.evaluate(()=>{const label=document.createElement('label');label.textContent='Level'; const select=document.createElement('select');select.name='numeric-option';select.innerHTML='<option value="">Choose</option><option value="two">Level 2</option>';label.append(select);document.querySelector('form').append(label);});
  const numericScan = await panel.evaluate(()=>chrome.runtime.sendMessage({type:'scan'}));
  const numericField = numericScan.value.fields.find(field=>field.name==='numeric-option');
  const numericResult = await panel.evaluate(data=>chrome.runtime.sendMessage({type:'fill',...data}),{...numericScan.value,fields:[{...numericField,value:'Level 1'}],overwrite:false});
  assert.ok(numericResult.value[0].status.includes('无法精确')); assert.equal(await page.locator('select[name="numeric-option"]').inputValue(),'');
  console.log('PASS distinct option numbers are never treated as equivalent');
  // Changed labels invalidate a scan and must not redirect values.
  const fresh = await panel.evaluate(()=>chrome.runtime.sendMessage({type:'scan'}));
  const stale = fresh.value.fields.find(field=>field.name==='full-name');
  await page.locator('input[name="full-name"]').evaluate(element=>element.parentElement.firstChild.textContent='Different question');
  const rejected = await panel.evaluate(data=>chrome.runtime.sendMessage({type:'fill',...data}),{...fresh.value,fields:[{...stale,value:'Do not write'}],overwrite:true});
  assert.ok(rejected.value[0].status.includes('变化')); assert.equal(await page.locator('input[name="full-name"]').inputValue(),'Test Candidate');
  console.log('PASS stale descriptor protection');
  await page.goto('http://localhost:3000/react');
  await page.waitForSelector('#framework-state');
  const complex = await panel.evaluate(()=>chrome.runtime.sendMessage({type:'scan'}));
  assert.ok(complex.ok, complex.error);
  assert.equal(complex.value.fields.find(field=>field.name==='email')?.label.replace(/[\s*：:]/g,''),'电子邮箱');
  assert.ok(!complex.value.fields.some(field=>field.name==='priPhotoUrl'));
  const extraFacts = [{key:'identity.gender',label:'性别',aliases:['性别'],value:'Female',section:'identity',index:0}, {...facts.find(fact=>fact.key==='education.0.degree'),value:'Master'}];
  const complexFacts = [...facts.filter(fact=>fact.key!=='education.0.degree'),...extraFacts];
  const complexFields = complex.value.fields.flatMap(field=>{const fact=matchField(field,complexFacts).fact;return fact?[{...field,value:fact.value,factKey:fact.key}]:[];});
  const complexFilled = await panel.evaluate(data=>chrome.runtime.sendMessage({type:'fill',...data}),{...complex.value,fields:complexFields,overwrite:false});
  assert.ok(complexFilled.ok,complexFilled.error);
  await page.locator('#rerender').click();
  const state = JSON.parse(await page.locator('#framework-state').textContent());
  assert.equal(state.name,'Test Candidate'); assert.equal(state.email,'test@fixture.invalid'); assert.equal(state.school1,'Test School 1'); assert.equal(state.degree,'硕士'); assert.equal(state.gender,'女');
  assert.equal(await page.locator('input[name="consent"]').isChecked(),false); assert.equal(await page.evaluate(()=>Boolean(window.submitted)),false);
  console.log('PASS JD-style sibling labels, hidden backend fields, readonly dropdown, radio and actual React state survives rerender');
  const content = await readFile(resolve('chrome-extension/content-script.js'),'utf8'); assert.ok(!content.includes('.submit('));
} finally {
  if(browser) await browser.close();
  await new Promise(resolveClose=>server.close(resolveClose));
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
