"use client";
import {useEffect,useMemo,useState} from "react";
import {Activity,ArrowRight,ArrowUpRight,Building2,RefreshCw,TrendingDown,TrendingUp,AlertCircle} from "lucide-react";

const nf=new Intl.NumberFormat("pt-BR");
const rateFormat=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
const pointsFormat=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
const monthLabel=value=>{
 if(!/^\d{4}-\d{2}$/.test(String(value||"")))return "Não informado";
 const [year,month]=value.split("-").map(Number);
 return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));
};
const shortMonth=value=>monthLabel(value).split(" de ")[0].slice(0,3).toUpperCase();
const pct=value=>value===null||!Number.isFinite(value)?"Não informado":rateFormat.format(value)+"%";

export default function ChurnOverview({onOpen}){
 const [reload,setReload]=useState(0);
 const [result,setResult]=useState({loading:true,data:null,error:""});
 useEffect(()=>{
  const controller=new AbortController();
  setResult(prev=>({...prev,loading:true,error:""}));
  fetch("/api/churn/overview",{cache:"no-store",credentials:"same-origin",signal:controller.signal})
   .then(async response=>{
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.error||"Não foi possível consultar o relatório.");
    return body;
   })
   .then(data=>{if(!controller.signal.aborted)setResult({loading:false,data,error:""});})
   .catch(error=>{if(!controller.signal.aborted)setResult({loading:false,data:null,error:error.message||"Não foi possível consultar o relatório."});});
  return ()=>controller.abort();
 },[reload]);

 const data=result.data;
 const latest=data?.latest;
 const trend=data?.trend||[];
 const change=latest&&data?.previous?.churnPct!=null&&latest.churnPct!=null
  ?latest.churnPct-data.previous.churnPct:null;
 const maxBar=useMemo(()=>Math.max(1,...trend.map(x=>Number(x.churnPct)||0)),[trend]);

 return <section className="cc-overview-churn" aria-label="Resumo do churn comercial">
  <div className="cc-overview-churn-head">
   <div className="cc-overview-churn-heading">
    <span className="cc-overview-churn-icon"><Activity size={18}/></span>
    <div>
     <div className="cc-overview-eyebrow">RETENÇÃO E MOVIMENTAÇÃO</div>
     <h3>Churn {data?.scope==="unidades"?"das minhas unidades":"da rede"}</h3>
    </div>
    {latest&&<span className="cc-overview-period">{monthLabel(latest.month)}</span>}
   </div>
   <button className="cc-overview-go" onClick={onOpen} type="button">
    Análise completa <ArrowUpRight size={16}/>
   </button>
  </div>
  {result.loading?<div className="cc-overview-loading" role="status">
   <RefreshCw size={18} className="cc-overview-spinning"/> Carregando os indicadores de churn…
  </div>:result.error?<div className="cc-overview-unavailable" role="alert">
   <AlertCircle size={17}/><span>{result.error}</span>
   <button type="button" onClick={()=>setReload(x=>x+1)}>Tentar novamente</button>
  </div>:!latest?<div className="cc-overview-unavailable">
   Ainda não existem resultados de churn para as unidades disponíveis a este perfil.
   <button type="button" onClick={onOpen}>Abrir churn <ArrowRight size={14}/></button>
  </div>:<>
   <div className="cc-overview-churn-grid">
    <div className="cc-overview-rate">
     <span className="cc-overview-rate-caption">Taxa de churn no mês</span>
     <div className="cc-overview-rate-number">{pct(latest.churnPct)}</div>
     <div className={"cc-overview-variation "+(change===null?"flat":change<0?"down":change>0?"up":"flat")}>
      {change===null?"Sem mês anterior para comparar":<>
       {change<0?<TrendingDown size={15}/>:change>0?<TrendingUp size={15}/>:null}
       <strong>{change>0?"+":""}{pointsFormat.format(change)} p.p.</strong>
       <span>em relação ao mês anterior</span>
      </>}
     </div>
     <small>{data.scope==="rede"?"Taxa informada no relatório oficial":"Saídas ÷ soma das bases iniciais das unidades atribuídas"}</small>
    </div>
    <div className="cc-overview-movements">
     <h4>Movimentação de alunos</h4>
     <div className="cc-overview-movements-grid">
      <div><span><span className="cc-overview-mini-dot green"/> Entradas</span><strong>{nf.format(latest.entries)}</strong></div>
      <div><span><span className="cc-overview-mini-dot red"/> Saídas</span><strong>{nf.format(latest.exits)}</strong></div>
      <div><span><span className="cc-overview-mini-dot orange"/> Saldo do mês</span>
       <strong className={latest.netChange>=0?"cc-overview-positive":"cc-overview-negative"}>{latest.netChange>0?"+":""}{nf.format(latest.netChange)}</strong></div>
     </div>
     <p>{data.scope==="rede"?"Totais do rodapé do último relatório importado.":"Dados das unidades atribuídas ao seu perfil."}</p>
    </div>
    <div className="cc-overview-evolution">
     <div className="cc-overview-block-head"><h4>Churn nos últimos meses</h4><span>{trend.length} competências</span></div>
     <div className="cc-overview-bars" role="img" aria-label={"Evolução mensal do churn: "+trend.map(x=>shortMonth(x.month)+" "+pct(x.churnPct)).join(", ")}>
      {trend.map((x,i)=><div className="cc-overview-bar" key={x.month}>
       <span className="cc-overview-bar-number">{pct(x.churnPct)}</span>
       <div className="cc-overview-bar-track"><span className={i===trend.length-1?"current":""}
        style={{height:((x.churnPct||0)>0?Math.max(4,100*x.churnPct/maxBar):0)+"%"}}/></div>
       <span className="cc-overview-bar-month">{shortMonth(x.month)}</span>
      </div>)}
     </div>
    </div>
    <div className="cc-overview-attention">
     <div className="cc-overview-block-head"><h4>Maiores taxas por unidade</h4><Building2 size={16}/></div>
     <div className="cc-overview-attention-list">
      {data.highlights?.length?data.highlights.map(unit=><div key={unit.unitId} className="cc-overview-attention-item">
       <div><strong>{unit.name}</strong><small>Churn {String(unit.code).padStart(2,"0")} · Base: {nf.format(unit.base)}</small></div>
       <b>{pct(unit.churnPct)}</b>
      </div>):<p>Sem unidades com base suficiente neste mês.</p>}
     </div>
     <small className="cc-overview-attention-note">Comparação de unidades com pelo menos 50 alunos na base inicial.</small>
    </div>
   </div>
  </>}
 </section>;
}
