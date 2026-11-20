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
 redirect.cookies.set("cc_ms_oauth",{value:JSON.stringify({state,verifier,email:access.email}),httpOnly:true,secure:true,sameSite:"lax",path:"/api/microsoft-calendar",maxAge:600});
 return redirect;
}