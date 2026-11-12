import {createPublicKey,verify as verifySignature} from "node:crypto";
import {renderAuthEmail} from "../../../lib/emails/central-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export const maxDuration=15;

// Este endpoint só deve ser ativado na configuração de webhooks do Neon
// DEPOIS de configurar RESEND_API_KEY e AUTH_EMAIL_FROM em produção.
// Sem provedor, devolve 503 em vez de fingir que um código foi enviado.
const reject=(status)=>new Response(null,{status,headers:{"Cache-Control":"no-store"}});

async function verifyNeonSignature(raw,headers){
 const signature=headers.get("x-neon-signature");
 const kid=headers.get("x-neon-signature-kid");
 const stamp=headers.get("x-neon-timestamp");
 const type=headers.get("x-neon-event-type");
 if(!signature||!kid||!stamp||!type)return null;
 if(!/^\d{13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>300000)return null;
 if(!["send.otp","send.magic_link"].includes(type))return null;
 const parts=signature.split(".");
 if(parts.length!==3||parts[1]!==""||!parts[0]||!parts[2])return null;
 let header;
 try{header=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));}
 catch{return null;}
 if(header.alg!=="EdDSA"||header.kid!==kid)return null;
 const authUrl=process.env.NEON_AUTH_BASE_URL;
 if(!authUrl||!authUrl.startsWith("https://"))return null;
 const jwksResponse=await fetch(authUrl.replace(/\/$/,"")+"/.well-known/jwks.json",{
  cache:"no-store",signal:AbortSignal.timeout(2200)
 });
 if(!jwksResponse.ok)return null;
 const jwks=await jwksResponse.json();
 const key=jwks.keys?.find(item=>item.kid===kid&&item.kty==="OKP"&&item.crv==="Ed25519");
 if(!key)return null;
 const publicKey=createPublicKey({key,format:"jwk"});
 const bodyB64=Buffer.from(raw,"utf8").toString("base64url");
 const signedContent=Buffer.from(stamp+"."+bodyB64,"utf8").toString("base64url");
 const signingInput=parts[0]+"."+signedContent;
 const ok=verifySignature(null,Buffer.from(signingInput),publicKey,Buffer.from(parts[2],"base64url"));
 if(!ok)return null;
 let payload;
 try{payload=JSON.parse(raw);}catch{return null;}
 if(payload?.event_type!==type||payload?.event_id!==headers.get("x-neon-event-id"))return null;
 if(typeof payload?.event_id!=="string"||!(/^[a-zA-Z0-9-]{20,80}$/).test(payload.event_id))return null;
 return payload;
}
export async function POST(request){
 if(!process.env.RESEND_API_KEY||!process.env.AUTH_EMAIL_FROM)return reject(503);
 const length=Number(request.headers.get("content-length")||0);
 if(length>65536)return reject(413);
 let raw;
 try{raw=await request.text();}catch{return reject(400);}
 if(Buffer.byteLength(raw)>65536)return reject(413);
 let event;
 try{event=await verifyNeonSignature(raw,request.headers);}
 catch{return reject(503);}
 if(!event)return reject(401);
 if(event.event_data?.delivery_preference==="sms")return reject(400);
 const to=String(event.user?.email||"").trim().toLowerCase();
 if(to.length>255||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return reject(422);
 let message;
 try{
  if(event.event_type==="send.otp"){
   message=renderAuthEmail({
    kind:event.event_data?.otp_type||"sign-in",
    code:event.event_data?.otp_code,
    expiresAt:event.event_data?.expires_at,
    name:event.user?.name
   });
  }else if(event.event_type==="send.magic_link"){
   message=renderAuthEmail({
    kind:event.event_data?.link_type||"sign-in",
    url:event.event_data?.link_url,
    expiresAt:event.event_data?.expires_at,
    name:event.user?.name
   });
  }else{return reject(400);}
 }catch{return reject(422);}
 try{
  const resp=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{
    "Content-Type":"application/json",
    Authorization:"Bearer "+process.env.RESEND_API_KEY,
    "Idempotency-Key":"neon-auth-"+event.event_id
   },
   body:JSON.stringify({
    from:process.env.AUTH_EMAIL_FROM,
    to:[to],
    subject:message.subject,
    html:message.html,
    text:message.text
   }),
   signal:AbortSignal.timeout(6000)
  });
  if(!resp.ok)return reject(503);
  return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
 }catch{return reject(503);}
}
