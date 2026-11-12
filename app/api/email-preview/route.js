import {getAccess} from "../../../lib/access";
import {renderAuthEmail} from "../../../lib/emails/central-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request){
 let access;
 try{access=await getAccess();}
 catch{return new Response("Prévia indisponível.",{status:503});}
 if(!access.allowed||!["developer","admin","gestor"].includes(access.role)){
  return new Response("Acesso restrito à gestão da Central Comercial.",{status:403,headers:{"Cache-Control":"no-store"}});
 }
 const type=new URL(request.url).searchParams.get("type")||"otp";
 const samples={
  otp:{kind:"sign-in",code:"123456",name:"Colaborador",expiresAt:new Date(Date.now()+10*60*1000).toISOString()},
  verification:{kind:"email-verification",code:"123456",name:"Colaborador",expiresAt:new Date(Date.now()+10*60*1000).toISOString()},
  reset:{kind:"forget-password",code:"123456",name:"Colaborador",expiresAt:new Date(Date.now()+10*60*1000).toISOString()},
  link:{kind:"sign-in",url:"https://centralcomercial-eta.vercel.app/auth/sign-in",name:"Colaborador",expiresAt:new Date(Date.now()+10*60*1000).toISOString()}
 };
 if(!Object.hasOwn(samples,type))return new Response("Tipo não encontrado.",{status:404});
 const rendered=renderAuthEmail(samples[type]);
 return new Response(rendered.html,{
  status:200,
  headers:{
   "Content-Type":"text/html; charset=utf-8",
   "Cache-Control":"private, no-store, max-age=0",
   "X-Content-Type-Options":"nosniff",
   "X-Robots-Tag":"noindex,nofollow",
   "Content-Security-Policy":"default-src 'none'; img-src 'self' https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }
 });
}
