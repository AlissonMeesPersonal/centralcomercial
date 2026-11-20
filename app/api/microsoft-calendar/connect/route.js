import {NextResponse} from "next/server";
import {randomBytes,createHash} from "node:crypto";
import {getAccess} from "../../../../lib/access";
import {configured,redirectUri,scopes} from "../../../../lib/microsoft-calendar";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request){
 const access=await getAccess();
 if(!access.signedIn||!access.allowed)return NextResponse.redirect(new URL("/auth/sign-in",request.url));
 if(!configured())return NextResponse.redirect(new URL("/?ms=not_configured",request.url));
 const state=randomBytes(32).toString("base64url"),verifier=randomBytes(48).toString("base64url");
 const challenge=createHash("sha256").update(verifier).digest("base64url");
 const params=new URLSearchParams({client_id:process.env.MICROSOFT_CLIENT_ID,response_type:"code",
  redirect_uri:redirectUri,response_mode:"query",scope:scopes,state,code_challenge:challenge,code_challenge_method:"S256",prompt:"select_account"});
 const redirect=NextResponse.redirect("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?"+params.toString());
 // Cookies independentes evitam serialização incorreta do objeto OAuth.
 // O vínculo de usuário é validado pelo hash do e-mail verificado na sessão.
 const options={httpOnly:true,secure:true,sameSite:"lax",path:"/api/microsoft-calendar",maxAge:600};
 redirect.cookies.set("cc_ms_state_v2",state,options);
 redirect.cookies.set("cc_ms_verifier_v2",verifier,options);
 redirect.cookies.set("cc_ms_owner_v2",createHash("sha256").update(access.email).digest("hex"),options);
 redirect.cookies.set("cc_ms_oauth","",{...options,maxAge:0});
 return redirect;
}