"use client";
import UnitsManager from "./UnitsManager";
import TeamManagement from "./TeamManagement";
import CampaignUnitSelector from "./CampaignUnitSelector";
import ChurnDashboard from "./ChurnDashboard";
import ChurnOverview from "./ChurnOverview";
import LearningArchive from "./LearningArchive";
import HistoryDashboard from "./HistoryDashboard";
import CalendarWorkspace from "./CalendarWorkspace";
import EmailSettingsPanel from "./EmailSettingsPanel";
import DateCalendarInput from "./DateCalendarInput";
import TeamAttendeePicker from "./TeamAttendeePicker";
import CalendarAlertsBell from "./CalendarAlertsBell";
import { OFFICIAL_UNITS, mergeOfficialUnits } from "../data/official-units";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, ClipboardList, Megaphone, CalendarDays, Building2,
  BookOpen, History, Archive, UsersRound, Settings2, Search, Plus, Bell, ArrowUpRight,
  CheckCircle2, Clock3, AlertTriangle, Menu, X, Download, Upload,
  MoreHorizontal, ArrowLeft, ShieldCheck, FileText, Target, Wallet,
  CircleAlert, Filter, RotateCcw, TrendingUp, TrendingDown, Save, Trash2, Eye,
  Info, Sparkles, List, Columns3, LockKeyhole, ChevronDown, Check,
  MessageSquare, Pencil, ArrowRight, ChartColumnIncreasing, FolderOpen
} from "lucide-react";

