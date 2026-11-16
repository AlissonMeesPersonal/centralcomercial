import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export const maxDuration=60;

// O Realtime nativo do Neon ainda não está disponível na região deste banco.
// Canal SSE protegido: consulta apenas o índice de auditoria, nunca transmite
// conteúdo das demandas ou dados de outros usuários.
const POLL_MS=1500;
const STREAM_MS=45000;
const headers={
 "Content-Type":"text/event-stream; charset=utf-8",
 "Cache-Control":"private, no-cache, no-store, must-revalidate, no-transform",
 "Connection":"keep-alive",
 "X-Accel-Buffering":"no",
 "Vary":"Cookie",
 "X-Content-Type-Options":"nosniff"
};

export async function GET(request){
 const access=await getAccess();
 if(!access.signedIn)return Response.json({error:"Faça login."},{status:401});
 if(!access.allowed)return Response.json({error:"Perfil não autorizado."},{status:403});
 const sql=database();
 const revision=async()=>{
  const rows=await sql.query("SELECT COALESCE(MAX(id),0)::text AS revision FROM cc_commercial_audit");
  return String(rows[0]?.revision||"0");
 };
 let last;
 try{last=await revision();}
 catch(e){
  console.error("commercial realtime initial read failed",e?.code||"unknown");
  return Response.json({error:"Sincronização temporariamente indisponível."},{status:503});
 }
 const encoder=new TextEncoder();
 let cancelled=false;
 let currentTimer=null;
 let wake=null;
 request.signal.addEventListener("abort",()=>{cancelled=true;if(currentTimer)clearTimeout(currentTimer);wake?.();},{once:true});
 const stream=new ReadableStream({
  start(controller){
   const send=(kind,payload)=>{
    if(cancelled)return;
    try{controller.enqueue(encoder.encode("event: "+kind+"\ndata: "+JSON.stringify(payload)+"\n\n"));}
    catch{cancelled=true;}
   };
   const sleep=ms=>new Promise(resolve=>{
    wake=resolve;
    currentTimer=setTimeout(()=>{currentTimer=null;wake=null;resolve();},ms);
   });
   void (async()=>{
    const began=Date.now();
    send("ready",{revision:last});
    try{
     while(!cancelled&&Date.now()-began<STREAM_MS){
      await sleep(POLL_MS);
      if(cancelled)break;
      const next=await revision();
      if(next!==last){last=next;send("change",{revision:next});}
     }
    }catch(e){
     if(!cancelled)console.error("commercial realtime stream interrupted",e?.code||"unknown");
    }finally{
     cancelled=true;
     if(currentTimer)clearTimeout(currentTimer);
     try{controller.close();}catch{}
    }
   })();
  },
  cancel(){cancelled=true;if(currentTimer)clearTimeout(currentTimer);wake?.();}
 });
 return new Response(stream,{headers});
}
