// ============================================================================
//  lib/pin.ts — PIN de consulta para los QR (SOLO SERVIDOR).
//  El PIN se guarda cifrado (scrypt); al validarlo se entrega una constancia
//  firmada que vence en 2 horas y deja de servir si el PIN se cambia.
// ============================================================================
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const HORAS_CONSTANCIA = 2;
export const MAX_FALLOS = 5;
export const MINUTOS_BLOQUEO = 15;

export function servicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) throw new Error("Faltan variables de entorno en el servidor");
  return createClient(url, key, { db: { schema: "gm" }, auth: { persistSession: false } });
}

export function cifrarPin(pin: string) {
  const sal = randomBytes(16).toString("hex");
  return { sal, hash: scryptSync(pin, sal, 32).toString("hex") };
}

export function pinCorrecto(pin: string, sal: string, hash: string) {
  const a = scryptSync(pin, sal, 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function llave() {
  return createHash("sha256").update("archivo-legal:consulta-pin:" + (process.env.SUPABASE_SERVICE_ROLE_KEY || "")).digest();
}

export function firmarConstancia(version: number) {
  const datos = Buffer.from(JSON.stringify({ v: version, exp: Date.now() + HORAS_CONSTANCIA * 3600_000 })).toString("base64url");
  const firma = createHmac("sha256", llave()).update(datos).digest("base64url");
  return `${datos}.${firma}`;
}

export function constanciaValida(token: string, version: number) {
  const [datos, firma] = (token || "").split(".");
  if (!datos || !firma) return false;
  const esperada = createHmac("sha256", llave()).update(datos).digest("base64url");
  if (esperada.length !== firma.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(firma))) return false;
  try {
    const p = JSON.parse(Buffer.from(datos, "base64url").toString());
    return p.v === version && typeof p.exp === "number" && p.exp > Date.now();
  } catch { return false; }
}

/** DNI 12345678 -> DNI ••••5678 */
export function ocultarDoc(tipo: string | null, num: string | null) {
  if (!num) return tipo === "PENDIENTE" ? "Pendiente" : "—";
  const t = tipo && tipo !== "PENDIENTE" ? tipo + " " : "";
  return t + "••••" + String(num).slice(-4);
}

export function ipDe(h: Headers) {
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "desconocida";
}
