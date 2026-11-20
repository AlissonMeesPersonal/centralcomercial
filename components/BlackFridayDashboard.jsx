"use client";
import {useEffect,useMemo,useState} from "react";
import {readSheet} from "read-excel-file/browser";
import {BarChart3,Download,FileSpreadsheet,Link2,RefreshCcw,Search,MessageCircle,Copy,ShieldCheck,Upload,CheckCircle2,AlertTriangle,Trash2} from "lucide-react";

const fmt=n=>Number(n||0).toLocaleString("pt-BR");
const pct=(a,b)=>b?(100*a/b).toFixed(1).replace(".",",")+"%":"0,0%";
const labels={novo:"Novo",em_contato:"Em contato",interessado:"Interessado",sem_retorno:"Sem retorno",convertido:"Convertido",perdido:"Perdido"};
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
function guess(columns,words){
 return columns.findIndex(x=>words.some(re=>re.test(norm(x))));
}
function getMapping(header){
 return {timestamp:guess(header,[/carimbo/,/data.*hora/,/data.*cadastro/,/data.*envio/,/timestamp/]),
  name:guess(header,[/nome/]),phone:guess(header,[/whatsapp/,/telefone/,/celular/,/fone/]),
  unit:guess(header,[/unidade/,/filial/,/cidade/,/academia/]),
  email:guess(header,[/e-?mail/])};
}
function parseCSV(text){
 const first=(text.split(/\r?\n/)[0]||"");const delimiter=[";",",","\t"].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
 const result=[];let row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
  }else if(!quoted&&c===delimiter){row.push(field);field="";}
  else if(!quoted&&(c==="\r"||c==="\n")){
   if(c==="\r"&&text[i+1]==="\n")i++;
   row.push(field);if(row.some(x=>String(x).trim()))result.push(row);
   row=[];field="";
  }else field+=c;
 }
 row.push(field);if(row.some(x=>String(x).trim()))result.push(row);
 return result;
}
function parseDate(value){
 if(value instanceof Date)return value.toISOString();
 if(typeof value==="number"&&value>30000&&value<100000){
  const d=new Date(Date.UTC(1899,11,30)+Math.round(value*86400000));
  return d.toISOString();
 }
 const s=String(value??"").trim();
 if(!s)return "";
 const match=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
 if(match)return match[3]+"-"+match[2].padStart(2,"0")+"-"+match[1].padStart(2,"0")+"T"+(match[4]||"00").padStart(2,"0")+":"+(match[5]||"00")+":"+(match[6]||"00")+"-03:00";
 return s;
}
function cleanPhone(phone){return String(phone??"").replace(/\D/g,"");}
function makeScript(endpoint,token){
 return [
  "// 26fit Central Comercial • Captacao Black26",
  "// Execute black26fitAtivarIntegracao UMA VEZ. O script importa dados antigos e",
  "// registra o acionador para novas respostas. Nao publique este codigo.",
  'const BLACK26_API = '+JSON.stringify(endpoint)+';',
  'const BLACK26_CHAVE = '+JSON.stringify(token)+';',
  'const BLACK26_PLANILHA = "1itsdYErCGmCZ0ETjaOc0tGZoMu0H0_ZH_GiD73Pf89U";',
  'const BLACK26_ABA = "Respostas ao formulário 1";',
  "",
  "function black26fitPlanilha() {",
  "  const planilha = SpreadsheetApp.getActiveSpreadsheet();",
  "  if (planilha.getId() !== BLACK26_PLANILHA) throw new Error('Planilha diferente da autorizada.');",
  "  return planilha;",
  "}",
  "",
  "function black26fitEnviarLote(aba, inicio, quantidade) {",
  "  const planilha = black26fitPlanilha();",
  "  if (aba.getName() !== BLACK26_ABA) throw new Error('Aba de respostas inesperada.');",
  "  const largura = aba.getLastColumn();",
  "  const headers = aba.getRange(1, 1, 1, largura).getDisplayValues()[0];",
  "  const rows = aba.getRange(inicio, 1, quantidade, largura).getDisplayValues();",
  "  const rowNumbers = rows.map((r, i) => inicio + i);",
  "  const payload = { headers, rows, rowNumbers, sourceId: planilha.getId() + ':' + aba.getSheetId() };",
  "  const resposta = UrlFetchApp.fetch(BLACK26_API, {",
  "    method: 'post', contentType: 'application/json',",
  "    headers: { Authorization: 'Bearer ' + BLACK26_CHAVE },",
  "    payload: JSON.stringify(payload), muteHttpExceptions: true",
  "  });",
  "  if (resposta.getResponseCode() !== 200) {",
  "    throw new Error('Central 26fit: ' + resposta.getContentText());",
  "  }",
  "}",
  "",
  "function black26fitAoEnviarFormulario(evento) {",
  "  if (!evento || !evento.range) throw new Error('Acionador de formulario nao instalado.');",
  "  if (evento.range.getSheet().getName() !== BLACK26_ABA) return;",
  "  black26fitEnviarLote(evento.range.getSheet(), evento.range.getRow(), 1);",
  "}",
  "",
  "function black26fitImportarRespostasAnteriores() {",
  "  const aba = black26fitPlanilha().getSheetByName(BLACK26_ABA);",
  "  if (!aba) throw new Error('A aba de respostas nao foi encontrada.');",
  "  const fim = aba.getLastRow();",
  "  for (let inicio = 2; inicio <= fim; inicio += 100) {",
  "    black26fitEnviarLote(aba, inicio, Math.min(100, fim - inicio + 1));",
  "  }",
  "}",
  "",
  "function black26fitAtivarIntegracao() {",
  "  const planilha = black26fitPlanilha();",
  "  const existente = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'black26fitAoEnviarFormulario');",
  "  if (!existente) ScriptApp.newTrigger('black26fitAoEnviarFormulario').forSpreadsheet(planilha).onFormSubmit().create();",
  "  black26fitImportarRespostasAnteriores();",
  "  Logger.log('Integracao Black26 ativada. Novas respostas serao enviadas a Central.');",
  "}"
 ].join("\n");
}
const BLACK26_FORM_UNITS_SCRIPT = String.raw`/**
 * Black26 - preenche a lista com 26fit, Eleve, franquias e Matriz.
 * Adicione estas funções ao mesmo Código.gs usado para integrar os leads.
 * NÃO substitua BLACK26_API, BLACK26_CHAVE nem as outras funções existentes.
 */
function black26fitAtualizarUnidades() {
  const api = BLACK26_API.replace(/\/webhook\/?$/, '/units');
  if (api === BLACK26_API) {
    throw new Error('A URL da integração Black26 não foi encontrada.');
  }
  const resposta = UrlFetchApp.fetch(api, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + BLACK26_CHAVE },
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() !== 200) {
    throw new Error('Erro ao consultar unidades: ' + resposta.getContentText());
  }
  const unidades = JSON.parse(resposta.getContentText()).units;
  if (!Array.isArray(unidades) || unidades.length < 30) {
    throw new Error('Lista incompleta: nenhuma alteração foi aplicada ao formulário.');
  }

  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const urlFormulario = planilha.getFormUrl();
  if (!urlFormulario) {
    throw new Error('Esta planilha não possui um formulário vinculado.');
  }
  const formulario = FormApp.openByUrl(urlFormulario);
  const limpar = valor => String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();

  const perguntas = formulario.getItems().filter(item =>
    /em qual unidade (26fit|voce|da rede)/.test(limpar(item.getTitle()))
  );
  if (perguntas.length !== 1) {
    throw new Error('Não foi encontrada exatamente uma pergunta sobre unidade 26fit.');
  }
  if (perguntas[0].getType() !== FormApp.ItemType.LIST) {
    throw new Error('No editor do Formulário, altere a pergunta de "Resposta curta" para "Lista suspensa" e execute novamente.');
  }
  const nomes = unidades.map(unidade => unidade.name);
  perguntas[0].asListItem().setChoiceValues(nomes).setRequired(true);
  Logger.log('Lista atualizada com ' + nomes.length + ' locais cadastrados.');
}

function black26fitAtivarListaDeUnidades() {
  black26fitAtualizarUnidades();
  const instalado = ScriptApp.getProjectTriggers().some(
    trigger => trigger.getHandlerFunction() === 'black26fitAtualizarUnidades'
  );
  if (!instalado) {
    ScriptApp.newTrigger('black26fitAtualizarUnidades')
      .timeBased().everyDays(1).atHour(4).create();
  }
  Logger.log('Atualização diária das unidades ativada.');
}`;
export default function BlackFridayDashboard({isDeveloper=false}){
 const [data,setData]=useState({summary:{},byUnit:[],byDay:[],leads:[],history:[],sources:[]});
 const [filters,setFilters]=useState({unit:"",status:"",q:""});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [file,setFile]=useState(null),[header,setHeader]=useState([]),[rows,setRows]=useState([]),[mapping,setMapping]=useState({});
 const [preview,setPreview]=useState(null),[progress,setProgress]=useState("");
 const [edits,setEdits]=useState({}),[page,setPage]=useState(0);
 const [generated,setGenerated]=useState(null),[sourceLabel,setSourceLabel]=useState("26fit | Catraca Livre Semana Black26 (respostas)");
 const [showUnitsCode,setShowUnitsCode]=useState(false);
 const refresh=async()=>{
  try{
   const query=new URLSearchParams(filters);
   const response=await fetch("/api/black-leads?"+query.toString(),{credentials:"same-origin",cache:"no-store"});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Não foi possível consultar os leads.");
   setData(result);setError("");
  }catch(e){setError(e.message||"Falha ao atualizar a campanha.");}
 };
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==="visible")void refresh();},20000);return()=>clearInterval(timer);},[filters.unit,filters.status,filters.q]);
 const records=data.leads||[];
 const pageSize=25,pages=Math.max(1,Math.ceil(records.length/pageSize));
 const listed=records.slice(page*pageSize,(page+1)*pageSize);
 const units=data.byUnit||[];
 const chart=(data.byDay||[]).slice(0,14).reverse();
 const max=Math.max(1,...chart.map(x=>x.leads));
 async function readFile(event){
  const chosen=event.target.files?.[0];
  setFile(null);setRows([]);setHeader([]);setPreview(null);setProgress("");setError("");setNotice("");
  if(!chosen)return;
  if(chosen.size>5*1024*1024){setError("Arquivo acima de 5 MB.");return;}
  try{
   let result;
   if(/\.xlsx$/i.test(chosen.name))result=await readSheet(chosen);
   else if(/\.csv$/i.test(chosen.name))result=parseCSV((await chosen.text()).replace(/^\uFEFF/,""));
   else throw Error("Selecione Excel (.xlsx) ou CSV (.csv).");
   if(result.length<2||result.length>30000)throw Error("A planilha deve conter cabeçalho e até 30 mil linhas.");
   const index=result.findIndex(r=>{const x=r.map(norm);return x.some(h=>h.includes("nome"))&&x.some(h=>h.includes("telefone")||h.includes("whatsapp")||h.includes("celular"));});
   const hrow=index>=0?index:0;
   const head=result[hrow].map(x=>String(x??""));
   setHeader(head);setRows(result.slice(hrow+1));setMapping(getMapping(head));setFile(chosen);
  }catch(e){setError(e.message);}
 }
 function prepare(){
  const required=[mapping.name,mapping.phone,mapping.unit];
  if(required.some(x=>!Number.isInteger(x)||x<0)){setError("Selecione as colunas Nome, WhatsApp e Unidade.");return;}
  if(new Set(required).size!==3){setError("Nome, telefone e unidade devem ter colunas diferentes.");return;}
  const parsed=[],bad=[];
  rows.forEach((row,i)=>{
   if(row.every(v=>!String(v??"").trim()))return;
   const name=String(row[mapping.name]??"").trim(),phone=cleanPhone(row[mapping.phone]),unit=String(row[mapping.unit]??"").trim();
   if(!name||phone.length<10||phone.length>13||!unit){bad.push(i+2);return;}
   const email=mapping.email>=0?String(row[mapping.email]??"").trim():"";
   const responseAt=mapping.timestamp>=0?parseDate(row[mapping.timestamp]):"";
   parsed.push({name,phone,unit,email,responseAt,sourceKey:responseAt+"|"+phone+"|"+norm(unit)+"|"+norm(name)});
  });
  if(!parsed.length){setError("Nenhum lead válido encontrado. Confira a seleção de colunas.");return;}
  setPreview({leads:parsed,invalid:bad,units:[...new Set(parsed.map(x=>x.unit))],total:rows.length});
  setError("");
 }
 async function upload(){
  if(!preview||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   let total=0;
   const items=preview.leads;
   for(let i=0;i<items.length;i+=250){
    const slice=items.slice(i,i+250);
    setProgress("Importando "+Math.min(i+slice.length,items.length)+" de "+items.length+" leads");
    const response=await fetch("/api/black-leads",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"import",filename:file?.name||"Planilha",leads:slice})});
    const output=await response.json();
    if(!response.ok)throw Error(output.error||"Falha ao importar o lote.");
    total+=output.processed||0;
   }
   setNotice(total+" respostas processadas no Neon. Importações repetidas não apagam o status do atendimento.");
   setPreview(null);setProgress("");await refresh();
  }catch(e){setError(e.message||"Erro na importação.");}finally{setBusy(false);}
 }
 async function saveLead(lead){
  const edit=edits[lead.id]||{};
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/black-leads",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update_status",id:lead.id,status:edit.status||lead.status,notes:edit.notes??lead.notes})});
   const output=await response.json();
   if(!response.ok)throw Error(output.error||"Falha ao salvar.");
   setNotice("Atendimento atualizado.");
   setEdits(x=>{const n={...x};delete n[lead.id];return n;});await refresh();
  }catch(e){setError(e.message||"Falha ao salvar lead.");}finally{setBusy(false);}
 }
 async function sourceAction(action,id){
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/black-leads",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,label:sourceLabel,id})});
   const output=await response.json();
   if(!response.ok)throw Error(output.error||"Não foi possível atualizar a integração.");
   if(action==="create_webhook")setGenerated({...output,script:makeScript(output.url,output.token)});
   if(action==="revoke_webhook")setNotice("Integração desativada.");
   await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const getWhatsApp=phone=>{const d=cleanPhone(phone);return "https://wa.me/"+((d.startsWith("55")&&(d.length===12||d.length===13))?d:"55"+d);};
 return <div className="cc-black">
  <div className="heading-row">
   <div><div className="eyebrow">CAMPANHA BLACK FRIDAY • 26FIT</div><h1>Captação de leads</h1><p>Cadastros do QR Code, distribuição por unidade, acompanhamento comercial e resultados.</p></div>
   <button className="btn secondary" onClick={refresh}><RefreshCcw size={16}/> Atualizar</button>
  </div>
  <div className="cc-black-kpis">
   {[
    ["Leads gerados",data.summary?.total||0],
    ["Contatos únicos",data.summary?.unique_contacts||0],
    ["Em atendimento",data.summary?.contacted||0],
    ["Convertidos",data.summary?.converted||0],
    ["Conversão",pct(data.summary?.converted||0,data.summary?.total||0)]
   ].map(([name,value])=><div className="cc-black-kpi" key={name}><small>{name}</small><strong>{typeof value==="number"?fmt(value):value}</strong></div>)}
  </div>
  <div className="cc-black-layout">
   <section className="panel cc-black-import">
    <div className="section-title"><div><h3><Upload size={17}/> Importar planilha de respostas</h3><p>Excel ou CSV exportado do Google Forms</p></div></div>
    <p>Importe o arquivo original, identifique as colunas e confira os leads antes de publicar. Os contatos já trabalhados mantêm seus status em novas importações.</p>
    <input type="file" accept=".xlsx,.csv" onChange={readFile}/>
    {file&&<div className="cc-black-mapping">
     {[[ "name","Nome *"],["phone","Telefone / WhatsApp *"],["unit","Unidade *"],["timestamp","Data e horário"],["email","E-mail"]].map(([key,label])=><label key={key}>{label}
       <select value={mapping[key]??-1} onChange={e=>{setMapping(m=>({...m,[key]:Number(e.target.value)}));setPreview(null);}}>
        <option value={-1}>Não encontrada / selecionar</option>{header.map((h,i)=><option key={i} value={i}>{h||"Coluna "+(i+1)}</option>)}
       </select>
      </label>)}
     <button className="btn secondary" onClick={prepare}>Conferir dados</button>
    </div>}
    {preview&&<div className="cc-black-review">
     <strong>{fmt(preview.leads.length)} leads válidos em {fmt(preview.units.length)} unidades</strong>
     <p>{preview.invalid.length?preview.invalid.length+" linhas incompletas serão ignoradas: "+preview.invalid.slice(0,8).join(", "):"Todas as linhas possuem nome, telefone e unidade."}</p>
     <button className="btn" disabled={busy} onClick={upload}><CheckCircle2 size={16}/> Confirmar importação</button>
    </div>}
    {progress&&<p>{progress}</p>}
   </section>
   <section className="panel cc-black-graph">
    <div className="section-title"><div><h3><BarChart3 size={17}/> Cadastros por dia</h3><p>Últimos 14 dias com respostas registradas</p></div></div>
    {chart.length?<div className="cc-black-bars">{chart.map(x=><div className="cc-black-bar" key={x.day}><span>{x.day.slice(8,10)}/{x.day.slice(5,7)}</span><div><i style={{width:(100*x.leads/max)+"%"}}/></div><b>{fmt(x.leads)}</b></div>)}</div>:<p className="cc-black-empty">O gráfico será preenchido depois de importar respostas com data.</p>}
    <p className="cc-black-note">Conversão = leads marcados como convertidos ÷ cadastros totais. Não representa vendas confirmadas sem atualização do status pela equipe.</p>
   </section>
  </div>
  <section className="panel cc-black-units">
   <div className="section-title"><div><h3><FileSpreadsheet size={17}/> Resultado e exportação por unidade</h3><p>Gere um Excel individual para cada unidade contatar os próprios leads.</p></div></div>
   {!units.length?<div className="cc-black-empty">Nenhuma unidade com cadastros ainda.</div>:<div className="cc-black-table-wrap"><table><thead><tr><th>Unidade</th><th>Leads</th><th>Contatados</th><th>Convertidos</th><th>Conversão</th><th>Exportar</th></tr></thead>
    <tbody>{units.map(u=><tr key={u.unit_label}><td>{u.unit_label}</td><td>{fmt(u.leads)}</td><td>{fmt(u.contacted)}</td><td>{fmt(u.converted)}</td><td>{pct(u.converted,u.leads)}</td><td><a className="btn secondary cc-black-export" href={"/api/black-leads/export?unit="+encodeURIComponent(u.unit_label)}><Download size={14}/> Excel da unidade</a></td></tr>)}</tbody>
   </table></div>}
  </section>
  <section className="panel cc-black-list">
   <div className="section-title"><div><h3><MessageCircle size={17}/> Carteira de leads e atendimento</h3><p>Você e a equipe comercial atualizam os resultados na mesma base.</p></div></div>
   <div className="cc-black-filters">
    <label><span>Unidade</span><select value={filters.unit} onChange={e=>{setFilters(p=>({...p,unit:e.target.value}));setPage(0);}}><option value="">Todas as unidades</option>{units.map(u=><option key={u.unit_label} value={u.unit_label}>{u.unit_label}</option>)}</select></label>
    <label><span>Status</span><select value={filters.status} onChange={e=>{setFilters(p=>({...p,status:e.target.value}));setPage(0);}}><option value="">Todos</option>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
    <label><span>Buscar</span><div className="cc-black-search"><Search size={15}/><input placeholder="Nome ou telefone" value={filters.q} onChange={e=>{setFilters(p=>({...p,q:e.target.value}));setPage(0);}}/></div></label>
   </div>
   {!records.length?<div className="cc-black-empty">Nenhum lead encontrado para os filtros.</div>:<div className="cc-black-table-wrap"><table><thead><tr><th>Data</th><th>Nome / contato</th><th>Unidade</th><th>Status</th><th>Observações</th><th>Ações</th></tr></thead>
    <tbody>{listed.map(lead=><tr key={lead.id}><td className="cc-black-date">{lead.response_at?new Date(lead.response_at).toLocaleDateString("pt-BR"):"—"}</td>
      <td><strong>{lead.name}</strong><small>{lead.phone}{lead.email?" · "+lead.email:""}</small></td><td>{lead.unit}</td>
      <td><select aria-label={"Status de "+lead.name} value={edits[lead.id]?.status||lead.status} onChange={e=>setEdits(x=>({...x,[lead.id]:{...x[lead.id],status:e.target.value}}))}>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></td>
      <td><input aria-label={"Observações de "+lead.name} value={edits[lead.id]?.notes??lead.notes} maxLength={2000} onChange={e=>setEdits(x=>({...x,[lead.id]:{...x[lead.id],notes:e.target.value}}))} placeholder="Resultado do contato"/></td>
      <td><div className="cc-black-actions"><a href={getWhatsApp(lead.phone)} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp"><MessageCircle size={17}/></a><button type="button" className="btn secondary" disabled={busy||!edits[lead.id]} onClick={()=>saveLead(lead)}>Salvar</button></div></td>
     </tr>)}</tbody></table></div>}
   {records.length>pageSize&&<div className="cc-black-pagination"><span>Página {page+1} de {pages}{records.length>=data.limit?" · Mais resultados podem existir; filtre por unidade":""}</span><div><button className="btn secondary" disabled={page===0} onClick={()=>setPage(x=>Math.max(0,x-1))}>Anterior</button><button className="btn secondary" disabled={page+1>=pages} onClick={()=>setPage(x=>x+1)}>Próxima</button></div></div>}
  </section>
  {isDeveloper&&<section className="panel cc-black-integration">
   <div className="section-title"><div><h3><Link2 size={17}/> Integrar respostas do Google Forms automaticamente</h3><p>Conexão segura com o Google Sheets, sem publicar contatos na internet.</p></div></div>
   <p className="cc-black-source-note"><ShieldCheck size={15}/><span>Planilha oficial: <a href="https://docs.google.com/spreadsheets/d/1itsdYErCGmCZ0ETjaOc0tGZoMu0H0_ZH_GiD73Pf89U/edit" target="_blank" rel="noopener noreferrer">26fit | Catraca Livre Semana Black26 (respostas)</a>. Aba: <strong>Respostas ao formulário 1</strong>. A primeira importação já foi realizada; ative o Apps Script para receber novos cadastros automaticamente.</span></p>
   <div className="cc-black-source-actions">
    <input value={sourceLabel} maxLength={120} onChange={e=>setSourceLabel(e.target.value)} aria-label="Nome da integração"/>
    <button className="btn" disabled={busy||sourceLabel.trim().length<3} onClick={()=>sourceAction("create_webhook")}><Link2 size={15}/> Gerar integração segura</button>
   </div>
   {generated&&<div className="cc-black-script">
    <strong>Integração criada — copie o código abaixo agora.</strong>
    <p>A chave não poderá ser consultada novamente. Na planilha vinculada acima, abra Extensões → Apps Script, cole o código e salve. Selecione a função black26fitAtivarIntegracao, clique em Executar e autorize a conta Google. O próprio script cria o acionador Ao enviar formulário e sincroniza as respostas existentes. Não compartilhe o código com a chave fora da equipe autorizada.</p>
    <textarea readOnly rows={13} value={generated.script}/>
    <button className="btn secondary" onClick={()=>navigator.clipboard.writeText(generated.script)}><Copy size={15}/> Copiar código da integração</button>
   </div>}
   {(data.sources||[]).length>0&&<div className="cc-black-sources">{data.sources.map(src=><div className="cc-black-source" key={src.id}><div><strong>{src.label}</strong><small>{src.active?"Ativa":"Revogada"} · {src.last_sync_at?"Último envio "+new Date(src.last_sync_at).toLocaleString("pt-BR"):"Sem envios ainda"}{src.last_error?" · Erro: "+src.last_error:""}</small></div>{src.active&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>{if(window.confirm("Revogar esta conexão Google Sheets?"))void sourceAction("revoke_webhook",src.id);}}><Trash2 size={14}/> Revogar</button>}</div>)}</div>}
   <div className="cc-black-units-integration">
    <strong>Lista de unidades 26fit, Eleve e Matriz no Google Forms</strong>
    <p>A Central fornece automaticamente as unidades 26fit (incluindo franquias), Eleve e a Matriz Nova Prata cadastradas no sistema. No editor do Google Forms, altere somente a pergunta <b>“Em qual unidade 26fit você está treinando?”</b> de <b>Resposta curta</b> para <b>Lista suspensa</b>. Preserve a mesma pergunta, para manter o vínculo das respostas anteriores.</p>
    <p>Depois, no Apps Script <b>já instalado na planilha</b>, acrescente o trecho abaixo ao final de Código.gs, salve e execute <code>black26fitAtivarListaDeUnidades</code>. O código preencherá todas as opções e instalará uma atualização diária.</p>
    <button type="button" className="btn secondary" onClick={()=>setShowUnitsCode(x=>!x)}><FileSpreadsheet size={15}/>{showUnitsCode?"Ocultar código":"Ver código das unidades"}</button>
    {showUnitsCode&&<div className="cc-black-script">
      <textarea readOnly rows={14} value={BLACK26_FORM_UNITS_SCRIPT} aria-label="Código Apps Script para atualizar todas as unidades 26fit"/>
      <button type="button" className="btn secondary" onClick={()=>navigator.clipboard.writeText(BLACK26_FORM_UNITS_SCRIPT)}><Copy size={15}/> Copiar código das unidades</button>
    </div>}
   </div>
   <p className="cc-black-note">A integração identifica automaticamente colunas com "Nome", "WhatsApp/Telefone" e "Unidade". Caso os títulos do seu formulário sejam diferentes, teremos que ajustar o mapeamento com a planilha original.</p>
  </section>}
  {!!(data.history||[]).length&&<section className="panel cc-black-history"><div className="section-title"><h3>Histórico de importações</h3></div>{data.history.map((h,i)=><p key={i}>{new Date(h.created_at).toLocaleString("pt-BR")} · {h.filename} · {fmt(h.imported_rows)} linhas · {h.imported_by}</p>)}</section>}
  {error&&<p className="validation" role="alert"><AlertTriangle size={16}/>{error}</p>}
  {notice&&<p className="notice" role="status">{notice}</p>}
 </div>;
}
