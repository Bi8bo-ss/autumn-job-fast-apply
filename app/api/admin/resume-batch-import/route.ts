import { contentFromText, db, id, now } from '@/lib/server/data';
import { json } from '@/lib/server/http';
import { getFilesBucket, getRuntimeEnv } from '@/lib/server/runtime';

const resumeInputs = [
  { key: 'business-analysis', name: '商业分析' },
  { key: 'strategy-operations', name: '策略运营' },
  { key: 'process-business-analysis', name: '流程分析与业务分析' },
  { key: 'data-operations', name: '数据运营' },
] as const;

type ExistingResume = {
  id: string;
  userId: string;
  sourceFileId: string | null;
  baseVersionId: string | null;
};

export async function POST(request: Request) {
  const expectedToken = getRuntimeEnv().RESUME_IMPORT_TOKEN?.trim();
  const suppliedToken = request.headers.get('x-resume-import-token');
  if (!expectedToken || !suppliedToken || suppliedToken !== expectedToken) {
    return json({ error: 'Not found.' }, { status: 404 });
  }

  const form = await request.formData();
  const owner = await db().prepare(`SELECT user_id AS userId FROM resumes
    ORDER BY created_at ASC LIMIT 1`).first<{ userId: string }>();
  if (!owner) return json({ error: '未找到现有简历所有者。' }, { status: 409 });
  if (form.get('action') === 'archive-active') {
    const archived = await db().prepare(`UPDATE resumes SET is_base = 0, updated_at = ?
      WHERE user_id = ? AND is_base = 1`).bind(now(), owner.userId).run();
    return json({ archived: archived.meta.changes });
  }
  const requestedKey = form.get('key');
  const selectedInputs = resumeInputs.filter((input) => input.key === requestedKey);
  if (selectedInputs.length !== 1) {
    return json({ error: '请选择一份允许导入的基础简历。' }, { status: 400 });
  }
  const timestamp = now();
  const imported: Array<{ id: string; name: string; mode: 'created' | 'updated' }> = [];

  for (const input of selectedInputs) {
    const file = form.get(`file-${input.key}`);
    const sourceText = form.get(`text-${input.key}`);
    if (!(file instanceof File) || file.type !== 'application/pdf') {
      return json({ error: `${input.name}缺少有效 PDF。` }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return json({ error: `${input.name}超过 10MB。` }, { status: 413 });
    }
    if (typeof sourceText !== 'string' || sourceText.trim().length < 30) {
      return json({ error: `${input.name}缺少有效解析文本。` }, { status: 400 });
    }

    const existing = await db().prepare(`SELECT r.id, r.user_id AS userId,
      r.source_file_id AS sourceFileId,
      (SELECT rv.id FROM resume_versions rv WHERE rv.resume_id = r.id
        AND rv.job_id IS NULL AND rv.parent_version_id IS NULL
        ORDER BY rv.version_number ASC, rv.created_at ASC LIMIT 1) AS baseVersionId
      FROM resumes r WHERE r.user_id = ? AND r.name = ? AND r.is_base = 1
      ORDER BY r.created_at ASC LIMIT 1`).bind(owner.userId, input.name).first<ExistingResume>();

    const resumeId = existing?.id || id('resume');
    const fileId = existing?.sourceFileId || id('file');
    const versionId = existing?.baseVersionId || id('rv');
    const objectKey = `${owner.userId}/source/${fileId}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const text = sourceText.trim();
    const content = contentFromText(text, 'zh');

    await getFilesBucket().put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: 'application/pdf' },
    });

    if (existing) {
      if (!existing.sourceFileId || !existing.baseVersionId) {
        return json({ error: `${input.name}的基础记录不完整，已停止导入。` }, { status: 409 });
      }
      await db().batch([
        db().prepare(`UPDATE stored_files SET filename = ?, object_key = ?, mime_type = 'application/pdf', size = ?
          WHERE id = ? AND user_id = ?`).bind(file.name, objectKey, file.size, fileId, owner.userId),
        db().prepare(`UPDATE resume_versions SET content_json = ?, source_text = ?
          WHERE id = ? AND user_id = ?`).bind(JSON.stringify(content), text, versionId, owner.userId),
        db().prepare(`UPDATE resumes SET language = 'zh', source_file_id = ?, current_version_id = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`).bind(fileId, versionId, timestamp, resumeId, owner.userId),
      ]);
      imported.push({ id: resumeId, name: input.name, mode: 'updated' });
    } else {
      await db().batch([
        db().prepare(`INSERT INTO stored_files
          (id,user_id,filename,object_key,mime_type,size,kind,owner_id,created_at)
          VALUES (?,?,?,?,?,?,'source',?,?)`).bind(fileId, owner.userId, file.name, objectKey, 'application/pdf', file.size, resumeId, timestamp),
        db().prepare(`INSERT INTO resumes
          (id,user_id,name,language,source_file_id,is_base,current_version_id,created_at,updated_at)
          VALUES (?,?,?,'zh',?,1,?,?,?)`).bind(resumeId, owner.userId, input.name, fileId, versionId, timestamp, timestamp),
        db().prepare(`INSERT INTO resume_versions
          (id,user_id,resume_id,job_id,parent_version_id,version_number,content_json,source_text,created_at)
          VALUES (?,?,?,NULL,NULL,1,?,?,?)`).bind(versionId, owner.userId, resumeId, JSON.stringify(content), text, timestamp),
      ]);
      imported.push({ id: resumeId, name: input.name, mode: 'created' });
    }
  }

  return json({ imported }, { status: 201 });
}
