import { requireApiUser } from '@/lib/server/auth';
import { db } from '@/lib/server/data';
import { errorResponse,json } from '@/lib/server/http';
import { getFilesBucket } from '@/lib/server/runtime';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireApiUser();const {id}=await params;const file=await db().prepare('SELECT filename,object_key AS objectKey,mime_type AS mimeType FROM stored_files WHERE id=? AND user_id=? LIMIT 1').bind(id,user.userId).first<{filename:string;objectKey:string;mimeType:string}>();if(!file)return json({error:'文件不存在。'},{status:404});const object=await getFilesBucket().get(file.objectKey);if(!object)return json({error:'文件内容不存在。'},{status:404});return new Response(object.body,{headers:{'content-type':file.mimeType,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`}});}catch(error){return errorResponse(error);}}
