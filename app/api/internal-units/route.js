// Dados internos da rede: apenas no ambiente de produção protegido por autenticação Vercel.
// O repositório público nunca contém contatos de colaboradores. Não cachear esta resposta.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
 const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff"
 };
 if (process.env.VERCEL_ENV !== "production") {
  return Response.json({ error: "Diretório interno indisponível fora da produção protegida." }, { status: 403, headers });
 }
 const raw = process.env.CENTRAL_INTERNAL_DIRECTORY_JSON;
 if (!raw) return Response.json({ error: "Cadastro administrativo não configurado." }, { status: 503, headers });
 try {
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload.units) || payload.units.length !== 83)
   throw new Error("Arquivo administrativo incompleto");
  return Response.json({ units: payload.units, total: payload.total }, { status: 200, headers });
 } catch {
  return Response.json({ error: "Cadastro interno inválido." }, { status: 500, headers });
 }
}
