// ============================================================================
//  app/api/ingest/sigm/route.ts
//  Endpoint que recibe el Excel del SIGM (POST con el .xlsx en el cuerpo),
//  lo parsea y reemplaza toda la base de garantías en Supabase.
//  Protegido por un token (header x-ingest-token). Corre en Node (no edge).
//
//  Variables de entorno necesarias en Vercel (tipo Config, NO NEXT_PUBLIC):
//    SUPABASE_SERVICE_ROLE_KEY   ← la llave secreta service_role de Supabase
//    INGEST_TOKEN                ← un secreto largo que tú generas
//  Reutiliza NEXT_PUBLIC_SUPABASE_URL para la URL del proyecto.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseSigm } from "../../../../lib/sigm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function insChunks(sb: any, table: string, data: any[]) {
  const N = 500;
  for (let i = 0; i < data.length; i += N) {
    const ins = await sb.from(table).insert(data.slice(i, i + N));
    if (ins.error) throw ins.error;
  }
}

export async function POST(req: NextRequest) {
  // 1. Autorización por token
  const token = req.headers.get("x-ingest-token");
  if (!token || token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // 2. Cliente con service_role (salta RLS; solo vive en el servidor)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Faltan variables de entorno en el servidor" }, { status: 500 });
  }
  const sb = createClient(url, key, { db: { schema: "gm" }, auth: { persistSession: false } });

  // 3. Leer el archivo del cuerpo
  let buf: ArrayBuffer;
  try {
    buf = await req.arrayBuffer();
  } catch {
    return NextResponse.json({ ok: false, error: "No llegó el archivo" }, { status: 400 });
  }
  if (!buf || buf.byteLength === 0) {
    return NextResponse.json({ ok: false, error: "Archivo vacío" }, { status: 400 });
  }

  try {
    // 4. Parsear
    const { deudores, bienes, garantias, omitidas } = parseSigm(buf);
    if (!garantias.length) throw new Error("No se encontraron garantías con folio y documento válidos.");

    // 4.b GUARDA DE SEGURIDAD: no reemplazar la base buena con un Excel truncado.
    //     Si el archivo nuevo trae menos de la mitad de las garantías que ya hay,
    //     se aborta (salvo header x-ingest-force: 1, para una baja intencional).
    const forzar = req.headers.get("x-ingest-force") === "1";
    const { count: actual } = await sb
      .from("garantia")
      .select("*", { count: "exact", head: true });
    if (!forzar && typeof actual === "number" && actual > 0 && garantias.length < actual * 0.5) {
      const detalle = `Abortado por seguridad: el archivo trae ${garantias.length} garantías, menos de la mitad de las ${actual} actuales (posible archivo truncado). Reenviar con el header x-ingest-force: 1 si la baja es intencional.`;
      await sb.from("ingesta_log").insert({ fuente: "SIGM", estado: "error", garantias: garantias.length, detalle });
      return NextResponse.json({ ok: false, error: detalle }, { status: 409 });
    }

    // 5. Reemplazo total (orden por dependencias FK)
    for (const t of ["acto", "garantia", "bien", "deudor"]) {
      const d = await sb.from(t).delete().not("id", "is", null);
      if (d.error) throw d.error;
    }
    await insChunks(sb, "deudor", deudores);
    await insChunks(sb, "bien", bienes);
    await insChunks(sb, "garantia", garantias);

    // 6. Registrar la corrida
    await sb.from("ingesta_log").insert({
      fuente: "SIGM", estado: "ok",
      garantias: garantias.length, deudores: deudores.length, omitidas,
      detalle: "Reemplazo total vía endpoint automático",
    });

    return NextResponse.json({ ok: true, garantias: garantias.length, deudores: deudores.length, omitidas });
  } catch (ex: any) {
    const msg = ex?.message || String(ex);
    // Intentar registrar el error (sin romper la respuesta si también falla)
    try {
      await sb.from("ingesta_log").insert({ fuente: "SIGM", estado: "error", detalle: msg });
    } catch {}
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
