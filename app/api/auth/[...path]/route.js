import { auth } from "../../../../lib/auth/server";
import {hasPendingInviteEmail} from "../../../../lib/invitations";
export const runtime="nodejs";export const dynamic="force-dynamic";
const handlers=auth.handler();
export const GET=handlers.GET;
// O endpoint de cadastro da nossa aplicação só aceita emails previamente
// convidados. O provedor externo também exige confirmação do email;
// nenhuma conta sem papel ativo pode acessar dados da Central.
export async function POST(request,context) {
 const path=new URL(request.url).pathname;
 if(/\/sign-up\/email\/?$/.test(path)){
  let data;
  try{data=await request.clone().json();}catch{return Response.json({message:"Cadastro inválido."},{status:400});}
  const allowed=await hasPendingInviteEmail(data?.email);
  if(!allowed)return Response.json({message:"É necessário receber um convite da gestão para criar uma conta."},{status:403});
 }
 return handlers.POST(request,context);
}
