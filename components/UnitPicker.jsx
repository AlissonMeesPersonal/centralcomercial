"use client";
import {useMemo,useState} from "react";
import {Building2,Search} from "lucide-react";
const normalize=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function UnitPicker({units=[],selected=[],onChange,label="Unidades vinculadas"}){
 const [search,setSearch]=useState("");
 const registered=useMemo(()=>units.filter(u=>!u.demo&&u.type!=="Matriz"&&u.status!=="Inativa").sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")),[units]);
 const visible=registered.filter(u=>normalize([u.name,u.city,u.state].join(" ")).includes(normalize(search)));
 return <section className="team-units-control">
  <div className="team-unit-header"><strong><Building2 size={15}/>{label}</strong><span>{selected.length} selecionada(s)</span></div>
  <label className="team-unit-search"><Search size={15}/><input aria-label="Pesquisar unidades vinculadas" placeholder="Pesquisar unidade ou cidade" value={search} onChange={e=>setSearch(e.target.value)}/></label>
  <div className="team-unit-options">
   {visible.map(u=><label className="team-unit-option" key={u.id}>
    <input type="checkbox" checked={selected.includes(u.id)} onChange={e=>onChange(e.target.checked?[...selected,u.id]:selected.filter(id=>id!==u.id))}/>
    <span><strong>{u.name}</strong><small>{u.city||""} · {u.state||"—"}</small></span>
   </label>)}
   {!visible.length&&<p className="team-secondary">{registered.length?"Nenhuma unidade encontrada.":"O diretório de unidades ainda está carregando."}</p>}
  </div>
  <small>As unidades só aparecerão nas campanhas quando houver uma pessoa ativa vinculada a elas.</small>
 </section>;
}
