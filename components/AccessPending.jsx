import Link from "next/link";
export function AccessPending({state}) {
 const stateMap={
  unavailable:["Serviço temporariamente indisponível","Não foi possível confirmar as permissões. Seus dados permanecem protegidos. Tente novamente mais tarde."],
  unverified:["Confirme seu e-mail","Para liberar o acesso, confirme seu e-mail pelo código enviado durante o login."],
  invited:["Convite recebido","Seu e-mail já está autorizado. Confirme que deseja ativar sua conta na Central Comercial."],
  pending:["Aguardando autorização","Sua conta ainda não foi cadastrada por um administrador. Solicite um convite à gestão da rede."],
  suspended:["Acesso suspenso","Seu acesso foi desativado pela gestão. Entre em contato com o administrador."]
 };
 const [title,description]=stateMap[state]||stateMap.pending;
 return <main className="access-page"><section className="access-panel">
 <img src="/logo_v2.png" alt="26fit" width="110" height="59"/>
 <div className="access-divider"/>
 <h1>{title}</h1><p>{description}</p>
 {state==="invited"&&<form method="post" action="/api/team/activate"><button className="btn" type="submit">Ativar minha conta</button></form>}
 {state==="unverified"&&<Link className="btn" href="/auth/sign-in">Entrar com código por e-mail</Link>}
 {state!=="unavailable"&&<Link className="btn secondary" href="/auth/sign-out">Sair da conta</Link>}
 {state==="unavailable"&&<Link className="btn secondary" href="/">Tentar novamente</Link>}
 </section></main>;
}
