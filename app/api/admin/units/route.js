import { database,getEditor,normalizeUnit } from "../../../lib/unit-db";
export const runtime="nodejs";export const dynamic="force-dynamic";export const revalidate=0;
const headers={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const err=(message,status)=>Response.json({error:message},{status,headers});
export async function GET(){
 if(process.env.VERCEL_ENV!=="production")return err("Ambiente sem acesso administrativo.",403);
 try{const u=await getEditor();return Response.json({signedIn:u.signedIn,canEdit:u.canEdit,role:u.role||null,needsVerification:!!u.needsVerification},{headers});}
 catch{return err("Não foi possível verificar as permissões.",503);}
}
export async function POST(request){
 if(process.env.VERCEL_ENV!=="production")return err("Ambiente sem permissão.",403);
 try{
  const editor=await getEditor();
  if(!editor.signedIn)return err("É necessário entrar na conta para editar.",401);
  if(!editor.canEdit)return err("Seu perfil não permite editar unidades.",403);
  if(Number(request.headers.get("content-length")||0)>30000)return err("Dados excedem o limite.",413);
  let body;try{body=await request.json();}catch{return err("JSON inválido.",400);}
  if(!body?.unit||typeof body.unit!=="object")return err("Cadastro inválido.",400);
  const creating=body.action==="create";
  if(!creating&&body.action!=="update")return err("Operação desconhecida.",400);
  const expected=body.revision;
  if(!Number.isSafeInteger(expected)||expected<0)return err("Revisão inválida.",400);
  const id=creating?"custom-"+crypto.randomUUID():body.unit.id;
  if(!id||typeof id!=="string"||!/^[-a-zA-Z0-9]{6,180}$/.test(id))return err("Código de unidade inválido.",400);
  if(creating&&expected!==0)return err("A nova unidade precisa começar na revisão zero.",400);
  let unit;try{unit=normalizeUnit(body.unit,id);}catch(e){return err(e.message,422);}
  const sql=database();
  if(!creating){
    const stored=await sql.query("SELECT id FROM cc_unit_seed WHERE id=$1 UNION SELECT id FROM cc_unit_records WHERE id=$1 LIMIT 1",[id]);
    if(!stored.length)return err("Unidade não encontrada.",404);
  }
  const query=[
    "WITH saved AS (",
    "INSERT INTO cc_unit_records(id,payload,revision,created_by,updated_by)",
    "VALUES ($1,$2::jsonb,1,$3,$3)",
    "ON CONFLICT (id) DO UPDATE SET",
    "payload=EXCLUDED.payload,revision=cc_unit_records.revision+1,updated_by=$3,updated_at=now()",
    "WHERE cc_unit_records.revision=$4",
    "RETURNING id,payload,revision,updated_at",
    "), audit AS (",
    "INSERT INTO cc_unit_audit(unit_id,revision,action,author_email,payload)",
    "SELECT id,revision,CASE WHEN revision=1 THEN 'create' ELSE 'update' END,$3,payload FROM saved RETURNING id",
    ") SELECT saved.id,saved.payload,saved.revision,saved.updated_at FROM saved JOIN audit ON TRUE"
  ].join(" ");
  const saved=await sql.query(query,[id,JSON.stringify(unit),editor.email,expected]);
  if(!saved.length)return err("Conflito: outra pessoa já editou este cadastro. Atualize e revise os dados antes de salvar.",409);
  return Response.json({unit:{...saved[0].payload,revision:saved[0].revision,updatedAt:saved[0].updated_at},message:creating?"Unidade cadastrada.":"Unidade atualizada."},{headers});
 }catch{return err("Falha ao gravar no banco. Os dados anteriores foram preservados.",500);}
}
