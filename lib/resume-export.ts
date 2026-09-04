import {
  BorderStyle,
  Document,
  HeadingLevel,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  TabStopType,
  TextWrappingSide,
  TextWrappingType,
  TextRun,
  VerticalPositionRelativeFrom,
} from 'docx';
import type { ResumeContent } from './product-types';

function esc(value: string) {
  return value.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[match]!);
}

function labels(content: ResumeContent) {
  const zh = content.language === 'zh';
  return {
    summary: zh ? '个人简介' : 'PROFILE',
    education: zh ? '教育经历' : 'EDUCATION',
    experiences: zh ? '实习经历' : 'EXPERIENCE',
    projects: zh ? '项目经历' : 'PROJECTS',
    skills: zh ? '技能' : 'SKILLS',
    extras: zh ? '其他信息' : 'ADDITIONAL',
  };
}

function isContactLine(value: string) {
  return /(?:@|(?:\+?86[-\s]?)?1\d{10}|邮箱|手机|电话|email|tel\.?)/i.test(value);
}

function splitLead(value: string) {
  const match = value.match(/^([^：:]{1,12}[：:])\s*(.*)$/);
  return match ? { lead: match[1], rest: match[2] } : { lead: '', rest: value };
}

function groupEducation(lines: string[]) {
  const groups: Array<{ heading: string; meta: string; details: string[] }> = [];
  for (const line of lines) {
    if (/^(?:19|20)\d{2}/.test(line) && groups.length && !groups.at(-1)!.meta) {
      groups.at(-1)!.meta = line;
    } else if (/^(?:主修|课程|Relevant Coursework)/i.test(line) && groups.length) {
      groups.at(-1)!.details.push(line);
    } else {
      groups.push({ heading: line, meta: '', details: [] });
    }
  }
  return groups;
}

function htmlSection(title: string, body: string) {
  return body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
}

function htmlBullet(value: string) {
  const { lead, rest } = splitLead(value);
  return `<li>${lead ? `<strong>${esc(lead)}</strong> ` : ''}${esc(rest)}</li>`;
}

function htmlEntries(values: ResumeContent['experiences']) {
  return values.map((entry) => `<article><div class="entry-head"><h3>${esc(entry.heading)}</h3><span>${esc(entry.meta)}</span></div>${entry.bullets.length ? `<ul>${entry.bullets.map(htmlBullet).join('')}</ul>` : ''}</article>`).join('');
}

function htmlEducation(content: ResumeContent) {
  return groupEducation(content.education).map((entry) => `<article><div class="entry-head"><h3>${esc(entry.heading)}</h3><span>${esc(entry.meta)}</span></div>${entry.details.map((line) => `<p>${esc(line)}</p>`).join('')}</article>`).join('');
}

