import OpportunityImporter from "../../../components/OpportunityImporter";
import MultifilialImporter from "../../../components/MultifilialImporter";
export const metadata={
 title:"Envio de levantamento | Central Comercial 26fit",
 robots:{index:false,follow:false},
 referrer:"no-referrer"
};
export const dynamic="force-dynamic";
export default async function Page({params}){
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{40,80}$/.test(token||""))return <main className="cc-op-public"><section className="panel"><h1>Link inválido</h1><p>Solicite um novo link à administração.</p></section></main>;
 return <main className="cc-op-public"><div className="cc-op-public-brand"><strong>26<span>fit</span></strong><small>Central Comercial</small></div>
  <section className="panel"><h1>Atualizar levantamento comercial</h1>
   <p>Envie a planilha original Vendas Multifiliais (.xlsx). O sistema soma automaticamente as unidades e gera o consolidado de vendas da rede. Este arquivo não contém oportunidades nem vendas discriminadas por dia, portanto não permite calcular a conversão diária do modelo anterior.</p>
   <MultifilialImporter token={token}/>
   <details style={{marginTop:24}}><summary>Tenho outra planilha com oportunidades e vendas por dia</summary><div style={{paddingTop:16}}><OpportunityImporter token={token}/></div></details>
   <p className="cc-op-note">Este link permite somente enviar o levantamento. Ele não dá acesso às demandas, aos usuários ou ao restante da Central.</p>
  </section>
 </main>;
}