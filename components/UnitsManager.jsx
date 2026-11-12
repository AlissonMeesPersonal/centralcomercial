"use client";
import { useEffect,useMemo,useState } from "react";
import { Building2, Plus, Pencil, Search, X, Save, RefreshCcw, ShieldCheck, Lock, FileText, AlertTriangle } from "lucide-react";
const fields=[
 ["name","Nome da unidade",true],["administrativeName","Nome administrativo"],
 ["type","Tipo"],["status","Situação"],["city","Cidade",true],["state","UF",true],
 ["cnpj","CNPJ"],["cep","CEP"],["leader","Líder da unidade"],
 ["leaderContact","Contato do líder"],["coordinator","Coordenador regional"],
 ["coordinatorContact","Contato da coordenação"],["address","Endereço completo"],
 ["street","Rua"],["number","Número"],["complement","Complemento"],
 ["mapUrl","Link do Google Maps"],["siteUrl","Link do site"]
];
const blank=()=>({id:null,name:"",administrativeName:"",type:"Unidade",status:"Aberta",city:"",state:"RS",cnpj:"",cep:"",leader:"",leaderContact:"",coordinator:"",coordinatorContact:"",address:"",street:"",number:"",complement:"",mapUrl:"",siteUrl:"",revision:0});
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function UnitsManager({units,onSaved,notify}){
 const [access,setAccess]=useState({loading:true});
 const [q,setQ]=useState("");
 const [edit,setEdit]=useState(null);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [conflict,setConflict]=useState(false);
 useEffect(()=>{let live=true;fetch("/api/admin/units",{credentials:"same-origin",cache:"no-store"})
  .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);return v;})
  .then(v=>{if(live)setAccess({...v,loading:false});})
  .catch(e=>{if(live)setAccess({loading:false,canEdit:false,error:e.message});});
  return ()=>{live=false};
 },[]);
 const filtered=useMemo(()=>units.filter(u=>!u.demo&&norm([u.name,u.city,u.state,u.leader,u.coordinator,u.cnpj,u.churnCode].join(" ")).includes(norm(q))).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")),[units,q]);
 const open=u=>{setEdit({...u});setError("");setConflict(false)};
 async function save(){
  if(!edit||saving)return;
  if(!edit.name?.trim()||!edit.city?.trim()||!edit.state?.trim())return setError("Nome, cidade e UF são obrigatórios.");
  setSaving(true);setError("");setConflict(false);
  try{
   const res=await fetch("/api/admin/units",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:edit.id?"update":"create",revision:edit.revision??0,unit:edit})});
   const data=await res.json();
   if(!res.ok){if(res.status===409)setConflict(true);throw Error(data.error||"Não foi possível salvar.");}
   onSaved(data.unit);notify(data.message);setEdit(null);
  }catch(e){setError(e.message);}finally{setSaving(false);}
 }
 return <section>
  <div className="heading-row"><div><div className="eyebrow">ADMINISTRAÇÃO</div><h1>Gerenciar unidades</h1><p>Adicione academias e atualize seus cadastros.</p></div>
   {access.canEdit&&<button className="btn" onClick={()=>open(blank())}><Plus size={17}/> Nova unidade</button>}
  </div>
  {access.loading?<div className="panel admin-gate">Verificando autorização…</div>:!access.canEdit?
   <div className="panel admin-gate"><div className="gate-icon"><Lock size={25}/></div><h3>Área administrativa</h3>
    <p>{access.error||(access.signedIn?(access.needsVerification?"Confirme seu e-mail antes de editar.":"Sua conta não possui permissão de edição."):"Entre com sua conta administrativa para editar e adicionar unidades.")}</p>
    {!access.signedIn?<div className="gate-actions"><a className="btn" href="/auth/sign-in">Entrar</a><span className="admin-invite-tip">O acesso exige convite da gestão.</span></div>:<a className="btn secondary" href="/auth/sign-in">Trocar conta</a>}
    <small>Compartilhar o site não concede permissão de edição. Apenas administradores e gestores autorizados podem salvar alterações.</small>
   </div>:
   <>
    <div className="editor-summary"><div><ShieldCheck size={19}/> Perfil autorizado: <strong>{access.role==="admin"?"Administrador":"Gestor comercial"}</strong></div><span>Edição compartilhada no Neon, com histórico e revisão.</span></div>
    <div className="editor-toolbar"><label><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar nome, cidade, líder ou CNPJ"/></label><span>{filtered.length} registros</span></div>
    <div className="editor-rows">{filtered.map(u=><div className="editor-row" key={u.id}><div className="editor-building"><Building2 size={19}/></div>
      <div className="editor-name"><strong>{u.name}</strong><small>{u.city} · {u.state} · {u.type} · {u.churnCode==null?"Sem código churn":"Churn "+String(u.churnCode).padStart(2,"0")}</small></div>
      <div className="editor-leader"><span>Líder</span><strong>{u.leader||"Não informado"}</strong></div>
      <div className="editor-leader"><span>Coordenação</span><strong>{u.coordinator||"Não informado"}</strong></div>
      <button onClick={()=>open(u)}><Pencil size={15}/> Editar</button></div>)}
      {!filtered.length&&<div className="empty">Nenhuma unidade encontrada.</div>}
    </div>
   </>}
  {edit&&access.canEdit&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setEdit(null);}}><div className="drawer">
   <div className="drawer-head"><div><div className="eyebrow">{edit.id?"EDIÇÃO":"NOVO CADASTRO"}</div><h2>{edit.id?"Editar unidade":"Adicionar unidade"}</h2></div><button className="icon-button" onClick={()=>setEdit(null)} disabled={saving}><X size={20}/></button></div>
   <div className="drawer-content"><div className="editor-info"><FileText size={17}/> {edit.id?<>Código do relatório de churn: <strong>{edit.churnCode==null?"Não vinculado":"#"+String(edit.churnCode).padStart(2,"0")}</strong>. A correspondência deve ser alterada na aba Churn das unidades, não neste cadastro.</>:"A nova unidade estará disponível nas campanhas e demandas após salvar."}</div>
    {error&&<div className="validation"><AlertTriangle size={17}/>{error}{conflict&&<button className="editor-reload" onClick={()=>window.location.reload()}><RefreshCcw size={14}/> Recarregar</button>}</div>}
    <div className="editor-form">{fields.map(([field,label,required])=><label className={"field "+(["name","address","mapUrl","siteUrl"].includes(field)?"wide":"")} key={field}>
      <span>{label}{required?" *":""}</span>
      {field==="type"?<select value={edit.type||"Unidade"} onChange={e=>setEdit(o=>({...o,type:e.target.value}))}>{["Unidade","Franquia","Eleve","Matriz","Academia 26fit"].map(s=><option key={s}>{s}</option>)}</select>:
       field==="status"?<select value={edit.status||"Aberta"} onChange={e=>setEdit(o=>({...o,status:e.target.value}))}>{["Aberta","Inauguração","Administrativo","Inativa"].map(s=><option key={s}>{s}</option>)}</select>:
       <input type={field.endsWith("Url")?"url":"text"} maxLength={field.endsWith("Url")?2000:field==="state"?2:550} value={edit[field]??""} onChange={e=>setEdit(o=>({...o,[field]:e.target.value}))} placeholder={field==="mapUrl"?"https://www.google.com/maps/...":""}/>}
    </label>)}</div>
    <div className="editor-info"><ShieldCheck size={17}/> As mudanças são registradas com autoria e número de revisão. Alterações simultâneas são bloqueadas para evitar perda de dados.</div>
   </div>
   <div className="drawer-footer"><button className="btn secondary" disabled={saving} onClick={()=>setEdit(null)}>Cancelar</button><button className="btn" disabled={saving} onClick={save}>{saving?<RefreshCcw size={16}/>:<Save size={16}/>} {saving?"Salvando…":"Salvar unidade"}</button></div>
  </div></div>}
 </section>;
}
