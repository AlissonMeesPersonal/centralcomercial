const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ROOT="https://centralcomercial-eta.vercel.app";
export function reminderEmail({title,kind,startsAt,unitName,when}){
 const date=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(startsAt));
 const heading=when==="amanha"?"Amanhã você tem um compromisso":"Seu compromisso é hoje";
 const label=kind==="prazo_demanda"?"Prazo de demanda":kind==="reuniao"?"Reunião":kind==="treinamento"?"Treinamento":kind==="visita"?"Visita":"Evento";
 const subject=(when==="amanha"?"Lembrete para amanhã: ":"Hoje: ")+title+" • 26fit";
 const html='<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f2f4f5;padding:30px 12px;font-family:Arial,sans-serif;">'+
 '<table role="presentation" style="margin:auto;background:white;border-radius:15px;border:1px solid #e7ebee;max-width:550px;width:100%;border-collapse:separate;border-spacing:0;overflow:hidden"><tr><td style="background:#1c2023;padding:22px 29px;border-top:5px solid #ef8937">'+
 '<img src="'+ROOT+'/logo_v2.png" width="95" height="52" alt="26fit" style="display:inline-block;vertical-align:middle"><span style="color:white;font-size:18px;font-weight:700;vertical-align:middle;margin-left:13px">Central Comercial</span></td></tr><tr><td style="padding:30px">'+
 '<span style="color:#a86633;background:#fff1e5;padding:8px 11px;border-radius:7px;font-size:11px;font-weight:700">'+esc(label)+'</span>'+
 '<h1 style="font-size:24px;line-height:1.3;color:#2b343b;margin:22px 0 10px">'+esc(heading)+'</h1>'+
 '<p style="font-size:14px;line-height:1.7;color:#7b8790">Você foi incluído(a) neste compromisso da rede 26fit:</p>'+
 '<h2 style="color:#323d45;font-size:17px;margin:19px 0 10px">'+esc(title)+'</h2>'+
 '<p style="font-size:14px;color:#586670;line-height:1.7"><strong>Quando:</strong> '+esc(date)+'<br><strong>Unidade:</strong> '+esc(unitName||"Rede 26fit")+'</p>'+
 '<a href="'+ROOT+'/?page=calendar" style="display:inline-block;padding:14px 20px;background:#21282e;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;margin-top:17px">Abrir calendário</a>'+
 '<p style="margin-top:28px;padding-top:17px;border-top:1px solid #e9edf0;color:#88949d;font-size:11px;line-height:1.7">Mensagem automática da 26fit • Central Comercial. Se você não reconhece este compromisso, consulte a equipe de gestão.</p>'+
 '</td></tr></table></body></html>';
 const text=heading+"\n"+label+": "+title+"\nQuando: "+date+"\nUnidade: "+(unitName||"Rede 26fit")+"\n"+ROOT+"/?page=calendar";
 return {subject,html,text};
}
