/**
 * Consolidação mensal do churn da Central Comercial.
 * "Base acumulada" significa soma das bases mensais (alunos-mês),
 * NÃO a quantidade de alunos únicos durante o período.
 *
 * O relatório original exibe 11,9% para Santa Cruz (jan-out/2026).
 * A fórmula do sistema de origem não foi disponibilizada.
 * Para comparação visual usamos a APROXIMAÇÃO:
 * saídas / (soma das bases iniciais + metade das entradas).
 * A taxa simples segue disponível separadamente, sem ambiguidade.
 */
export const count=(n)=>Number.isFinite(Number(n))?Number(n):0;
export const simpleChurn=(base,exits)=>base>0?exits/base*100:null;
export const periodApproxChurn=(base,entries,exits,months)=>{
  if(base<=0)return null;
  return months>1?exits/(base+entries/2)*100:exits/base*100;
};
export const periodGrowth=(base,entries,exits)=>base>0?(entries-exits)/base*100:null;
export const rangeKey=(year,i)=>year+"-"+String(i+1).padStart(2,"0");
export function aggregateMonths(rows){
 const byUnit=new Map();
 for(const row of rows){
  let x=byUnit.get(row.unit_id);
  if(!x){
   x={unit_id:row.unit_id,month:row.month,monthCount:0,active_start:0,total_entries:0,
    total_exits:0,cancellations:0,cancelled_count:0,expired:0,dropouts:0,suspended:0,
    enrollments:0,reactivations:0,renewals:0,suspension_returns:0,active_end:null,
    firstMonth:null,lastMonth:null,firstActive:null,lastActive:null,source:row.source||"manual"};
   byUnit.set(row.unit_id,x);
  }
  x.monthCount++;
  x.active_start+=count(row.active_start);
  x.total_entries+=count(row.total_entries??row.enrollments);
  x.total_exits+=count(row.total_exits??row.cancellations);
  x.cancellations=x.total_exits;
  x.cancelled_count+=count(row.cancelled_count??row.cancellations);
  x.expired+=count(row.expired);
  x.dropouts+=count(row.dropouts);
  x.suspended+=count(row.suspended);
  x.enrollments+=count(row.enrollments);
  x.reactivations+=count(row.reactivations);
  x.renewals+=count(row.renewals);
  x.suspension_returns+=count(row.suspension_returns);
  if(x.firstMonth===null||row.month<x.firstMonth){x.firstMonth=row.month;x.firstActive=count(row.active_start);}
  if(x.lastMonth===null||row.month>x.lastMonth){
   x.lastMonth=row.month;x.lastActive=row.active_end===null?null:count(row.active_end);x.active_end=x.lastActive;
  }
 }
 for(const x of byUnit.values()){
  x.churn=periodApproxChurn(x.active_start,x.total_entries,x.total_exits,x.monthCount);
  x.simpleChurn=simpleChurn(x.active_start,x.total_exits);
  x.growth=x.total_entries-x.total_exits;
  x.growthPct=periodGrowth(x.active_start,x.total_entries,x.total_exits);
 }
 return [...byUnit.values()];
}
export function totalize(rows){
 return rows.reduce((x,row)=>{
  x.active_start+=count(row.active_start);
  x.total_entries+=count(row.total_entries??row.enrollments);
  x.total_exits+=count(row.total_exits??row.cancellations);
  x.cancelled_count+=count(row.cancelled_count??row.cancellations);
  x.expired+=count(row.expired);
  x.dropouts+=count(row.dropouts);
  x.suspended+=count(row.suspended);
  return x;
 },{active_start:0,total_entries:0,total_exits:0,cancelled_count:0,expired:0,dropouts:0,suspended:0});
}
