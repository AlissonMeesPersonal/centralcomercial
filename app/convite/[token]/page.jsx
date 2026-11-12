import Link from "next/link";
import {findInvite} from "../../../lib/invitations";
export const dynamic="force-dynamic";
const labels={admin:"Administradora",gestor:"Gestora comercial",lider:"Líder de unidade",colaborador:"Colaboradora"};
export default async function InvitePage({params}){
 const {token}=await params;
 let record=null;
 try{record=await findInvite(token);}catch{}
 return <main className="access-page"><section className="access-panel">
  <img src="/logo_v2.png" alt="26fit" width="110" height="60"/>
  <div className="access-divider"/>
  {record?<><div className="eyebrow">ACESSO À CENTRAL COMERCIAL</div>
   <h1>Você recebeu um convite</h1>
   <p><strong>{record.name}</strong>, a equipe da 26fit autorizou o e-mail <strong>{record.email}</strong> como <strong>{labels[record.role]||record.role}</strong>.</p>
   <p>Crie sua conta com este mesmo e-mail, confirme o código enviado e clique em “Ativar minha conta” ao entrar. Caso já tenha conta, basta fazer login.</p>
   <Link className="btn" href={"/auth/sign-up?convite="+encodeURIComponent(token)}>Criar minha conta</Link>
   <Link className="btn secondary" href="/auth/sign-in">Já tenho uma conta</Link>
   <small>Convite pessoal, válido por 7 dias. Não compartilhe este endereço.</small></>:
   <><h1>Convite indisponível</h1><p>Este convite não existe, expirou ou já foi utilizado. Solicite um novo à gestão.</p><Link className="btn secondary" href="/auth/sign-in">Voltar ao acesso</Link></>}
 </section></main>;
}
