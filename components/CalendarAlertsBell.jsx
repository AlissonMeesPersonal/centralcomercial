"use client";
import {useEffect,useMemo,useState} from "react";
import {Bell,CalendarDays,Clock3,ClipboardList,ChevronRight,CheckCircle2} from "lucide-react";
const today=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});
const hour=e=>new Date(e).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"});
const date=e=>new Date(e).toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});
export default function CalendarAlertsBell({tasks=[],pending=0,onCalendar,onApprovals}){
 const [open,setOpen]=useState(false),[events,setEvents]=useState([]),[refreshTick,setRefreshTick]=useState(0);
 useEffect(()=>{const update=()=>setRefreshTick(x=>x+1);window.addEventListener("26fit:calendar-updated",update);return ()=>window.removeEventListener("26fit:calendar-updated",update);},[]);
 useEffect(()=>{
  const controller=new AbortController();
  const base=new Date(),months=[base,new Date(base.getFullYear(),base.getMonth()+1,1)];
  Promise.all(months.map(d=>fetch("/api/calendar?year="+d.getFullYear()+"&month="+(d.getMonth()+1),
   {credentials:"same-origin",cache:"no-store",signal:controller.signal}).then(r=>r.ok?r.json():null)))
   .then(all=>{if(!controller.signal.aborted)setEvents(all.flatMap(x=>x?.events||[]));})
   .catch(()=>{});
  return ()=>controller.abort();
 },[refreshTick]);
 const soon=useMemo(()=>{
  const start=today(),limit=new Date(Date.now()+7*86400000).toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});
  const eventIds=new Set(events.filter(e=>e.external_task_id).map(e=>e.external_task_id));
  const e=events.filter(x=>x.status==="agendado"&&date(x.starts_at)>=start&&date(x.starts_at)<=limit)
   .map(x=>({id:x.id,day:date(x.starts_at),title:x.title,time:hour(x.starts_at),kind:"agenda"}));
  const t=tasks.filter(x=>x.due&&x.due>=start&&x.due<=limit&&x.stage!=="Concluído"&&!x.archived&&!eventIds.has(x.id))
   .map(x=>({id:x.id,day:x.due,title:x.title,time:"17:00",kind:"demanda"}));
  return [...e,...t].sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time)).slice(0,10);
 },[tasks,events]);
 const urgent=soon.filter(x=>x.day<=new Date(Date.now()+86400000).toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"})).length;
 return <div className="cc-alert-root">
  <button className="icon-button" title="Avisos da Central" aria-label="Abrir avisos do calendário" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <Bell size={18}/>{(urgent>0||pending>0)&&<i/>}
  </button>
  {open&&<div className="cc-alert-popover">
   <div className="cc-alert-top"><strong>Seus avisos</strong><span>{soon.length+(pending>0?1:0)} pendência(s)</span></div>
   {pending>0&&<button className="cc-alert-item" onClick={()=>{setOpen(false);onApprovals();}}><span className="cc-alert-symbol"><ClipboardList size={16}/></span><span><strong>{pending} demanda(s) aguardando aprovação</strong><small>Consultar demandas comerciais</small></span><ChevronRight size={14}/></button>}
   {!soon.length?<p className="cc-alert-nothing"><CheckCircle2 size={19}/> Nenhum prazo próximo na agenda.</p>:
   soon.map(x=><button className="cc-alert-item" key={x.kind+":"+x.id} onClick={()=>{setOpen(false);onCalendar();}}>
    <span className={"cc-alert-symbol "+x.kind}>{x.kind==="demanda"?<ClipboardList size={16}/>:<CalendarDays size={16}/>}</span>
    <span><strong>{x.title}</strong><small><Clock3 size={12}/>{x.day.split("-").reverse().join("/")} às {x.time}</small></span>
    <ChevronRight size={14}/>
   </button>)}
   <button className="cc-alert-seeall" onClick={()=>{setOpen(false);onCalendar();}}>Ver calendário completo <ChevronRight size={15}/></button>
  </div>}
 </div>;
}
