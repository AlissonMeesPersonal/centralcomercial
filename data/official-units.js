// Fonte pública: https://26fit.com.br/unidades (consulta de 11/11/2026).
// Listagem pública de 80 academias. Não confundir com o PDF administrativo de 82 registros:
// o site não fornece aqui a classificação de franquia/própria, responsáveis, CNPJ ou contato.
// Links individuais reproduzidos do diretório, inclusive slugs legados atípicos.
const PUBLIC_UNIT_ROWS = [
  [
    "Santo Ângelo",
    "26fit-santo-angelo"
  ],
  [
    "Alvorada - Getúlio Vargas",
    "26fit-alvorada-getulio-vargas"
  ],
  [
    "Porto Alegre - Saldanha",
    "26fit-porto-alegre-saldanha"
  ],
  [
    "Valença do Piauí",
    "26fit-valenca-do-piaui"
  ],
  [
    "Pelotas - Ferreira Viana",
    "26fit-pelotas-ferreira-viana"
  ],
  [
    "Venâncio Aires",
    "26fit-venancio-aires"
  ],
  [
    "Cascavel - Irani",
    "26fit-cascavel-irani"
  ],
  [
    "Cascavel - JL",
    "26fit-cascavel-jl"
  ],
  [
    "Cachoeira do Sul",
    "26fit-cachoeira-do-sul"
  ],
  [
    "Blumenau",
    "26fit-blumenau"
  ],
  [
    "Sinop - Avenida dos Ingas",
    "26fit-sinopingas"
  ],
  [
    "Indaiatuba",
    "26fit-indaiatuba"
  ],
  [
    "Porto Alegre Assis Brasil",
    "26fit-assis-brasil"
  ],
  [
    "Caxias do Sul",
    "26fit-caxias-do-sul"
  ],
  [
    "Porto Alegre - Campos Velho",
    "26fit-porto-alegre-campos-velho"
  ],
  [
    "Alegrete",
    "26fit-alegrete"
  ],
  [
    "Canoas - Mathias Velho",
    "26fit-canoas-mathias-velho"
  ],
  [
    "Canoas - Marechal Rondon",
    "26fit-canoas-marechal-rondon"
  ],
  [
    "Teutônia",
    "26fit-teutonia"
  ],
  [
    "Porto Alegre Medianeira",
    "26fit-portoalegre-medianeira"
  ],
  [
    "Sinop - Avenida dos Jacarandas",
    "26fit-sinop"
  ],
  [
    "Erechim",
    "26fit-erechim"
  ],
  [
    "São Leopoldo Imperatriz",
    "26fit-sao-leopoldo-imperatriz"
  ],
  [
    "Alvorada",
    "26fit-alvorada"
  ],
  [
    "Santa Maria",
    "26fit-santa-maria"
  ],
  [
    "Nova Araçá",
    "26fit-nova-araca"
  ],
  [
    "Guaporé",
    "26fit-guapore"
  ],
  [
    "Nova Bassano",
    "26fit-nova-bassano"
  ],
  [
    "Nova Prata",
    "26fit-nova-prata"
  ],
  [
    "Serafina Corrêa",
    "26fit-serafina-corra"
  ],
  [
    "Carlos Barbosa",
    "26fit-carlos-barbosa"
  ],
  [
    "Campo Bom",
    "26fit-campo-bom"
  ],
  [
    "Marau",
    "26fit-marau"
  ],
  [
    "Taquara",
    "26fit-taquara"
  ],
  [
    "Sapiranga",
    "26fit-sapiranga"
  ],
  [
    "Carazinho",
    "26fit-carazinho"
  ],
  [
    "Esteio",
    "26fit-esteio"
  ],
  [
    "Lajeado",
    "26fit-lajeado"
  ],
  [
    "Santa Cruz do Sul",
    "26fit-santa-cruz-do-sul"
  ],
  [
    "Sapucaia do Sul",
    "26fit-sapucaia-do-sul"
  ],
  [
    "São Miguel do Oeste",
    "26fit-sao-miguel-do-oeste"
  ],
  [
    "Joaçaba",
    "26fit-joacaba"
  ],
  [
    "Ijuí",
    "26fit-ijui"
  ],
  [
    "Bento Gonçalves",
    "26fit-bento-gonalves"
  ],
  [
    "Vera Cruz",
    "26fit-vera-cruz"
  ],
  [
    "Gravataí - Salgado Filho",
    "26fit-gravatai-salgado-filho"
  ],
  [
    "Passo Fundo - Av. Brasil Leste",
    "26fit-passo-fundo-av-brasil-leste"
  ],
  [
    "Cachoeirinha",
    "26fit-cachoeirinha"
  ],
  [
    "Guaíba",
    "26fit-guaiba"
  ],
  [
    "Cruz Alta",
    "26fit-cruz-alta"
  ],
  [
    "Dom Pedrito",
    "26fit-dom-pedrito"
  ],
  [
    "Estância Velha",
    "26fit-estancia-velha"
  ],
  [
    "Rio Grande",
    "26fit-rio-grande"
  ],
  [
    "Porto Alegre Juca Batista",
    "26fit-porto-alegre-juca-batista"
  ],
  [
    "Porto Alegre - Aparício Borges",
    "26fit-porto-alegre-aparicio-borges"
  ],
  [
    "Porto Alegre Ipiranga",
    "26fit-porto-alegre-ipiranga"
  ],
  [
    "Panambi",
    "26fit-panambi"
  ],
  [
    "Santarém",
    "26fit-santarm"
  ],
  [
    "Capão da Canoa",
    "26fit-capao-da-canoa"
  ],
  [
    "Porto Alegre Otto Niemeyer",
    "26fit-porto-alegre-otto-niemeyer"
  ],
  [
    "Passo Fundo - Presidente",
    "26fit-passo-fundo-presidente"
  ],
  [
    "Pelotas - Gonçalves Chaves",
    "26fit-pelotas-2"
  ],
  [
    "Osório",
    "26fit-osorio"
  ],
  [
    "Veranópolis",
    "26fit-veranpolis"
  ],
  [
    "Porto União",
    "26fit-porto-uniao"
  ],
  [
    "Porto Alegre Vicente Fontoura",
    "26fit-porto-alegre-vicente-fontoura"
  ],
  [
    "Porto Alegre - Restinga",
    "26fit-porto-alegre-restinga"
  ],
  [
    "São Gabriel",
    "26fit-sao-gabriel"
  ],
  [
    "Passo Fundo - Brasil Oeste",
    "26fit-passo-fundo-brasil-oeste"
  ],
  [
    "Videira",
    "26fit-videira"
  ],
  [
    "Salto",
    "26fit-salto"
  ],
  [
    "Bagé",
    "26fit-bage"
  ],
  [
    "Pelotas - Andrade Neves",
    "26fit-pelotas"
  ],
  [
    "Tramandaí",
    "26fit-tramandai"
  ],
  [
    "Campinas",
    "26fit-campinas"
  ],
  [
    "Farroupilha",
    "26fit-farroupilha"
  ],
  [
    "Novo Hamburgo - Pedro Adams",
    "26fit-novo-hamburgo-pedro-adams"
  ],
  [
    "São Leopoldo",
    "26fit-sao-leopoldo"
  ],
  [
    "Gravataí - Dorival Cândido",
    "26fit-gravatai-dorival-candido"
  ],
  [
    "Novo Hamburgo - Rio Branco",
    "26fit-novo-hamburgo-rio-branco"
  ]
];
const CITY_PREFIXES = [
  "Porto Alegre","Novo Hamburgo","Passo Fundo","São Leopoldo",
  "Santa Cruz do Sul","São Miguel do Oeste","Cachoeira do Sul",
  "Caxias do Sul","Sapucaia do Sul","Capão da Canoa",
  "Valença do Piauí","Bento Gonçalves","Dom Pedrito","Estância Velha",
  "Rio Grande","Canoas","Pelotas","Sinop","Cascavel","Gravataí","Alvorada"
].sort((a,b)=>b.length-a.length);
const STATE_BY_CITY = {
  "Blumenau":"SC","São Miguel do Oeste":"SC","Joaçaba":"SC",
  "Porto União":"SC","Videira":"SC",
  "Cascavel":"PR","Sinop":"MT",
  "Indaiatuba":"SP","Salto":"SP","Campinas":"SP",
  "Santarém":"PA","Valença do Piauí":"PI"
};
const REGION_BY_UF = {
  RS:"Sul",SC:"Sul",PR:"Sul",SP:"Sudeste",MT:"Centro-Oeste",PA:"Norte",PI:"Nordeste"
};
const VERIFIED_ADDRESSES = {
  "26fit-alvorada-getulio-vargas":"Av. Presidente Getúlio Vargas, 4163 - Maria Regina, Alvorada/RS - 94818-001",
  "26fit-porto-alegre-saldanha":"Rua Santa Maria, 201 - Vila São José, Porto Alegre/RS - 91520-460",
  "26fit-valenca-do-piaui":"Av. Joaquim Manoel, 84 - Lavanderia, Valença do Piauí/PI - 64300-000",
  "26fit-pelotas-ferreira-viana":"Av. Ferreira Viana, 1001 - Areal, Pelotas - RS, 96085-000",
  "26fit-santa-maria":"Av Borges de Medeiros, 955 - Nossa Sra do Rosario/RS -97010-081",
  "26fit-porto-alegre-juca-batista":"Av. Juca Batista, 1495 - Cavalhada, Porto Alegre - RS, 91770-001",
  "26fit-gravatai-dorival-candido":"Avenida Dorival Cândido Luiz de Oliveira, nº 5900"
};
const cityFromName=(name)=>CITY_PREFIXES.find(prefix=>name===prefix||name.startsWith(prefix+" ")||name.startsWith(prefix+" -"))||name;

