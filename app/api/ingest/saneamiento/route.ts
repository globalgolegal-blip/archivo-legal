// ============================================================================
//  app/api/ingest/saneamiento/route.ts
//  Recibe el saneamiento del archivo físico desde el Google Sheets (vía Apps
//  Script) como JSON, y reemplaza en la base las sedes presentes en el envío.
//  Mismo token y misma llave service_role que el endpoint del SIGM.
//
//  Body esperado (JSON):
//    { "rows": [ { sede, tipo_documento, numero_documento, estado_civil, tomo, fecha_firma }, ... ] }
//  Reemplaza SOLO las sedes que vengan en rows (una sede sin filas nunca se toca).
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pad(n: any) { return String(n).padStart(2, "0"); }

function tdoc(s: any): string | null {
  s = String(s ?? "").toUpperCase();
  if (s.indexOf("DNI") >= 0) return "DNI";
  if (s.indexOf("EXTRANJER") >= 0 || s.trim() === "CE" || s.indexOf("CARN") >= 0) return "CARNÉ DE EXTRANJERÍA";
  if (s.indexOf("PASAPORTE") >= 0) return "PASAPORTE";
  if (s.indexOf("PTP") >= 0) return "PTP";
  return null;
}
function ecivil(s: any): string | null {
  s = String(s ?? "").trim().toUpperCase();
  return ["SOLTERO (A)", "CASADO (A)", "VIUDO (A)", "DIVORCIADO (A)"].indexOf(s) >= 0 ? s : null;
}
function num(s: any): string {
  return s == null ? "" : String(s).replace(/\s+/g, "").toUpperCase();
}
// Acepta "YYYY-MM-DD" (lo que manda Apps Script cuando la celda es fecha) o
// "DD/MM/YYYY" (texto). Devuelve ISO o null.
function fechaISO(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

async function insChunks(sb: any, table: string, data: any[]) {
  const N = 500;
  for (let i = 0; i < data.length; i += N) {
    const ins = await sb.from(table).insert(data.slice(i, i + N));
    if (ins.error) throw ins.error;
  }
}

export async function POST(req: NextRequest) {
  // 1. Autorización
  const token = req.headers.get("x-ingest-token");
  if (!token || token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // 2. Cliente service_role (server-only)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Faltan variables de entorno en el servidor" }, { status: 500 });
  }
  const sb = createClient(url, key, { db: { schema: "gm" }, auth: { persistSession: false } });

  // 3. Leer el cuerpo
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido (se esperaba JSON)" }, { status: 400 });
  }
  const entrada: any[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!entrada.length) {
    return NextResponse.json({ ok: false, error: "No llegaron filas (rows vacío)" }, { status: 400 });
  }

  try {
    // 4. Normalizar
    const rows: any[] = [];
    const sedes = new Set<string>();
    for (const r of entrada) {
      const sede = String(r?.sede ?? "").trim();
      if (!sede) continue;
      const doc = num(r?.numero_documento);
      const tomo = r?.tomo == null || String(r.tomo).trim() === "" ? null : String(r.tomo).trim();
      if (!doc && tomo == null) continue; // fila vacía
      sedes.add(sede);
      rows.push({
        sede,
        tipo_documento: tdoc(r?.tipo_documento),
        numero_documento: doc,
        estado_civil: ecivil(r?.estado_civil),
        tomo,
        fecha_firma: fechaISO(r?.fecha_firma),
      });
    }
    if (!rows.length) throw new Error("No se encontraron filas válidas (con documento o tomo).");
    const sedeList = Array.from(sedes);

    // 5. Reemplazo por sede (borra solo las sedes presentes, inserta las nuevas)
    const del = await sb.from("archivo_fisico").delete().in("sede", sedeList);
    if (del.error) throw del.error;
    await insChunks(sb, "archivo_fisico", rows);

    // 6. Bitácora
    await sb.from("ingesta_log").insert({
      fuente: "saneamiento",
      estado: "ok",
      detalle: `Saneamiento: ${rows.length} filas en sede(s) ${sedeList.join(", ")}`,
    });

    return NextResponse.json({ ok: true, filas: rows.length, sedes: sedeList });
  } catch (ex: any) {
    const msg = ex?.message || String(ex);
    try {
      await sb.from("ingesta_log").insert({ fuente: "saneamiento", estado: "error", detalle: msg });
    } catch {}
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
