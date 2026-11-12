import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
import {readChurnFile,parseChurnRows} from "../../../../lib/churn-import";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export const maxDuration=45;
const HEADERS={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const fail=(message,status)=>Response.json({error:message},{status,headers:HEADERS});
const keyOf=row=>row.unitId+"|"+row.month;

export async function POST(request){
 try{
  const access=await getAccess();
  if(!access.signedIn)return fail("Entre na Central Comercial para importar planilhas.",401);
  if(!access.allowed||!["developer","admin","gestor"].includes(access.role))
    return fail("Seu perfil não permite importar dados de churn.",403);

  const claimedSize=Number(request.headers.get("content-length")||0);
  if(claimedSize>6*1024*1024)return fail("Arquivo muito grande. Limite de 5 MB.",413);
  let form;
  try{form=await request.formData();}
  catch{return fail("Não foi possível receber o arquivo.",400);}
  const file=form.get("file"),action=form.get("action"),period=String(form.get("period")||"");
  if(!file||typeof file.arrayBuffer!=="function")return fail("Selecione um arquivo CSV ou XLSX.",422);
  if(!["preview","commit"].includes(action))return fail("Operação inválida.",400);
  let parsed;
  try{
   const fileData=await readChurnFile(file);
   parsed={...fileData,...await parseChurnRows(fileData,period)};
  }catch(e){return fail(e.message||"Planilha inválida.",422);}
  const preview={
   filename:parsed.filename,sha:parsed.sha,total:parsed.total,
   valid:parsed.errors.length===0&&parsed.rows.length>0,
   errors:parsed.errors.slice(0,35),
   errorCount:parsed.errors.length,
   warnings:parsed.warnings.slice(0,30),
   warningCount:parsed.warnings.length,
   existing:parsed.existing||0,
   newRecords:parsed.rows.length-(parsed.existing||0),
   sample:parsed.rows.slice(0,16).map(row=>({
    unitId:row.unitId,unitName:row.unitName,month:row.month,
    activeStart:row.activeStart,cancellations:row.cancellations,churn:row.churn,
    existing:row.expectedRevision>0
   })),
   versions:parsed.rows.map(row=>({key:keyOf(row),revision:row.expectedRevision||0}))
  };
  if(action==="preview")return Response.json(preview,{headers:HEADERS});
  if(!preview.valid)return fail("Corrija os erros identificados antes de importar.",422);
  if(form.get("sha")!==parsed.sha)return fail("O arquivo foi alterado após a prévia. Gere outra prévia.",409);
  const overwrite=form.get("overwrite")==="true";
  if(parsed.existing>0&&!overwrite)return fail("Já existem resultados para algumas unidades e meses. Marque a opção de substituição para atualizá-los.",409);
  let versions;
  try{versions=JSON.parse(String(form.get("versions")||"null"));}
  catch{return fail("Prévia inválida. Verifique novamente o arquivo.",400);}
  if(!Array.isArray(versions)||versions.length!==parsed.rows.length)return fail("Gere uma nova prévia antes de importar.",409);
  const seen=new Set(),byKey=new Map();
  for(const entry of versions){
   if(!entry||typeof entry.key!=="string"||!Number.isSafeInteger(entry.revision)||entry.revision<0||seen.has(entry.key))
    return fail("Revisões inválidas. Gere uma nova prévia.",409);
   seen.add(entry.key);byKey.set(entry.key,entry.revision);
  }
  for(const row of parsed.rows){
   const previous=byKey.get(keyOf(row));
   if(previous===undefined||previous!==row.expectedRevision)
    return fail("Os dados mudaram após a prévia. Atualize e confira as alterações antes de importar.",409);
  }
  const values=parsed.rows.map(row=>({
   unitId:row.unitId,period:row.period,activeStart:row.activeStart,
   cancellations:row.cancellations,enrollments:row.enrollments,
   reactivations:row.reactivations,activeEnd:row.activeEnd,
   expectedRevision:byKey.get(keyOf(row))
  }));
  const sql=database();
  try{
   const result=await sql.query(
    "SELECT cc_churn_import($1::jsonb,$2,$3,$4,$5) AS outcome",
    [JSON.stringify(values),parsed.filename,parsed.sha,access.email,overwrite]
   );
   return Response.json({ok:true,...result[0].outcome},{headers:HEADERS});
  }catch(e){
   if(e.code==="40001"||e.code==="23505"||/conflito|já existe registro/i.test(String(e.message)))
    return fail("Conflito ou duplicidade detectada. Nenhum dado foi alterado. Atualize a prévia.",409);
   if(e.code==="22023"||e.code==="23514")return fail("Os dados não passaram pela validação do banco. Confira a planilha.",422);
   return fail("Não foi possível gravar o lote no Neon. Nenhum registro parcial foi salvo.",500);
  }
 }catch{return fail("Não foi possível processar a planilha. Tente novamente.",500);}
}
