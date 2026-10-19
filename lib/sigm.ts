// ============================================================================
//  lib/sigm.ts — parseo del Excel del SIGM (usado por el endpoint /api/ingest/sigm).
//  Misma lógica y mismos mapeos de columnas que la carga manual, pero del lado
//  del servidor. Función pura: recibe los bytes del Excel y devuelve las filas.
// ============================================================================
import * as XLSX from "xlsx";

function tdoc(s: any): string | null {
  s = String(s ?? "").toUpperCase();
  if (s.indexOf("DNI") >= 0) return "DNI";
  if (s.indexOf("EXTRANJER") >= 0 || s.trim() === "CE" || s.indexOf("CARN") >= 0) return "CARNÉ DE EXTRANJERÍA";
  if (s.indexOf("PASAPORTE") >= 0) return "PASAPORTE";
  if (s.indexOf("PTP") >= 0) return "PTP";
  return null;
}
function num(s: any): string {
  return s == null ? "" : String(s).replace(/\s+/g, "").toUpperCase();
}
function pad(n: any): string {
  return String(n).padStart(2, "0");
}
function isoDate(v: any): string | null {
  return v instanceof Date && !isNaN(v as any)
    ? v.getFullYear() + "-" + pad(v.getMonth() + 1) + "-" + pad(v.getDate())
    : null;
}
function dmy(v: any): string | null {
  if (v instanceof Date && !isNaN(v as any)) return isoDate(v);
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + "-" + pad(+m[2]) + "-" + pad(+m[1]) : null;
}
function siNo(v: any): boolean | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "sí" || s === "si" || s === "s" || s === "true") return true;
  if (s === "no" || s === "n" || s === "false") return false;
  return null;
}
function clean(v: any): string | null {
  v = v == null ? "" : String(v).trim();
  return v === "" ? null : v;
}
function sigmEstado(s: any): string {
  s = String(s ?? "").toLowerCase();
  if (s.indexOf("constitu") >= 0) return "Constituida";
  if (s.indexOf("modific") >= 0) return "Modificada";
  if (s.indexOf("cancel") >= 0 || s.indexOf("levant") >= 0) return "Cancelada / Levantada";
  if (s.indexOf("termin") >= 0) return "Ejecución terminada";
  if (s.indexOf("ejec") >= 0 || s.indexOf("inicio") >= 0) return "En ejecución";
  return "Sin estado";
}

export type SigmParse = {
  deudores: any[];
  bienes: any[];
  garantias: any[];
  omitidas: number;
};

export function parseSigm(buf: ArrayBuffer | Uint8Array): SigmParse {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const sn = wb.SheetNames.indexOf("Garantias") >= 0 ? "Garantias" : wb.SheetNames[0];
  const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, blankrows: false });

  const h = aoa.findIndex((r) => r && r.some((c) => String(c).trim().toLowerCase().indexOf("folio causal") >= 0));
  if (h < 0) throw new Error('No encontré el encabezado "Folio causal (clave)".');
  const hd = aoa[h].map((c) => (c == null ? "" : String(c).trim()));
  const ix: Record<string, number> = {};
  hd.forEach((n, k) => { if (n) ix[n] = k; });
  const g = (r: any[], n: string) => (n in ix ? r[ix[n]] : null);

  const deudores: Record<string, any> = {};
  const gmap: Record<string, any> = {};
  let omitidas = 0;

  for (let r = h + 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.every((c) => c == null)) continue;
    const folio = clean(g(row, "Folio causal (clave)"));
    if (!folio) continue;
    const td = tdoc(g(row, "Tipo de documento"));
    const nd = num(g(row, "N° de documento"));
    if (!td || !nd) { omitidas++; continue; }
    const key = td + "|" + nd;
    let did: string;
    if (deudores[key]) {
      did = deudores[key].id;
    } else {
      did = crypto.randomUUID();
      // Columna real = nombre_completo (no "nombre").
      deudores[key] = { id: did, tipo_documento: td, numero_documento: nd, nombre_completo: clean(g(row, "Nombre completo del deudor")) };
    }
    gmap[folio] = {
      deudor_id: did,
      bien: {
        marca: clean(g(row, "Marca")), modelo: clean(g(row, "Modelo")), placa: clean(g(row, "Placa")),
        numero_serie: clean(g(row, "N° de serie")), numero_motor: clean(g(row, "N° de motor")),
        pendiente_placa: siNo(g(row, "Pendiente de placa")),
      },
      gar: {
        folio, id_credito: clean(g(row, "ID de Crédito")), estado: sigmEstado(g(row, "Estado actual")),
        departamento: clean(g(row, "Departamento")), provincia: clean(g(row, "Provincia")), distrito: clean(g(row, "Distrito")),
        fecha_constitucion: dmy(g(row, "Fecha constitución")), fecha_modificacion: dmy(g(row, "Fecha modificación")),
        fecha_inicio_ejec: dmy(g(row, "Fecha inicio ejec.")), fecha_termino_ejec: dmy(g(row, "Fecha término ejec.")),
        fecha_cancelacion: dmy(g(row, "Fecha cancelación")), observaciones: clean(g(row, "Observaciones")),
      },
    };
  }

  const deudList = Object.values(deudores);
  const bienes: any[] = [];
  const garantias: any[] = [];
  Object.keys(gmap).forEach((f) => {
    const e = gmap[f];
    const bid = crypto.randomUUID();
    e.bien.id = bid;
    bienes.push(e.bien);
    e.gar.deudor_id = e.deudor_id;
    e.gar.bien_id = bid;
    garantias.push(e.gar);
  });

  return { deudores: deudList, bienes, garantias, omitidas };
}
