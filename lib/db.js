import { neon } from "@neondatabase/serverless";
export function database() {
 if (!process.env.DATABASE_URL) throw Error("Banco da Central Comercial não configurado.");
 return neon(process.env.DATABASE_URL);
}
