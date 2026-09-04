import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { resumeContentSchema, type ResumeContent } from '@/lib/product-types';
import { normalizeResumeContent } from '@/lib/resume-parser';
import { requireApiUser } from '@/lib/server/auth';
import { getResumeVersion } from '@/lib/server/data';
import { errorResponse, json } from '@/lib/server/http';

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[match]!);
}

function labels(content: ResumeContent) {
  const zh = content.language === 'zh';
  return {
    summary: zh ? '个人简介' : 'Profile',
    education: zh ? '教育背景' : 'Education',
    experiences: zh ? '实习 / 工作经历' : 'Experience',
    projects: zh ? '项目经历' : 'Projects',
    skills: zh ? '专业技能' : 'Skills',
    extras: zh ? '其他信息' : 'Additional Information',
  };
}

function htmlSection(title: string, body: string) {
  return body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
}

function htmlFor(content: ResumeContent, filename: string) {
  const section = labels(content);
  const lines = (values: string[]) => values.map((value) => `<p>${esc(value)}</p>`).join('');
  const entries = (values: ResumeContent['experiences']) => values.map((entry) => `<article><div class="entry-head"><h3>${esc(entry.heading)}</h3><span>${esc(entry.meta)}</span></div>${entry.bullets.length ? `<ul>${entry.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join('')}</ul>` : ''}</article>`).join('');
  return `<!doctype html><html lang="${content.language === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><title>${esc(filename)}</title><style>
    @page{size:A4;margin:15mm 17mm}*{box-sizing:border-box}body{font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif;color:#172b3a;max-width:176mm;margin:auto;font-size:10.2pt;line-height:1.5}h1{font-size:21pt;line-height:1.2;margin:0 0 5mm;border-bottom:2px solid #0a8a75;padding-bottom:3mm;overflow-wrap:anywhere}section{margin-top:4.5mm;break-inside:auto}h2{font-size:11pt;line-height:1.3;text-transform:uppercase;letter-spacing:.04em;color:#087e72;border-bottom:1px solid #cbd5e1;margin:0 0 2mm;padding-bottom:1.2mm}h3{font-size:10.3pt;margin:0;font-weight:700}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 1.5mm}article{margin:0 0 3mm;break-inside:avoid}.entry-head{display:flex;align-items:baseline;justify-content:space-between;gap:5mm}.entry-head span{font-size:9pt;color:#64748b;text-align:right}ul{margin:1mm 0 0;padding-left:4.5mm}li{margin-bottom:.7mm}.hint{position:fixed;right:16px;top:16px;background:#07304c;color:#fff;padding:10px 14px;border:0;border-radius:9px;cursor:pointer}@media print{.hint{display:none}}
  </style></head><body><button class="hint" onclick="print()">打印 / 另存为 PDF</button><h1>${esc(content.headline)}</h1>${htmlSection(section.summary, content.summary ? `<p>${esc(content.summary)}</p>` : '')}${htmlSection(section.education, lines(content.education))}${htmlSection(section.experiences, entries(content.experiences))}${htmlSection(section.projects, entries(content.projects))}${htmlSection(section.skills, lines(content.skills))}${htmlSection(section.extras, lines(content.extras))}</body></html>`;
}

function docxChildren(content: ResumeContent) {
  const section = labels(content);
  const children: Paragraph[] = [new Paragraph({ text: content.headline, heading: HeadingLevel.TITLE, spacing: { after: 240 } })];
  const addHeading = (title: string) => children.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, color: '087E72', size: 22 })], border: { bottom: { color: 'CBD5E1', size: 6, style: 'single' } }, spacing: { before: 220, after: 100 } }));
  const addLines = (title: string, values: string[]) => {
    if (!values.length) return;
    addHeading(title);
    for (const value of values) children.push(new Paragraph({ text: value, spacing: { after: 70 } }));
  };
  const addEntries = (title: string, values: ResumeContent['experiences']) => {
    if (!values.length) return;
    addHeading(title);
    for (const entry of values) {
      children.push(new Paragraph({ children: [new TextRun({ text: entry.heading, bold: true }), ...(entry.meta ? [new TextRun({ text: `\t${entry.meta}`, color: '64748B', italics: true })] : [])], spacing: { before: 90, after: 45 } }));
      for (const bullet of entry.bullets) children.push(new Paragraph({ text: bullet, bullet: { level: 0 }, spacing: { after: 35 } }));
    }
  };
  if (content.summary) addLines(section.summary, [content.summary]);
  addLines(section.education, content.education);
  addEntries(section.experiences, content.experiences);
  addEntries(section.projects, content.projects);
  addLines(section.skills, content.skills);
  addLines(section.extras, content.extras);
  return children;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const version = await getResumeVersion(user.userId, id);
    if (!version) return json({ error: '简历版本不存在。' }, { status: 404 });
    const raw = resumeContentSchema.parse(JSON.parse(version.contentJson));
    const content = normalizeResumeContent(raw, version.sourceText);
    const format = new URL(request.url).searchParams.get('format');
    const filename = safeName(`${version.resumeName}-v${version.versionNumber}`);
    if (format === 'pdf') {
      return new Response(htmlFor(content, filename), { headers: { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `inline; filename="${filename}.html"` } });
    }
    if (format !== 'docx') return json({ error: '仅支持 docx 或 pdf。' }, { status: 400 });
    const doc = new Document({
      styles: { default: { document: { run: { font: content.language === 'zh' ? 'Noto Sans SC' : 'Arial', size: 21 }, paragraph: { spacing: { line: 285 } } } } },
      sections: [{ properties: { page: { margin: { top: 700, right: 760, bottom: 700, left: 760 } } }, children: docxChildren(content) }],
    });
    const bytes = await Packer.toBuffer(doc);
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': `attachment; filename="${filename}.docx"` } });
  } catch (error) {
    return errorResponse(error);
  }
}