const STAGES = ["Ideias","Planejamento","Aguardando aprovação","Pronto para executar","Em execução","Em avaliação","Concluído"];
const PRIORITIES = ["Baixa","Média","Alta","Urgente"];
const METRICS = ["Contatos","Visitas agendadas","Comparecimentos","Matrículas","Reativações","Receita"];
const CATEGORIES = ["Campanha geral","Estratégia de unidade","Inauguração","Ação promocional","Parceria local","Reativação","Retenção"];
const TEMPLATES = {
  "Campanha geral":["Definir público-alvo","Validar oferta","Produzir materiais","Alinhar unidades","Registrar resultados"],
  "Estratégia de unidade":["Diagnosticar oportunidades","Definir meta local","Planejar canais","Distribuir atividades","Avaliar resultados"],
  "Inauguração":["Planejar cronograma","Aprovar orçamento","Preparar equipe","Divulgar inauguração","Consolidar matrículas"],
  "Ação promocional":["Definir condições","Obter aprovação","Divulgar ação","Executar contatos","Avaliar conversão"],
  "Parceria local":["Selecionar parceiro","Validar proposta","Formalizar acordo","Divulgar parceria","Avaliar retornos"],
  "Reativação":["Definir carteira","Validar comunicação","Realizar contatos","Registrar reativações","Consolidar resultados"],
  "Retenção":["Identificar público","Planejar abordagem","Executar acompanhamento","Registrar resultados","Analisar aprendizados"]
};
const NAV=[
 ["Visão geral",LayoutDashboard],
 ["Demandas",ClipboardList],
 ["Campanhas",Megaphone],
 ["Calendário",CalendarDays],
 ["Unidades",Building2],
 ["Churn das unidades",TrendingDown],
 ["Gerenciar unidades",Pencil],
 ["Acervo",BookOpen],
 ["Histórico",History],
 ["Equipe",UsersRound],
 ["Configurações",Settings2],
];
const uid=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);
function day(n=0){const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function dateFmt(d){if(!d)return "Sem prazo";const p=String(d).split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:d;}
// Abre o WhatsApp somente com telefone brasileiro válido (DDD + número).
// Se o cadastro já trouxer +55, não duplicamos o código do país.
function whatsAppLink(phone){
 const digits=String(phone??"").replace(/\D/g,"");
 const national=(digits.length===12||digits.length===13)&&digits.startsWith("55")?digits.slice(2):digits;
 if(![10,11].includes(national.length)||!/^[1-9][0-9]/.test(national))return null;
 return "https://wa.me/55"+national;
}
function currency(n){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:2}).format(Number(n)||0);}
function percent(x){return x===null?"Não informado":new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(x)+"%";}
function ratio(n,d){return n===null||n===undefined||d===null||d===undefined||Number(d)<=0||n===""?null:(Number(n)/Number(d))*100;}
function cost(i,r){return i===null||i===undefined||r===null||r===undefined||Number(r)<=0||i===""?null:Number(i)/Number(r);}
function checklist(cat){return (TEMPLATES[cat]||TEMPLATES["Campanha geral"]).map((title,i)=>({id:uid(),title,done:false,required:i<3,owner:"",due:""}));}
function task(data={}) {return {id:uid(),title:"",objective:"",category:"Campanha geral",unitId:"site-26fit-santa-cruz-do-sul",campaignId:null,owner:"Equipe local",support:"",collaborators:"",priority:"Média",due:day(7),stage:"Ideias",targetAudience:"",offer:"",channels:"",dependencies:"",blocked:false,blockReason:"",indicator:"Matrículas",goal:null,actual:null,budget:null,investment:null,ackVersion:0,archived:false,participantEmails:[],deadlineRevision:0,checklist:checklist("Campanha geral"),comments:[],history:[],learning:{worked:"",challenges:"",decision:"",pendingReason:""},demo:false,updatedAt:new Date().toISOString(),...data};}
function seedData(){ return { units: [...OFFICIAL_UNITS], campaigns: [], tasks: [] }; }
function Tag({children,tone="neutral"}){return <span className={"tag "+tone}>{children}</span>;}
function UnitName({units,id}){return units.find(u=>u.id===id)?.name||"Unidade não cadastrada";}
function Button({children,onClick,kind="primary",disabled=false,title,type="button"}){return <button title={title} type={type} disabled={disabled} onClick={onClick} className={"btn "+kind}>{children}</button>;}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>;}
function Notice({children}){return <div className="notice"><Info size={18}/><span>{children}</span></div>;}
function TaskCard({item,units,onOpen,compact=false,drag=true}) {
 const done=item.checklist.filter(c=>c.done).length, total=item.checklist.length;
 const overdue=item.due<day()&&item.stage!=="Concluído";
 return <article className={"task-card "+(compact?"compact":"")} draggable={drag} onDragStart={e=>{e.dataTransfer.setData("text/plain",item.id);e.dataTransfer.effectAllowed="move";}}>
 <div className="card-meta"><Tag tone={item.priority==="Urgente"?"danger":item.priority==="Alta"?"warning":"neutral"}>{item.priority}</Tag>{item.archived&&<Tag>Arquivada</Tag>}{item.demo&&<Tag>Demo</Tag>}{item.blocked&&<Tag tone="danger">Bloqueada</Tag>}</div>
 <button className="task-title" onClick={()=>onOpen(item)}>{item.title}</button>
 <div className="task-unit"><Building2 size={13}/><UnitName units={units} id={item.unitId}/></div>
 <div className="progress-track"><span style={{width:(total?100*done/total:0)+"%"}}/></div>
 <div className="card-foot"><span>{done}/{total} atividades</span><span className={overdue?"late":""}><Clock3 size={13}/>{dateFmt(item.due)}</span></div>
 </article>;
}
export default function Home({accessRole}) {
 const [ready,setReady]=useState(false),[units,setUnits]=useState([]),[campaigns,setCampaigns]=useState([]),[tasks,setTasks]=useState([]);
 // Refs preservam a etapa mais recente durante movimentações rápidas,
 // sem esperar a renderização ou a resposta de chamadas externas.
 const tasksRef=useRef(tasks);
 tasksRef.current=tasks;
 const stageWritesRef=useRef(new Map());
 const serverRevisionsRef=useRef(new Map());
 const sharedBusyRef=useRef(0);
 const fetchingRef=useRef(false);
 const initialRemoteRef=useRef(false);
 const [syncState,setSyncState]=useState({status:"loading",error:"",lastAt:null});
 const [legacyCounts,setLegacyCounts]=useState({tasks:0,campaigns:0});
 const [legacyIssue,setLegacyIssue]=useState("");
 const [nav,setNav]=useState("Visão geral"),[view,setView]=useState("Kanban"),[filter,setFilter]=useState({q:"",unit:"",priority:"",stage:"",campaign:"",category:"",owner:"",period:""});
 const [drawer,setDrawer]=useState(null),[editing,setEditing]=useState(null),[campaignDraft,setCampaignDraft]=useState(null);
 const [detailCamp,setDetailCamp]=useState(null),[month,setMonth]=useState(new Date().getMonth()),[year,setYear]=useState(new Date().getFullYear());
 const [toast,setToast]=useState(""),[error,setError]=useState(""),[mobile,setMobile]=useState(false);
 const [directoryFilter,setDirectoryFilter]=useState({q:"",state:"",region:"",status:"",kind:"",coordinator:""});
 const [showDemoUnits,setShowDemoUnits]=useState(false);
 useEffect(()=>{if(typeof window!=="undefined"){const page=new URLSearchParams(window.location.search).get("page");if(page==="manage-units")setNav("Gerenciar unidades");else if(page==="churn")setNav("Churn das unidades");else if(page==="history")setNav("Histórico");else if(page==="calendar")setNav("Calendário");}},[]);
 const [internalDirectoryState,setInternalDirectoryState]=useState("loading");
 async function commercialRequest(payload){
  sharedBusyRef.current++;
  try{
   const response=await fetch("/api/commercial",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok){
    const issue=new Error(result.error||"O Neon não confirmou a gravação.");
    issue.status=response.status;
    throw issue;
   }
   return result;
  }finally{sharedBusyRef.current--;}
 }
 async function refreshShared(firstLoad=false){
  if(fetchingRef.current||sharedBusyRef.current>0)return;
  fetchingRef.current=true;
  try{
   const response=await fetch("/api/commercial",{credentials:"same-origin",cache:"no-store"});
   let payload=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(payload.error||"Falha ao carregar dados compartilhados.");
   if(firstLoad&&!initialRemoteRef.current){
    initialRemoteRef.current=true;
    // Importação automática e não destrutiva SOMENTE na primeira carga de
    // uma conta administradora com o banco ainda vazio. O arquivo local
    // original nunca é apagado nem sobrescrito.
    try{
     const raw=localStorage.getItem("26fit-central-comercial-demo-v1");
     const old=raw?JSON.parse(raw):null;
     if(Array.isArray(old?.units))setUnits(mergeOfficialUnits(old.units));
     else setUnits(seedData().units);
     const tasks=(Array.isArray(old?.tasks)?old.tasks:[]).filter(x=>x&&!x.demo&&x.title?.trim());
     const campaigns=(Array.isArray(old?.campaigns)?old.campaigns:[]).filter(x=>x&&!x.demo&&x.title?.trim());
     if(["developer","admin"].includes(accessRole)&&
       Number(payload.counts?.tasks||0)===0&&Number(payload.counts?.campaigns||0)===0&&
       (tasks.length||campaigns.length)){
      try{
       await commercialRequest({action:"merge_legacy",tasks,campaigns});
       const post=await fetch("/api/commercial",{credentials:"same-origin",cache:"no-store"});
       if(!post.ok)throw Error("Falha ao consultar dados após a migração.");
       payload=await post.json();
      }catch(e){
       setLegacyIssue("Importação automática não concluída: "+e.message+". Você pode importar novamente na aba Configurações.");
      }
     }
     const remoteTaskIds=new Set((payload.tasks||[]).map(t=>t.id));
     const remoteCampaignIds=new Set((payload.campaigns||[]).map(c=>c.id));
     const missingTasks=tasks.filter(t=>!remoteTaskIds.has(t.id)).length;
     const missingCampaigns=campaigns.filter(c=>!remoteCampaignIds.has(c.id)).length;
     setLegacyCounts({tasks:missingTasks,campaigns:missingCampaigns});
     if(missingTasks||missingCampaigns){
      setLegacyIssue(previous=>previous||(
       missingTasks+" demanda(s) e "+missingCampaigns+" campanha(s) antigas ainda estão neste navegador, mas não aparecem na base compartilhada. "+
       (["developer","admin"].includes(accessRole)
         ?"Use Configurações → Migrar dados deste navegador."
         :"Exporte um backup JSON e entregue ao administrador para mesclagem no Neon.")
      ));
     }
    }catch{
     setUnits(seedData().units);
     setLegacyCounts({tasks:0,campaigns:0});
    }
   }
   // Se uma alteração está sendo gravada, nunca substitua a visualização
   // otimista por uma resposta GET de outra versão.
   if(sharedBusyRef.current>0)return;
   tasksRef.current=Array.isArray(payload.tasks)?payload.tasks:[];
   serverRevisionsRef.current=new Map(tasksRef.current.map(t=>[t.id,t.syncRevision||0]));
   setTasks(tasksRef.current);
   setCampaigns(Array.isArray(payload.campaigns)?payload.campaigns:[]);
   setReady(true);
   setSyncState({status:"ready",error:"",lastAt:new Date().toISOString()});
  }catch(e){
   setSyncState(x=>({status:"error",error:e.message||"Neon indisponível",lastAt:x.lastAt}));
  }finally{
   fetchingRef.current=false;
  }
 }
 useEffect(()=>{
  refreshShared(true);
 },[]);
 useEffect(()=>{
  if(!ready)return;
  const timer=setInterval(()=>{
   if(document.visibilityState==="visible"&&!drawer)refreshShared(false);
  },12000);
  const onFocus=()=>{if(!drawer)refreshShared(false);};
  window.addEventListener("focus",onFocus);
  return ()=>{clearInterval(timer);window.removeEventListener("focus",onFocus);};
 },[ready,drawer]);
 // Telefones e informações internas vêm da API protegida; nunca entram no armazenamento local.
 const privateUnitFields=new Set(["leader","leaderContact","coordinator","coordinatorContact","cnpj","cep","street","number","complement","administrativeName","churnCode"]);
 function publicUnitForStorage(unit){
  if(!unit||typeof unit!=="object")return unit;
  return Object.fromEntries(Object.entries(unit).filter(([field])=>!privateUnitFields.has(field)));
 }
 useEffect(()=>{
  if(!ready)return;
  const controller=new AbortController();
  fetch("/api/internal-units",{cache:"no-store",credentials:"same-origin",signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error("Diretório interno indisponível");return response.json();})
   .then(payload=>{
    if(!Array.isArray(payload.units)||payload.units.length<83)throw Error("Cadastro interno incompleto");
    setUnits(previous=>{
      const byId=new Map(mergeOfficialUnits(previous).map(unit=>[unit.id,unit]));
      for(const incoming of payload.units){
        if(!incoming||typeof incoming.id!=="string")continue;
        const old=byId.get(incoming.id)||{};
        byId.set(incoming.id,{
          ...old,...incoming,
          source:old.source||incoming.source,
          region:old.region||({RS:"Sul",SC:"Sul",PR:"Sul",SP:"Sudeste",MT:"Centro-Oeste",PA:"Norte",PI:"Nordeste"}[incoming.state]||null),
          siteUrl:old.siteUrl||null,
          status:old.status||(incoming.type==="Matriz"?"Administrativo":"Aberta")
        });
      }
      return [...byId.values()];
    });
    setInternalDirectoryState("ready");
   }).catch(e=>{if(e.name!=="AbortError")setInternalDirectoryState("error");});
  return ()=>controller.abort();
 },[ready]);
 // O localStorage antigo fica intocado para recuperação/migração manual.
 // A fonte oficial dos dados comerciais agora é a API compartilhada do Neon.
 const normalizeSearch=(v)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const directoryUnits=units.filter(u=>showDemoUnits||!u.demo).filter(u=>{
    const search=normalizeSearch([u.name,u.city,u.state,u.region,u.address,u.coordinator,u.leader,u.cnpj,u.cep,u.administrativeName,u.churnCode].filter(Boolean).join(" "));
    return (!directoryFilter.q||search.includes(normalizeSearch(directoryFilter.q)))
      &&(!directoryFilter.state||u.state===directoryFilter.state)
      &&(!directoryFilter.region||u.region===directoryFilter.region)
      &&(!directoryFilter.status||u.status===directoryFilter.status)
      &&(!directoryFilter.kind||u.type===directoryFilter.kind)
      &&(!directoryFilter.coordinator||normalizeSearch(u.coordinator).includes(normalizeSearch(directoryFilter.coordinator)));
 });
 const publicUnitCount=units.filter(u=>u.source==="26fit.com.br"&&!u.demo).length;
 const publicStates=[...new Set(units.filter(u=>!u.demo&&u.state).map(u=>u.state))].sort();
 const publicRegions=[...new Set(units.filter(u=>!u.demo&&u.region).map(u=>u.region))].sort();
 const publicTypes=[...new Set(units.filter(u=>!u.demo&&u.type).map(u=>u.type))].sort();
 function notify(s){setToast(s);setTimeout(()=>setToast(""),3600);}
 function moveNav(n){setNav(n);setMobile(false);}
 const filtered=useMemo(()=>tasks.filter(t=>{
  const search=(t.title+" "+t.objective+" "+t.owner+" "+t.category+" "+(units.find(u=>u.id===t.unitId)?.name||"")).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const q=filter.q.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return (!q||search.includes(q))&&(!filter.unit||t.unitId===filter.unit)&&(!filter.priority||t.priority===filter.priority)&&(!filter.stage||t.stage===filter.stage)&&(!filter.campaign||t.campaignId===filter.campaign)&&(!filter.category||t.category===filter.category)&&(!filter.owner||t.owner.toLowerCase().includes(filter.owner.toLowerCase()))&&(!filter.period||!t.due||(filter.period==="overdue"?t.due<day()&&t.stage!=="Concluído":filter.period==="week"?t.due>=day()&&t.due<=day(7):true));
 }),[tasks,filter,units]);
 const openCount=tasks.filter(t=>t.stage!=="Concluído"&&!t.archived).length;
 const overdue=tasks.filter(t=>t.stage!=="Concluído"&&t.due<day()).length;
 const pending=tasks.filter(t=>t.stage==="Aguardando aprovação").length;
 const upcoming=tasks.filter(t=>t.stage!=="Concluído"&&t.due>=day()&&t.due<=day(7)).length;
 function openTask(t){setError("");setEditing(JSON.parse(JSON.stringify(t)));setDrawer("task");}
 function newTask(){
  if(accessRole==="colaborador"){notify("Seu perfil pode atualizar apenas demandas atribuídas.");return;}
  openTask(task());
 }

 async function recordActivity({module,action,entityId,title,details="",unitId=null}){
  if(!globalThis.crypto?.randomUUID)throw Error("Seu navegador não suporta o registro seguro de ações.");
  const response=await fetch("/api/history",{
   method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({eventId:globalThis.crypto.randomUUID(),module,action,entityId,title,details,unitId})
  });
  let body={};try{body=await response.json();}catch{}
  if(!response.ok)throw Error(body.error||"O Histórico está indisponível. A alteração não foi salva.");
  return body;
 }
 async function changeStage(id,stage){
  const current=tasksRef.current.find(t=>t.id===id);
  if(!current||current.stage===stage)return;
  if(current.archived){notify("Restaure a demanda antes de alterar sua etapa.");return;}
  if(stage==="Concluído"){openTask({...current,stage});return;}
  if(accessRole==="colaborador"){notify("Colaboradores concluem suas atividades, não movimentam as etapas.");return;}
  const stamp=new Date().toISOString();
  const updated={
   ...current,stage,updatedAt:stamp,
   history:[...(current.history||[]),{id:uid(),at:stamp,action:"Etapa alterada para "+stage,by:"Usuário autenticado"}]
  };
  const displayed=tasksRef.current.map(t=>t.id===id?updated:t);
  tasksRef.current=displayed;
  setTasks(displayed);
  const previous=stageWritesRef.current.get(id)||Promise.resolve();
  const write=previous.catch(()=>{}).then(async()=>{
   const latestRevision=serverRevisionsRef.current.get(id)??current.syncRevision??0;
   const response=await commercialRequest({action:"change_stage",id,stage,expectedRevision:latestRevision});
   const revision=response.item.syncRevision;
   serverRevisionsRef.current.set(id,revision);
   const revised=tasksRef.current.map(t=>t.id===id?{...t,syncRevision:revision}:t);
   tasksRef.current=revised;
   setTasks(revised);
   void recordActivity({
    module:"demanda",action:"stage_changed",entityId:id,title:current.title||"Demanda",
    details:current.stage+" → "+stage,unitId:current.unitId
   }).catch(()=>{});
  });
  stageWritesRef.current.set(id,write);
  try{
   await write;
   if(stageWritesRef.current.get(id)===write)notify("Etapa sincronizada com toda a equipe.");
  }catch(err){
   await refreshShared(false);
   notify(err.message||"Não foi possível atualizar a etapa. Consulte a versão compartilhada.");
  }finally{
   if(stageWritesRef.current.get(id)===write)stageWritesRef.current.delete(id);
  }
 }
 async function syncTaskDeadline(item){
  if(item.demo||!item.due)return item;
  const response=await fetch("/api/calendar/deadline",{
   method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    taskId:item.id,title:item.title,unitId:item.unitId,due:item.due,
    expectedRevision:item.deadlineRevision||0,
    attendees:item.participantEmails||[],
    status:item.archived?"cancelado":item.stage==="Concluído"?"concluido":"agendado"
   })
  });
  let info={};try{info=await response.json();}catch{}
  if(!response.ok)throw Error(info.error||"Falha ao sincronizar o prazo com a agenda.");
  return {...item,deadlineRevision:info.revision};
 }
 async function saveTask(){
  if(!editing?.title?.trim()){setError("Informe o título da demanda.");return;}
  if(editing.archived){setError("Restaure a demanda antes de editá-la.");return;}
  if(editing.blocked&&!editing.blockReason?.trim()){setError("Informe o motivo do bloqueio.");return;}
  if(editing.stage==="Concluído"){
   if(!editing.learning?.worked?.trim()||!editing.learning?.challenges?.trim()||!editing.learning?.decision){
    setError("Para concluir, registre aprendizados e recomendação.");return;
   }
   if(editing.checklist.some(c=>c.required&&!c.done)&&!editing.learning.pendingReason?.trim()){
    setError("Justifique as atividades obrigatórias pendentes.");return;
   }
  }
  const exists=tasks.some(t=>t.id===editing.id);
  const original=tasks.find(t=>t.id===editing.id);
  const updated={...editing,updatedAt:new Date().toISOString(),
   history:[...(editing.history||[]),{at:new Date().toISOString(),
    action:exists?"Demanda editada":"Demanda criada",by:"Usuário autenticado"}]};
  try{
   const changedDeadline=!original||original.due!==updated.due||
    original.title!==updated.title||original.unitId!==updated.unitId||
    original.archived!==updated.archived||original.stage!==updated.stage||
    JSON.stringify(original.participantEmails||[])!==JSON.stringify(updated.participantEmails||[]);
   const synced=changedDeadline?await syncTaskDeadline(updated):updated;
   const response=await commercialRequest({
    action:"save_task",item:synced,expectedRevision:editing.syncRevision||0
   });
   serverRevisionsRef.current.set(updated.id,response.item.syncRevision);
   setTasks(list=>exists?list.map(t=>t.id===editing.id?response.item:t):[response.item,...list]);
   window.dispatchEvent(new Event("26fit:calendar-updated"));
   setDrawer(null);setError("");
   notify("Demanda salva no Neon e compartilhada com a equipe.");
   void recordActivity({
    module:"demanda",action:updated.stage==="Concluído"?"completed":exists?"updated":"created",
    entityId:updated.id,title:updated.title,
    details:"Etapa: "+updated.stage+(updated.category?" • "+updated.category:""),
    unitId:updated.unitId
   }).catch(()=>{});
  }catch(err){
   setError(err.message||"Falha ao gravar a demanda compartilhada.");
   if(err.status===409)void refreshShared(false);
  }
 }
 async function toggleTaskArchived(){
  if(!editing||!tasks.some(t=>t.id===editing.id))return;
  const next=!editing.archived;
  if(next&&!window.confirm("Arquivar esta demanda? Ela continuará disponível para consulta e restauração."))return;
  const updated={...editing,archived:next,updatedAt:new Date().toISOString()};
  try{
   const synced=await syncTaskDeadline(updated);
   const result=await commercialRequest({
    action:"save_task",item:synced,expectedRevision:editing.syncRevision||0
   });
   serverRevisionsRef.current.set(updated.id,result.item.syncRevision);
   setTasks(list=>list.map(t=>t.id===updated.id?result.item:t));
   setEditing(result.item);setDrawer(null);setError("");
   window.dispatchEvent(new Event("26fit:calendar-updated"));
   notify(next?"Demanda arquivada no Neon.":"Demanda restaurada no Neon.");
   void recordActivity({
    module:"demanda",action:next?"archived":"restored",entityId:updated.id,
    title:updated.title||"Demanda",details:next?"Demanda arquivada":"Demanda restaurada",unitId:updated.unitId
   }).catch(()=>{});
  }catch(err){
   setError(err.message||"Falha ao arquivar a demanda.");
   if(err.status===409)void refreshShared(false);
  }
 }
 function newCampaign(){
  if(!["developer","admin","gestor"].includes(accessRole)){notify("Campanhas centrais são criadas pela gestão.");return;}
  setError("");setCampaignDraft({id:uid(),title:"",description:"",indicator:"Matrículas",goal:null,version:1,units:[],archived:false,demo:false,createdAt:new Date().toISOString()});setDrawer("campaign");}
 function editCampaign(c){
  if(!["developer","admin","gestor"].includes(accessRole)){notify("A edição da campanha é restrita à gestão.");return;}
  setError("");setCampaignDraft(JSON.parse(JSON.stringify(c)));setDrawer("campaign");}

 async function saveCampaign(){
  if(!campaignDraft?.title?.trim()){setError("Informe o título da campanha.");return;}
  if(campaignDraft.archived){setError("Restaure a campanha antes de editá-la.");return;}
  const old=campaigns.find(c=>c.id===campaignDraft.id);
  const changed=old&&old.description!==campaignDraft.description;
  const merged={
   ...campaignDraft,
   version:changed?(old.version+1):campaignDraft.version,
   updatedAt:new Date().toISOString()
  };
  try{
   const saved=await commercialRequest({
    action:"save_campaign",item:merged,expectedRevision:old?.syncRevision||0
   });
   setCampaigns(list=>old?list.map(c=>c.id===merged.id?saved.item:c):[saved.item,...list]);
   if(saved.createdTasks?.length)setTasks(list=>{
    const ids=new Set(list.map(t=>t.id));
    return [...saved.createdTasks.filter(t=>!ids.has(t.id)),...list];
   });
   setDrawer(null);setError("");
   notify(changed?"Orientações atualizadas e compartilhadas.":"Campanha salva no Neon com "+saved.createdCount+" entrega(s) nova(s).");
   void recordActivity({
    module:"campanha",action:old?"updated":"created",
    entityId:merged.id,title:merged.title,
    details:(merged.units||[]).length+" unidade(s) • "+saved.createdCount+" nova(s) entrega(s) • versão "+merged.version
   }).catch(()=>{});
   void refreshShared(false);
  }catch(err){
   setError(err.message||"Não foi possível salvar a campanha.");
   if(err.status===409)void refreshShared(false);
  }
 }
 async function toggleCampaignArchived(){
  if(!campaignDraft||!campaigns.some(c=>c.id===campaignDraft.id))return;
  const next=!campaignDraft.archived;
  if(next&&!window.confirm("Arquivar esta campanha? Suas entregas e seu histórico serão preservados."))return;
  const updated={...campaignDraft,archived:next,updatedAt:new Date().toISOString()};
  try{
   const saved=await commercialRequest({
    action:"save_campaign",item:updated,expectedRevision:campaignDraft.syncRevision||0
   });
   setCampaigns(list=>list.map(c=>c.id===updated.id?saved.item:c));
   setCampaignDraft(saved.item);setDrawer(null);setError("");
   notify(next?"Campanha arquivada no Neon.":"Campanha restaurada no Neon.");
   void recordActivity({
    module:"campanha",action:next?"archived":"restored",
    entityId:updated.id,title:updated.title||"Campanha",
    details:next?"Campanha arquivada":"Campanha restaurada"
   }).catch(()=>{});
  }catch(err){
   setError(err.message||"Não foi possível arquivar a campanha.");
   if(err.status===409)void refreshShared(false);
  }
 }
 function confirmRead(t){const c=campaigns.find(c=>c.id===t.campaignId);if(!c)return;setEditing(e=>({...e,ackVersion:c.version}));notify("Confirmação será gravada ao salvar a demanda.");}
 function exportData(){
  const data=JSON.stringify({
   schema:"26fit.central.demo.v1",exportedAt:new Date().toISOString(),
   source:"Neon compartilhado",
   units:units.map(publicUnitForStorage),campaigns,tasks
  },null,2);
  const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
  const a=document.createElement("a");
  a.href=url;a.download="26fit-central-comercial-backup-"+day()+".json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify("Backup dos registros compartilhados exportado.");
 }
 async function mergeBackup(data){
  if(!Array.isArray(data.tasks)||!Array.isArray(data.campaigns))
   throw Error("Arquivo sem campanhas ou demandas válidas.");
  if(!["developer","admin"].includes(accessRole))
   throw Error("Somente a administração pode migrar os dados comerciais.");
  const result=await commercialRequest({
   action:"merge_legacy",
   tasks:data.tasks.filter(x=>x&&!x.demo),
   campaigns:data.campaigns.filter(x=>x&&!x.demo)
  });
  await refreshShared(false);
  setLegacyIssue("");
  setLegacyCounts({tasks:0,campaigns:0});
  return result;
 }
 async function importData(file){
  if(!file)return;
  if(file.size>3*1024*1024){notify("Backup excede 3 MB.");return;}
  try{
   const data=JSON.parse(await file.text());
   if(!["26fit.central.demo.v1","26fit.central.shared.v2"].includes(data.schema))
    throw Error("Formato de backup não reconhecido.");
   if(!window.confirm("Mesclar os registros deste backup no Neon? Registros já existentes serão preservados, sem sobrescrita."))
    return;
   const result=await mergeBackup(data);
   notify("Mesclagem concluída: "+result.tasksImported+" demandas e "+result.campaignsImported+" campanhas adicionadas.");
   void recordActivity({
    module:"configuracoes",action:"backup_imported",entityId:"backup-"+uid(),
    title:"Backup comercial mesclado no Neon",
    details:result.tasksImported+" demandas e "+result.campaignsImported+" campanhas adicionadas"
   }).catch(()=>{});
  }catch(err){notify("Importação não realizada: "+err.message);}
 }
 async function importLegacyBrowser(){
  try{
   const raw=localStorage.getItem("26fit-central-comercial-demo-v1");
   if(!raw)throw Error("Nenhum backup antigo encontrado neste navegador.");
   const data=JSON.parse(raw);
   if(!window.confirm("Importar registros antigos deste navegador para o Neon? Nenhum dado existente será substituído."))return;
   const result=await mergeBackup(data);
   notify("Migração local: "+result.tasksImported+" demandas e "+result.campaignsImported+" campanhas adicionadas.");
  }catch(err){notify("Importação local não realizada: "+err.message);}
 }
 async function clearDemo(){
  if(!window.confirm("Remover registros de demonstração? Os demais registros deste navegador serão preservados."))return;
  const count=tasks.filter(t=>t.demo).length+campaigns.filter(c=>c.demo).length+units.filter(u=>u.demo).length;
  if(!count){notify("Não há registros fictícios para remover.");return;}
  try{
   await recordActivity({module:"configuracoes",action:"demo_removed",entityId:"demos-"+uid(),
    title:"Registros demonstrativos arquivados",details:count+" registro(s) fictício(s) removido(s) do navegador"});
   setTasks(list=>list.filter(t=>!t.demo));setCampaigns(list=>list.filter(c=>!c.demo));
   setUnits(list=>list.filter(u=>!u.demo));notify("Registros fictícios removidos e registrados no Histórico.");
  }catch(err){notify(err.message||"Falha ao registrar a limpeza.");}
 }
 function quickFilter(f){setFilter(a=>({...a,...f}));moveNav("Demandas");setView("Lista");}
 const activeCampaign=campaigns.find(c=>c.id===detailCamp);
 function campaignTotal(c){const list=tasks.filter(t=>t.campaignId===c.id&&t.indicator===c.indicator&&t.actual!==null&&t.actual!==""&&t.actual!==undefined);return {n:list.length,sum:list.reduce((n,t)=>n+Number(t.actual),0)};}
 function localUnits(){return units.filter(u=>u.demo).length;}
 if(!ready)return <main className="boot">{syncState.status==="error"?
  <div className="cc-sync-boot-error">
   <CircleAlert size={26}/>
   <h2>Não foi possível conectar ao Neon</h2>
   <p>{syncState.error}. Para proteger os dados comerciais, o sistema não permite gravações locais.</p>
   <button className="btn" onClick={()=>window.location.reload()}>Tentar novamente</button>
  </div>:"Carregando os dados compartilhados da Central Comercial…"}</main>;
 return <div className="shell">
  <aside className={"sidebar "+(mobile?"mobile-open":"")}>
   <div className="brand"><div className="brand-logo"><img src="/logo_v2.png" alt="26fit" width="100" height="54"/></div><div className="brand-copy"><strong>Central</strong><small>Comercial</small></div><button className="close-mobile" onClick={()=>setMobile(false)}><X size={18}/></button></div>
   <div className="sidebar-caption">ESPAÇO DE TRABALHO</div>
   <nav>{NAV.filter(([name])=>(name!=="Churn das unidades"||["developer","admin","gestor","lider"].includes(accessRole))&&(name!=="Histórico"||["developer","admin","gestor"].includes(accessRole))&&(!["Gerenciar unidades","Configurações","Equipe"].includes(name)||["developer","admin","gestor"].includes(accessRole))).map(([name,Icon])=><button key={name} className={"nav-item "+(nav===name?"active":"")} onClick={()=>moveNav(name)}><Icon size={18}/><span>{name}</span>{name==="Demandas"&&<b>{openCount}</b>}</button>)}</nav>
   <div className="sidebar-bottom"><div className="sidebar-footer"><strong>26fit • Central Comercial</strong><small>Planejamento e execução da rede</small></div></div>
  </aside>
  {mobile&&<button aria-label="Fechar menu" className="mobile-mask" onClick={()=>setMobile(false)}/>}
  <div className="workspace">
   <header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={()=>setMobile(true)}><Menu size={21}/></button><span>Central Comercial</span><span className="crumb">/</span><strong>{nav}</strong><span className={"cc-sync-indicator "+(syncState.status==="ready"?"online":"offline")} title={syncState.status==="ready"?"Dados compartilhados no Neon":syncState.error}><span/> {syncState.status==="ready"?"Neon sincronizado":"Sincronização indisponível"}</span></div><div className="top-actions"><CalendarAlertsBell tasks={tasks} pending={pending} onCalendar={()=>moveNav("Calendário")} onApprovals={()=>quickFilter({stage:"Aguardando aprovação"})}/><div className="avatar small">D</div></div></header>
   <main className="main">
   {legacyIssue&&<div className="cc-sync-warning"><AlertTriangle size={17}/><span>{legacyIssue}</span></div>}
   {nav==="Visão geral"&&<>
    <div className="heading-row"><div><div className="eyebrow">PAINEL DE CONTROLE <span className="dot">·</span> {new Date().toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"})}</div><h1>Visão geral</h1><p>Organize a estratégia da rede e acompanhe a execução de cada unidade.</p></div>{accessRole!=="colaborador"&&<Button onClick={newTask}><Plus size={17}/> Nova demanda</Button>}</div>
    <div className="hero"><div><div className="hero-kicker"><Sparkles size={14}/> CENTRAL DE PLANEJAMENTO</div><h2>Uma rede alinhada.<br/><span>Resultados em movimento.</span></h2><p>Planeje campanhas, distribua entregas e transforme aprendizados em novas ações.</p><button onClick={()=>moveNav("Campanhas")}>Ver campanhas <ArrowUpRight size={16}/></button></div><div className="hero-decoration"><span className="ring one"/><span className="ring two"/><span className="ring three"/><div className="hero-card"><ChartColumnIncreasing size={22}/><div><b>Planejamento → Execução</b><small>Visão completa da jornada</small></div><CheckCircle2 size={17}/></div></div></div>
    {["developer","admin","gestor","lider"].includes(accessRole)&&<ChurnOverview onOpen={()=>moveNav("Churn das unidades")}/>}
    <div className="kpis">
     <button className="kpi" onClick={()=>quickFilter({stage:"",period:""})}><span><ClipboardList size={17}/> Demandas abertas</span><div><strong>{openCount}</strong><ArrowUpRight size={19}/></div><small>Em todas as etapas</small></button>
     <button className="kpi" onClick={()=>quickFilter({stage:"",period:"overdue"})}><span><AlertTriangle size={17}/> Atrasadas</span><div><strong>{overdue}</strong><ArrowUpRight size={19}/></div><small>Prazo já ultrapassado</small></button>
     <button className="kpi" onClick={()=>quickFilter({stage:"Aguardando aprovação",period:""})}><span><Clock3 size={17}/> Aguardando aprovação</span><div><strong>{pending}</strong><ArrowUpRight size={19}/></div><small>Precisam de decisão</small></button>
     <button className="kpi" onClick={()=>quickFilter({stage:"",period:"week"})}><span><CalendarDays size={17}/> Próximos 7 dias</span><div><strong>{upcoming}</strong><ArrowUpRight size={19}/></div><small>Entregas com prazo próximo</small></button>
    </div>
    <div className="dashboard-grid"><section className="panel"><div className="section-title"><div><h3>Minha semana</h3><p>Pendências próximas no ambiente demonstrativo</p></div><button className="text-button" onClick={()=>moveNav("Demandas")}>Ver todas <ArrowRight size={15}/></button></div><div className="weekly">{tasks.filter(t=>t.stage!=="Concluído").sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5).map(t=><button className="weekly-row" key={t.id} onClick={()=>openTask(t)}><span className={"round-icon "+(t.due<day()?"red":"")}><ClipboardList size={16}/></span><span className="weekly-info"><strong>{t.title}</strong><small><UnitName units={units} id={t.unitId}/> · {t.stage}</small></span><span className={"due "+(t.due<day()?"late":"")}>{dateFmt(t.due)}</span><ArrowUpRight size={16}/></button>)}{tasks.length===0&&<div className="empty">Nenhuma demanda cadastrada.</div>}</div></section>
    <section className="panel"><div className="section-title"><div><h3>Execução por unidade</h3><p>Visibilidade das demandas locais</p></div><Building2 size={18} color="#9299a1"/></div><div className="unit-progress">{units.filter(u=>!u.demo).sort((a,b)=>tasks.filter(t=>t.unitId===b.id).length-tasks.filter(t=>t.unitId===a.id).length).slice(0,6).map(u=>{const x=tasks.filter(t=>t.unitId===u.id),total=x.length,completed=x.filter(t=>t.stage==="Concluído").length;return <button className="unit-progress-row" key={u.id} onClick={()=>quickFilter({unit:u.id,stage:"",period:""})}><span className="unit-initial">{u.name.replace("Unidade ","").charAt(0)}</span><div><div className="bar-caption"><strong>{u.name}</strong><small>{completed}/{total}</small></div><div className="progress-track"><span style={{width:(total?completed/total*100:0)+"%"}}/></div></div></button>})}{units.length===0&&<div className="empty">Importe o diretório oficial para iniciar.</div>}</div></section></div>
    
   </>}
   {nav==="Demandas"&&<>
    <div className="heading-row"><div><div className="eyebrow">GESTÃO DA EXECUÇÃO</div><h1>Demandas</h1><p>Do planejamento ao aprendizado, tudo em um único lugar.</p></div>{accessRole!=="colaborador"&&<Button onClick={newTask}><Plus size={17}/> Nova demanda</Button>}</div>
    <div className="toolbar"><div className="tab-list">{[["Kanban",Columns3],["Lista",List],["Calendário",CalendarDays],["Por unidade",Building2]].map(([label,Icon])=><button key={label} className={view===label?"active":""} onClick={()=>setView(label)}><Icon size={15}/>{label}</button>)}</div><span className="count">{filtered.length} demandas</span></div>
    <div className="filters"><div className="search"><Search size={17}/><input aria-label="Buscar demandas" placeholder="Buscar demandas..." value={filter.q} onChange={e=>setFilter(f=>({...f,q:e.target.value}))}/></div>
     <select aria-label="Filtrar unidade" value={filter.unit} onChange={e=>setFilter(f=>({...f,unit:e.target.value}))}><option value="">Todas as unidades</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
     <select aria-label="Filtrar prioridade" value={filter.priority} onChange={e=>setFilter(f=>({...f,priority:e.target.value}))}><option value="">Prioridade</option>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select>
     <select aria-label="Filtrar etapa" value={filter.stage} onChange={e=>setFilter(f=>({...f,stage:e.target.value}))}><option value="">Todas as etapas</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
     <select aria-label="Filtrar campanha" value={filter.campaign} onChange={e=>setFilter(f=>({...f,campaign:e.target.value}))}><option value="">Todas as campanhas</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select>
     <select aria-label="Filtrar categoria" value={filter.category} onChange={e=>setFilter(f=>({...f,category:e.target.value}))}><option value="">Categoria</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
     <input className="owner-filter" value={filter.owner} onChange={e=>setFilter(f=>({...f,owner:e.target.value}))} placeholder="Responsável"/>
     <select aria-label="Filtrar período" value={filter.period} onChange={e=>setFilter(f=>({...f,period:e.target.value}))}><option value="">Qualquer período</option><option value="week">Próximos 7 dias</option><option value="overdue">Atrasadas</option></select>
     <button className="clear-filter" title="Limpar filtros" onClick={()=>setFilter({q:"",unit:"",priority:"",stage:"",campaign:"",category:"",owner:"",period:""})}><X size={17}/></button>
    </div>
    {view==="Kanban"&&<div className="kanban">{STAGES.map(s=><section key={s} className="kanban-column" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain");if(id)changeStage(id,s);}}><div className="column-heading"><span className={"stage-dot "+s.toLowerCase().replace(/\s/g,"-")}/><strong>{s}</strong><b>{filtered.filter(t=>t.stage===s).length}</b></div><div className="kanban-cards">{filtered.filter(t=>t.stage===s).map(t=><TaskCard key={t.id} item={t} units={units} onOpen={openTask} drag={accessRole!=="colaborador"}/>)}{filtered.filter(t=>t.stage===s).length===0&&<div className="drop-hint">Arraste uma demanda para cá</div>}</div></section>)}</div>}
    {view==="Lista"&&<div className="table-wrap"><table><thead><tr><th>Demanda</th><th>Unidade</th><th>Responsável</th><th>Etapa</th><th>Prioridade</th><th>Prazo</th><th>Meta</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id} onClick={()=>openTask(t)}><td><strong>{t.title}</strong> {t.demo&&<Tag>Demo</Tag>}<small>{t.category}</small></td><td><UnitName units={units} id={t.unitId}/></td><td>{t.owner||"—"}</td><td><Tag tone={t.stage==="Concluído"?"success":t.stage==="Aguardando aprovação"?"warning":"neutral"}>{t.stage}</Tag></td><td>{t.priority}</td><td className={t.due<day()&&t.stage!=="Concluído"?"late":""}>{dateFmt(t.due)}</td><td>{percent(ratio(t.actual,t.goal))}</td></tr>)}</tbody></table>{filtered.length===0&&<div className="empty">Nenhuma demanda encontrada para os filtros.</div>}</div>}
    {view==="Calendário"&&<CalendarView tasks={filtered} year={year} month={month} setYear={setYear} setMonth={setMonth} onOpen={openTask}/>}
    {view==="Por unidade"&&<div className="unit-grid">{units.map(u=><section key={u.id} className="panel"><div className="section-title"><div><h3>{u.name}</h3><p>{u.type} · {u.state}</p></div><Tag>{filtered.filter(t=>t.unitId===u.id).length}</Tag></div>{filtered.filter(t=>t.unitId===u.id).map(t=><TaskCard compact drag={false} key={t.id} item={t} units={units} onOpen={openTask}/>)}{!filtered.some(t=>t.unitId===u.id)&&<div className="empty small">Nenhuma entrega encontrada.</div>}</section>)}</div>}
   </>}
   {nav==="Campanhas"&&<>
    <div className="heading-row"><div><div className="eyebrow">PLANEJAMENTO DA REDE</div><h1>Campanhas</h1><p>Uma estratégia central, com entregas e metas locais.</p></div>{["developer","admin","gestor"].includes(accessRole)&&<Button onClick={newCampaign}><Plus size={17}/> Nova campanha</Button>}</div>
    <div className="campaign-grid">{campaigns.map(c=>{const t=campaignTotal(c);const linked=tasks.filter(d=>d.campaignId===c.id);return <article key={c.id} className="campaign-card"><div className="card-meta"><Tag tone="neutral">Versão {c.version}</Tag>{c.archived&&<Tag>Arquivada</Tag>}{c.demo&&<Tag>Demo</Tag>}</div><h3>{c.title}</h3><p>{c.description}</p><div className="campaign-metrics"><div><small>Unidades participantes</small><strong>{c.units.length}</strong></div><div><small>Entregas vinculadas</small><strong>{linked.length}</strong></div><div><small>Resultado ({c.indicator})</small><strong>{t.n?t.sum:"Não informado"}</strong></div></div><div className="card-end"><button className="text-button" onClick={()=>{setDetailCamp(c.id);setNav("Campanhas");}}>Abrir campanha <ArrowRight size={16}/></button>{["developer","admin","gestor"].includes(accessRole)&&<button className="icon-button" onClick={()=>editCampaign(c)} title="Editar campanha"><Pencil size={17}/></button>}</div></article>})}{campaigns.length===0&&<div className="empty">Nenhuma campanha cadastrada.</div>}</div>
    {activeCampaign&&<div className="campaign-detail panel"><div className="section-title"><div><div className="eyebrow">ENTREGAS DA CAMPANHA</div><h3>{activeCampaign.title}</h3><p>{activeCampaign.indicator} · versão {activeCampaign.version}</p></div><button className="icon-button" title="Fechar" onClick={()=>setDetailCamp(null)}><X size={18}/></button></div><p>{activeCampaign.description}</p><div className="summary-grid"><div><small>Meta central</small><strong>{activeCampaign.goal??"Não informada"}</strong></div><div><small>Realizado consolidado</small><strong>{campaignTotal(activeCampaign).n?campaignTotal(activeCampaign).sum:"Não informado"}</strong></div><div><small>Demandas que contribuíram</small><strong>{campaignTotal(activeCampaign).n}</strong></div><div><small>Atingimento</small><strong>{percent(ratio(campaignTotal(activeCampaign).n?campaignTotal(activeCampaign).sum:null,activeCampaign.goal))}</strong></div></div><div className="linked-list">{tasks.filter(t=>t.campaignId===activeCampaign.id).map(t=><button key={t.id} onClick={()=>openTask(t)}><span><strong><UnitName units={units} id={t.unitId}/></strong><small>{t.stage}{t.blocked?" · Bloqueada":""}{t.ackVersion<activeCampaign.version?" · Leitura pendente":""}</small></span><ArrowUpRight size={17}/></button>)}{!tasks.some(t=>t.campaignId===activeCampaign.id)&&<div className="empty">Sem entregas vinculadas.</div>}</div></div>}
   </>}
   {nav==="Calendário"&&<CalendarWorkspace tasks={tasks} units={units} year={year} month={month} setYear={setYear} setMonth={setMonth} onOpenTask={openTask} onNewTask={newTask} accessRole={accessRole}/>}
   {nav==="Unidades"&&<>
    <div className="heading-row">
      <div><div className="eyebrow">DIRETÓRIO DA REDE</div><h1>Unidades 26fit</h1><p>Academias presentes no diretório público da rede.</p></div>
      <a className="btn secondary" href="https://26fit.com.br/unidades" target="_blank" rel="noopener noreferrer"><ArrowUpRight size={16}/> Site oficial</a>
    </div>
    <div className="directory-summary">
      <div><span className="directory-summary-icon"><Building2 size={22}/></span><div><strong>{publicUnitCount}</strong><small>Academias do site oficial</small></div></div>
      <div><strong>{publicStates.length}</strong><small>Estados</small></div>
      <div><strong>{units.filter(u=>u.source==="26fit.com.br"&&u.status==="Inauguração").length}</strong><small>Em inauguração</small></div>
      <div><strong>{units.filter(u=>u.demo).length}</strong><small>Exemplos locais preservados</small></div>
    </div>
    <div className="directory-filters">
      <label className="directory-search"><Search size={17}/><input value={directoryFilter.q} onChange={e=>setDirectoryFilter(f=>({...f,q:e.target.value}))} placeholder="Pesquisar nome, código churn, cidade ou endereço" aria-label="Pesquisar unidades"/></label>
      <select value={directoryFilter.state} onChange={e=>setDirectoryFilter(f=>({...f,state:e.target.value}))} aria-label="Filtrar estado"><option value="">Todos os estados</option>{publicStates.map(x=><option key={x} value={x}>{x}</option>)}</select>
      <select value={directoryFilter.region} onChange={e=>setDirectoryFilter(f=>({...f,region:e.target.value}))} aria-label="Filtrar região"><option value="">Todas as regiões</option>{publicRegions.map(x=><option key={x}>{x}</option>)}</select>
      <select value={directoryFilter.status} onChange={e=>setDirectoryFilter(f=>({...f,status:e.target.value}))} aria-label="Filtrar situação"><option value="">Todas as situações</option><option value="Aberta">Abertas</option><option value="Inauguração">Em inauguração</option></select>
      <select value={directoryFilter.kind} onChange={e=>setDirectoryFilter(f=>({...f,kind:e.target.value}))} aria-label="Filtrar tipo"><option value="">Todos os tipos</option>{publicTypes.map(x=><option key={x}>{x}</option>)}</select>
      <input value={directoryFilter.coordinator} onChange={e=>setDirectoryFilter(f=>({...f,coordinator:e.target.value}))} placeholder="Coordenador" aria-label="Filtrar coordenador"/>
      <button className="clear-filter" title="Limpar filtros" onClick={()=>setDirectoryFilter({q:"",state:"",region:"",status:"",kind:"",coordinator:""})}><X size={17}/></button>
    </div>
    <div className="directory-head">
      <strong>{directoryUnits.length} registros encontrados</strong>
      <label className="directory-show-examples"><input type="checkbox" checked={showDemoUnits} onChange={e=>setShowDemoUnits(e.target.checked)}/> Mostrar exemplos fictícios</label>
    </div>
    <div className="directory-grid">
      {directoryUnits.map(u=><article className="unit-tile" key={u.id}>
        <div className="unit-icon"><Building2 size={21}/></div>
        <div className="unit-content">
          <div className="unit-label"><h3>{u.name}</h3>{!u.demo&&<span className={"unit-churn-code "+(u.churnCode==null?"unmatched":"")} title="Código da unidade no relatório de churn">{u.churnCode==null?"Sem código churn":"Churn "+String(u.churnCode).padStart(2,"0")}</span>}{u.demo?<Tag>Fictícia</Tag>:u.type==="Matriz"?<Tag>Matriz</Tag>:u.type==="Eleve"?<Tag>Eleve</Tag>:u.status==="Inauguração"?<Tag tone="warning">Inauguração</Tag>:<Tag tone="success">Aberta</Tag>}</div>
          <p>{u.city||"Cidade não informada"} {u.state?"· "+u.state:""} {u.region?"· "+u.region:""}</p>
          {u.address&&<p className="unit-address">{u.address}</p>}
          {(u.leader||u.coordinator)&&<div className="directory-people">
            <div><span>Líder da unidade</span><strong>{u.leader||"Não informado"}</strong>{u.leaderContact&&(whatsAppLink(u.leaderContact)?<a className="directory-whatsapp" href={whatsAppLink(u.leaderContact)} target="_blank" rel="noopener noreferrer" title={"Conversar com "+(u.leader||"o líder")+" pelo WhatsApp"} aria-label={"Abrir WhatsApp do líder "+(u.leader||"da unidade")+", telefone "+u.leaderContact}><MessageSquare size={13}/>{u.leaderContact}</a>:<span className="directory-phone-invalid" title="Telefone sem DDD válido; confira o cadastro">{u.leaderContact}</span>)}</div>
            <div><span>Coordenação regional</span><strong>{u.coordinator||"Não informado"}</strong>{u.coordinatorContact&&<a href={"tel:"+u.coordinatorContact.replace(/\D/g,"")} title="Ligar para a coordenação">{u.coordinatorContact}</a>}</div>
          </div>}
          {(u.cnpj||u.cep||u.street||u.complement)&&<details className="directory-extra">
            <summary>Dados cadastrais e endereço</summary>
            <div className="directory-extra-fields">
              {u.administrativeName&&<p><span>Nome na planilha</span><strong>{u.administrativeName}</strong></p>}
              {u.cnpj&&<p><span>CNPJ</span><strong>{u.cnpj}</strong></p>}
              {u.cep&&<p><span>CEP</span><strong>{u.cep}</strong></p>}
              {u.street&&<p><span>Logradouro</span><strong>{u.street}</strong></p>}
              {u.number&&<p><span>Número</span><strong>{u.number}</strong></p>}
              {u.complement&&<p><span>Complemento</span><strong>{u.complement}</strong></p>}
            </div>
          </details>}
          <div className="unit-actions">
            <Tag>{u.type||"Tipo não informado"}</Tag>
            {u.mapUrl&&<a href={u.mapUrl} target="_blank" rel="noopener noreferrer" title={"Abrir localização de "+u.name}>Mapa <ArrowUpRight size={14}/></a>}
            {u.siteUrl&&<a href={u.siteUrl} target="_blank" rel="noopener noreferrer" title={"Abrir página oficial de "+u.name}>Site <ArrowUpRight size={14}/></a>}
            <button type="button" onClick={()=>quickFilter({unit:u.id,stage:"",period:""})}>Demandas <ArrowRight size={14}/></button>
          </div>
        </div>
      </article>)}
      {!directoryUnits.length&&<div className="empty">Nenhuma unidade encontrada com esses filtros.</div>}
    </div>
    <Notice>{internalDirectoryState==="ready"?"Cadastro administrativo carregado com liderança, coordenação, CNPJ, endereço e mapa. Os telefones são fornecidos pelo servidor protegido e não são gravados no GitHub ou no armazenamento local.":internalDirectoryState==="loading"?"Carregando cadastro interno de líderes e coordenadores…":"O diretório público continua disponível. Não foi possível carregar os dados administrativos protegidos; verifique o acesso autorizado na Vercel."} A gestão de demandas permanece local até a integração do banco compartilhado.</Notice>
   </>}
   {nav==="Churn das unidades"&&<ChurnDashboard units={units} accessRole={accessRole}/>}
   {nav==="Gerenciar unidades"&&<UnitsManager units={units} notify={notify} onSaved={unit=>setUnits(previous=>previous.some(u=>u.id===unit.id)?previous.map(u=>u.id===unit.id?{...u,...unit}:u):[...previous,unit])}/>}
   {nav==="Acervo"&&<LearningArchive
    tasks={tasks} campaigns={campaigns} units={units} onOpenTask={openTask}
    onReplicateTask={original=>{const copy=task({
      title:"Cópia de "+original.title,objective:original.objective||"",category:original.category||"Campanha geral",
      unitId:original.unitId,owner:original.owner,priority:original.priority||"Média",
      targetAudience:original.targetAudience||"",offer:original.offer||"",channels:original.channels||"",
      dependencies:original.dependencies||"",support:original.support||"",
      indicator:original.indicator||"Matrículas",goal:original.goal??null,
      budget:original.budget??null,actual:null,investment:null,
      stage:"Planejamento",campaignId:null,ackVersion:0,
      blocked:false,blockReason:"",demo:false,
      checklist:(original.checklist||[]).map(item=>({...item,id:uid(),done:false})),
      comments:[],history:[],learning:{worked:"",challenges:"",decision:"",pendingReason:""}
    });openTask(copy);}}
    onReplicateCampaign={original=>{setError("");setCampaignDraft({
      id:uid(),title:"Nova ação — "+original.title,description:original.description||"",
      indicator:original.indicator||"Matrículas",goal:original.goal??null,
      version:1,units:[],demo:false,createdAt:new Date().toISOString()
    });setDrawer("campaign");}}
    onGoTasks={()=>setNav("Demandas")}
   />}
   {nav==="Histórico"&&<HistoryDashboard units={units}/>}
   {nav==="Equipe"&&<TeamManagement accessRole={accessRole} units={units}/>}
   {nav==="Configurações"&&<><div className="heading-row"><div><div className="eyebrow">ADMINISTRAÇÃO DO AMBIENTE</div><h1>Configurações</h1><p>Manutenção e preferências da Central Comercial.</p></div><Settings2 size={30} color="#8b949d"/></div><Notice>Demandas, campanhas, aprendizados, calendário, unidades e equipe utilizam o Neon compartilhado. O arquivo antigo do navegador foi preservado apenas para migração ou recuperação, e as edições simultâneas possuem controle de revisão.</Notice>{["developer","admin"].includes(accessRole)&&<EmailSettingsPanel/>}<div className="settings-grid"><section className="panel"><div className="section-title"><div><h3>Backup e mesclagem no Neon</h3><p>Exportação da base compartilhada e importação administrativa sem sobrescrever registros existentes</p></div><Download size={20}/></div><div className="settings-actions"><Button onClick={exportData} kind="secondary"><Download size={16}/> Exportar JSON</Button>{["developer","admin"].includes(accessRole)&&<><label className="btn secondary file-label"><Upload size={16}/> Importar JSON<input type="file" accept=".json,application/json" onChange={e=>{importData(e.target.files?.[0]);e.target.value="";}}/></label><Button kind="secondary" onClick={importLegacyBrowser}><RotateCcw size={16}/> Migrar dados deste navegador</Button></>}</div></section><section className="panel"><div className="section-title"><div><h3>Registros de demonstração</h3><p>Remova apenas dados marcados como fictícios</p></div><Trash2 size={20}/></div><div className="settings-actions"><span>{tasks.filter(t=>t.demo).length} demandas · {campaigns.filter(c=>c.demo).length} campanha(s) · {localUnits()} unidade(s)</span><Button kind="danger" onClick={clearDemo}><Trash2 size={16}/> Remover demos</Button></div></section></div></>}
   </main>
  </div>
  {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
  {drawer==="task"&&editing&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDrawer(null);}}><div className="drawer"><div className="drawer-head"><div><span className="eyebrow">DEMANDA • {editing.demo?"DEMONSTRAÇÃO":"NEON COMPARTILHADO"}</span><h2>{tasks.some(t=>t.id===editing.id)?"Editar demanda":"Nova demanda"}</h2></div><button className="icon-button" onClick={()=>setDrawer(null)}><X size={20}/></button></div><div className="drawer-content">
   {error&&<div className="validation"><CircleAlert size={17}/>{error}</div>}
   {editing.campaignId&&(()=>{const c=campaigns.find(c=>c.id===editing.campaignId);return c?<div className="version"><div><strong>Campanha: {c.title}</strong><small>Orientações centrais · versão {c.version}</small><p>{c.description}</p></div>{editing.ackVersion<c.version?<Button kind="secondary" onClick={()=>confirmRead(editing)}><Check size={15}/> Confirmar leitura</Button>:<Tag tone="success">Leitura confirmada</Tag>}</div>:null;})()}
   <div className="form-grid"><Field label="Título *"><input value={editing.title} onChange={e=>setEditing(d=>({...d,title:e.target.value}))}/></Field><Field label="Objetivo"><textarea rows={2} value={editing.objective} onChange={e=>setEditing(d=>({...d,objective:e.target.value}))}/></Field><div className="form-pair"><Field label="Unidade"><select value={editing.unitId} onChange={e=>setEditing(d=>({...d,unitId:e.target.value}))}>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Categoria"><select value={editing.category} onChange={e=>setEditing(d=>({...d,category:e.target.value,checklist:checklist(e.target.value)}))}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field></div><div className="form-pair"><Field label="Responsável"><input value={editing.owner} onChange={e=>setEditing(d=>({...d,owner:e.target.value}))}/></Field><Field label="Pessoa de apoio"><input value={editing.support||""} onChange={e=>setEditing(d=>({...d,support:e.target.value}))}/></Field></div><div className="form-pair"><Field label="Etapa"><select value={editing.stage} onChange={e=>setEditing(d=>({...d,stage:e.target.value}))}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Prioridade"><select value={editing.priority} onChange={e=>setEditing(d=>({...d,priority:e.target.value}))}>{PRIORITIES.map(s=><option key={s}>{s}</option>)}</select></Field></div><div className="form-pair"><Field label="Prazo"><DateCalendarInput type="date" ariaLabel="Prazo da demanda" value={editing.due||""} onChange={e=>setEditing(d=>({...d,due:e.target.value}))}/></Field><Field label="Colaboradores (observações)"><input value={editing.collaborators||""} onChange={e=>setEditing(d=>({...d,collaborators:e.target.value}))}/></Field></div><TeamAttendeePicker value={editing.participantEmails||[]} onChange={participantEmails=>setEditing(d=>({...d,participantEmails}))} label="Participantes que receberão lembretes do prazo"/><div className="form-pair"><Field label="Público-alvo"><input value={editing.targetAudience||""} onChange={e=>setEditing(d=>({...d,targetAudience:e.target.value}))}/></Field><Field label="Oferta"><input value={editing.offer||""} onChange={e=>setEditing(d=>({...d,offer:e.target.value}))}/></Field></div><div className="form-pair"><Field label="Canais"><input value={editing.channels||""} onChange={e=>setEditing(d=>({...d,channels:e.target.value}))}/></Field><Field label="Dependências"><input value={editing.dependencies||""} onChange={e=>setEditing(d=>({...d,dependencies:e.target.value}))}/></Field></div></div>
   <div className="form-section"><h3><CheckCircle2 size={18}/> Checklist <small>({editing.checklist.filter(c=>c.done).length}/{editing.checklist.length})</small></h3><div className="check-list">{editing.checklist.map(c=><div key={c.id} className="check-row"><input aria-label={"Concluir "+c.title} type="checkbox" checked={c.done} onChange={e=>setEditing(d=>({...d,checklist:d.checklist.map(x=>x.id===c.id?{...x,done:e.target.checked}:x)}))}/><input aria-label="Atividade" className="activity-input" value={c.title} onChange={e=>setEditing(d=>({...d,checklist:d.checklist.map(x=>x.id===c.id?{...x,title:e.target.value}:x)}))}/>{c.required&&<Tag>Obrig.</Tag>}</div>)}</div><button className="add-link" onClick={()=>setEditing(d=>({...d,checklist:[...d.checklist,{id:uid(),title:"Nova atividade",done:false,required:false,owner:"",due:""}]}))}><Plus size={15}/> Adicionar atividade</button></div>
   <div className="form-section"><h3><Target size={18}/> Indicadores e investimento</h3><div className="form-pair"><Field label="Indicador"><select value={editing.indicator} onChange={e=>setEditing(d=>({...d,indicator:e.target.value}))}>{METRICS.map(m=><option key={m}>{m}</option>)}</select></Field><Field label="Meta local"><input type="number" min="0" value={editing.goal??""} onChange={e=>setEditing(d=>({...d,goal:e.target.value===""?null:Number(e.target.value)}))}/></Field></div><div className="form-pair"><Field label="Realizado"><input type="number" min="0" value={editing.actual??""} onChange={e=>setEditing(d=>({...d,actual:e.target.value===""?null:Number(e.target.value)}))}/></Field><Field label="Orçamento previsto (R$)"><input type="number" min="0" value={editing.budget??""} onChange={e=>setEditing(d=>({...d,budget:e.target.value===""?null:Number(e.target.value)}))}/></Field></div><Field label="Investimento realizado (R$)"><input type="number" min="0" value={editing.investment??""} onChange={e=>setEditing(d=>({...d,investment:e.target.value===""?null:Number(e.target.value)}))}/></Field><div className="result-mini"><div><small>Checklist</small><strong>{editing.checklist.length?percent(editing.checklist.filter(c=>c.done).length/editing.checklist.length*100):"Não informado"}</strong></div><div><small>Atingimento</small><strong>{percent(ratio(editing.actual,editing.goal))}</strong></div><div><small>Custo por resultado</small><strong>{cost(editing.investment,editing.actual)===null?"Não informado":currency(cost(editing.investment,editing.actual))}</strong></div></div></div>
   <div className="form-section"><h3><CircleAlert size={18}/> Bloqueios e conclusão</h3><label className="toggle-line"><input type="checkbox" checked={!!editing.blocked} onChange={e=>setEditing(d=>({...d,blocked:e.target.checked}))}/> Demanda bloqueada</label>{editing.blocked&&<Field label="Motivo do bloqueio *"><textarea value={editing.blockReason||""} onChange={e=>setEditing(d=>({...d,blockReason:e.target.value}))}/></Field>}
   {editing.stage==="Concluído"&&<div className="learning-input"><Field label="O que funcionou? *"><textarea value={editing.learning?.worked||""} onChange={e=>setEditing(d=>({...d,learning:{...d.learning,worked:e.target.value}}))}/></Field><Field label="Quais foram as dificuldades? *"><textarea value={editing.learning?.challenges||""} onChange={e=>setEditing(d=>({...d,learning:{...d.learning,challenges:e.target.value}}))}/></Field><Field label="Recomendação *"><select value={editing.learning?.decision||""} onChange={e=>setEditing(d=>({...d,learning:{...d.learning,decision:e.target.value}}))}><option value="">Selecione</option><option>Repetir</option><option>Ajustar</option><option>Encerrar</option></select></Field>{editing.checklist.some(c=>c.required&&!c.done)&&<Field label="Justificativa para atividades obrigatórias pendentes *"><textarea value={editing.learning?.pendingReason||""} onChange={e=>setEditing(d=>({...d,learning:{...d.learning,pendingReason:e.target.value}}))}/></Field>}</div>}</div>
   <div className="form-section"><h3><MessageSquare size={18}/> Comentários e histórico</h3><div className="comment-list">{(editing.comments||[]).map(c=><div key={c.id} className="comment"><strong>Usuário demonstrativo</strong><p>{c.text}</p><small>{dateFmt(c.at?.slice(0,10))}</small></div>)}</div><textarea id="new-comment" rows={2} placeholder="Registre um comentário ou aprendizado..."/><button className="add-link" onClick={()=>{const el=document.getElementById("new-comment");const value=el?.value?.trim();if(value){setEditing(d=>({...d,comments:[...(d.comments||[]),{id:uid(),at:new Date().toISOString(),text:value}]}));el.value="";}}}><Plus size={15}/> Adicionar comentário</button>{(editing.history||[]).slice(-4).reverse().map((h,i)=><div className="history" key={i}>{h.action} · {h.by}</div>)}</div>
  </div><div className="drawer-footer">{tasks.some(t=>t.id===editing.id)&&<Button kind="secondary" onClick={toggleTaskArchived}><Archive size={16}/> {editing.archived?"Restaurar":"Arquivar"}</Button>}<Button kind="secondary" onClick={()=>setDrawer(null)}>Cancelar</Button><Button onClick={saveTask} disabled={!!editing.archived}><Save size={16}/> Salvar demanda</Button></div></div></div>}
  {drawer==="campaign"&&campaignDraft&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDrawer(null);}}><div className="drawer campaign-drawer"><div className="drawer-head"><div><span className="eyebrow">CAMPANHA DA REDE</span><h2>Planejamento central</h2></div><button className="icon-button" onClick={()=>setDrawer(null)}><X size={20}/></button></div><div className="drawer-content"><Notice>Ao salvar, será criada uma entrega para cada unidade selecionada que ainda não tenha uma demanda vinculada. Retirar unidades não apaga históricos.</Notice>{error&&<div className="validation">{error}</div>}<Field label="Nome da campanha *"><input value={campaignDraft.title} onChange={e=>setCampaignDraft(d=>({...d,title:e.target.value}))}/></Field><Field label="Orientações da gestão (versionadas)"><textarea rows={5} value={campaignDraft.description} onChange={e=>setCampaignDraft(d=>({...d,description:e.target.value}))}/></Field><div className="form-pair"><Field label="Indicador consolidado"><select value={campaignDraft.indicator} onChange={e=>setCampaignDraft(d=>({...d,indicator:e.target.value}))}>{METRICS.map(m=><option key={m}>{m}</option>)}</select></Field><Field label="Meta consolidada"><input type="number" min="0" value={campaignDraft.goal??""} onChange={e=>setCampaignDraft(d=>({...d,goal:e.target.value===""?null:Number(e.target.value)}))}/></Field></div><div className="form-section"><h3><Building2 size={18}/> Unidades participantes</h3>
   <CampaignUnitSelector units={units} selectedIds={campaignDraft.units||[]} onChange={unitIds=>setCampaignDraft(d=>({...d,units:unitIds}))}/>
   </div></div><div className="drawer-footer">{campaigns.some(c=>c.id===campaignDraft.id)&&<Button kind="secondary" onClick={toggleCampaignArchived}><Archive size={16}/> {campaignDraft.archived?"Restaurar":"Arquivar"}</Button>}<Button kind="secondary" onClick={()=>setDrawer(null)}>Cancelar</Button><Button onClick={saveCampaign} disabled={!!campaignDraft.archived}><Save size={16}/> Salvar campanha</Button></div></div></div>}
 </div>;
}
function CalendarView({tasks,month,year,setMonth,setYear,onOpen}){
 const start=new Date(year,month,1),days=new Date(year,month+1,0).getDate();
 const offset=(start.getDay()+6)%7;const cells=Array(offset).fill(null).concat(Array.from({length:days},(_,i)=>i+1));
 const move=(n)=>{const x=new Date(year,month+n,1);setYear(x.getFullYear());setMonth(x.getMonth());};
 return <section className="panel calendar"><div className="section-title"><h3>{start.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</h3><div className="calendar-nav"><Button kind="secondary" onClick={()=>move(-1)}>←</Button><Button kind="secondary" onClick={()=>{setYear(new Date().getFullYear());setMonth(new Date().getMonth());}}>Hoje</Button><Button kind="secondary" onClick={()=>move(1)}>→</Button></div></div><div className="calendar-grid">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(s=><div className="weekday" key={s}>{s}</div>)}{cells.map((d,i)=>{const key=d?[year,String(month+1).padStart(2,"0"),String(d).padStart(2,"0")].join("-"):"";return <div className={"calendar-cell "+(key===day()?"today":"")} key={i}>{d&&<><b>{d}</b>{tasks.filter(t=>t.due===key).slice(0,3).map(t=><button key={t.id} onClick={()=>onOpen(t)} title={t.title}>{t.title}</button>)}{tasks.filter(t=>t.due===key).length>3&&<small>+ {tasks.filter(t=>t.due===key).length-3}</small>}</>}</div>})}</div></section>;
}