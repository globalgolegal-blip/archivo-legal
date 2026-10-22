// ============================================================================
//  app/api/consulta/route.ts — consulta de un archivador con PIN (sin cuenta).
//  Devuelve SOLO el contenido del archivador del QR, en modo lectura y con los
//  documentos de identidad parcialmente ocultos. Bloquea tras 5 PIN fallidos.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import {
  servicio, pinCorrecto, firmarConstancia, constanciaValida, ocultarDoc, ipDe,
  MAX_FALLOS, MINUTOS_BLOQUEO,
} from "../../../lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Destino =
  | { tipo: "tomo"; src: string; region?: string; anio?: string; tomo: string }
  | { tipo: "gf_exp"; base: string }
  | { tipo: "gf_folder"; doc: string; folder: string };

const TABLAS_GF: Record<string, { tabla: string; fecha: string; etiqueta: string }> = {
  contrato: { tabla: "contrato", fecha: "fecha_creacion", etiqueta: "Contratos" },
  pagare: { tabla: "pagare", fecha: "fecha_creacion", etiqueta: "Pagarés" },
  letra: { tabla: "letra", fecha: "fecha_giro", etiqueta: "Letras de cambio" },
  transaccion: { tabla: "transaccion", fecha: "fecha_firma", etiqueta: "Transacciones" },
};

function ok(cuerpo: unknown, status = 200) { return NextResponse.json(cuerpo, { status }); }

export async function POST(req: NextRequest) {
  let body: { pin?: string; token?: string; destino?: Destino };
  try { body = await req.json(); } catch { return ok({ error: "Solicitud inválida" }, 400); }
  const destino = body.destino;
  if (!destino || !["tomo", "gf_exp", "gf_folder"].includes(destino.tipo)) return ok({ error: "Archivador no válido" }, 400);

  let sb;
  try { sb = servicio(); } catch (e) { return ok({ error: (e as Error).message }, 500); }
  const ip = ipDe(req.headers);
  const navegador = (req.headers.get("user-agent") || "").slice(0, 200);

  // 1. Bloqueo por intentos fallidos
  const desde = new Date(Date.now() - MINUTOS_BLOQUEO * 60_000).toISOString();
  const { count: fallos } = await sb.from("consulta_registro").select("id", { count: "exact", head: true })
    .eq("ip", ip).eq("exito", false).gte("fecha", desde);
  if ((fallos ?? 0) >= MAX_FALLOS) {
    return ok({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${MINUTOS_BLOQUEO} minutos.` }, 429);
  }

  // 2. PIN vigente
  const { data: pin } = await sb.from("consulta_pin").select("*").eq("id", 1).maybeSingle();
  if (!pin) return ok({ error: "La consulta con PIN no está habilitada. Ingresa con tu cuenta." }, 403);
  if (new Date(pin.vence).getTime() < Date.now()) return ok({ error: "El PIN de consulta venció. Pide el nuevo PIN a Legal." }, 403);

  // 3. Validar PIN o constancia previa
  let token = body.token || "";
  const conToken = !!token && constanciaValida(token, pin.version);
  if (!conToken) {
    const p = String(body.pin || "").trim();
    if (!/^\d{6,8}$/.test(p) || !pinCorrecto(p, pin.sal, pin.pin_hash)) {
      await sb.from("consulta_registro").insert({ ip, navegador, exito: false, destino });
      const quedan = MAX_FALLOS - (fallos ?? 0) - 1;
      return ok({ error: quedan > 0 ? `PIN incorrecto. Te quedan ${quedan} intento(s).` : `PIN incorrecto. Acceso bloqueado por ${MINUTOS_BLOQUEO} minutos.`, pedirPin: true }, 401);
    }
    token = firmarConstancia(pin.version);
  }
  await sb.from("consulta_registro").insert({ ip, navegador, exito: true, destino });

  // 4. Contenido del archivador (solo lectura, datos mínimos)
  try {
    if (destino.tipo === "tomo") {
      let q = sb.from("v_tomo_detalle").select("tipo_documento, numero_documento, nombre, fecha_firma").eq("tomo", destino.tomo);
      if (destino.src === "lima") q = q.eq("src", "lima").eq("anio", destino.anio || "");
      else q = q.eq("src", "fisico").eq("region", destino.region || "");
      const { data, error } = await q;
      if (error) throw error;
      const filas = (data ?? []).map((f) => ({ documento: ocultarDoc(f.tipo_documento, f.numero_documento), nombre: f.nombre, fecha: f.fecha_firma, detalle: null }))
        .sort((a, b) => destino.src === "lima" ? (a.nombre || "").localeCompare(b.nombre || "") : (a.fecha || "").localeCompare(b.fecha || ""));
      return ok({ token, vence: pin.vence, titulo: destino.src === "lima" ? `Lima ${destino.anio} · Tomo ${destino.tomo}` : `${destino.region} · Tomo ${destino.tomo}`, empresa: "Global Go", filas });
    }

    const gf = sb.schema("gf");
    const cp = "contraparte:contraparte_id(tipo_documento, numero_documento, nombre)";
    if (destino.tipo === "gf_exp") {
      const { data, error } = await gf.from("proceso").select(`tipo, expediente, organo, localidad, materia, ${cp}`).eq("expediente_base", destino.base).order("expediente");
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filas = (data ?? []).map((p: any) => ({ documento: ocultarDoc(p.contraparte?.tipo_documento, p.contraparte?.numero_documento), nombre: p.contraparte?.nombre, fecha: null, detalle: [p.tipo, p.expediente, p.organo, p.localidad].filter(Boolean).join(" · ") }));
      return ok({ token, vence: pin.vence, titulo: `Expediente ${destino.base}`, empresa: "Global Factoring", filas });
    }

    const t = TABLAS_GF[destino.doc];
    if (!t) return ok({ error: "Archivador no válido" }, 400);
    const { data, error } = await gf.from(t.tabla).select(`${t.fecha}, observacion, ${cp}`).eq("folder", destino.folder).order(t.fecha, { nullsFirst: false });
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filas = (data ?? []).map((r: any) => ({ documento: ocultarDoc(r.contraparte?.tipo_documento, r.contraparte?.numero_documento), nombre: r.contraparte?.nombre, fecha: r[t.fecha], detalle: null }));
    return ok({ token, vence: pin.vence, titulo: `${t.etiqueta} · ${destino.folder}`, empresa: "Global Factoring", filas });
  } catch (e) {
    return ok({ error: "No se pudo leer el archivador: " + (e as Error).message }, 500);
  }
}
