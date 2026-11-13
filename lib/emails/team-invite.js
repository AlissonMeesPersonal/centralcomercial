import {createHash} from "node:crypto";

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

const roleLabel={
 admin:"Administração",gestor:"Gestão comercial",
 lider:"Liderança de unidade",colaborador:"Equipe comercial"
};

export async function sendCentralTeamInvite({email,name,role,url,tokenHash}){
 const apiKey=process.env.RESEND_API_KEY;
 const sender=process.env.AUTH_EMAIL_FROM;
 if(!apiKey||!sender)return {status:"not_configured"};
 if(!/^https:\/\/centralcomercial-eta\.vercel\.app\/convite\/[A-Za-z0-9_-]{30,80}$/.test(url))
  return {status:"invalid_link"};
 const displayName=escapeHtml(name);
 const displayRole=escapeHtml(roleLabel[role]||"Equipe");
 const safeUrl=escapeHtml(url);
 const subject="Convite para acessar a 26fit • Central Comercial";
 const html='<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"></head>'+
 '<body style="margin:0;padding:28px 12px;background:#f2f4f5;font-family:Arial,sans-serif;">'+
 '<table role="presentation" style="width:100%;max-width:560px;margin:auto;border:1px solid #e5e9ee;border-spacing:0;border-radius:12px;background:#fff;overflow:hidden">'+
 '<tr><td style="background:#1b2024;border-top:5px solid #ec8c3f;padding:25px;color:#fff;font-size:19px;font-weight:bold">26fit • Central Comercial</td></tr>'+
 '<tr><td style="padding:30px;color:#33404b">'+
 '<h1 style="font-size:23px;margin:0 0 18px">Você foi convidado(a)!</h1>'+
 '<p style="font-size:14px;line-height:1.7">Olá, '+displayName+'. A gestão da 26fit convidou você para acessar a Central Comercial.</p>'+
 '<p style="font-size:14px;line-height:1.7"><strong>Perfil de acesso:</strong> '+displayRole+'</p>'+
 '<a href="'+safeUrl+'" style="display:inline-block;margin:18px 0;padding:14px 20px;background:#252a2e;color:white;text-decoration:none;font-size:13px;font-weight:bold;border-radius:8px">Aceitar convite</a>'+
 '<p style="color:#77848f;font-size:12px;line-height:1.7">Este convite é individual e válido por 7 dias. Se você já tem conta, entre com o mesmo e-mail cadastrado e aceite o convite. Caso ainda não tenha conta, crie uma usando esse e-mail.</p>'+
 '<p style="color:#8b97a0;font-size:11px;line-height:1.7;word-break:break-word">Se o botão não funcionar, copie este endereço no navegador:<br><a href="'+safeUrl+'">'+safeUrl+'</a></p>'+
 '<p style="color:#97a2ab;border-top:1px solid #e9edf0;padding-top:18px;margin-top:24px;font-size:11px">Se você não reconhece este convite, ignore a mensagem. Nunca compartilhe seu link de acesso.</p>'+
 '</td></tr></table></body></html>';
 const text="Olá, "+name+". Você foi convidado(a) para a 26fit • Central Comercial como "+
 (roleLabel[role]||"equipe")+".\nAceite o convite (válido por 7 dias): "+url+
 "\nSe já tem conta, entre com o mesmo e-mail. Se não solicitou este acesso, ignore.";
 try{
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{
    Authorization:"Bearer "+apiKey,
    "Content-Type":"application/json",
    "Idempotency-Key":"26fit-team-"+createHash("sha256").update(tokenHash).digest("hex")
   },
   body:JSON.stringify({from:sender,to:[email],subject,html,text}),
   signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return {status:"failed",httpStatus:response.status};
  const payload=await response.json();
  return payload?.id?{status:"accepted"}:{status:"failed"};
 }catch{
  return {status:"failed"};
 }
}
