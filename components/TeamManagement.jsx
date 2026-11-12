"use client";
import {useEffect,useMemo,useState} from "react";
import {UsersRound,UserPlus,Copy,Search,RefreshCcw,ShieldCheck,UserX,UserCheck,Clock3,Building2,X,Save} from "lucide-react";
import UnitPicker from "./UnitPicker";
const roleLabels={admin:"Administrador(a)",gestor:"Gestor comercial",lider:"Líder de unidade",colaborador:"Colaborador(a)"};
const available={developer:["admin","gestor","lider","colaborador"],admin:["gestor","lider","colaborador"],gestor:["lider","colaborador"]};
const formatDate=v=>v?new Date(v).toLocaleDateString("pt-BR"):"—";
const normalize=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function TeamManagement({accessRole,units=[]}){
 const [loading,setLoading]=useState(true),[members,setMembers]=useState([]),[invites,setInvites]=useState([]);
 const [q,setQ]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [name,setName]=useState(""),[email,setEmail]=useState("");
 const [role,setRole]=useState(accessRole==="developer"?"admin":accessRole==="admin"?"gestor":"lider");
 const [inviteUrl,setInviteUrl]=useState(""),[saving,setSaving]=useState(false),[copied,setCopied]=useState(false);
 const [inviteUnitIds,setInviteUnitIds]=useState([]),[editingMember,setEditingMember]=useState(null),[editUnitIds,setEditUnitIds]=useState([]);
 const [assignError,setAssignError]=useState(""),[assignSaving,setAssignSaving]=useState(false);
 const roles=available[accessRole]||[];
 async function refresh(){
  setLoading(true);
  try{const response=await fetch("/api/team",{cache:"no-store",credentials:"same-origin"});const data=await response.json();
  if(!response.ok)throw Error(data.error||"Falha no cadastro da equipe.");
  setMembers(data.members||[]);setInvites(data.invitations||[]);setError("");
  }catch(e){setError(e.message||"Não foi possível carregar a equipe.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{refresh();},[]);
 async function invite(event){
  event.preventDefault();if(saving)return;setSaving(true);setError("");setNotice("");setCopied(false);
  try{
   const response=await fetch("/api/team",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,role,unitIds:inviteUnitIds})});
   const payload=await response.json();
   if(!response.ok)throw Error(payload.error||"Falha ao criar convite.");
   setInviteUrl(payload.url);setNotice("Convite criado. Envie o link à pessoa autorizada.");
   setName("");setEmail("");setInviteUnitIds([]);await refresh();
  }catch(e){setError(e.message||"Falha ao criar convite.");}
  finally{setSaving(false);}
 }
 async function toggle(member){
  const next=member.status==="active"?"suspended":"active";
  if(!window.confirm((next==="suspended"?"Suspender":"Reativar")+" acesso de "+member.name+"?"))return;
  try{
   const response=await fetch("/api/team",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:member.email,status:next})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Não foi possível atualizar.");
   setNotice(next==="suspended"?"Acesso suspenso.":"Acesso reativado.");await refresh();
  }catch(e){setError(e.message);}
 }
 function openUnitEditor(member){
  setEditingMember(member);setEditUnitIds([...(member.unit_ids||[])]);
  setAssignError("");
 }
 async function saveUnitAssignments(){
  if(!editingMember||assignSaving)return;
  setAssignSaving(true);setAssignError("");
  try{
   const response=await fetch("/api/team",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"assign_units",email:editingMember.email,unitIds:editUnitIds,unitRevision:editingMember.unit_revision||0
   })});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Não foi possível salvar as unidades.");
   setEditingMember(null);setNotice("Unidades vinculadas atualizadas.");await refresh();
  }catch(e){setAssignError(e.message);}
  finally{setAssignSaving(false);}
 }
 const show=useMemo(()=>members.filter(x=>normalize([x.email,x.name,x.role].join(" ")).includes(normalize(q))),[members,q]);
 return <section className="team-page">
  <div className="heading-row"><div><div className="eyebrow">ACESSOS DA REDE</div><h1>Equipe</h1><p>Cadastre as pessoas autorizadas e controle seus perfis.</p></div>
  <span className="team-count"><UsersRound size={16}/>{members.length} membros</span></div>
  <div className="team-privacy"><ShieldCheck size={18}/><div><strong>Convites individuais e gestão de acessos</strong><span>Cada pessoa usa seu próprio e-mail. As permissões são verificadas no servidor.</span></div></div>
  <div className="team-layout">
   <section className="panel team-invite-card">
    <div className="section-title"><div><h3>Convidar colaborador</h3><p>Gere um link pessoal válido por sete dias.</p></div><UserPlus size={19} color="#737d87"/></div>
    <form className="team-invite-form" onSubmit={invite}>
     <label className="field"><span>Nome completo</span><input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da pessoa"/></label>
     <label className="field"><span>E-mail de acesso</span><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="pessoa@empresa.com.br"/></label>
     <label className="field"><span>Nível de permissão</span><select value={role} onChange={e=>{setRole(e.target.value);setInviteUnitIds([]);}}>{roles.map(value=><option value={value} key={value}>{roleLabels[value]}</option>)}</select></label>
     {["lider","colaborador"].includes(role)&&<UnitPicker units={units} selected={inviteUnitIds} onChange={setInviteUnitIds} label="Unidades de atuação *"/>}
     <button className="btn" type="submit" disabled={saving}>{saving?<RefreshCcw size={16}/>:<UserPlus size={16}/>} {saving?"Gerando convite…":"Gerar convite"}</button>
    </form>
    {inviteUrl&&<div className="team-invite-link"><label>Link de acesso gerado</label><input readOnly value={inviteUrl} aria-label="Link do convite"/><button className="btn secondary" onClick={async()=>{try{await navigator.clipboard.writeText(inviteUrl);setCopied(true);}catch{setNotice("Selecione e copie o link no campo.");}}}><Copy size={15}/>{copied?"Copiado!":"Copiar link"}</button><small>Envie por e-mail ou mensagem. Nenhuma senha é compartilhada.</small></div>}
   </section>
   <section className="panel">
    <div className="section-title"><div><h3>Convites pendentes</h3><p>Cadastros aguardando confirmação.</p></div><Clock3 size={19} color="#737d87"/></div>
    {loading?<p className="team-secondary">Carregando convites…</p>:invites.length?invites.map((item,i)=><div className="team-pending-row" key={item.email+"-"+i}><div><strong>{item.name}</strong><small>{item.email}</small><small>{roleLabels[item.role]||item.role} · {item.unit_ids?.length||0} unidade(s) · até {formatDate(item.expires_at)}</small></div><span className="tag warning">Pendente</span></div>):<p className="team-secondary">Nenhum convite aguardando cadastro.</p>}
   </section>
  </div>
  {error&&<p className="team-error" role="alert">{error}</p>}
  {notice&&<p className="team-notice">{notice}</p>}
  <section className="panel team-members">
   <div className="section-title"><div><h3>Usuários cadastrados</h3><p>Perfis da equipe com acesso autorizado.</p></div><button className="btn secondary" onClick={refresh}><RefreshCcw size={14}/> Atualizar</button></div>
   <label className="team-search"><Search size={16}/><input aria-label="Pesquisar usuários" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou cargo"/></label>
   {loading?<p className="team-secondary">Carregando equipe…</p>:show.length?show.map(member=><div className="team-person" key={member.email}>
     <span className="team-avatar">{member.name?.trim()?.[0]?.toUpperCase()||"?"}</span>
     <div className="team-person-main"><strong>{member.name}</strong><small>{member.email}</small></div>
     <div className="team-role"><span>{roleLabels[member.role]||member.role}</span><small>Desde {formatDate(member.created_at)}</small></div>
     <span className={"tag "+(member.status==="active"?"success":"danger")}>{member.status==="active"?"Ativo":"Suspenso"}</span>
     {roles.includes(member.role)&&<button className="team-units-edit" title={"Gerenciar unidades de "+member.name} onClick={()=>openUnitEditor(member)}><Building2 size={15}/> {member.unit_ids?.length||0} unidades</button>}
     {roles.includes(member.role)&&<button className="team-toggle" title={member.status==="active"?"Suspender acesso":"Reativar acesso"} onClick={()=>toggle(member)}>{member.status==="active"?<UserX size={17}/>:<UserCheck size={17}/>}</button>}
   </div>):<p className="team-secondary">Nenhum usuário cadastrado.</p>}
  </section>
  {editingMember&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!assignSaving)setEditingMember(null);}}>
    <div className="drawer team-assignment-drawer">
      <div className="drawer-head"><div><div className="eyebrow">UNIDADES VINCULADAS</div><h2>{editingMember.name}</h2></div><button className="icon-button" onClick={()=>!assignSaving&&setEditingMember(null)}><X size={19}/></button></div>
      <div className="drawer-content">
       <p className="team-secondary">Selecione as unidades que este colaborador poderá representar nas campanhas. Uma unidade aparece nas campanhas quando pelo menos uma pessoa vinculada estiver ativa.</p>
       {assignError&&<p role="alert" className="team-error">{assignError}</p>}
       <UnitPicker units={units} selected={editUnitIds} onChange={setEditUnitIds} label="Unidades atribuídas"/>
      </div>
      <div className="drawer-footer"><button className="btn secondary" disabled={assignSaving} onClick={()=>setEditingMember(null)}>Cancelar</button><button className="btn" disabled={assignSaving} onClick={saveUnitAssignments}><Save size={16}/>{assignSaving?"Salvando…":"Salvar unidades"}</button></div>
    </div>
   </div>}
 </section>;
}
