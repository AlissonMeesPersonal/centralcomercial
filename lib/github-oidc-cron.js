import { createPublicKey, verify } from "node:crypto";

// Apenas o fluxo de trabalho agendado e publicado em main pode
// solicitar uma sincronização. Nenhum segredo estático é compartilhado
// entre a Central e o GitHub Actions.
const issuer = "https://token.actions.githubusercontent.com";
const audience = "https://centralcomercial-eta.vercel.app/api/cron/microsoft-calendar";
const repository = "AlissonMeesPersonal/centralcomercial";
const ref = "refs/heads/main";
const workflow = repository + "/.github/workflows/sync-microsoft-calendar.yml@" + ref;
const testWorkflow = repository + "/.github/workflows/test-remote-push.yml@" + ref;
const testAudience = "https://centralcomercial-eta.vercel.app/api/cron/test-push";
// O GitHub passou a emitir subjects imutáveis com IDs para repositórios
// criados após 15/07/2026. Aceitamos apenas as duas variantes exatas
// pertencentes a este mesmo repositório e à branch principal.
const subjects = new Set([
  "repo:" + repository + ":ref:" + ref,
  "repo:AlissonMeesPersonal@175993991/centralcomercial@1454405633:ref:" + ref,
]);

const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

export async function githubCronAuthorized(token, expectedAudience = audience, expectedSha = null) {
  const calendarAudience = "https://centralcomercial-eta.vercel.app/api/cron/due-notifications";
  if (![audience, calendarAudience, testAudience].includes(expectedAudience)) return false;
  if (typeof token !== "string" || token.length > 15000 || token.length < 100) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((x) => !/^[A-Za-z0-9_-]+$/.test(x))) return false;
  let header, claims;
  try {
    header = decode(parts[0]);
    claims = decode(parts[1]);
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 160)
    return false;
  if (
    claims.iss !== issuer ||
    claims.aud !== expectedAudience ||
    claims.repository !== repository ||
    claims.ref !== ref ||
    !subjects.has(claims.sub) ||
    claims.repository_id !== "1454405633" ||
    claims.repository_owner_id !== "175993991" ||
    claims.workflow_ref !== (expectedAudience === testAudience ? testWorkflow : workflow) ||
    !(expectedAudience === testAudience
      ? ["push", "workflow_dispatch"].includes(claims.event_name)
      : ["schedule", "workflow_dispatch"].includes(claims.event_name)) ||
    (expectedSha !== null && claims.sha !== expectedSha)
  )
    return false;
  if (
    !Number.isFinite(claims.iat) ||
    !Number.isFinite(claims.exp) ||
    claims.iat > now + 60 ||
    claims.iat < now - 600 ||
    claims.exp < now ||
    claims.exp > now + 600 ||
    (claims.nbf != null && Number(claims.nbf) > now + 60)
  )
    return false;
  try {
    const response = await fetch(issuer + "/.well-known/jwks", {
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return false;
    const data = await response.json();
    const key = data.keys?.find((x) => x.kid === header.kid && x.kty === "RSA");
    if (!key) return false;
    return verify(
      "RSA-SHA256",
      Buffer.from(parts[0] + "." + parts[1]),
      createPublicKey({ key, format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    );
  } catch {
    return false;
  }
}