export function buildResumeHtml(content: ResumeContent, filename: string) {
  const section = labels(content);
  const contact = isContactLine(content.summary);
  const lines = (values: string[]) => values.map((value) => {
    const { lead, rest } = splitLead(value);
    return `<p>${lead ? `<strong>${esc(lead)}</strong> ` : ''}${esc(rest)}</p>`;
  }).join('');
  return `<!doctype html><html lang="${content.language === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><title>${esc(filename)}</title><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#d7d7d7;color:#000;font-family:"Microsoft YaHei","Noto Sans SC",Arial,sans-serif}body{font-size:8.6pt;line-height:1.395}.page{width:210mm;height:297mm;margin:8mm auto;background:#fff;padding:15mm 16mm 14mm;overflow:hidden;box-shadow:0 8px 30px #0002}.resume{transform-origin:top left;width:100%}.portrait{float:right;width:19.9mm;height:30mm;object-fit:cover;margin:0 0 2mm 6mm}.name{font-size:20pt;line-height:1.1;font-weight:700;margin:0 0 1.5mm}.contact{font-size:8.6pt;line-height:1.25;margin:0 0 3.1mm;white-space:pre-wrap}section{clear:none;margin:2.5mm 0 0}h2{font-size:10.5pt;line-height:1.22;font-weight:700;margin:0 0 1.3mm;padding:0 0 .7mm;border-bottom:.55pt solid #000;color:#000}article{margin:0 0 1.8mm;break-inside:avoid}h3{font-size:9.2pt;line-height:1.24;font-weight:700;margin:0}.entry-head{display:flex;align-items:baseline;justify-content:space-between;gap:4mm}.entry-head span{flex:none;font-size:7.5pt;line-height:1.2;font-weight:700;white-space:nowrap}p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}ul{list-style:none;margin:.45mm 0 0;padding:0}li{position:relative;margin:0;padding-left:3.6mm;text-indent:0;overflow-wrap:anywhere}li:before{content:"-";position:absolute;left:0}strong{font-weight:700}.hint{position:fixed;right:16px;top:16px;z-index:2;border:0;border-radius:8px;background:#111;color:#fff;padding:10px 14px;cursor:pointer}.fit-note{position:fixed;left:16px;top:16px;z-index:2;border-radius:7px;background:#fff;padding:8px 11px;box-shadow:0 2px 12px #0002;font-size:12px;color:#444}@media print{html,body{background:#fff}.page{margin:0;box-shadow:none}.hint,.fit-note{display:none}}
  </style></head><body><button class="hint" onclick="window.print()">打印 / 另存为 PDF</button><span class="fit-note">已自动适配为 1 页 A4</span><main class="page"><div class="resume"><img class="portrait" src="/resume-portrait.jpg" alt=""><h1 class="name">${esc(content.headline)}</h1>${contact ? `<p class="contact">${esc(content.summary)}</p>` : ''}${!contact && content.summary ? htmlSection(section.summary, `<p>${esc(content.summary)}</p>`) : ''}${htmlSection(section.education, htmlEducation(content))}${htmlSection(section.experiences, htmlEntries(content.experiences))}${htmlSection(section.projects, htmlEntries(content.projects))}${htmlSection(section.skills, lines(content.skills))}${htmlSection(section.extras, lines(content.extras))}</div></main><script>
  function fitOnePage(){const page=document.querySelector('.page');const resume=document.querySelector('.resume');if(!page||!resume)return;resume.style.width='100%';resume.style.transform='none';const css=getComputedStyle(page);const available=page.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);let scale=Math.min(1,available/resume.scrollHeight);for(let i=0;i<3&&scale<.999;i++){resume.style.width=(100/scale)+'%';scale=Math.min(1,available/resume.scrollHeight);}resume.style.width=(100/scale)+'%';resume.style.transform='scale('+scale+')';document.documentElement.dataset.fit=String(scale)}
  window.addEventListener('load',fitOnePage);window.addEventListener('beforeprint',fitOnePage);if(document.fonts)document.fonts.ready.then(fitOnePage);
  </script></body></html>`;
}

const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '&': '\\&',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

function tex(value: string) {
  return [...value].map((char) => LATEX_ESCAPES[char] ?? (char === '\n' ? '\\\\\n' : char)).join('');
}

function texLine(value: string) {
  const { lead, rest } = splitLead(value);
  return `${lead ? `\\textbf{${tex(lead)}} ` : ''}${tex(rest)}`;
}

function texEntry(heading: string, meta: string, bullets: string[]) {
  const items = bullets.length ? `
\\begin{itemize}
${bullets.map((bullet) => `  \\item ${texLine(bullet)}`).join('\n')}
\\end{itemize}` : '';
  return `\\resumeentry{${tex(heading)}}{${tex(meta)}}${items}`;
}

function texSection(title: string, body: string) {
  return body ? `\\ressection{${tex(title)}}
${body}` : '';
}