export const OFFICIAL_UNITS = PUBLIC_UNIT_ROWS.map(([label,slug])=>{
  const city=cityFromName(label);
  const state=STATE_BY_CITY[city]||"RS";
  return {
    id:"site-"+slug,
    name:"26fit "+label,
    city,state,region:REGION_BY_UF[state],
    status:["Santo Ângelo","Porto União"].includes(label)?"Inauguração":"Aberta",
    type:"Academia 26fit",
    coordinator:null,
    responsible:null,
    contact:null,
    cnpj:null,
    address:VERIFIED_ADDRESSES[slug]||null,
    mapUrl:null,
    siteUrl:"https://26fit.com.br/unidades/"+slug,
    source:"26fit.com.br",
    demo:false
  };
});

if(OFFICIAL_UNITS.length!==80)throw new Error("Diretório público deve ter exatamente 80 unidades");

// Migração aditiva: conserva cadastros e vínculos locais anteriores, incorporando o
// diretório público e atualizando apenas os campos conhecidos da fonte oficial.
// Reexecutar é idempotente, sem multiplicar as 80 unidades.
export function mergeOfficialUnits(previous) {
  const old=Array.isArray(previous)?previous.filter(x=>x&&typeof x.id==="string"):[];
  const byId=new Map(old.map(x=>[x.id,x]));
  const officialIds=new Set(OFFICIAL_UNITS.map(x=>x.id));
  const official=OFFICIAL_UNITS.map(item=>{
    const existing=byId.get(item.id);
    if(!existing)return item;
    return {
      ...existing,...item,
      // Preserve atribuições e dados internos adicionados pelo usuário.
      coordinator:existing.coordinator||item.coordinator,
      responsible:existing.responsible||item.responsible,
      contact:existing.contact||item.contact,
      cnpj:existing.cnpj||item.cnpj,
      address:existing.address||item.address,
      mapUrl:existing.mapUrl||item.mapUrl,
      type:existing.type&&existing.type!=="Academia 26fit"?existing.type:item.type
    };
  });
  return [...official,...old.filter(item=>!officialIds.has(item.id))];
}
