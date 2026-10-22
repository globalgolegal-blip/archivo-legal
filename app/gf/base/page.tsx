"use client";

import { useEffect, useState, type CSSProperties } from "react";
import GfHeader, { main, inp, btn, btnGhost } from "../../../components/GfHeader";
import { COLOR } from "../../../lib/theme";
import { gf, fmt, useSesion, normFolder, docTexto, filtroContraparte } from "../../../lib/gf";

// Base de Global Factoring: explorador de registros por tipo de documento,
// con búsqueda por contraparte (nombre o RUC/DNI), filtro por folder y paginación.

const PAGE = 50;
type Tipo = "contrato" | "pagare" | "letra" | "proceso" | "transaccion";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- filas de tablas distintas
type Row = Record<string, any>;
type Col = { t: string; f: (r: Row) => string };

const monto = (r: Row) => (r.importe == null ? "—" : `${r.moneda === "USD" ? "US$" : "S/"} ${Number(r.importe).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`);

const TIPOS: Record<Tipo, { label: string; orden: string; cols: Col[] }> = {
  contrato: { label: "Contratos", orden: "fecha_creacion", cols: [
    { t: "Tipo", f: (r) => r.tipo ?? "Sin tipo" }, { t: "Creación", f: (r) => fmt(r.fecha_creacion) },
    { t: "Firma", f: (r) => r.estado_firma }, { t: "Cant.", f: (r) => String(r.cantidad ?? "") }] },
  pagare: { label: "Pagarés", orden: "fecha_creacion", cols: [
    { t: "Creación", f: (r) => fmt(r.fecha_creacion) }, { t: "Legalizado", f: (r) => (r.legalizado == null ? "—" : r.legalizado ? "Sí" : "No") },
    { t: "Juegos", f: (r) => String(r.juegos ?? "—") }] },
  letra: { label: "Letras de cambio", orden: "fecha_giro", cols: [
    { t: "Giro", f: (r) => fmt(r.fecha_giro) }, { t: "N°", f: (r) => r.numero ?? "—" }, { t: "Importe", f: monto }] },
  proceso: { label: "Procesos", orden: "expediente", cols: [
    { t: "Tipo", f: (r) => r.tipo }, { t: "Expediente", f: (r) => r.expediente ?? "—" },
    { t: "Localidad", f: (r) => r.localidad ?? "—" }, { t: "Rol de GF", f: (r) => r.rol }] },
  transaccion: { label: "Transacciones", orden: "fecha_firma", cols: [{ t: "Firma", f: (r) => fmt(r.fecha_firma) }] },
};

export default function GfBase() {
  const sesion = useSesion();
  const [tipo, setTipo] = useState<Tipo>("contrato");
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [sinFolder, setSinFolder] = useState(false);
  const [page, setPage] = useState(0);
  const [applied, setApplied] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [estado, setEstado] = useState("Cargando…");

  useEffect(() => {
    if (!sesion) return;
    (async () => {
      setEstado("Cargando…");
      let query = gf().from(tipo)
        .select("*, contraparte:contraparte_id!inner(tipo_documento, numero_documento, nombre)", { count: "exact" });
      if (sinFolder) query = query.is("folder", null);
      else if (folder.trim()) query = query.eq("folder", normFolder(folder));
      if (q.trim()) query = filtroContraparte(query, q, "contraparte.");
      const from = page * PAGE;
      const { data, error, count } = await query.order(TIPOS[tipo].orden, { nullsFirst: false }).range(from, from + PAGE - 1);
      if (error) { setEstado(error.message); return; }
      setRows((data ?? []) as Row[]);
      setTotal(count ?? 0);
      setEstado("");
    })();
  }, [sesion, tipo, sinFolder, page, applied]); // eslint-disable-line react-hooks/exhaustive-deps

  function buscar() { setPage(0); setApplied((a) => a + 1); }

  if (!sesion) return <main style={main} />;
  const paginas = Math.max(1, Math.ceil(total / PAGE));
  const cols = TIPOS[tipo].cols;

  return (
    <main style={main}>
      <GfHeader titulo="Base de datos · Global Factoring" sub="Explorador de registros" />
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as Tipo); setPage(0); }} style={{ ...inp, width: "auto" }}>
            {(Object.keys(TIPOS) as Tipo[]).map((k) => <option key={k} value={k}>{TIPOS[k].label}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="Buscar contraparte o RUC/DNI…" style={{ ...inp, flex: 1, minWidth: 220, width: "auto" }} />
          <input value={folder} onChange={(e) => setFolder(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="Folder" disabled={sinFolder} style={{ ...inp, width: 100 }} />
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: COLOR.textSec }}>
            <input type="checkbox" checked={sinFolder} onChange={(e) => { setSinFolder(e.target.checked); setPage(0); }} /> Sin folder
          </label>
          <button onClick={buscar} style={btn}>Buscar</button>
        </div>

        <div style={{ fontSize: 13, color: COLOR.textSec, marginBottom: 8 }}>
          {estado || total.toLocaleString("es-PE") + " registro(s)"}
        </div>

        <div style={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>
              {["Contraparte", "RUC/DNI", ...cols.map((c) => c.t), "Folder", "Observación"].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={td}><a href={`/gf?q=${encodeURIComponent(r.contraparte?.nombre ?? "")}`} style={{ color: COLOR.text }}>{r.contraparte?.nombre ?? "—"}</a></td>
                  <td style={{ ...td, color: r.contraparte?.tipo_documento === "PENDIENTE" ? "#B26A00" : undefined, whiteSpace: "nowrap" }}>{r.contraparte ? docTexto(r.contraparte) : "—"}</td>
                  {cols.map((c) => <td key={c.t} style={td}>{c.f(r)}</td>)}
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{r.folder ?? "—"}</td>
                  <td style={td}>{r.observacion ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 && estado === "" && <tr><td style={td} colSpan={cols.length + 4}>Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0} style={btnGhost}>‹ Anterior</button>
          <span style={{ fontSize: 13, color: COLOR.textSec }}>Página {page + 1} de {paginas}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= paginas - 1} style={btnGhost}>Siguiente ›</button>
        </div>
      </section>
    </main>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${COLOR.border}`, color: COLOR.textSec, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #E8E6DF", verticalAlign: "top" };
