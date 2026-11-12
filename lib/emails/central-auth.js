// Template HTML da 26fit • Central Comercial para emails transacionais.
// Layout em tabelas e CSS inline: compatível com Gmail, Outlook e celulares.
// Nunca armazene nem registre códigos, tokens ou links de autenticação.
const ROOT="https://centralcomercial-eta.vercel.app";
const BRAND="26fit • Central Comercial";

const htmlEscape=(value)=>String(value??"").replace(/[&<>"']/g,(s)=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[s]);

const options={
 "sign-in":{
   subject:"Seu código de acesso • 26fit",
   headline:"Seu código de acesso",
   lead:"Recebemos uma solicitação para entrar na Central Comercial.",
   action:"Use o código abaixo para continuar com segurança."
 },
 "email-verification":{
   subject:"Confirme seu e-mail • 26fit",
   headline:"Confirme seu e-mail",
   lead:"Seu acesso à Central Comercial está quase pronto.",
   action:"Digite o código abaixo para confirmar que este endereço pertence a você."
 },
 "forget-password":{
   subject:"Recuperação de acesso • 26fit",
   headline:"Recupere seu acesso",
   lead:"Recebemos uma solicitação para recuperar o acesso à sua conta.",
   action:"Use o código abaixo para continuar a recuperação com segurança."
 }
};

export function renderAuthEmail({kind="sign-in",code=null,url=null,name=null,expiresAt=null}={}){
 const info=options[kind]||options["sign-in"];
 const isLink=!!url;
 if(!isLink && !/^[0-9]{4,10}$/.test(String(code||"")))throw Error("Código temporário inválido.");
 if(isLink){
  const dest=new URL(String(url));
  if(dest.protocol!=="https:"||dest.username||dest.password)throw Error("Link de confirmação inválido.");
 }
 const safeCode=htmlEscape(code);
 const safeURL=isLink?htmlEscape(String(url)):null;
 const safeName=htmlEscape(name ? String(name).trim().split(/\s+/)[0].slice(0,60) : "");
 const greeting=safeName?"Olá, "+safeName+"!":"Olá!";
 const remaining=expiresAt?Math.ceil((new Date(expiresAt).getTime()-Date.now())/60000):null;
 const expiry=Number.isFinite(remaining)&&remaining>0
   ?"Este acesso expira em aproximadamente "+remaining+" minuto"+(remaining===1?"":"s")+"."
   :"Este código ou link é temporário e tem validade limitada.";
 const subject=isLink
  ?kind==="forget-password"?"Redefina sua senha • 26fit"
    :kind==="email-verification"?"Confirme seu e-mail • 26fit":"Seu link de acesso • 26fit"
  :info.subject;
 const title=isLink?kind==="forget-password"?"Redefina sua senha":kind==="email-verification"?"Confirme seu e-mail":"Acesse a Central Comercial":info.headline;
 const intro=isLink?"Use o botão abaixo para continuar com segurança.":info.action;
 const action=isLink
  ?'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 27px;width:100%;"><tr><td align="center">'+
    '<a href="'+safeURL+'" style="display:inline-block;background-color:#ef862f;color:#171b1e;text-decoration:none;font-weight:800;letter-spacing:.2px;font-family:Arial,Helvetica,sans-serif;font-size:14px;border-radius:9px;padding:17px 27px;">'+
    (kind==="forget-password"?"Redefinir minha senha":kind==="email-verification"?"Confirmar meu e-mail":"Entrar na Central")+
    '</a></td></tr></table><p style="font-size:12px;line-height:1.7;color:#7e8993;margin:0 0 14px;">Se o botão não funcionar, copie este endereço no navegador:</p>'+
    '<p style="font-size:11px;line-height:1.7;word-break:break-all;margin:0 0 20px;color:#435260;">'+safeURL+'</p>'
  :'<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:26px auto 26px;"><tr><td align="center" style="border:1px solid #dce1e5;background-color:#f5f7f8;border-radius:11px;padding:21px 31px;">'+
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:35px;line-height:1.2;letter-spacing:8px;font-weight:800;color:#232a30;white-space:nowrap;">'+safeCode+'</div>'+
    '</td></tr></table>';
 const html=[
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="color-scheme" content="light"><title>'+htmlEscape(subject)+'</title>',
  '</head><body style="margin:0;padding:0;background-color:#f2f4f5;font-family:Arial,Helvetica,sans-serif;color:#242d34;">',
  '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">',
  htmlEscape(title)+' — mensagem de segurança da Central Comercial 26fit.</div>',
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#f2f4f5;">',
  '<tr><td align="center" style="padding:42px 14px;">',
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:separate;border-spacing:0;background:#fff;border-radius:15px;overflow:hidden;border:1px solid #e6e9eb;">',
  '<tr><td style="height:5px;background-color:#f3872e;font-size:0;line-height:0;">&nbsp;</td></tr>',
  '<tr><td align="left" bgcolor="#1b2024" style="background:#1b2024;padding:27px 34px;">',
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
  '<td style="vertical-align:middle;"><img width="90" height="50" alt="26fit" src="'+ROOT+'/logo_v2.png" style="display:block;width:90px;height:50px;object-fit:contain;border:0;"></td>',
  '<td style="vertical-align:middle;padding-left:17px;">',
  '<div style="font-size:17px;font-weight:800;line-height:1.25;color:#ffffff;">Central Comercial</div>',
  '<div style="font-size:10px;letter-spacing:1.4px;font-weight:700;line-height:1.5;color:#b3bcc3;margin-top:4px;">GESTÃO COMERCIAL 26FIT</div>',
  '</td></tr></table></td></tr>',
  '<tr><td style="padding:37px 35px 13px;">',
  '<div style="display:inline-block;background:#fff3e9;color:#a65a21;border-radius:30px;padding:7px 11px;font-weight:800;font-size:10px;letter-spacing:1px;margin-bottom:19px;">ACESSO SEGURO</div>',
  '<h1 style="font-family:Arial,Helvetica,sans-serif;font-size:27px;letter-spacing:-.6px;line-height:1.2;color:#252e35;margin:0 0 21px;font-weight:800;">'+htmlEscape(title)+'</h1>',
  '<p style="font-size:15px;font-weight:700;line-height:1.6;color:#39454d;margin:0 0 8px;">'+greeting+'</p>',
  '<p style="font-size:14px;line-height:1.8;color:#606d76;margin:0 0 9px;">'+htmlEscape(info.lead)+'</p>',
  '<p style="font-size:14px;line-height:1.75;color:#606d76;margin:0;">'+htmlEscape(intro)+'</p>',
  action,
  '<div style="background-color:#f7f9fa;border:1px solid #e9edf0;border-radius:9px;padding:14px 16px;margin:0 0 26px;">',
  '<p style="margin:0;font-size:12px;line-height:1.6;color:#56636d;"><strong style="color:#3b4851;">Prazo de segurança.</strong> '+htmlEscape(expiry)+'</p>',
  '</div>',
  '<div style="height:1px;background:#e9edef;margin:0 0 23px;"></div>',
  '<p style="font-size:12px;line-height:1.8;color:#8a959d;margin:0 0 23px;">Se você não solicitou esta ação, ignore esta mensagem. Nunca compartilhe códigos ou links de acesso, nem mesmo com colaboradores da 26fit.</p>',
  '</td></tr>',
  '<tr><td style="padding:21px 35px 27px;background-color:#fafbfc;border-top:1px solid #edf0f2;">',
  '<p style="font-size:11px;line-height:1.8;color:#7a8790;margin:0;"><strong style="color:#4c5861;">26fit • Central Comercial</strong><br>Comunicação automática de segurança. Não responda a este e-mail.</p>',
  '</td></tr></table>',
  '<p style="font-size:11px;line-height:1.7;color:#9aa5ad;margin:23px 10px 0;text-align:center;">Uso interno da rede 26fit. &copy; '+new Date().getFullYear()+' 26fit.</p>',
  '</td></tr></table></body></html>'
 ].join("");
 const text=[
  BRAND,
  title,
  greeting,
  info.lead,
  intro,
  isLink?"Acesse: "+url:"Código: "+code,
  expiry,
  "Se você não solicitou esta ação, ignore esta mensagem.",
  "Nunca compartilhe códigos ou links de acesso.",
  "Mensagem automática de segurança da rede 26fit."
 ].join("\n\n");
 return {subject,html,text};
}
