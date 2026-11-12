"use client";

import {useMemo,useState} from "react";
import {Building2,Search,ChevronDown,MapPin,CheckSquare2} from "lucide-react";

const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const stateNames={
 AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",
 ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",
 MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",
 RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",
 RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins"
};
const preferredOrder=["RS","SC","PR","SP","MT","PA","PI"];

export default function CampaignUnitSelector({units=[],selectedIds=[],onChange}){
 const [search,setSearch]=useState("");
 const [openedStates,setOpenedStates]=useState([]);
 const selected=useMemo(()=>new Set(selectedIds),[selectedIds]);

 // Diretório das unidades 26fit, não a tabela de contas de colaboradores.
 // Inclui unidades próprias, franquias e inaugurações; exclui apenas
 // a matriz, a marca Eleve e registros identificados como fictícios.
 const networkUnits=useMemo(()=>{
  const byId=new Map();
  for(const unit of units){
   if(!unit?.id||unit.demo||unit.type==="Matriz"||unit.type==="Eleve")continue;
   if(!normalize(unit.name).startsWith("26fit "))continue;
   byId.set(unit.id,unit);
  }
  return [...byId.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
 },[units]);

 const groups=useMemo(()=>{
  const byState=new Map();
  for(const unit of networkUnits){
   const state=(unit.state||"").toUpperCase().trim()||"SEM_UF";
   if(!byState.has(state))byState.set(state,[]);
   byState.get(state).push(unit);
  }
  return [...byState.entries()].sort(([a],[b])=>{
   const aOrder=preferredOrder.indexOf(a),bOrder=preferredOrder.indexOf(b);
   if(aOrder>=0&&bOrder>=0)return aOrder-bOrder;
   if(aOrder>=0)return -1;
   if(bOrder>=0)return 1;
   return (stateNames[a]||a).localeCompare(stateNames[b]||b,"pt-BR");
  }).map(([state,items])=>({state,label:stateNames[state]||"Sem estado informado",items}));
 },[networkUnits]);

 const matches=unit=>normalize([unit.name,unit.city,unit.state,unit.address].filter(Boolean).join(" ")).includes(normalize(search));
 const visibleGroups=groups.map(group=>({...group,visible:group.items.filter(matches)})).filter(group=>group.visible.length>0);
 const currentSelected=networkUnits.filter(unit=>selected.has(unit.id)).length;
 const allSelected=networkUnits.length>0&&currentSelected===networkUnits.length;

 function toggleOne(id,checked){
  const next=new Set(selectedIds);
  if(checked)next.add(id);else next.delete(id);
  onChange([...next]);
 }
 function toggleState(group){
  const next=new Set(selectedIds);
  const all=group.items.every(unit=>next.has(unit.id));
  for(const unit of group.items)if(all)next.delete(unit.id);else next.add(unit.id);
  onChange([...next]);
 }
 function toggleAll(){
  const next=new Set(selectedIds);
  if(allSelected){
   for(const unit of networkUnits)next.delete(unit.id);
  }else{
   for(const unit of networkUnits)next.add(unit.id);
  }
  onChange([...next]);
 }
 function toggleOpen(state){
  setOpenedStates(previous=>previous.includes(state)?previous.filter(item=>item!==state):[...previous,state]);
 }

 return <section className="campaign-unit-selector" aria-label="Unidades participantes por estado">
  <div className="campaign-unit-summary">
   <span><Building2 size={16}/> {networkUnits.length} unidades da rede · {groups.length} estados</span>
   <strong>{currentSelected} selecionada(s)</strong>
  </div>
  <div className="campaign-unit-controls">
   <label className="campaign-unit-search">
    <Search size={16}/>
    <input aria-label="Buscar unidades 26fit" placeholder="Pesquisar unidade, cidade ou estado" value={search} onChange={event=>setSearch(event.target.value)}/>
   </label>
   <button type="button" className="btn secondary campaign-all-button" onClick={toggleAll} disabled={!networkUnits.length}>
    <CheckSquare2 size={15}/>{allSelected?"Desmarcar todas":"Selecionar todas da rede"}
   </button>
  </div>
  <p className="campaign-unit-help">Selecione uma unidade individualmente ou marque todas de um estado. Não é necessário ter usuário cadastrado na unidade.</p>
  <div className="campaign-state-groups">
   {visibleGroups.map(group=>{
    const total=group.items.length;
    const checked=group.items.filter(unit=>selected.has(unit.id)).length;
    // A busca filtra a visualização, mas selecionar o estado sempre seleciona
    // TODAS as unidades daquele estado, inclusive as ocultas pela pesquisa.
    const expanded=openedStates.includes(group.state)||Boolean(search.trim());
    return <div className="campaign-state-group" key={group.state}>
     <div className="campaign-state-header">
      <button type="button" className="campaign-state-expand" aria-expanded={expanded} onClick={()=>toggleOpen(group.state)}>
       <ChevronDown size={16} className={expanded?"expanded":""}/>
       <span><strong>{group.label}</strong><small>{group.state==="SEM_UF"?"UF não informada":group.state} · {checked} de {total} selecionadas</small></span>
      </button>
      <button type="button" className="campaign-state-select" onClick={()=>toggleState(group)}>
       {checked===total?"Desmarcar todas":"Selecionar todas"}
      </button>
     </div>
     {expanded&&<div className="campaign-state-items">
      {group.visible.map(unit=><label key={unit.id} className="select-unit campaign-unit-item">
       <input type="checkbox" checked={selected.has(unit.id)} onChange={event=>toggleOne(unit.id,event.target.checked)}/>
       <div><strong>{unit.name}</strong><small><MapPin size={12}/>{unit.city||"Cidade não informada"} · {group.state==="SEM_UF"?"UF não informada":group.state}{unit.status==="Inauguração"?" · Em inauguração":""}</small></div>
      </label>)}
     </div>}
    </div>;
   })}
   {!visibleGroups.length&&<div className="empty">{networkUnits.length?"Nenhuma unidade encontrada nesta pesquisa.":"Nenhuma unidade 26fit disponível no diretório."}</div>}
  </div>
 </section>;
}
