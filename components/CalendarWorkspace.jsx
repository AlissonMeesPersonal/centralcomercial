"use client";
import {useEffect,useMemo,useState} from "react";
import {
 CalendarDays,Plus,Clock3,ChevronLeft,ChevronRight,MapPin,UsersRound,Building2,
 ClipboardList,Video,CalendarCheck,CheckCircle2,AlertCircle,RefreshCcw,Save,X,
 Bell,Mail,Filter,Archive,BookOpen
} from "lucide-react";
import TeamAttendeePicker from "./TeamAttendeePicker";
import MicrosoftCalendarPanel from "./MicrosoftCalendarPanel";
import DateCalendarInput from "./DateCalendarInput";

const KINDS={reuniao:"Reunião",evento:"Evento",treinamento:"Treinamento",visita:"Visita",outro:"Outro compromisso",prazo_demanda:"Prazo de demanda",microsoft:"Microsoft Teams"};
const STATUSES={agendado:"Agendado",concluido:"Concluído",cancelado:"Arquivado"};
const TZ="America/Sao_Paulo";
const pad=x=>String(x).padStart(2,"0");
const dayKey=(y,m,d)=>[y,pad(m),pad(d)].join("-");
function inBrazil(value){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));
 const get=type=>parts.find(p=>p.type===type)?.value||"";
 return get("year")+"-"+get("month")+"-"+get("day")+"T"+get("hour")+":"+get("minute");
}
function formatHour(value){return inBrazil(value).slice(11);}
function initialEvent(date){
 const today=date||inBrazil(new Date()).slice(0,10);
 return {id:null,revision:null,kind:"reuniao",title:"",description:"",unitId:"",unitIds:[],
  location:"",startsLocal:today+"T09:00",endsLocal:today+"T10:00",
  attendees:[],status:"agendado"};
}
function toDraft(event){
 return {id:event.id,revision:event.revision,kind:event.kind,title:event.title,
  description:event.description||"",unitId:event.unit_id||"",unitIds:Array.isArray(event.unit_ids)?event.unit_ids:(event.unit_id?[event.unit_id]:[]),location:event.location||"",
  startsLocal:inBrazil(event.starts_at),endsLocal:inBrazil(event.ends_at),
  attendees:event.attendees||[],status:event.status};
}
function futureLabel(day){
 const today=inBrazil(new Date()).slice(0,10);
 if(day===today)return "Hoje";
 const tomorrow=inBrazil(new Date(Date.now()+86400000)).slice(0,10);
 if(day===tomorrow)return "Amanhã";
 return day.split("-").reverse().join("/");
}
export default function CalendarWorkspace({tasks=[],units=[],year,month,setYear,setMonth,onOpenTask,onNewTask,accessRole}){
 const [state,setState]=useState({events:[],members:[],currentEmail:"",canManageNetwork:false,emailReady:false,loading:true,error:""});
 const [draft,setDraft]=useState(null),[saving,setSaving]=useState(false),[formError,setFormError]=useState("");
 const [tick,setTick]=useState(0),[kindFilter,setKindFilter]=useState("todos");
 const [selectedDay,setSelectedDay]=useState(null);
 const [microsoftDetail,setMicrosoftDetail]=useState(null);
 const [dayList,setDayList]=useState(null);
 const [showAllMonth,setShowAllMonth]=useState(true);
 const [showArchivedEvents,setShowArchivedEvents]=useState(false);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==="visible"&&!draft)setTick(n=>n+1);};
  const timer=setInterval(refresh,10000);
  window.addEventListener("focus",refresh);
  window.addEventListener("26fit:calendar-updated",refresh);
  const visibility=()=>{if(document.visibilityState==="visible")refresh();};
  document.addEventListener("visibilitychange",visibility);
  return ()=>{
   clearInterval(timer);
   window.removeEventListener("focus",refresh);
   window.removeEventListener("26fit:calendar-updated",refresh);
   document.removeEventListener("visibilitychange",visibility);
  };
 },[draft]);
 useEffect(()=>{
  const controller=new AbortController();
  setState(s=>({...s,loading:true,error:""}));
  fetch("/api/calendar?year="+year+"&month="+(month+1),{credentials:"same-origin",cache:"no-store",signal:controller.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||"Não foi possível carregar a agenda.");return d;})
   .then(d=>setState({events:d.events||[],members:d.members||[],currentEmail:d.currentEmail||"",
    canManageNetwork:!!d.canManageNetwork,emailReady:!!d.emailReady,loading:false,error:""}))
   .catch(e=>{if(e.name!=="AbortError")setState(s=>({...s,loading:false,error:e.message}));});
  return ()=>controller.abort();
 },[year,month,tick]);
 const unitMap=useMemo(()=>new Map(units.map(u=>[u.id,u])),[units]);
 const mirrors=new Set(state.events.filter(e=>e.external_task_id).map(e=>e.external_task_id));
 const visibleTasks=useMemo(()=>tasks.filter(t=>t.due&&t.stage!=="Concluído"&&!t.archived),[tasks]);
 const allEntries=useMemo(()=>{
  const events=state.events.filter(e=>(showArchivedEvents||e.status!=="cancelado")&&(kindFilter==="todos"||e.kind===kindFilter)).map(e=>({
   id:"e:"+e.id,day:inBrazil(e.starts_at).slice(0,10),title:e.title,time:formatHour(e.starts_at),kind:e.kind,
   source:"event",status:e.status,original:e
  }));
  const duties=kindFilter!=="todos"&&kindFilter!=="prazo_demanda"?[]:
   visibleTasks.filter(t=>!mirrors.has(t.id)).map(t=>({
    id:"t:"+t.id,day:t.due,title:t.title,time:"17:00",kind:"prazo_demanda",
    source:"task",status:"agendado",original:t
   }));
  return [...events,...duties].sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time));
 },[state.events,visibleTasks,kindFilter,showArchivedEvents]);
 const byDay=useMemo(()=>{
  const groups=new Map();
  for(const event of allEntries){const value=groups.get(event.day)||[];value.push(event);groups.set(event.day,value);}
  return groups;
 },[allEntries]);
 const monthStart=new Date(year,month,1);
 const firstOffset=(monthStart.getDay()+6)%7;
 const daysInMonth=new Date(year,month+1,0).getDate();
 const cells=Array(firstOffset).fill(null).concat(Array.from({length:daysInMonth},(_,i)=>i+1));
 while(cells.length%7)cells.push(null);
 const today=inBrazil(new Date()).slice(0,10);
 const upcoming=allEntries.filter(e=>e.day>=today&&e.day<=inBrazil(new Date(Date.now()+7*86400000)).slice(0,10)&&e.status==="agendado").slice(0,12);
 const alerts=upcoming.filter(e=>e.day<=inBrazil(new Date(Date.now()+86400000)).slice(0,10));
 const navigate=diff=>{const target=new Date(year,month+diff,1);setYear(target.getFullYear());setMonth(target.getMonth());setSelectedDay(null);setDayList(null);};
 const toToday=()=>{const d=new Date();setYear(d.getFullYear());setMonth(d.getMonth());setSelectedDay(today);};
 function openDate(date){setSelectedDay(date);setDayList(date);setFormError("");}
 function newEventOn(date){setDayList(null);setDraft(initialEvent(date));setFormError("");}
 function openEntry(entry){
  if(entry.source==="task"){onOpenTask(entry.original);return;}
  if(entry.original.kind==="prazo_demanda"&&entry.original.external_task_id){
   const local=tasks.find(t=>t.id===entry.original.external_task_id);
   if(local){onOpenTask(local);return;}
  }
  if(entry.original.microsoft_imported){
   setMicrosoftDetail(entry.original);setFormError("");return;
  }
  setDraft(toDraft(entry.original));setFormError("");
 }
 // Abre o compromisso exato quando a pessoa clica em um aviso
 // central ou em uma notificação Web Push de outra aba.
 useEffect(()=>{
  const openReminder=()=>{
   if(state.loading)return;
   const params=new URLSearchParams(window.location.search);
   const id=params.get("reminder");
   if(!id)return;
   const event=state.events.find(item=>item.reminder_key===id);
   if(!event)return;
   openEntry({source:"event",original:event});
   const url=new URL(window.location.href);
   url.searchParams.delete("reminder");
   url.searchParams.delete("section");
   window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  };
  window.addEventListener("26fit:reminder-open",openReminder);
  openReminder();
  return ()=>window.removeEventListener("26fit:reminder-open",openReminder);
 },[state.events,state.loading,tasks,onOpenTask]);

 function dateToISOString(value){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error("Informe data e horário válidos.");
  const utc=new Date(value+":00-03:00");
  if(!Number.isFinite(utc.getTime())||inBrazil(utc)!==value)throw Error("Data ou horário inválido.");
  return utc.toISOString();
 }
 async function save(statusOverride=null){
  if(saving||!draft)return;
  if(statusOverride==="cancelado"&&!window.confirm("Arquivar este compromisso? Ele sairá da agenda ativa e poderá ser restaurado depois."))return;
  setSaving(true);setFormError("");
  try{
   const request={
    kind:draft.kind,title:draft.title.trim(),description:draft.description||"",unitId:draft.unitIds?.length===1?draft.unitIds[0]:null,unitIds:draft.unitIds||[],
    location:draft.location||"",startsAt:dateToISOString(draft.startsLocal),
    endsAt:dateToISOString(draft.endsLocal),attendees:draft.attendees||[],status:statusOverride||draft.status
   };
   if(new Date(request.endsAt)<=new Date(request.startsAt))throw Error("O horário final deve ser posterior ao inicial.");
   if(draft.id){request.id=draft.id;request.revision=draft.revision;}
   const response=await fetch("/api/calendar",{
    method:draft.id?"PATCH":"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(request)
   });
   const body=await response.json();
   if(!response.ok)throw Error(body.error||"Não foi possível salvar o evento.");
   setDraft(null);setSelectedDay(null);setTick(n=>n+1);window.dispatchEvent(new Event("26fit:calendar-updated"));
  }catch(e){setFormError(e.message||"Não foi possível salvar.");}
  finally{setSaving(false);}
 }
 async function deleteAppointment(){
  if(saving||!draft?.id||draft.kind==="prazo_demanda")return;
  if(!window.confirm("Excluir este agendamento da agenda? Os detalhes ficarão registrados no histórico de auditoria do Neon."))return;
  setSaving(true);setFormError("");
  try{
   const response=await fetch("/api/calendar",{
    method:"DELETE",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:draft.id,revision:draft.revision})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Não foi possível excluir.");
   setDraft(null);setSelectedDay(null);setTick(n=>n+1);
   window.dispatchEvent(new Event("26fit:calendar-updated"));
  }catch(e){setFormError(e.message||"Falha ao excluir agendamento.");}
  finally{setSaving(false);}
 }
 function canEdit(entry){return state.canManageNetwork||entry.owner_email?.toLowerCase()===state.currentEmail.toLowerCase();}
 const filteredNext=selectedDay?allEntries.filter(e=>e.day===selectedDay):showAllMonth?allEntries.filter(e=>e.source==="event"):upcoming;
 const heading=monthStart.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
 return <section className="cc-agenda">
  <div className="heading-row cc-agenda-heading">
   <div><div className="eyebrow">AGENDA E COMPROMISSOS DA REDE</div><h1>Calendário</h1>
    <p>Reuniões, eventos, visitas, treinamentos e prazos de demandas em um só lugar.</p></div>
   <div className="cc-agenda-heading-actions">
    <button className="btn secondary" onClick={onNewTask}><ClipboardList size={16}/> Nova demanda</button>
    <button className="btn" onClick={()=>{setDraft(initialEvent());setFormError("");}}><Plus size={16}/> Novo evento</button>
   </div>
  </div>
  {!state.emailReady&&<div className="cc-agenda-mail-note"><Mail size={17}/><span>Os compromissos já são compartilhados com os participantes na Central. <strong>E-mails automáticos aguardam a configuração do remetente oficial</strong> na Vercel. Os lembretes visuais funcionam normalmente.</span></div>}
  {state.error&&<div className="validation" role="alert">{state.error}<button className="btn secondary" onClick={()=>setTick(n=>n+1)}>Tentar novamente</button></div>}
  <div className="cc-agenda-stat-row">
   <div><span><CalendarCheck size={18}/> Compromissos do mês</span><strong>{state.events.filter(e=>e.status!=="cancelado").length}</strong></div>
   <div><span><UsersRound size={18}/> Convidados</span><strong>{new Set(state.events.flatMap(e=>e.attendees||[])).size}</strong></div>
   <div><span><Bell size={18}/> Próximos 7 dias</span><strong>{upcoming.length}</strong></div>
  </div>
  <MicrosoftCalendarPanel canManageNetwork={state.canManageNetwork} onUpdated={()=>setTick(n=>n+1)}/>
  {alerts.length>0&&<div className="cc-agenda-alerts"><Bell size={17}/><div><strong>{alerts.length} compromisso(s) com prazo hoje ou amanhã</strong><p>{alerts.slice(0,2).map(x=>x.title).join(" · ")}</p></div></div>}
  <div className="cc-agenda-layout">
   <section className="panel cc-agenda-calendar">
    <div className="cc-agenda-calendar-top">
     <div><h3>{heading}</h3><small>{state.loading?"Atualizando agenda compartilhada…":"Horário de Brasília (America/Sao_Paulo)"}</small></div>
     <div className="cc-agenda-calendar-actions">
      <label className="cc-agenda-archive-toggle"><input type="checkbox" checked={showArchivedEvents} onChange={e=>setShowArchivedEvents(e.target.checked)}/> Mostrar arquivados ({state.events.filter(e=>e.status==="cancelado").length})</label>
      <select aria-label="Filtrar tipo de compromisso" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}>
       <option value="todos">Todos os compromissos</option>{Object.entries(KINDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
      <button onClick={()=>navigate(-1)} aria-label="Mês anterior"><ChevronLeft size={17}/></button>
      <button onClick={toToday}>Hoje</button>
      <button onClick={()=>navigate(1)} aria-label="Próximo mês"><ChevronRight size={17}/></button>
     </div>
    </div>
    <div className="cc-agenda-month-scroll" role="region" aria-label="Calendário do mês, deslize horizontalmente em telas menores" tabIndex={0}>
     <div className="cc-agenda-weekdays">{["SEG","TER","QUA","QUI","SEX","SÁB","DOM"].map(d=><span key={d}>{d}</span>)}</div>
     <div className="cc-agenda-grid">
      {cells.map((d,i)=>{
       const date=d?dayKey(year,month+1,d):"";
       const entries=byDay.get(date)||[];
       return <div key={i} className={"cc-agenda-day"+(!d?" empty":"")+(date===today?" today":"")+(date===selectedDay?" selected":"")}>
        {d&&<>
         <div className="cc-agenda-day-header">
          <button className="cc-agenda-day-number" type="button" onClick={()=>openDate(date)} aria-label={"Abrir agenda de "+date.split("-").reverse().join("/")}>{d}</button>
          {entries.length>0&&<button type="button" className="cc-agenda-day-count" onClick={()=>openDate(date)} aria-label={"Ver "+entries.length+" compromissos deste dia"}>{entries.length} {entries.length===1?"evento":"eventos"}</button>}
         </div>
         <div className="cc-agenda-day-items">
          {entries.slice(0,2).map(e=><button key={e.id} type="button" className={"cc-agenda-event-preview "+e.kind+" "+e.status} onClick={()=>openEntry(e)} title={e.time+" · "+e.title}>
           <span className="cc-agenda-event-time">{e.time}</span>
           <span className="cc-agenda-event-title">{e.title}</span>
          </button>)}
          {entries.length>2&&<button type="button" className="cc-agenda-more" onClick={()=>openDate(date)} aria-label={"Abrir lista com todos os "+entries.length+" compromissos do dia"}><span>+ {entries.length-2} {entries.length===3?"outro":"outros"}</span><ChevronRight size={12}/></button>}
         </div></>}
       </div>;
      })}
     </div>
    </div>
    <p className="cc-agenda-hint">Confira horários e títulos nos cartões. Clique no número do dia, na contagem ou em “+ outros” para ver todos os compromissos e agendar.</p>
   </section>
   <aside className="panel cc-agenda-upcoming">
    <div className="cc-agenda-upcoming-heading"><h3>{selectedDay?"Agenda de "+futureLabel(selectedDay):showAllMonth?"Todos os compromissos do mês":"Próximos compromissos"}</h3>
    <div className="cc-agenda-list-controls">
     <button type="button" onClick={()=>setTick(n=>n+1)} title="Buscar compromissos no Neon"><RefreshCcw size={15}/> Atualizar</button>
     {selectedDay?<button type="button" onClick={()=>setSelectedDay(null)}>Ver todos</button>:<button type="button" onClick={()=>setShowAllMonth(x=>!x)}>{showAllMonth?"Próximos 7 dias":"Mês inteiro"}</button>}
    </div>
   </div>
    {!filteredNext.length?<div className="cc-agenda-empty"><CalendarDays size={25}/><strong>Agenda livre</strong><p>{selectedDay?"Nenhum compromisso para este dia.":"Não há atividades nos próximos sete dias."}</p></div>:
      <div className="cc-agenda-upcoming-list">{filteredNext.map(e=><button key={e.id} className="cc-agenda-upcoming-item" onClick={()=>openEntry(e)}>
       <span className={"cc-agenda-upcoming-icon "+e.kind}>{e.kind==="prazo_demanda"?<ClipboardList size={16}/>:<CalendarDays size={16}/>}</span>
       <span className="cc-agenda-upcoming-body"><small>{futureLabel(e.day)} · {e.time}</small><strong>{e.title}</strong><span>{KINDS[e.kind]||"Compromisso"}{e.source==="event"&&e.original.owner_email?" · "+e.original.owner_email:""}</span>
       {e.source==="event"&&<span>{(e.original.unit_ids||[]).length===0?"Toda a rede":(e.original.unit_ids||[]).map(id=>unitMap.get(id)?.name||"Unidade").join(", ")}</span>}</span>
      </button>)}</div>}
    <div className="cc-agenda-legend"><span><i className="cc-agenda-legend-dot event"/> Reuniões e eventos</span><span><i className="cc-agenda-legend-dot task"/> Prazos de demandas</span></div>
   </aside>
  </div>
  {dayList&&<div className="cc-agenda-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDayList(null);}}>
   <div className="cc-agenda-modal cc-agenda-day-list-modal" role="dialog" aria-modal="true" aria-label={"Compromissos de "+futureLabel(dayList)}>
    <div className="cc-agenda-modal-head"><div><div className="eyebrow">AGENDA COMPARTILHADA DA REDE</div><h2>Compromissos de {dayList.split("-").reverse().join("/")}</h2></div><button type="button" onClick={()=>setDayList(null)} aria-label="Fechar"><X size={20}/></button></div>
    <div className="cc-agenda-modal-content">
      <p className="cc-agenda-day-list-count">{(byDay.get(dayList)||[]).length} compromisso(s) neste dia, de todos os usuários autorizados.</p>
      <div className="cc-agenda-day-list-entries">{(byDay.get(dayList)||[]).map(entry=><button key={entry.id} type="button" onClick={()=>{setDayList(null);openEntry(entry);}}>
       <span className="cc-agenda-day-list-hour">{entry.time}</span><span><strong>{entry.title}</strong><small>{KINDS[entry.kind]||"Compromisso"}{entry.original?.owner_email?" · "+entry.original.owner_email:""}</small></span><ChevronRight size={16}/>
      </button>)}</div>
      {!(byDay.get(dayList)||[]).length&&<p>Não há compromissos cadastrados neste dia.</p>}
    </div>
    <div className="cc-agenda-modal-footer"><button className="btn secondary" onClick={()=>setDayList(null)}>Fechar</button><button className="btn" onClick={()=>newEventOn(dayList)}><Plus size={15}/> Novo compromisso neste dia</button></div>
   </div>
  </div>}
  {microsoftDetail&&<div className="cc-agenda-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setMicrosoftDetail(null);}}>
   <div className="cc-agenda-modal cc-ms-event-modal" role="dialog" aria-modal="true" aria-label="Compromisso Teams">
    <div className="cc-agenda-modal-head"><div><div className="eyebrow">CALENDÁRIO MICROSOFT · SOMENTE LEITURA</div><h2>{microsoftDetail.title}</h2></div><button onClick={()=>setMicrosoftDetail(null)} aria-label="Fechar"><X size={20}/></button></div>
    <div className="cc-agenda-modal-content cc-ms-event-details">
     <div className="cc-ms-event-fields">
      <div className="cc-ms-event-field"><span>Conta Microsoft conectada</span><strong>{microsoftDetail.owner_email}</strong></div>
      <div className="cc-ms-event-field"><span>Início</span><strong>{new Date(microsoftDetail.starts_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})}</strong></div>
      <div className="cc-ms-event-field"><span>Término</span><strong>{new Date(microsoftDetail.ends_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})}</strong></div>
      {!microsoftDetail.is_private&&<div className="cc-ms-event-field"><span>Local</span><strong>{microsoftDetail.location||"Não informado"}</strong></div>}
     </div>
     {!microsoftDetail.is_private&&<>
      <div className="cc-ms-event-section">
       <h3><ClipboardList size={16}/> Pauta e descrição da reunião</h3>
       {microsoftDetail.description?.trim()
        ?<div className="cc-ms-event-description">{microsoftDetail.description}</div>
        :<p className="cc-ms-event-empty">Nenhuma pauta informada. Clique em “Sincronizar agora” para atualizar os detalhes da reunião.</p>}
      </div>
      {Array.isArray(microsoftDetail.participants)&&microsoftDetail.participants.length>0&&<div className="cc-ms-event-section">
       <h3><UsersRound size={16}/> Participantes convidados ({microsoftDetail.participants.length})</h3>
       <div className="cc-ms-event-participants">{microsoftDetail.participants.map((p,index)=><div className="cc-ms-event-participant" key={(p.email||"")+index}>
        <strong>{p.name||p.email}</strong>{p.name&&p.email&&<span>{p.email}</span>}
       </div>)}</div>
      </div>}
      {/^https:\/\//i.test(microsoftDetail.join_url||"")&&<a className="cc-ms-event-join" href={microsoftDetail.join_url} target="_blank" rel="noopener noreferrer"><Video size={17}/> Participar pelo Microsoft Teams</a>}
     </>}
     {microsoftDetail.is_private&&<p className="cc-ms-event-empty">Este compromisso está marcado como privado no Microsoft. A descrição, os convidados e o link não são compartilhados.</p>}
     <p className="cc-op-note cc-ms-event-note">Compromisso importado do Microsoft Teams, somente leitura. Faça alterações na agenda original; elas serão sincronizadas com a Central.</p>
    </div>
    <div className="cc-agenda-modal-footer"><button className="btn secondary" onClick={()=>setMicrosoftDetail(null)}>Fechar</button></div>
   </div>
  </div>}
  {draft&&<div className="cc-agenda-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setDraft(null);}}>
   <div className="cc-agenda-modal" role="dialog" aria-modal="true" aria-label={draft.id?"Editar compromisso":"Novo compromisso"}>
    <div className="cc-agenda-modal-head"><div><div className="eyebrow">CENTRAL COMERCIAL • AGENDA</div><h2>{draft.id?"Detalhes do compromisso":"Novo compromisso"}</h2></div><button onClick={()=>!saving&&setDraft(null)} aria-label="Fechar"><X size={20}/></button></div>
    <div className="cc-agenda-modal-content">
     {draft.kind==="prazo_demanda"&&<div className="cc-agenda-reminder-info">Este prazo pertence a uma demanda. Para arquivar ou excluir o prazo, abra a demanda correspondente na Central.</div>}
     {formError&&<div role="alert" className="validation"><AlertCircle size={17}/>{formError}</div>}
     <div className="cc-agenda-form-grid">
      <label className="cc-agenda-field"><span>Título *</span><input required maxLength={160} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="Ex.: Reunião de resultados da rede"/></label>
      <div className="cc-agenda-form-pair">
       <label className="cc-agenda-field"><span>Tipo de compromisso</span><select value={draft.kind} onChange={e=>setDraft(d=>({...d,kind:e.target.value}))} disabled={draft.kind==="prazo_demanda"}>{Object.entries(KINDS).filter(([kind])=>kind!=="prazo_demanda"||draft.kind==="prazo_demanda").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
       <div className="cc-agenda-field cc-agenda-units-field"><span>Unidades</span>
        <details className="cc-agenda-unit-select">
         <summary>{!draft.unitIds?.length?"Toda a rede (gestão)":draft.unitIds.length===1?(units.find(u=>u.id===draft.unitIds[0])?.name||"1 unidade selecionada"):draft.unitIds.length+" unidades selecionadas"}</summary>
         <div className="cc-agenda-unit-options">
          <label className="cc-agenda-unit-option cc-agenda-unit-all"><input type="checkbox" checked={!draft.unitIds?.length} onChange={()=>setDraft(d=>({...d,unitIds:[],unitId:""}))}/> Toda a rede (gestão)</label>
          <div className="cc-agenda-unit-tools"><button type="button" onClick={()=>setDraft(d=>({...d,unitIds:units.filter(u=>!u.demo&&u.type!=="Matriz").map(u=>u.id),unitId:""}))}>Selecionar todas individualmente</button><button type="button" onClick={()=>setDraft(d=>({...d,unitIds:[],unitId:""}))}>Limpar seleção</button></div>
          <div className="cc-agenda-unit-scroll">{units.filter(u=>!u.demo&&u.type!=="Matriz").map(u=><label key={u.id} className="cc-agenda-unit-option"><input type="checkbox" checked={draft.unitIds?.includes(u.id)||false} onChange={e=>setDraft(d=>({...d,unitIds:e.target.checked?[...(d.unitIds||[]),u.id]:(d.unitIds||[]).filter(id=>id!==u.id),unitId:""}))}/>{u.name}</label>)}</div>
         </div>
        </details>
        <small>{!draft.unitIds?.length?"Aplicável a toda a rede.":draft.unitIds.length+" unidade(s) vinculada(s) ao compromisso."}</small>
       </div>
      </div>
      <div className="cc-agenda-form-pair">
       <label className="cc-agenda-field"><span>Início *</span><DateCalendarInput type="datetime-local" ariaLabel="Início do compromisso" value={draft.startsLocal} required onChange={e=>setDraft(d=>({...d,startsLocal:e.target.value}))}/></label>
       <label className="cc-agenda-field"><span>Término *</span><DateCalendarInput type="datetime-local" ariaLabel="Término do compromisso" value={draft.endsLocal} required onChange={e=>setDraft(d=>({...d,endsLocal:e.target.value}))}/></label>
      </div>
      <label className="cc-agenda-field"><span>Local ou link da reunião</span><input value={draft.location} onChange={e=>setDraft(d=>({...d,location:e.target.value}))} placeholder="Sala de reunião, Google Meet, endereço…"/></label>
      <label className="cc-agenda-field"><span>Pauta e observações</span><textarea value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} rows={3} placeholder="Objetivos e assuntos do compromisso"/></label>
      {draft.id&&<label className="cc-agenda-field"><span>Situação</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}>{Object.entries(STATUSES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>}
      <TeamAttendeePicker value={draft.attendees} onChange={attendees=>setDraft(d=>({...d,attendees}))} members={state.members} label="Participantes convidados"/>
      <div className="cc-agenda-reminder-info"><Bell size={17}/><span>Os avisos visuais aparecem na Central. Assim que o serviço de e-mail estiver configurado, os participantes receberão lembretes no dia anterior e no próprio dia (na rotina diária).</span></div>
     </div>
    </div>
    <div className="cc-agenda-modal-footer cc-agenda-action-footer">
     {draft.id&&draft.kind!=="prazo_demanda"&&canEdit(state.events.find(e=>e.id===draft.id)||{})&&<>
      <button type="button" className="btn danger" disabled={saving} onClick={deleteAppointment}><X size={16}/> Excluir agendamento</button>
      <button type="button" className="btn secondary" disabled={saving} onClick={()=>save(draft.status==="cancelado"?"agendado":"cancelado")}><Archive size={16}/>{draft.status==="cancelado"?"Restaurar":"Arquivar"}</button>
     </>}
     <button type="button" className="btn secondary" onClick={()=>setDraft(null)} disabled={saving}>Cancelar</button>
     <button type="button" className="btn" onClick={()=>save()} disabled={saving||draft.kind==="prazo_demanda"||(draft.id&&!canEdit(state.events.find(e=>e.id===draft.id)||{}))}><Save size={16}/>{saving?"Salvando…":"Salvar compromisso"}</button>
    </div>
   </div>
  </div>}
 </section>;
}
