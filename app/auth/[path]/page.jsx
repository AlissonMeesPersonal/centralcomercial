import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";
export const dynamicParams=false;
export function generateStaticParams(){return Object.values(authViewPaths).map(path=>({path}));}
export default async function AuthPage({params}){
 const {path}=await params;
 return <main className="auth-page"><div className="auth-shell">
 <header className="auth-brand"><img src="/logo_v2.png" alt="26fit" width="94" height="51"/>
 <div><strong>Central Comercial</strong><small>Acesso ao gerenciamento de unidades</small></div></header>
 <AuthView path={path}/>
 </div></main>;
}
