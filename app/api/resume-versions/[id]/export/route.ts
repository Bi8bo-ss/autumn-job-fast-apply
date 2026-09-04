import { resumeContentSchema } from '@/lib/product-types';
import { buildResumeHtml, buildResumeTex, packResumeDocument } from '@/lib/resume-export';
import { normalizeResumeContent } from '@/lib/resume-parser';
import { requireApiUser } from '@/lib/server/auth';
import { getResumeVersion } from '@/lib/server/data';
import { errorResponse, json } from '@/lib/server/http';

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
}

async function loadPortrait(request: Request) {
  try {
    const headers = new Headers();
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
    const response = await fetch(new URL('/resume-portrait.jpg', request.url), { headers });
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
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
    if (format === 'tex') {
      return new Response(buildResumeTex(content), { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="${filename}.tex"` } });
    }
    if (format === 'pdf') {
      return new Response(buildResumeHtml(content, filename), { headers: { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `inline; filename="${filename}.html"` } });
    }
    if (format !== 'docx') return json({ error: '仅支持 docx、pdf 或 tex。' }, { status: 400 });
    const bytes = await packResumeDocument(content, await loadPortrait(request));
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': `attachment; filename="${filename}.docx"` } });
  } catch (error) {
    return errorResponse(error);
  }
}