export function buildResumeTex(content: ResumeContent) {
  const section = labels(content);
  const contact = isContactLine(content.summary);
  const education = groupEducation(content.education).map((entry) => `\\resumeentry{${tex(entry.heading)}}{${tex(entry.meta)}}
${entry.details.map((detail) => `${texLine(detail)}\\par`).join('\n')}`).join('\n');
  const experiences = content.experiences.map((entry) => texEntry(entry.heading, entry.meta, entry.bullets)).join('\n');
  const projects = content.projects.map((entry) => texEntry(entry.heading, entry.meta, entry.bullets)).join('\n');
  const lines = (values: string[]) => values.map((value) => `${texLine(value)}\\par`).join('\n');
  return `% Overleaf compiler: XeLaTeX
% Optional photo: upload a file named resume-photo.jpg
\\documentclass[UTF8,10pt,a4paper]{ctexart}
\\usepackage[left=16mm,right=16mm,top=15mm,bottom=14mm]{geometry}
\\usepackage{fontspec}
\\usepackage{graphicx}
\\usepackage{wrapfig}
\\usepackage{adjustbox}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{enumitem}
\\setmainfont{TeX Gyre Heros}
\\setCJKmainfont{FandolHei-Regular}[BoldFont=FandolHei-Bold]
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\setlength{\\textfloatsep}{0pt}
\\setlength{\\intextsep}{0pt}
\\newcommand{\\ressection}[1]{%
  \\vspace{2.3mm}{\\fontsize{10.5pt}{12pt}\\selectfont\\bfseries #1}\\par
  \\vspace{-1.1mm}\\rule{\\linewidth}{0.45pt}\\vspace{0.5mm}}
\\newcommand{\\resumeentry}[2]{%
  \\begin{tabularx}{\\linewidth}{@{}>{\\fontsize{9.2pt}{11pt}\\selectfont\\bfseries}X>{\\raggedleft\\arraybackslash\\fontsize{7.5pt}{9pt}\\selectfont\\bfseries}l@{}}
  #1 & #2
  \\end{tabularx}\\vspace{-1.4mm}}
\\setlist[itemize]{label=-,leftmargin=3.6mm,itemsep=0pt,topsep=0.2mm,parsep=0pt,partopsep=0pt}
\\begin{document}
\\begin{adjustbox}{max width=\\textwidth,max totalheight=0.98\\textheight,center}
\\begin{minipage}{\\textwidth}
\\IfFileExists{resume-photo.jpg}{%
  \\begin{wrapfigure}{r}{20mm}
    \\vspace{-4mm}\\centering
    \\includegraphics[width=20mm,height=30mm]{resume-photo.jpg}
    \\vspace{-5mm}
  \\end{wrapfigure}}{}
{\\fontsize{20pt}{22pt}\\selectfont\\bfseries ${tex(content.headline)}}\\par
\\vspace{1.2mm}
${contact ? `{\\fontsize{8.6pt}{10.5pt}\\selectfont ${tex(content.summary)}}\\par` : ''}
\\fontsize{8.6pt}{12pt}\\selectfont
${!contact && content.summary ? texSection(section.summary, `${tex(content.summary)}\\par`) : ''}
${texSection(section.education, education)}
${texSection(section.experiences, experiences)}
${texSection(section.projects, projects)}
${texSection(section.skills, lines(content.skills))}
${texSection(section.extras, lines(content.extras))}
\\end{minipage}
\\end{adjustbox}
\\end{document}
`;
}

function density(content: ResumeContent) {
  const all = [content.summary, ...content.education, ...content.experiences.flatMap((entry) => [entry.heading, entry.meta, ...entry.bullets]), ...content.projects.flatMap((entry) => [entry.heading, entry.meta, ...entry.bullets]), ...content.skills, ...content.extras];
  const weighted = all.reduce((total, value) => total + [...value].reduce((sum, char) => sum + (/[^\u0000-\u00ff]/.test(char) ? 1 : .52), 0), 0);
  return weighted + (content.experiences.length + content.projects.length) * 14 + content.education.length * 8;
}

function docxScale(content: ResumeContent) {
  const units = density(content);
  if (units <= 3200) return 1;
  return Math.max(.64, Math.sqrt(3200 / units));
}

function sectionHeading(text: string, scale: number) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: '000000', size: Math.max(16, Math.round(21 * scale)) })],
    border: { bottom: { color: '000000', size: 4, style: BorderStyle.SINGLE } },
    spacing: { before: Math.round(100 * scale), after: Math.round(45 * scale), line: Math.round(260 * scale), lineRule: 'exact' },
    keepNext: true,
  });
}

