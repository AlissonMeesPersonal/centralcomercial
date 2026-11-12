"use client";
import {useEffect,useMemo,useState} from "react";
import {Building2,Search,UsersRound,AlertTriangle} from "lucide-react";
const normalize=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function CampaignUnitSelector({units,selectedIds,onToggle,onGoTeam}){
 const [result,setResult]=useState({loading:true,ids:[],error:null});
 const [q,setQ]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/campaign-units",{credentials:"same-origin",cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Não foi possível verificar as unidades cadastradas.");
    if(!Array.isArray(data.unitIds))throw Error("Resposta de unidades inválida.");
    return data.unitIds;
   })
   .then(ids=>setResult({loading:false,ids,error:null}))
   .catch(e=>{if(e.name!=="AbortError")setResult({loading:false,ids:[],error:e.message});});
  return ()=>controller.abort();
 },[]);
 const ids=useMemo(()=>new Set(result.ids),[result.ids]);
 const eligible=useMemo(()=>units.filter(u=>!u.demo&&ids.has(u.id)&&u.type!=="Matriz"&&u.status!=="Inativa").sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")),[units,ids]);
 const shown=eligible.filter(u=>normalize([u.name,u.city,u.state].join(" ")).includes(normalize(q)));
 const historical=units.filter(u=>selectedIds.includes(u.id)&&!ids.has(u.id));
 return <div className="campaign-unit-selector">
  <div className="campaign-unit-summary"><span><UsersRound size={15}/> {result.loading?"Verificando cadastros…":eligible.length+" unidade(s) com equipe ativa"}</span><strong>{selectedIds.length} selecionada(s)</strong></div>
  {result.error&&<div className="validation"><AlertTriangle size={16}/>{result.error} Nenhuma nova unidade será incluída sem verificação.</div>}
  {result.loading&&<div className="team-secondary">Consultando os cadastros ativos da equipe…</div>}
  {!result.loading&&!result.error&&eligible.length===0&&<div className="campaign-units-empty">
   <Building2 size={25}/><strong>Nenhuma unidade com equipe ativa</strong>
   <p>Convide líderes ou colaboradores na aba Equipe, vincule as unidades e aguarde a ativação das contas. Os 83 registros do diretório continuam preservados.</p>
   <button type="button" className="btn secondary" onClick={onGoTeam}>Ir para Equipe</button>
  </div>}
  {!result.loading&&eligible.length>0&&<>
   <label className="campaign-unit-search"><Search size={16}/><input aria-label="Buscar unidades cadastradas" placeholder="Buscar entre unidades com cadastro ativo…" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <div className="campaign-unit-options">{shown.map(u=><label className="select-unit" key={u.id}>
     <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={e=>onToggle(u.id,e.target.checked)}/>
     <div><strong>{u.name}</strong><small>{u.city||""} · {u.state||"—"} · {u.type||"Unidade"}</small></div>
    </label>)}
    {!shown.length&&<p className="team-secondary">Nenhuma unidade corresponde à busca.</p>}
   </div>
  </>}
  {historical.length>0&&<div className="campaign-historical">
    <strong>Unidades vinculadas anteriormente</strong><p>Estas unidades não têm equipe ativa no momento. Suas entregas e históricos serão preservados.</p>
    {historical.map(u=><label className="select-unit" key={u.id}>
     <input type="checkbox" checked onChange={e=>onToggle(u.id,e.target.checked)}/>
     <div><strong>{u.name}</strong><small>Sem equipe ativa · participação anterior</small></div>
    </label>)}
   </div>}
 </div>;
}
