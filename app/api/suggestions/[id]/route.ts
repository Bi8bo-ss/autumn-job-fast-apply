import { suggestionUpdateSchema } from '@/lib/product-types';
import { requireApiUser } from '@/lib/server/auth';
import { db, now } from '@/lib/server/data';
import { errorResponse,json,readJson } from '@/lib/server/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireApiUser();const {id}=await params;const parsed=suggestionUpdateSchema.safeParse(await readJson(request));if(!parsed.success)return json({error:'建议状态无效。'},{status:400});const result=await db().prepare('UPDATE tune_suggestions SET state=?,edited_text=?,updated_at=? WHERE id=? AND user_id=?').bind(parsed.data.state,parsed.data.editedText||null,now(),id,user.userId).run();if(!result.meta.changes)return json({error:'建议不存在。'},{status:404});return json({ok:true});}catch(error){return errorResponse(error);}}
