// ============================================================================
//  lib/gf.ts — utilidades de Global Factoring (esquema "gf" en Supabase).
//  Usa el mismo cliente/sesión que el resto de la app, apuntando a otro esquema.
// ============================================================================
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { EMPRESAS } from "./empresas";

export const gf = () => supabase.schema("gf");

const _E = EMPRESAS.factoring;
export const GF = { label: _E.nombre, color: _E.primario, logo: _E.logo, pref: _E.pref };

export const TIPOS_DOC = ["RUC", "DNI", "CE", "PASAPORTE"] as const;

export type Contraparte = { id: string; tipo_documento: string; numero_documento: string | null; nombre: string | null };

/** Las contrapartes importadas del Sheets entran con documento PENDIENTE hasta completar su RUC/DNI. */
export const docTexto = (c: { tipo_documento: string; numero_documento: string | null }) =>
  c.tipo_documento === "PENDIENTE" ? "RUC/DNI pendiente" : `${c.tipo_documento} ${c.numero_documento}`;

// --- Documentos -------------------------------------------------------------
export const normDoc = (s: string) => s.replace(/[\s.-]+/g, "").toUpperCase();

export function rucValido(r: string): boolean {
  if (!/^(10|15|17|20)\d{9}$/.test(r)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 10; i++) s += +r[i] * w[i];
  let c = 11 - (s % 11);
  if (c === 10) c = 0; else if (c === 11) c = 1;
  return c === +r[10];
}

/** Devuelve el mensaje de error, o "" si el documento es válido (mismas reglas que la base). */
export function errorDocumento(tipo: string, num: string): string {
  if (!num) return "Ingresa el número de documento.";
  if (tipo === "RUC") return rucValido(num) ? "" : "RUC inválido: revisa los 11 dígitos (no pasa el dígito verificador).";
  if (tipo === "DNI") return /^\d{8}$/.test(num) ? "" : "El DNI debe tener 8 dígitos.";
  if (tipo === "CE") return /^[0-9A-Z]{6,12}$/.test(num) ? "" : "Carné de extranjería: 6 a 12 caracteres.";
  if (tipo === "PASAPORTE") return /^[0-9A-Z]{5,12}$/.test(num) ? "" : "Pasaporte: 5 a 12 caracteres.";
  return "Tipo de documento no válido.";
}

/** Busca la contraparte por documento; si no existe la crea. Actualiza el nombre si venía vacío. */
export async function obtenerContraparte(tipo: string, num: string, nombre: string): Promise<Contraparte> {
  const n = normDoc(num);
  const err = errorDocumento(tipo, n);
  if (err) throw new Error(err);
  const nom = nombre.trim().replace(/\s+/g, " ").toUpperCase() || null;
  const { data: ex, error: e1 } = await gf().from("contraparte").select("*")
    .eq("tipo_documento", tipo).eq("numero_documento", n).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (ex) {
    if (!ex.nombre && nom) await gf().from("contraparte").update({ nombre: nom }).eq("id", ex.id);
    return { ...ex, nombre: ex.nombre || nom };
  }
  // Si ya existe con el mismo nombre y documento pendiente (importada del Sheets), se completa esa
  if (nom) {
    const { data: pend } = await gf().from("contraparte").select("*")
      .eq("tipo_documento", "PENDIENTE").eq("nombre", nom).limit(1).maybeSingle();
    if (pend) {
      const { data, error } = await gf().from("contraparte")
        .update({ tipo_documento: tipo, numero_documento: n }).eq("id", pend.id).select("*").single();
      if (error) throw new Error(error.message);
      return data as Contraparte;
    }
  }
  const { data, error } = await gf().from("contraparte")
    .insert({ tipo_documento: tipo, numero_documento: n, nombre: nom }).select("*").single();
  if (error) throw new Error(error.message);
  return data as Contraparte;
}

const TABLAS_GF = ["contrato", "pagare", "letra", "proceso", "transaccion"];

/**
 * Completa el RUC/DNI de una contraparte pendiente. Si ese documento ya pertenece a otra
 * contraparte (el mismo cliente escrito distinto en el Sheets), pasa todos sus documentos
 * a esa y elimina la pendiente. Devuelve el id de la contraparte que queda.
 */
export async function completarDocumento(id: string, tipo: string, num: string): Promise<{ id: string; fusion: boolean }> {
  const n = normDoc(num);
  const err = errorDocumento(tipo, n);
  if (err) throw new Error(err);
  const { data: ex, error: e1 } = await gf().from("contraparte").select("id, nombre")
    .eq("tipo_documento", tipo).eq("numero_documento", n).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (ex && ex.id !== id) {
    for (const t of TABLAS_GF) {
      const { error } = await gf().from(t).update({ contraparte_id: ex.id }).eq("contraparte_id", id);
      if (error) throw new Error(error.message);
    }
    const { data: yo } = await gf().from("contraparte").select("nombre").eq("id", id).maybeSingle();
    if (!ex.nombre && yo?.nombre) await gf().from("contraparte").update({ nombre: yo.nombre }).eq("id", ex.id);
    const { error } = await gf().from("contraparte").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id: ex.id, fusion: true };
  }
  const { error } = await gf().from("contraparte").update({ tipo_documento: tipo, numero_documento: n }).eq("id", id);
  if (error) throw new Error(error.message);
  return { id, fusion: false };
}

