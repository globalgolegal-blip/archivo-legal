"use client";

import { useEffect, useState, type CSSProperties } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";
import EmpresaHeader from "../../components/EmpresaHeader";

// ============================================================================
//  CARGAS — port 1:1 de las tres cargas del app estático a Next.js.
//  SIGM (reemplazo total de garantías) · Mes (solicitudes, upsert) ·
//  Saneamiento (archivo físico por sede, delete+insert por sede).
//  Usa el mismo cliente supabase (schema gm) y las mismas políticas RLS.
// ============================================================================

// ---------- helpers de formato (idénticos al app estático) ----------
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
function pad(n: any): string {
  return String(n).padStart(2, "0");
}
function iso(v: any): string | null {
  return v instanceof Date && !isNaN(v as any)
    ? v.getFullYear() + "-" + pad(v.getMonth() + 1) + "-" + pad(v.getDate()) + "T" + pad(v.getHours()) + ":" + pad(v.getMinutes()) + ":" + pad(v.getSeconds())
    : null;
}
function isoDate(v: any): string | null {
  return v instanceof Date && !isNaN(v as any)
    ? v.getFullYear() + "-" + pad(v.getMonth() + 1) + "-" + pad(v.getDate())
    : null;
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

async function readWB(file: File) {
  const buf = await file.arrayBuffer();
  return XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
}

type Msg = { kind: "" | "ok" | "err"; text: string };

export default function CargasPage() {
  const [tab, setTab] = useState<"sigm" | "mes" | "sede">("sigm");
  const [sesion, setSesion] = useState<boolean | null>(null);

  const [sigmFile, setSigmFile] = useState<File | null>(null);
  const [sigmOk, setSigmOk] = useState(false);
  const [mesFile, setMesFile] = useState<File | null>(null);
  const [sedeFile, setSedeFile] = useState<File | null>(null);

  const [sigmMsg, setSigmMsg] = useState<Msg>({ kind: "", text: "" });
  const [mesMsg, setMesMsg] = useState<Msg>({ kind: "", text: "" });
  const [sedeMsg, setSedeMsg] = useState<Msg>({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSesion(false);
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      setSesion(true);
    })();
  }, []);

  // ---------- carga mes (solicitudes) ----------
  async function goMes() {
    if (!mesFile) return;
    setBusy(true);
    setMesMsg({ kind: "", text: "Procesando…" });
    try {
      const wb = await readWB(mesFile);
      const sh = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, blankrows: false });
      const h = aoa.findIndex((r) => r && String(r[0]).trim() === "Estado");
      if (h < 0) throw new Error('No encontré la fila de encabezados "Estado".');
      const hd = aoa[h].map((c) => (c == null ? "" : String(c).trim()));
      const ix: Record<string, number> = {};
      hd.forEach((n, k) => { if (n) ix[n] = k; });
      const g = (r: any[], n: string) => (n in ix ? r[ix[n]] : null);

      const byId: Record<string, any> = {};
      for (let r = h + 1; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || row.every((c) => c == null)) continue;
        const est = String(g(row, "Estado") ?? "").trim();
        if (["Desembolsado", "Generado", "CERRADO"].indexOf(est) < 0) continue;
        const cid = String(g(row, "CLiente ID") ?? "").trim();
        if (!cid) continue;
        const fr = g(row, "Fecha de Registro");
        const per = fr instanceof Date && !isNaN(fr as any) ? fr.getFullYear() + "-" + pad(fr.getMonth() + 1) : null;
        byId[cid] = {
          cliente_id: cid, estado: est, tipo_documento: tdoc(g(row, "Tipo Doc Iden")),
          numero_documento: num(g(row, "Documento identidad")), nombre: String(g(row, "Nombre") ?? ""),
          fecha_registro: iso(fr), distribuidor: String(g(row, "Distribuidor") ?? ""),
          tienda: String(g(row, "Tienda") ?? ""), empleado: String(g(row, "Empleado") ?? ""), periodo: per,
        };
      }
      const rows = Object.values(byId);
      if (!rows.length) throw new Error("No se encontraron filas Desembolsado/Generado/CERRADO.");

      let done = 0;
      const N = 500;
      for (let i = 0; i < rows.length; i += N) {
        const { error } = await supabase.from("solicitud").upsert(rows.slice(i, i + N), { onConflict: "cliente_id" });
        if (error) throw error;
        done += Math.min(N, rows.length - i);
        setMesMsg({ kind: "", text: `Cargando ${done.toLocaleString("es-PE")}/${rows.length.toLocaleString("es-PE")}…` });
      }
      setMesMsg({ kind: "ok", text: `Cargadas/actualizadas ${done.toLocaleString("es-PE")} solicitudes.` });
    } catch (ex: any) {
      setMesMsg({ kind: "err", text: "Error: " + (ex.message || ex) });
    }
    setBusy(false);
  }

  // ---------- carga saneamiento (sede) ----------
  async function goSede() {
    if (!sedeFile) return;
    setBusy(true);
    setSedeMsg({ kind: "", text: "Procesando…" });
    try {
      const wb = await readWB(sedeFile);
      const rows: any[] = [];
      const sedes: Record<string, number> = {};
      wb.SheetNames.forEach((sn) => {
        if (sn === "Listas") return;
        const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, blankrows: false });
        const h = aoa.findIndex((r) => r && r.some((c) => String(c).trim().toUpperCase() === "DOCUMENTO"));
        if (h < 0) return;
        const hd = aoa[h].map((c) => (c == null ? "" : String(c).trim().toUpperCase()));
        const ix: Record<string, number> = {};
        hd.forEach((n, k) => { if (n) ix[n] = k; });
        const g = (r: any[], n: string) => (n in ix ? r[ix[n]] : null);
        for (let r = h + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row || row.every((c) => c == null)) continue;
          const doc = num(g(row, "DOCUMENTO"));
          if (!doc && g(row, "TOMO") == null) continue;
          sedes[sn] = 1;
          rows.push({
            sede: sn, tipo_documento: tdoc(g(row, "TIPO DE DOCUMENTO")), numero_documento: doc,
            estado_civil: ecivil(g(row, "ESTADO CIVIL")),
            tomo: g(row, "TOMO") == null ? null : String(g(row, "TOMO")),
            fecha_firma: isoDate(g(row, "FECHA DE FIRMA")),
          });
        }
      });
      if (!rows.length) throw new Error("No encontré filas con DOCUMENTO en las hojas de sede.");
      const sedeList = Object.keys(sedes);

      const del = await supabase.from("archivo_fisico").delete().in("sede", sedeList);
      if (del.error) throw del.error;

      let done = 0;
      const N = 500;
      for (let i = 0; i < rows.length; i += N) {
        const ins = await supabase.from("archivo_fisico").insert(rows.slice(i, i + N));
        if (ins.error) throw ins.error;
        done += Math.min(N, rows.length - i);
        setSedeMsg({ kind: "", text: `Insertando ${done.toLocaleString("es-PE")}/${rows.length.toLocaleString("es-PE")}…` });
      }
      setSedeMsg({ kind: "ok", text: `Cargadas ${done.toLocaleString("es-PE")} filas de ${sedeList.join(", ")}.` });
    } catch (ex: any) {
      setSedeMsg({ kind: "err", text: "Error: " + (ex.message || ex) });
    }
    setBusy(false);
  }

  // ---------- carga SIGM (reemplazo total de la base de garantías) ----------
  async function delAll(table: string) {
    const r = await supabase.from(table).delete().not("id", "is", null);
    if (r.error) throw r.error;
  }
  async function insChunks(table: string, data: any[], label: string, setMsg: (m: Msg) => void) {
    const N = 500;
    for (let i = 0; i < data.length; i += N) {
      const ins = await supabase.from(table).insert(data.slice(i, i + N));
      if (ins.error) throw ins.error;
      setMsg({ kind: "", text: `Insertando ${label} ${Math.min(i + N, data.length).toLocaleString("es-PE")}/${data.length.toLocaleString("es-PE")}…` });
    }
  }
  async function goSigm() {
    if (!sigmFile || !sigmOk) return;
    setBusy(true);
    setSigmMsg({ kind: "", text: "Leyendo Excel…" });
    try {
      const wb = await readWB(sigmFile);
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
      let omit = 0;
      for (let r = h + 1; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || row.every((c) => c == null)) continue;
        const folio = clean(g(row, "Folio causal (clave)"));
        if (!folio) continue;
        const td = tdoc(g(row, "Tipo de documento"));
        const nd = num(g(row, "N° de documento"));
        if (!td || !nd) { omit++; continue; }
        const key = td + "|" + nd;
        let did: string;
        if (deudores[key]) { did = deudores[key].id; }
        else {
          did = crypto.randomUUID();
          // La columna real es nombre_completo (no "nombre") y es NOT NULL:
          // si el deudor viene sin nombre, se marca con placeholder en vez de null.
          deudores[key] = { id: did, tipo_documento: td, numero_documento: nd, nombre_completo: clean(g(row, "Nombre completo del deudor")) ?? "(SIN NOMBRE)" };
        }
        gmap[folio] = {
          deudor_id: did,
          bien: {
            marca: clean(g(row, "Marca")), modelo: clean(g(row, "Modelo")), placa: clean(g(row, "Placa")),
            numero_serie: clean(g(row, "N° de serie")), numero_motor: clean(g(row, "N° de motor")),
            pendiente_placa: siNo(g(row, "Pendiente de placa")),
          },
          gar: {
            folio: folio, id_credito: clean(g(row, "ID de Crédito")), estado: sigmEstado(g(row, "Estado actual")),
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
      if (!garantias.length) throw new Error("No se encontraron garantías con folio y documento válidos.");

      setSigmMsg({ kind: "", text: "Borrando base de garantías anterior…" });
      await delAll("acto");
      await delAll("garantia");
      await delAll("bien");
      await delAll("deudor");
      await insChunks("deudor", deudList, "deudores", setSigmMsg);
      await insChunks("bien", bienes, "bienes", setSigmMsg);
      await insChunks("garantia", garantias, "garantías", setSigmMsg);

      setSigmMsg({
        kind: "ok",
        text: `Listo: ${garantias.length.toLocaleString("es-PE")} garantías y ${deudList.length.toLocaleString("es-PE")} deudores cargados${omit ? " · " + omit.toLocaleString("es-PE") + " filas omitidas por tipo/N° de documento no reconocido" : ""}.`,
      });
      setSigmOk(false);
      setSigmFile(null);
    } catch (ex: any) {
      setSigmMsg({ kind: "err", text: "Error: " + (ex.message || ex) });
    }
    setBusy(false);
  }

  if (sesion === null) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (sesion === false) return <div style={{ padding: 24 }}>Redirigiendo a iniciar sesión…</div>;

  const TABS: { k: typeof tab; label: string }[] = [
    { k: "sigm", label: "Cargar SIGM (garantías)" },
    { k: "mes", label: "Cargar mes (solicitudes)" },
    { k: "sede", label: "Cargar saneamiento (sede)" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <EmpresaHeader empresa="globalgo" titulo="Cargas de datos" sub="Alimenta el archivo: garantías, solicitudes y saneamiento físico" />

      <section style={{ maxWidth: 820, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} style={tab === t.k ? tabOn : tabOff}>{t.label}</button>
          ))}
        </div>

        {tab === "sigm" && (
          <Panel titulo="Cargar base del SIGM (garantías mobiliarias)">
            <p style={hint}>
              Sube el Excel <b>Base_Garantias_SIGM</b> (hoja &quot;Garantias&quot;). Como el SIGM exporta la base completa,
              esta carga <b>reemplaza</b> toda la base de garantías con el snapshot nuevo (deudores, bienes y garantías):
              así se actualizan placas y estados y no quedan folios duplicados.
            </p>
            <FilePick file={sigmFile} onPick={setSigmFile} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", fontSize: 13 }}>
              <input type="checkbox" checked={sigmOk} onChange={(e) => setSigmOk(e.target.checked)} />
              Entiendo que esto <b>borra y reemplaza</b> toda la base de garantías actual.
            </label>
            <button disabled={!sigmFile || !sigmOk || busy} onClick={goSigm} style={goBtn(!sigmFile || !sigmOk || busy)}>
              Reemplazar base de garantías
            </button>
            <MsgView m={sigmMsg} />
          </Panel>
        )}

        {tab === "mes" && (
          <Panel titulo="Cargar solicitudes del mes">
            <p style={hint}>
              Sube el Excel del <b>ReporteSolicitudes</b>. Se toman Desembolsado, Generado y CERRADO,
              y se actualiza por cliente (no duplica).
            </p>
            <FilePick file={mesFile} onPick={setMesFile} />
            <button disabled={!mesFile || busy} onClick={goMes} style={goBtn(!mesFile || busy)}>Cargar solicitudes</button>
            <MsgView m={mesMsg} />
          </Panel>
        )}

        {tab === "sede" && (
          <Panel titulo="Cargar saneamiento (archivo físico por sede)">
            <p style={hint}>
              Sube el Excel por sede: cada hoja es una sede (se omite la hoja &quot;Listas&quot;). Se reemplazan
              las filas de las sedes incluidas en el archivo.
            </p>
            <FilePick file={sedeFile} onPick={setSedeFile} />
            <button disabled={!sedeFile || busy} onClick={goSede} style={goBtn(!sedeFile || busy)}>Cargar saneamiento</button>
            <MsgView m={sedeMsg} />
          </Panel>
        )}

        <div style={{ marginTop: 20, fontSize: 12, color: COLOR.textSec }}>
          <a href="/panel" style={{ color: COLOR.text }}>Ver panel</a> · <a href="/base" style={{ color: COLOR.text }}>Ver base</a>
        </div>
      </section>
    </main>
  );
}

// ---------- subcomponentes ----------
function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 12, background: "#fff", padding: 20 }}>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>{titulo}</h2>
      {children}
    </div>
  );
}
function FilePick({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label style={{ display: "block", border: `1.5px dashed ${COLOR.border}`, borderRadius: 10, padding: 18, textAlign: "center", cursor: "pointer", background: COLOR.bg }}>
      {file ? <b>{file.name}</b> : <span>Haz clic para elegir el Excel (.xlsx)</span>}
      <input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}
function MsgView({ m }: { m: Msg }) {
  if (!m.text) return null;
  const color = m.kind === "ok" ? "#1b7f3b" : m.kind === "err" ? "#b00020" : COLOR.textSec;
  return <div style={{ marginTop: 14, fontSize: 13, color, whiteSpace: "pre-wrap" }}>{m.text}</div>;
}

// ---------- estilos ----------
const hint: CSSProperties = { fontSize: 13, color: COLOR.textSec, lineHeight: 1.5 };
const tabOn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const tabOff: CSSProperties = { background: "#fff", color: "#1A2238", border: "1px solid #D3D1C7", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" };
function goBtn(disabled: boolean): CSSProperties {
  return { marginTop: 14, background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "11px 18px", fontWeight: 600, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 };
}
