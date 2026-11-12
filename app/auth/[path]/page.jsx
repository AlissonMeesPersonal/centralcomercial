import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";
import { redirect, notFound } from "next/navigation";
import { findInvite } from "../../../lib/invitations";
export const dynamic="force-dynamic";
export default async function AuthPage({params,searchParams}){
 const {path}=await params;
 const {convite}=await searchParams;
 if(!Object.values(authViewPaths).includes(path))notFound();
 if(path==="sign-up" && !(await findInvite(convite))) redirect("/auth/sign-in");
 return <main className="auth-page"><div className="auth-shell">
 <header className="auth-brand"><img src="/logo_v2.png" alt="26fit" width="94" height="51"/>
 <div><strong>Central Comercial</strong><small>Acesso privado à rede 26fit</small></div></header>
 <AuthView path={path}/>
 {path==="sign-in"&&<p className="auth-invite-hint">Novos acessos são liberados por convite da gestão.</p>}
 </div></main>;
}