// --- Búsqueda flexible --------------------------------------------------------
/** Igual que la columna "clave" de la base: sin tildes, puntos ni símbolos, en mayúsculas. */
export const claveBusqueda = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Aplica la búsqueda flexible a una consulta: si se escriben números, busca dentro del RUC/DNI;
 * si se escriben palabras, cada palabra debe aparecer en el nombre, en cualquier orden
 * ("setell tele" encuentra "TELECOMUNICACIONES SETELL E.I.R.L"). `pref` permite filtrar
 * por la contraparte vinculada (ej. "contraparte.").
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sirve para cualquier consulta de supabase
export function filtroContraparte<Q extends { ilike: (c: string, p: string) => any }>(q: Q, texto: string, pref = ""): Q {
  const t = texto.trim();
  const dig = t.replace(/\D/g, "");
  if (dig.length >= 3 && dig.length === t.replace(/[^0-9A-Za-z]/g, "").length) return q.ilike(pref + "numero_documento", `%${dig}%`) as Q;
  let r = q;
  for (const w of claveBusqueda(t).split(" ").filter(Boolean)) r = r.ilike(pref + "clave", `%${w}%`) as Q;
  return r;
}

// --- Folders ----------------------------------------------------------------
/** "6", "folder 6 ", "F6" -> "FOLDER 6". Texto libre se guarda en mayúsculas. */
export function normFolder(s: string): string | null {
  const t = s.trim().replace(/\s+/g, " ").toUpperCase();
  if (!t) return null;
  const m = t.match(/^(?:FOLDER|F)?\s*(\d+)$/);
  return m ? "FOLDER " + +m[1] : t;
}
export const numFolder = (f: string) => f.replace(/^FOLDER\s*/, "");

export const DOCS = {
  contrato: { tabla: "contrato", label: "Contratos", sigla: "CTR", fecha: "fecha_creacion" },
  pagare: { tabla: "pagare", label: "Pagarés", sigla: "PAG", fecha: "fecha_creacion" },
  letra: { tabla: "letra", label: "Letras de cambio", sigla: "LET", fecha: "fecha_giro" },
  transaccion: { tabla: "transaccion", label: "Transacciones", sigla: "TRX", fecha: "fecha_firma" },
} as const;
export type DocKey = keyof typeof DOCS;

// --- Procesos ---------------------------------------------------------------
export const ROLES: Record<string, string[]> = {
  CIVIL: ["DEMANDANTE", "DEMANDADO"],
  PENAL: ["AGRAVIADO", "TERCERO CIVIL"],
  CONCURSAL: ["ACREEDOR SOLICITANTE", "ACREEDOR", "DEUDOR"],
};

/** Etiqueta de la OTRA parte según el rol de Global Factoring. */
export function etiquetaContraparte(tipo: string, rol: string): string {
  if (tipo === "CIVIL") return rol === "DEMANDANTE" ? "DDO" : "DTE";
  if (tipo === "PENAL") return rol === "AGRAVIADO" ? "IMPUTADO" : "AGRAVIADO";
  if (tipo === "CONCURSAL") return rol === "DEUDOR" ? "ACREEDOR" : "DEUDORA";
  return "";
}

/** 03204-2025-63-1866-JP-CI-03 -> 03204-2025 · 42-2024/CCO-INDECOPI -> 42-2024 */
export function expSimple(exp: string): string {
  const e = exp.trim().split("/")[0];
  const m = e.match(/^(\d+-\d{4})/);
  return m ? m[1] : e;
}

/** Abreviatura concursal a partir de la materia. */
export function siglaConcursal(materia: string | null): string {
  const m = (materia || "").toUpperCase();
  if (m.includes("PREVENTIV")) return "PCP";
  if (m.includes("ORDINARI")) return "PCO";
  return "";
}

export const SIGLA_PROCESO: Record<string, string> = { CIVIL: "CIV", PENAL: "PEN", CONCURSAL: "CON" };
export const TAG_PROCESO: Record<string, string> = { CIVIL: "PROCESO CIVIL", PENAL: "PROCESO PENAL", CONCURSAL: "CONCURSAL · INDECOPI" };

// --- Fechas -----------------------------------------------------------------
const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
export function mesAnio(d: string | null) {
  if (!d) return "";
  const p = d.split("-");
  return MES[(+p[1] || 1) - 1] + " " + p[0];
}
export function fmt(d: string | null) {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

// --- Sesión -----------------------------------------------------------------
/** Igual que las demás pantallas: sin sesión, redirige al login y vuelve aquí. */
export function useSesion(redirigir = true) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && !redirigir) { setOk(false); return; }
      if (!data.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        setOk(false);
      } else setOk(true);
    });
  }, [redirigir]);
  return ok;
}
