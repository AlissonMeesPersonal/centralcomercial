import {createPublicKey,verify} from "node:crypto";

// Apenas o fluxo de trabalho agendado e publicado em main pode
// solicitar uma sincronização. Nenhum segredo estático é compartilhado
// entre a Central e o GitHub Actions.
const issuer="https://token.actions.githubusercontent.com";
const audience="https://centralcomercial-eta.vercel.app/api/cron/microsoft-calendar";
const repository="AlissonMeesPersonal/centralcomercial";
const ref="refs/heads/main";
const workflow=repository+"/.github/workflows/sync-microsoft-calendar.yml@"+ref;

const decode=part=>JSON.parse(Buffer.from(part,"base64url").toString("utf8"));

export async function githubCronAuthorized(token){
 if(typeof token!=="string"||token.length>15000||token.length<100)return false;
 const parts=token.split(".");
 if(parts.length!==3||parts.some(x=>!/^[A-Za-z0-9_-]+$/.test(x)))return false;
 let header,claims;
 try{header=decode(parts[0]);claims=decode(parts[1]);}
 catch{return false;}
 const now=Math.floor(Date.now()/1000);
 if(header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>160)return false;
 if(claims.iss!==issuer||claims.aud!==audience||claims.repository!==repository||
    claims.ref!==ref||claims.sub!=="repo:"+repository+":ref:"+ref||
    claims.workflow_ref!==workflow||
    !["schedule","workflow_dispatch"].includes(claims.event_name))return false;
 if(!Number.isFinite(claims.iat)||!Number.isFinite(claims.exp)||
    claims.iat>now+60||claims.iat<now-600||
    claims.exp<now||claims.exp>now+600||
    (claims.nbf!=null&&Number(claims.nbf)>now+60))return false;
 try{
  const response=await fetch(issuer+"/.well-known/jwks",{
   cache:"no-store",signal:AbortSignal.timeout(4500)
  });
  if(!response.ok)return false;
  const data=await response.json();
  const key=data.keys?.find(x=>x.kid===header.kid&&x.kty==="RSA");
  if(!key)return false;
  return verify("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),
   createPublicKey({key,format:"jwk"}),Buffer.from(parts[2],"base64url"));
 }catch{return false;}
}
