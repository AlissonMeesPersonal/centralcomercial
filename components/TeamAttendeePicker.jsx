"use client";
import {useEffect,useMemo,useState} from "react";
import {Search,UsersRound} from "lucide-react";
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function TeamAttendeePicker({value=[],onChange,members:provided,label="Pessoas convidadas"}){
 const [loaded,setLoaded]=useState([]),[loading,setLoading]=useState(!provided),[error,setError]=useState("");
 const [search,setSearch]=useState("");
 useEffect(()=>{
  if(provided)return;
  let cancelled=false;
  fetch("/api/calendar/people",{credentials:"same-origin",cache:"no-store"}).then(async r=>{
   const data=await r.json();
   if(!r.ok)throw Error(data.error||"Não foi possível carregar a equipe.");
   if(!cancelled){setLoaded(data.members||[]);setLoading(false);}
  }).catch(err=>{if(!cancelled){setError(err.message);setLoading(false);}});
  return ()=>{cancelled=true;};
 },[provided]);
 const members=provided||loaded;
 const selected=useMemo(()=>new Set(value),[value]);
 const visible=members.filter(p=>norm(p.name+" "+p.email).includes(norm(search)));
 const toggle=(email,checked)=>onChange(checked?[...new Set([...value,email])]:value.filter(x=>x!==email));
 const all=members.length>0&&members.every(p=>selected.has(p.email));
 return <section className="cc-attendee-picker">
  <div className="cc-attendee-head"><span><UsersRound size={16}/>{label}</span><strong>{value.length} selecionado(s)</strong></div>
  <div className="cc-attendee-actions"><label><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Pesquisar equipe"/></label>
   <button type="button" onClick={()=>onChange(all?value.filter(e=>!members.some(p=>p.email===e)):[...new Set([...value,...members.map(p=>p.email)])])} disabled={!members.length}>{all?"Desmarcar equipe":"Selecionar equipe"}</button>
  </div>
  {error&&<p role="alert" className="cc-attendee-error">{error}</p>}
  <div className="cc-attendee-scroll">
   {visible.map(p=><label key={p.email} className="cc-attendee-item"><input type="checkbox" checked={selected.has(p.email)} onChange={e=>toggle(p.email,e.target.checked)}/><span><strong>{p.name}</strong><small>{p.email}</small></span></label>)}
   {loading&&<p className="cc-attendee-empty">Carregando participantes…</p>}
   {!loading&&!error&&!visible.length&&<p className="cc-attendee-empty">Nenhum colaborador ativo encontrado.</p>}
  </div>
  <small className="cc-attendee-foot">O organizador também é avisado. Só serão convidados usuários com contas ativas na Central.</small>
 </section>;
}