function entryHeader(heading: string, meta: string, scale: number) {
  return new Paragraph({
    children: [new TextRun({ text: heading, bold: true, size: Math.max(15, Math.round(18 * scale)) }), ...(meta ? [new TextRun({ text: `\t${meta}`, bold: true, size: Math.max(13, Math.round(15 * scale)) })] : [])],
    tabStops: [{ type: TabStopType.RIGHT, position: 10080 }],
    spacing: { before: Math.round(35 * scale), after: Math.round(14 * scale), line: Math.round(220 * scale), lineRule: 'exact' },
    keepNext: true,
  });
}

function bodyParagraph(value: string, scale: number, bullet = false) {
  const { lead, rest } = splitLead(value);
  const size = Math.max(13, Math.round(17 * scale));
  return new Paragraph({
    children: [new TextRun({ text: bullet ? '- ' : '', size }), ...(lead ? [new TextRun({ text: `${lead} `, bold: true, size })] : []), new TextRun({ text: rest, size })],
    indent: bullet ? { left: 200, hanging: 0 } : undefined,
    spacing: { after: 0, line: Math.max(175, Math.round(240 * scale)), lineRule: 'exact' },
  });
}

function headerBlocks(content: ResumeContent, portrait: Uint8Array | null, scale: number) {
  const image = portrait ? new ImageRun({
    data: portrait,
    transformation: { width: 75, height: 113 },
    type: 'jpg',
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, align: HorizontalPositionAlign.RIGHT },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 540000 },
      wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.LEFT, margins: { distL: 110000, distR: 0, distT: 0, distB: 70000 } },
      allowOverlap: true,
      behindDocument: false,
    },
  }) : null;
  const name = new Paragraph({ children: [new TextRun({ text: content.headline, bold: true, size: Math.round(40 * scale) }), ...(image ? [image] : [])], heading: HeadingLevel.TITLE, spacing: { after: Math.round(55 * scale), line: Math.round(440 * scale), lineRule: 'exact' } });
  const contact = isContactLine(content.summary) ? new Paragraph({ children: [new TextRun({ text: content.summary, size: Math.max(14, Math.round(17 * scale)) })], spacing: { after: 0, line: Math.round(210 * scale), lineRule: 'exact' } }) : new Paragraph({ text: '' });
  return [name, contact];
}

export function buildResumeDocument(content: ResumeContent, portrait: Uint8Array | null) {
  const section = labels(content);
  const scale = docxScale(content);
  const children: Paragraph[] = headerBlocks(content, portrait, scale);
  const addLines = (title: string, values: string[]) => {
    if (!values.length) return;
    children.push(sectionHeading(title, scale));
    for (const value of values) children.push(bodyParagraph(value, scale));
  };
  const addEntries = (title: string, values: ResumeContent['experiences']) => {
    if (!values.length) return;
    children.push(sectionHeading(title, scale));
    for (const entry of values) {
      children.push(entryHeader(entry.heading, entry.meta, scale));
      for (const bullet of entry.bullets) children.push(bodyParagraph(bullet, scale, true));
    }
  };
  if (content.summary && !isContactLine(content.summary)) addLines(section.summary, [content.summary]);
  if (content.education.length) {
    children.push(sectionHeading(section.education, scale));
    for (const entry of groupEducation(content.education)) {
      children.push(entryHeader(entry.heading, entry.meta, scale));
      for (const detail of entry.details) children.push(bodyParagraph(detail, scale));
    }
  }
  addEntries(section.experiences, content.experiences);
  addEntries(section.projects, content.projects);
  addLines(section.skills, content.skills);
  addLines(section.extras, content.extras);
  return new Document({
    styles: { default: { document: { run: { font: content.language === 'zh' ? 'Microsoft YaHei' : 'Arial', size: Math.max(13, Math.round(17 * scale)), color: '000000' }, paragraph: { spacing: { after: 0 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 908, bottom: 850, left: 908 } } }, children }],
  });
}

export async function packResumeDocument(content: ResumeContent, portrait: Uint8Array | null) {
  return Packer.toBuffer(buildResumeDocument(content, portrait));
}
