import {randomUUID} from "node:crypto";
import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

const HEADERS={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const response=(data,status=200)=>Response.json(data,{status,headers:HEADERS});
const error=(message,status)=>response({error:message},status);
const manager=access=>["developer","admin","gestor"].includes(access.role);
const isValidId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{5,120}$/.test(id);
const stages=["Ideias","Planejamento","Aguardando aprovação","Pronto para executar","Em execução","Em avaliação","Concluído"];
const emailOf=value=>String(value||"").trim().toLowerCase();
const entitled=(task,email)=>(
 emailOf(task?.owner)===email||
 Array.isArray(task?.participantEmails)&&task.participantEmails.some(e=>emailOf(e)===email)||
 String(task?.collaborators||"").split(/[,;\n]+/).some(e=>emailOf(e)===email)
);
function allowedTask(access,task,unitIds,write=false){
 if(manager(access))return true;
 if(access.role==="lider")return unitIds.has(task.unitId);
 if(access.role==="colaborador"){
  const assigned=entitled(task,access.email);
  return assigned||(!write&&emailOf(task.createdBy)===access.email);
 }
 return false;
}
function stripRevision(value){
 const clean={...value};delete clean.syncRevision;delete clean.createdBy;delete clean.updatedBy;
 return clean;
}
function validateTask(task){
 if(!task||typeof task!=="object"||Array.isArray(task)||!isValidId(task.id)||
    !isValidId(task.unitId)||typeof task.title!=="string"||
    task.title.trim().length<2||task.title.length>240||
    !stages.includes(task.stage)||(!task.due?false:!/^\d{4}-\d{2}-\d{2}$/.test(task.due))||
    (task.campaignId!=null&&!isValidId(task.campaignId)))
  return "Preencha uma demanda válida, com unidade, título, etapa e prazo.";
 if(task.blocked&&!String(task.blockReason||"").trim())return "Informe o motivo do bloqueio.";
 if(task.stage==="Concluído"){
  if(!task.learning?.worked?.trim()||!task.learning?.challenges?.trim()||!task.learning?.decision)
   return "Para concluir, registre os aprendizados e a recomendação.";
  if(task.checklist?.some(c=>c.required&&!c.done)&&!task.learning?.pendingReason?.trim())
   return "Justifique as atividades obrigatórias pendentes.";
 }
 if(!Array.isArray(task.checklist)||task.checklist.length>160||
    !Array.isArray(task.comments)||task.comments.length>400||
    !Array.isArray(task.history)||task.history.length>700||
    !Array.isArray(task.participantEmails)||task.participantEmails.length>150)
  return "A demanda ultrapassou o limite permitido de itens.";
 return null;
}
function validateCampaign(item){
 if(!item||typeof item!=="object"||Array.isArray(item)||!isValidId(item.id)||
   typeof item.title!=="string"||item.title.trim().length<2||item.title.length>240||
   !Array.isArray(item.units)||item.units.length>150||
   !item.units.every(isValidId)||new Set(item.units).size!==item.units.length||
   !Number.isInteger(item.version)||item.version<1||
   typeof item.description!=="string"||item.description.length>20000)
  return "Preencha nome, orientações e unidades válidas para a campanha.";
 return null;
}
const unitIsKnown=async(sql,id)=>{
 const rows=await sql.query("SELECT 1 FROM cc_unit_seed WHERE id=$1 UNION ALL SELECT 1 FROM cc_unit_records WHERE id=$1 LIMIT 1",[id]);
 return rows.length>0;
};
const unitAssignment=async(sql,email)=>{
 const rows=await sql.query("SELECT unit_id FROM cc_team_unit_assignments WHERE lower(email)=$1",[email]);
 return new Set(rows.map(r=>r.unit_id));
};
function checkOrigin(request){
 const origin=request.headers.get("origin");
 return !origin||origin===new URL(request.url).origin;
}
async function getData(sql,access,units){
 const [taskRows,campaignRows]=await Promise.all([
  sql.query("SELECT id,payload,unit_id,revision,created_by,updated_at FROM cc_commercial_tasks ORDER BY updated_at DESC,id LIMIT 7000"),
  sql.query("SELECT id,payload,revision,created_by,updated_at FROM cc_commercial_campaigns ORDER BY updated_at DESC,id LIMIT 1200")
 ]);
 const tasks=taskRows.filter(r=>allowedTask(access,{...r.payload,unitId:r.unit_id,createdBy:r.created_by},units))
  .map(r=>({...r.payload,id:r.id,unitId:r.unit_id,syncRevision:r.revision,createdBy:r.created_by}));
 const taskCampaigns=new Set(tasks.map(t=>t.campaignId).filter(Boolean));
 const campaigns=campaignRows.filter(r=>manager(access)||
   access.role==="lider"&&(
    (Array.isArray(r.payload.units)&&r.payload.units.some(id=>units.has(id)))||
    taskCampaigns.has(r.id)
   )||access.role==="colaborador"&&taskCampaigns.has(r.id))
  .map(r=>({...r.payload,id:r.id,syncRevision:r.revision}));
 return {tasks,campaigns,counts:{tasks:taskRows.length,campaigns:campaignRows.length},role:access.role};
}
export async function GET(){
 try{
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login para acessar a Central.",401);
  if(!access.allowed)return error("Seu perfil ainda não está autorizado.",403);
  const sql=database();
  const units=manager(access)?new Set():await unitAssignment(sql,access.email);
  return response(await getData(sql,access,units));
 }catch{
  return error("Não foi possível carregar os dados compartilhados. Nenhuma alteração local será gravada.",503);
 }
}
export async function POST(request){
 try{
  if(!checkOrigin(request))return error("Origem não autorizada.",403);
  const length=Number(request.headers.get("content-length")||0);
  if(length>3*1024*1024)return error("Dados excedem o limite de importação.",413);
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login.",401);
  if(!access.allowed)return error("Perfil não autorizado.",403);
  let data;try{data=await request.json();}catch{return error("Conteúdo inválido.",400);}
  const action=data?.action;
  const sql=database();
  const units=manager(access)?new Set():await unitAssignment(sql,access.email);
  if(action==="merge_legacy"){
   if(!["developer","admin"].includes(access.role))
    return error("A importação de dados antigos é exclusiva da administração.",403);
   const campaigns=Array.isArray(data.campaigns)?data.campaigns:[];
   const tasks=Array.isArray(data.tasks)?data.tasks:[];
   if(campaigns.length>350||tasks.length>2000)return error("Lote de importação excessivo.",413);
   for(const c of campaigns.filter(x=>!x.demo)){const invalid=validateCampaign({...x,description:String(x.description||""),version:Number(x.version||1),units:x.units||[]});if(invalid)return error(invalid,422);}
   for(const t of tasks.filter(x=>!x.demo)){const invalid=validateTask(t);if(invalid)return error(invalid,422);}
   const rows=await sql.query(
    "SELECT cc_commercial_import_legacy($1::jsonb,$2::jsonb,$3)::jsonb AS result",
    [JSON.stringify(campaigns),JSON.stringify(tasks),access.email]
   );
   return response({ok:true,...rows[0].result});
  }
  if(action==="save_campaign"){
   if(!manager(access))return error("Somente a gestão pode administrar campanhas centrais.",403);
   const draft=data.item;
   const invalid=validateCampaign(draft);
   if(invalid)return error(invalid,422);
   const expected=data.expectedRevision;
   if(!Number.isInteger(expected)||expected<0)return error("Revisão da campanha inválida.",422);
   for(const id of draft.units)if(!await unitIsKnown(sql,id))return error("Uma unidade da campanha não existe no diretório.",422);
   const clean=stripRevision(draft);
   const due=new Date();due.setDate(due.getDate()+7);
   const deadline=[due.getFullYear(),String(due.getMonth()+1).padStart(2,"0"),String(due.getDate()).padStart(2,"0")].join("-");
   const checklist=["Definir público-alvo","Validar oferta","Produzir materiais","Alinhar unidades","Registrar resultados"];
   const deliveries=draft.units.map(unitId=>({
    id:randomUUID(),title:draft.title,objective:draft.description,category:"Campanha geral",
    unitId,campaignId:draft.id,owner:"Equipe local",support:"",collaborators:"",priority:"Média",
    due:deadline,stage:"Planejamento",targetAudience:"",offer:"",channels:"",dependencies:"",
    blocked:false,blockReason:"",indicator:draft.indicator||"Matrículas",goal:null,actual:null,budget:null,
    investment:null,ackVersion:0,archived:false,participantEmails:[],deadlineRevision:0,
    checklist:checklist.map((title,i)=>({id:randomUUID(),title,done:false,required:i<3,owner:"",due:""})),
    comments:[],history:[],learning:{worked:"",challenges:"",decision:"",pendingReason:""},
    demo:false,updatedAt:new Date().toISOString()
   }));
   let saved;
   try{
    const rows=await sql.query(
     "SELECT cc_commercial_write_campaign($1::jsonb,$2,$3,$4::jsonb) AS saved",
     [JSON.stringify(clean),expected,access.email,JSON.stringify(deliveries)]
    );
    saved=rows[0].saved;
   }catch(e){
    if(e.code==="40001")return error("Conflito de edição: outra pessoa modificou esta campanha. Atualize os dados antes de salvar.",409);
    throw e;
   }
   return response({ok:true,item:{...clean,syncRevision:Number(saved.revision)},
    createdTasks:saved.createdTasks||[],createdCount:saved.createdCount||0});
  }
  if(action==="save_task"){
   const item=data.item;
   const invalid=validateTask(item);
   if(invalid)return error(invalid,422);
   const expected=data.expectedRevision;
   if(!Number.isInteger(expected)||expected<0)return error("Revisão da demanda inválida.",422);
   if(!await unitIsKnown(sql,item.unitId))return error("Unidade não cadastrada.",422);
   const existing=await sql.query("SELECT id,payload,unit_id,revision,created_by FROM cc_commercial_tasks WHERE id=$1",[item.id]);
   const current=existing[0]||null;
   if(!allowedTask(access,item,units,true)||
       current&&!allowedTask(access,{...current.payload,unitId:current.unit_id,createdBy:current.created_by},units,true))
    return error("Você não pode editar demandas desta unidade.",403);
   if(!manager(access)&&access.role==="colaborador"){
    if(!current)return error("Colaboradores não podem criar demandas independentes.",403);
    const allowed=new Set(["checklist","comments","actual","learning","history","updatedAt"]);
    const original=current.payload;
    for(const key of new Set([...Object.keys(original),...Object.keys(item)])){
     if(allowed.has(key)||key==="syncRevision"||key==="createdBy")continue;
     if(JSON.stringify(original[key]??null)!==JSON.stringify(item[key]??null))
      return error("Colaboradores podem atualizar somente atividades, comentários, resultados e aprendizados.",403);
    }
   }
   const clean=stripRevision(item);
   let rows;
   if(expected===0){
    rows=await sql.query(
     "INSERT INTO cc_commercial_tasks(id,payload,unit_id,campaign_id,created_by,updated_by) VALUES($1,$2::jsonb,$3,$4,$5,$5) ON CONFLICT DO NOTHING RETURNING revision",
     [item.id,JSON.stringify(clean),item.unitId,item.campaignId||null,access.email]
    );
   }else{
    rows=await sql.query(
     "UPDATE cc_commercial_tasks SET payload=$2::jsonb,unit_id=$3,campaign_id=$4,revision=revision+1,updated_at=now(),updated_by=$5 WHERE id=$1 AND revision=$6 RETURNING revision",
     [item.id,JSON.stringify(clean),item.unitId,item.campaignId||null,access.email,expected]
    );
   }
   if(!rows.length)return error("Conflito de edição: a demanda foi alterada por outra pessoa. Atualize antes de salvar.",409);
   return response({ok:true,item:{...clean,syncRevision:Number(rows[0].revision)},revision:Number(rows[0].revision)});
  }
  if(action==="change_stage"){
   const id=data.id,stage=data.stage,expected=data.expectedRevision;
   if(!isValidId(id)||!stages.includes(stage)||stage==="Concluído"||
      !Number.isInteger(expected)||expected<1)return error("Movimentação inválida.",422);
   const oldRows=await sql.query("SELECT payload,unit_id,created_by FROM cc_commercial_tasks WHERE id=$1",[id]);
   if(!oldRows.length)return error("Demanda não encontrada.",404);
   const old=oldRows[0];
   if(!allowedTask(access,{...old.payload,unitId:old.unit_id,createdBy:old.created_by},units,true))
    return error("Seu perfil não pode movimentar esta demanda.",403);
   if(access.role==="colaborador")return error("Colaboradores podem concluir suas atividades, mas não alterar etapas do Kanban.",403);
   if(old.payload.archived)return error("Restaure a demanda antes de movimentar.",409);
   const at=new Date().toISOString();
   const entry={id:randomUUID(),at,action:"Etapa alterada para "+stage,by:access.email};
   const rows=await sql.query(
    "UPDATE cc_commercial_tasks SET payload=jsonb_set(jsonb_set(payload,'{stage}',to_jsonb($2::text)),'{history}',COALESCE(payload->'history','[]'::jsonb)||jsonb_build_array($3::jsonb))||jsonb_build_object('updatedAt',$4::text),revision=revision+1,updated_by=$5,updated_at=now() WHERE id=$1 AND revision=$6 RETURNING payload,revision",
    [id,stage,JSON.stringify(entry),at,access.email,expected]
   );
   if(!rows.length)return error("A demanda foi atualizada por outra pessoa. Recarregue o quadro para evitar conflito.",409);
   return response({ok:true,item:{...rows[0].payload,syncRevision:Number(rows[0].revision)}});
  }
  return error("Operação não reconhecida.",422);
 }catch(e){
  if(e.code==="23505"||e.code==="40001")return error("Conflito de edição: atualize os dados compartilhados e tente novamente.",409);
  if(e.code==="22023"||e.code==="23514")return error("Dados inválidos ou inconsistentes.",422);
  return error("Não foi possível gravar no Neon. Os dados anteriores foram preservados.",503);
 }
}
