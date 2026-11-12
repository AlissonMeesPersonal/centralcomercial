"use client";
import {useEffect,useMemo,useState} from "react";
import {Building2,RefreshCcw,Link2,AlertCircle,CheckCircle2,ShieldCheck} from "lucide-react";
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function ChurnUnitMatching({units=[],onChanged}){
 const [matches,setMatches]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [drafts,setDrafts]=useState({});
 const [expanded,setExpanded]=useState(false);
 async function reload(){
  try{
   const response=await fetch("/api/churn/matches",{cache:"no-store",credentials:"same-origin"});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Não foi possível carregar conciliações.");
   setMatches(result.rows||[]);setError("");
  }catch(e){setError(e.message);}
 }
 useEffect(()=>{reload();},[]);
 const pending=useMemo(()=>matches.filter(m=>m.match_status==="pendente"&&!m.unit_id),[matches]);
 const linked=new Set(matches.map(x=>x.unit_id).filter(Boolean));
 const available=units.filter(u=>!u.demo&&u.type!=="Matriz"&&!linked.has(u.id)).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
 async function save(item){
  const id=drafts[item.source_code];
  if(!id||busy)return;
  const chosen=available.find(u=>u.id===id);
  if(!chosen)return setError("Selecione uma unidade disponível.");
  if(!window.confirm("Vincular todos os meses do código "+item.source_code+" ("+item.source_label+") à unidade "+chosen.name+"?"))return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/churn/matches",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({sourceCode:item.source_code,unitId:id,revision:item.match_revision})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Não foi possível atualizar a unidade.");
   setMessage("Conciliação concluída: "+chosen.name+". Os meses existentes já aparecem no painel dessa unidade.");
   setDrafts(prev=>({...prev,[item.source_code]:""}));
   await reload();onChanged?.();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 return <section className="panel churn-matching">
  <div className="section-title"><div><h3>Conciliação de unidades do relatório</h3><p>Relacionar os códigos da exportação às academias do diretório sem misturar resultados.</p></div><Building2 size={20} color="#8b99a1"/></div>
  <div className="churn-matching-intro"><ShieldCheck size={17}/><span>{pending.length} código(s) sem vínculo de academia. O registro de treinamento é mantido separado. Nenhum resultado será atribuído automaticamente a nomes ambíguos.</span></div>
  <button type="button" className="btn secondary" onClick={()=>setExpanded(v=>!v)}>{expanded?"Ocultar conciliação":"Conferir códigos pendentes"}</button>
  {error&&<p role="alert" className="validation"><AlertCircle size={15}/>{error}</p>}
  {message&&<p role="status" className="churn-success"><CheckCircle2 size={15}/>{message}</p>}
  {expanded&&<div className="churn-matching-list">
    {pending.length?pending.map(item=><div className="churn-matching-row" key={item.source_code}>
     <div><strong>Código {item.source_code}</strong><small>{item.source_label}</small></div>
     <select aria-label={"Unidade para código "+item.source_code} value={drafts[item.source_code]||""} disabled={busy}
      onChange={e=>setDrafts(prev=>({...prev,[item.source_code]:e.target.value}))}>
       <option value="">Selecionar unidade correta</option>{available.map(u=><option key={u.id} value={u.id}>{u.name} · {u.state}</option>)}
     </select>
     <button className="btn" type="button" disabled={busy||!drafts[item.source_code]} onClick={()=>save(item)}><Link2 size={14}/> Vincular</button>
    </div>):<p className="churn-matching-empty"><CheckCircle2 size={17}/> Todos os códigos de academias já estão conciliados.</p>}
   </div>}
 </section>;
}
