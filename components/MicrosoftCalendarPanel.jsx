"use client";
import {useEffect,useState} from "react";
import {CalendarDays,Link2,RefreshCcw,Unplug,ShieldCheck} from "lucide-react";

export default function MicrosoftCalendarPanel({onUpdated,canManageNetwork=false}){
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
 async function load(){
  try{const res=await fetch("/api/microsoft-calendar",{credentials:"same-origin",cache:"no-store"});const json=await res.json();if(!res.ok)throw Error(json.error);setStatus(json);}
  catch(e){setError(e.message||"Falha ao consultar a conexão.");}
 }
 useEffect(()=>{void load();const params=new URLSearchParams(window.location.search);const outcome=params.get("ms");
  if(outcome==="connected")setNote("Conta vinculada e compromissos importados com sucesso.");
  if(outcome==="sync_pending")setNote("Conta vinculada. A importação ainda precisa ser sincronizada.");
  if(outcome==="error"){
   const reason=params.get("ms_reason");
   const messages={
    session:"A sessão da Central expirou. Entre novamente e reconecte a conta.",
    cookies:"A autorização anterior expirou ou o navegador bloqueou cookies. Clique novamente em Conectar Microsoft / Teams.",
    state:"A verificação de segurança da autorização falhou. Inicie uma nova conexão.",
    authorization:"A conta Microsoft recusou o acesso. Confira as permissões do aplicativo no Entra.",
    token:"A Microsoft não aceitou o código de autorização. Verifique Client Secret e URI de redirecionamento.",
    profile:"A conexão foi autorizada, mas não foi possível consultar o perfil Microsoft.",
    database:"O login Microsoft foi aceito, mas a Central não conseguiu salvar a conexão."
   };
   setError(messages[reason]||"Falha ao autorizar a conta Microsoft. Tente novamente.");
  }
  if(outcome==="not_configured")setError("Integração Microsoft aguardando credenciais da Vercel.");
  if(outcome){const clean=new URL(window.location.href);clean.searchParams.delete("ms");clean.searchParams.delete("ms_reason");clean.searchParams.delete("section");window.history.replaceState({},"",clean.pathname+clean.search+clean.hash);}
 },[]);
 async function action(kind){
  if(kind==="disconnect"&&!window.confirm("Desvincular a sua conta Microsoft e remover os eventos importados dela da Central? Os compromissos originais no Teams não serão apagados."))return;
  setBusy(true);setError("");setNote("");
  try{
   const r=await fetch("/api/microsoft-calendar",{method:kind==="disconnect"?"DELETE":"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:kind==="sync"?JSON.stringify({action:"sync"}):undefined});
   const result=await r.json();if(!r.ok)throw Error(result.error||"Falha na operação.");
   setNote(kind==="disconnect"?"Conta desvinculada. Seus eventos importados foram removidos da Central.":result.synced+" compromissos sincronizados.");
   await load();onUpdated?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="panel cc-ms-panel">
  <div className="section-title"><div><h3><CalendarDays size={17}/> Integração Microsoft Teams</h3><p>Importe sua agenda e mantenha os compromissos atualizados automaticamente, aproximadamente a cada 5 minutos.</p></div></div>
  <p className="cc-ms-privacy"><ShieldCheck size={16}/> Ao conectar, os seus eventos do calendário Microsoft serão visíveis à administração da Central. Eventos marcados como privados aparecem somente como “Compromisso privado”, sem detalhes.</p>
  {status===null?<p>Verificando conexão Microsoft…</p>:!status.configured?
    <p className="validation">Integração preparada. Falta registrar o aplicativo Microsoft e configurar MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET e MICROSOFT_TOKEN_ENCRYPTION_KEY na Vercel.</p>:
   status.connected?<div className="cc-ms-connected">
    <div><strong>Conta conectada: {status.connection?.name||status.connection?.email}</strong>
     <small>{status.connection?.email||""} · Última sincronização: {status.connection?.lastSyncedAt?new Date(status.connection.lastSyncedAt).toLocaleString("pt-BR"):"pendente"} · Atualização automática habilitada</small></div>
    <div className="cc-ms-actions"><button className="btn secondary" disabled={busy} onClick={()=>action("sync")}><RefreshCcw size={15}/> Sincronizar agora</button><button className="btn secondary" disabled={busy} onClick={()=>action("disconnect")}><Unplug size={15}/> Desvincular</button></div>
   </div>:<button className="btn" onClick={()=>window.location.assign("/api/microsoft-calendar/connect")}><Link2 size={15}/> Conectar conta Microsoft / Teams</button>}
  {canManageNetwork&&status?.connections?.length>0&&<div className="cc-ms-admin">
   <strong>Contas conectadas da equipe</strong>
   {status.connections.map(c=><div className="cc-ms-account" key={c.owner}><span>{c.name||c.email||c.owner}<small>{c.owner}</small></span><small>{c.lastSyncedAt?"Atualizada "+new Date(c.lastSyncedAt).toLocaleString("pt-BR"):"Aguardando sincronização"}</small></div>)}
  </div>}
  {status?.connection?.lastError&&<p className="validation">A última sincronização encontrou um erro. Use “Sincronizar agora” ou reconecte a conta.</p>}
  {error&&<p role="alert" className="validation">{error}</p>}
  {note&&<p role="status" className="notice">{note}</p>}
 </section>;
}
