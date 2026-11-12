import { neon } from "@neondatabase/serverless";
import { auth } from "./auth/server";
export function database(){
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL não configurada");
 return neon(process.env.DATABASE_URL);
}
export async function getEditor(){
 const result=await auth.getSession();
 const current=result?.data??result;
 const user=current?.user;
 if(!user?.email||!user?.id)return {signedIn:false,canEdit:false};
 if(user.emailVerified!==true)return {signedIn:true,canEdit:false,needsVerification:true};
 const email=user.email.trim().toLowerCase();
 const roles=await database().query("SELECT role FROM cc_unit_roles WHERE lower(email)=$1 LIMIT 1",[email]);
 const role=roles[0]?.role??null;
 return {signedIn:true,canEdit:role==="admin"||role==="gestor",email,role};
}
const clean=(x,limit=550)=>x===null||x===undefined||String(x).trim()===""?null:String(x).trim().slice(0,limit);
const link=value=>{const v=clean(value,2000);if(!v)return null;try{const url=new URL(v);return url.protocol==="https:"&&!url.username&&!url.password?url.href:null}catch{return null}};
const regions={RS:"Sul",SC:"Sul",PR:"Sul",SP:"Sudeste",RJ:"Sudeste",MG:"Sudeste",ES:"Sudeste",MT:"Centro-Oeste",MS:"Centro-Oeste",GO:"Centro-Oeste",DF:"Centro-Oeste",PA:"Norte",AM:"Norte",RR:"Norte",RO:"Norte",AC:"Norte",AP:"Norte",TO:"Norte",BA:"Nordeste",CE:"Nordeste",PE:"Nordeste",PB:"Nordeste",PI:"Nordeste",RN:"Nordeste",AL:"Nordeste",SE:"Nordeste",MA:"Nordeste"};
export function normalizeUnit(raw,id){
 const state=clean(raw.state,2)?.toUpperCase();
 const record={
  id,name:clean(raw.name,150),administrativeName:clean(raw.administrativeName,150),
  type:clean(raw.type,50)||"Unidade",status:clean(raw.status,50)||"Aberta",
  state,region:regions[state]||null,city:clean(raw.city,100),cnpj:clean(raw.cnpj,30),
  leader:clean(raw.leader,130),leaderContact:clean(raw.leaderContact,40),
  coordinator:clean(raw.coordinator,130),coordinatorContact:clean(raw.coordinatorContact,40),
  address:clean(raw.address),cep:clean(raw.cep,20),street:clean(raw.street,200),
  number:clean(raw.number,20),complement:clean(raw.complement,150),
  mapUrl:link(raw.mapUrl),siteUrl:link(raw.siteUrl),source:clean(raw.source,60)||"cadastro interno",demo:false
 };
 if(!record.name||!record.city||!state||!(/^[A-Z]{2}$/).test(state))throw Error("Preencha nome, cidade e UF válidos.");
 if(record.cnpj&&!(/^[0-9./-]{14,20}$/).test(record.cnpj))throw Error("CNPJ em formato inválido.");
 return record;
}
