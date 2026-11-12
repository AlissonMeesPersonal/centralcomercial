"use client";
import {useEffect,useState} from "react";
import {Mail,ShieldCheck,CheckCircle2,AlertCircle,RefreshCw,Send,ExternalLink} from "lucide-react";

export default function EmailSettingsPanel(){
 const [state,setState]=useState({loading:true,provider:false,from:false,cron:false,configured:false,sender:null,error:""});
 const [sending,setSending]=useState(false);
 const [feedback,setFeedback]=useState(null);
 async function load(){
  setState(s=>({...s,loading:true,error:""}));
  try{
   const response=await fetch("/api/admin/email-settings",{credentials:"same-origin",cache:"no-store"});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Não foi possível consultar a configuração.");
   setState({...result,loading:false,error:""});
  }catch(e){setState(s=>({...s,loading:false,error:e.message||"Falha ao consultar a configuração."}));}
 }
 useEffect(()=>{load();},[]);
 async function test(){
  if(sending||!state.configured)return;
  setFeedback(null);
  setSending(true);
  try{
   const response=await fetch("/api/admin/email-settings",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"
   });
   const result=await response.json();
   if(!response.ok){
    const code=result.providerCode&&result.providerCode!=="unknown_error"?" · Código: "+result.providerCode:"";
    setFeedback({ok:false,text:(result.error||"Falha ao solicitar o envio.")+code});
    return;
   }
   setFeedback({ok:true,text:result.message+" Destino: "+result.recipient});
  }catch(e){setFeedback({ok:false,text:e.message||"O teste não pôde ser realizado."});}
  finally{setSending(false);load();}
 }
 const status=[
  {label:"Provedor Resend",ready:state.provider,detail:"RESEND_API_KEY"},
  {label:"Remetente oficial",ready:state.from,detail:state.sender||"AUTH_EMAIL_FROM"},
  {label:"Proteção do agendamento",ready:state.cron,detail:"CRON_SECRET"}
 ];
 return <section className="panel cc-email-settings">
  <div className="section-title"><div><h3>E-mail e notificações automáticas</h3>
   <p>Configuração do envio de lembretes de reuniões, eventos e prazos da rede.</p></div>
   <Mail size={20}/></div>
  <div className="cc-email-status-list">
   {state.loading?<p role="status">Conferindo configuração de e-mail…</p>:state.error?
    <p role="alert" className="cc-email-message error"><AlertCircle size={16}/>{state.error}</p>:
    status.map(item=><div key={item.label} className="cc-email-status-row">
     <span className={item.ready?"cc-email-ok":"cc-email-pending"}>{item.ready?<CheckCircle2 size={17}/>:<AlertCircle size={17}/>}</span>
     <span><strong>{item.label}</strong><small>{item.detail}</small></span>
     <b className={item.ready?"cc-email-ready":"cc-email-awaiting"}>{item.ready?"Variável presente":"Pendente"}</b>
    </div>)}
  </div>
  <div className="cc-email-help">
   <ShieldCheck size={17}/><div><strong>Variáveis configuradas não significam e-mail habilitado</strong>
    <p>Verifique um domínio remetente no Resend, configure a chave da API e o e-mail autorizado nas variáveis de ambiente de <strong>produção</strong> da Vercel. Nunca coloque a chave no GitHub ou no formulário da Central. Após configurar, faça um novo deploy para aplicar as variáveis.</p>
    <p>A Central só consegue confirmar que as variáveis existem. A autorização do remetente e as permissões da chave precisam ser verificadas no Resend. Em caso de falha, consulte <a href="https://resend.com/logs" target="_blank" rel="noopener noreferrer">Resend → Logs</a> para o erro original.</p>
    <p>Os e-mails de autenticação do Neon são separados destes lembretes. A rotina programada envia lembretes para amanhã e para hoje, conforme o horário de execução.</p>
   </div>
  </div>
  {state.lastTest&&<div className={"cc-email-lasttest "+(state.lastTest.status==="sent"?"success":"failed")}>
   {state.lastTest.status==="sent"?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>}
   <span>Último teste: <strong>{state.lastTest.status==="sent"?"Aceito pelo Resend":state.lastTest.status==="failed"?"Falhou":"Em processamento"}</strong>
   {state.lastTest.provider_http_status?" · HTTP "+state.lastTest.provider_http_status:""}
   {state.lastTest.provider_error_code?" · "+state.lastTest.provider_error_code:""}.
   {state.lastTest.status==="failed"?" Consulte o motivo em Resend → Logs.":""}</span>
  </div>}
  {feedback&&<p role={feedback.ok?"status":"alert"} className={"cc-email-message "+(feedback.ok?"success":"error")}>
   {feedback.ok?<CheckCircle2 size={17}/>:<AlertCircle size={17}/>}
   {feedback.text}
  </p>}
  <div className="cc-email-buttons">
   <button type="button" className="btn secondary" onClick={load} disabled={state.loading||sending}><RefreshCw size={15}/> Atualizar status</button>
   <button type="button" className="btn" onClick={test} disabled={!state.configured||state.loading||sending}>
    <Send size={15}/>{sending?"Enviando teste…":"Enviar teste para meu e-mail"}
   </button>
   <a className="cc-email-provider-link" href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">Verificar domínio <ExternalLink size={14}/></a>
   <a className="cc-email-provider-link" href="https://resend.com/logs" target="_blank" rel="noopener noreferrer">Erros no Resend <ExternalLink size={14}/></a>
  </div>
  <p className="cc-email-footnote">Um teste pode ser solicitado a cada 15 minutos, sempre para o e-mail da pessoa administradora conectada. A confirmação do provedor não garante entrega na caixa de entrada.</p>
 </section>;
}
