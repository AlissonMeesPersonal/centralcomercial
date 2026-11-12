"use client";
import {useEffect,useMemo,useState} from "react";
import {
 CalendarDays,Plus,Clock3,ChevronLeft,ChevronRight,MapPin,UsersRound,Building2,
 ClipboardList,Video,CalendarCheck,CheckCircle2,AlertCircle,RefreshCcw,Save,X,
 Bell,Mail,Filter,Archive,BookOpen
} from "lucide-react";
import TeamAttendeePicker from "./TeamAttendeePicker";

const KINDS={reuniao:"Reunião",evento:"Evento",treinamento:"Treinamento",visita:"Visita",outro:"Outro compromisso",prazo_demanda:"Prazo de demanda"};
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
 return {id:null,revision:null,kind:"reuniao",title:"",description:"",unitId:"",
  location:"",startsLocal:today+"T09:00",endsLocal:today+"T10:00",
  attendees:[],status:"agendado"};
}
function toDraft(event){
 return {id:event.id,revision:event.revision,kind:event.kind,title:event.title,
  description:event.description||"",unitId:event.unit_id||"",location:event.location||"",
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
  const events=state.events.filter(e=>kindFilter==="todos"||e.kind===kindFilter).map(e=>({
   id:"e:"+e.id,day:inBrazil(e.starts_at).slice(0,10),title:e.title,time:formatHour(e.starts_at),kind:e.kind,
   source:"event",status:e.status,original:e
  }));
  const duties=kindFilter!=="todos"&&kindFilter!=="prazo_demanda"?[]:
   visibleTasks.filter(t=>!mirrors.has(t.id)).map(t=>({
    id:"t:"+t.id,day:t.due,title:t.title,time:"17:00",kind:"prazo_demanda",
    source:"task",status:"agendado",original:t
   }));
  return [...events,...duties].sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time));
 },[state.events,visibleTasks,kindFilter]);
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
 const navigate=diff=>{const target=new Date(year,month+diff,1);setYear(target.getFullYear());setMonth(target.getMonth());setSelectedDay(null);};
 const toToday=()=>{const d=new Date();setYear(d.getFullYear());setMonth(d.getMonth());setSelectedDay(today);};
 function openDate(date){setSelectedDay(date);setDraft(initialEvent(date));setFormError("");}
 function openEntry(entry){
  if(entry.source==="task"){onOpenTask(entry.original);return;}
  if(entry.original.kind==="prazo_demanda"&&entry.original.external_task_id){
   const local=tasks.find(t=>t.id===entry.original.external_task_id);
   if(local){onOpenTask(local);return;}
  }
  setDraft(toDraft(entry.original));setFormError("");
 }
 function dateToISOString(value){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error("Informe data e horário válidos.");
  const utc=new Date(value+":00-03:00");
  if(!Number.isFinite(utc.getTime())||inBrazil(utc)!==value)throw Error("Data ou horário inválido.");
  return utc.toISOString();
 }
 async function save(){
  if(saving||!draft)return;
  setSaving(true);setFormError("");
  try{
   const request={
    kind:draft.kind,title:draft.title.trim(),description:draft.description||"",unitId:draft.unitId||null,
    location:draft.location||"",startsAt:dateToISOString(draft.startsLocal),
    endsAt:dateToISOString(draft.endsLocal),attendees:draft.attendees||[],status:draft.status
   };
   if(new Date(request.endsAt)<=new Date(request.startsAt))throw Error("O horário final deve ser posterior ao inicial.");
   if(draft.id){request.id=draft.id;request.revision=draft.revision;}
   const response=await fetch("/api/calendar",{
    method:draft.id?"PATCH":"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(request)
   });
   const body=await response.json();
   if(!response.ok)throw Error(body.error||"Não foi possível salvar o evento.");
   setDraft(null);setSelectedDay(null);setTick(n=>n+1);
  }catch(e){setFormError(e.message||"Não foi possível salvar.");}
  finally{setSaving(false);}
 }
 function canEdit(entry){return state.canManageNetwork||entry.owner_email?.toLowerCase()===state.currentEmail.toLowerCase();}
 const filteredNext=selectedDay?allEntries.filter(e=>e.day===selectedDay):upcoming;
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
  {alerts.length>0&&<div className="cc-agenda-alerts"><Bell size={17}/><div><strong>{alerts.length} compromisso(s) com prazo hoje ou amanhã</strong><p>{alerts.slice(0,2).map(x=>x.title).join(" · ")}</p></div></div>}
  <div className="cc-agenda-layout">
   <section className="panel cc-agenda-calendar">
    <div className="cc-agenda-calendar-top">
     <div><h3>{heading}</h3><small>{state.loading?"Atualizando agenda compartilhada…":"Horário de Brasília (America/Sao_Paulo)"}</small></div>
     <div className="cc-agenda-calendar-actions">
      <select aria-label="Filtrar tipo de compromisso" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}>
       <option value="todos">Todos os compromissos</option>{Object.entries(KINDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
      <button onClick={()=>navigate(-1)} aria-label="Mês anterior"><ChevronLeft size={17}/></button>
      <button onClick={toToday}>Hoje</button>
      <button onClick={()=>navigate(1)} aria-label="Próximo mês"><ChevronRight size={17}/></button>
     </div>
    </div>
    <div className="cc-agenda-weekdays">{["SEG","TER","QUA","QUI","SEX","SÁB","DOM"].map(d=><span key={d}>{d}</span>)}</div>
    <div className="cc-agenda-grid">
      {cells.map((d,i)=>{
       const date=d?dayKey(year,month+1,d):"";
       const entries=byDay.get(date)||[];
       return <div key={i} className={"cc-agenda-day"+(!d?" empty":"")+(date===today?" today":"")+(date===selectedDay?" selected":"")}>
        {d&&<><button className="cc-agenda-day-number" type="button" onClick={()=>openDate(date)} title="Agendar compromisso neste dia">{d}</button>
         <div className="cc-agenda-day-items">{entries.slice(0,3).map(e=><button key={e.id} className={"cc-agenda-chip "+e.kind+" "+e.status} title={e.title} onClick={()=>openEntry(e)}><span>{e.time}</span>{e.title}</button>)}
          {entries.length>3&&<button className="cc-agenda-more" onClick={()=>setSelectedDay(date)}>+ {entries.length-3} compromisso(s)</button>}
         </div></>}
       </div>;
      })}
    </div>
    <p className="cc-agenda-hint">Clique no número do dia para agendar. Selecione um compromisso para ver ou editar seus detalhes.</p>
   </section>
   <aside className="panel cc-agenda-upcoming">
    <div className="cc-agenda-upcoming-heading"><h3>{selectedDay?"Agenda de "+futureLabel(selectedDay):"Próximos compromissos"}</h3>{selectedDay&&<button onClick={()=>setSelectedDay(null)}>Mostrar próximos</button>}</div>
    {!filteredNext.length?<div className="cc-agenda-empty"><CalendarDays size={25}/><strong>Agenda livre</strong><p>{selectedDay?"Nenhum compromisso para este dia.":"Não há atividades nos próximos sete dias."}</p></div>:
      <div className="cc-agenda-upcoming-list">{filteredNext.map(e=><button key={e.id} className="cc-agenda-upcoming-item" onClick={()=>openEntry(e)}>
       <span className={"cc-agenda-upcoming-icon "+e.kind}>{e.kind==="prazo_demanda"?<ClipboardList size={16}/>:<CalendarDays size={16}/>}</span>
       <span className="cc-agenda-upcoming-body"><small>{futureLabel(e.day)} · {e.time}</small><strong>{e.title}</strong><span>{KINDS[e.kind]||"Compromisso"}</span></span>
      </button>)}</div>}
    <div className="cc-agenda-legend"><span><i className="cc-agenda-legend-dot event"/> Reuniões e eventos</span><span><i className="cc-agenda-legend-dot task"/> Prazos de demandas</span></div>
   </aside>
  </div>
  {draft&&<div className="cc-agenda-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setDraft(null);}}>
   <div className="cc-agenda-modal" role="dialog" aria-modal="true" aria-label={draft.id?"Editar compromisso":"Novo compromisso"}>
    <div className="cc-agenda-modal-head"><div><div className="eyebrow">CENTRAL COMERCIAL • AGENDA</div><h2>{draft.id?"Detalhes do compromisso":"Novo compromisso"}</h2></div><button onClick={()=>!saving&&setDraft(null)} aria-label="Fechar"><X size={20}/></button></div>
    <div className="cc-agenda-modal-content">
     {draft.kind==="prazo_demanda"&&<div className="cc-agenda-reminder-info">Este prazo pertence a uma demanda. Abra a demanda no navegador em que ela foi criada para alterar os dados.</div>}
     {formError&&<div role="alert" className="validation"><AlertCircle size={17}/>{formError}</div>}
     <div className="cc-agenda-form-grid">
      <label className="cc-agenda-field"><span>Título *</span><input required maxLength={160} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="Ex.: Reunião de resultados da rede"/></label>
      <div className="cc-agenda-form-pair">
       <label className="cc-agenda-field"><span>Tipo de compromisso</span><select value={draft.kind} onChange={e=>setDraft(d=>({...d,kind:e.target.value}))} disabled={draft.kind==="prazo_demanda"}>{Object.entries(KINDS).filter(([kind])=>kind!=="prazo_demanda"||draft.kind==="prazo_demanda").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
       <label className="cc-agenda-field"><span>Unidade</span><select value={draft.unitId} onChange={e=>setDraft(d=>({...d,unitId:e.target.value}))}><option value="">Toda a rede (gestão)</option>{units.filter(u=>!u.demo&&u.type!=="Matriz").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      </div>
      <div className="cc-agenda-form-pair">
       <label className="cc-agenda-field"><span>Início *</span><input type="datetime-local" value={draft.startsLocal} onChange={e=>setDraft(d=>({...d,startsLocal:e.target.value}))}/></label>
       <label className="cc-agenda-field"><span>Término *</span><input type="datetime-local" value={draft.endsLocal} onChange={e=>setDraft(d=>({...d,endsLocal:e.target.value}))}/></label>
      </div>
      <label className="cc-agenda-field"><span>Local ou link da reunião</span><input value={draft.location} onChange={e=>setDraft(d=>({...d,location:e.target.value}))} placeholder="Sala de reunião, Google Meet, endereço…"/></label>
      <label className="cc-agenda-field"><span>Pauta e observações</span><textarea value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} rows={3} placeholder="Objetivos e assuntos do compromisso"/></label>
      {draft.id&&<label className="cc-agenda-field"><span>Situação</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}>{Object.entries(STATUSES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>}
      <TeamAttendeePicker value={draft.attendees} onChange={attendees=>setDraft(d=>({...d,attendees}))} members={state.members} label="Participantes convidados"/>
      <div className="cc-agenda-reminder-info"><Bell size={17}/><span>Os avisos visuais aparecem na Central. Assim que o serviço de e-mail estiver configurado, os participantes receberão lembretes no dia anterior e no próprio dia (na rotina diária).</span></div>
     </div>
    </div>
    <div className="cc-agenda-modal-footer"><button className="btn secondary" onClick={()=>setDraft(null)} disabled={saving}>Cancelar</button><button className="btn" onClick={save} disabled={saving||draft.kind==="prazo_demanda"||(draft.id&&!canEdit(state.events.find(e=>e.id===draft.id)||{}))}><Save size={16}/>{saving?"Salvando…":"Salvar compromisso"}</button></div>
   </div>
  </div>}
 </section>;
}
