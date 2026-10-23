"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";
import EmpresaHeader from "../../components/EmpresaHeader";

const PAGE = 50;

type Row = {
  situacion: string | null;
  numero_documento: string | null;
  nombre: string | null;
  folio: string | null;
  estado_garantia: string | null;
  placa: string | null;
  falta_placa: boolean;
  tomo_doc: string | null;
  sede_doc: string | null;
  tomo_lima: string | null;
};

export default function Base() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [sit, setSit] = useState("");
  const [pla, setPla] = useState("");
  const [applied, setApplied] = useState(0);
  const [estado, setEstado] = useState("Cargando…");

  useEffect(() => {
    (async () => {
      setEstado("Cargando…");
      let query = supabase
        .from("v_empate")
        .select(
          "situacion,numero_documento,nombre,folio,estado_garantia,placa,falta_placa,tomo_doc,sede_doc,tomo_lima",
          { count: "exact" }
        );
      if (sit) query = query.eq("situacion", sit);
      // "Pendiente de modificación" = garantía vigente sin placa (marca falta_placa de la base).
      // "Con placa" = la placa tiene un valor (antes también colaba a quienes no tienen garantía).
      if (pla === "1") query = query.eq("falta_placa", true);
      else if (pla === "0") query = query.not("placa", "is", null).neq("placa", "");
      if (q.trim()) {
        const like = "%" + q.trim().replace(/[%,]/g, "") + "%";
        query = query.or(`numero_documento.ilike.${like},nombre.ilike.${like}`);
      }
      const from = page * PAGE;
      const { data, error, count } = await query
        .order("nombre", { nullsFirst: false })
        .range(from, from + PAGE - 1);
      if (error) { setEstado(error.message); return; }
      setRows((data ?? []) as Row[]);
      setTotal(count ?? 0);
      setEstado("");
    })();
  }, [sit, pla, page, applied]);

  function buscar() { setPage(0); setApplied((a) => a + 1); }

  function fisico(r: Row) {
    if (r.tomo_doc) return "Tomo " + r.tomo_doc + (r.sede_doc ? " · " + r.sede_doc : "");
    if (r.tomo_lima) return "Tomo " + r.tomo_lima + " · LIMA";
    return "—";
  }

  const paginas = Math.max(1, Math.ceil(total / PAGE));

  return (
    <main style={{ minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
            <EmpresaHeader empresa="globalgo" titulo="Base de datos · Global Go" sub="Explorador de registros" />

      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") buscar(); }} placeholder="Buscar documento o nombre…" style={{ ...inp, flex: 1, minWidth: 220 }} />
          <select value={sit} onChange={(e) => { setSit(e.target.value); setPage(0); }} style={inp}>
            <option value="">Todas las situaciones</option>
            <option>Desembolsado</option><option>Cerrado</option><option>Generado</option>
          </select>
          <select value={pla} onChange={(e) => { setPla(e.target.value); setPage(0); }} style={inp}>
            <option value="">Placa: todas</option>
            <option value="1">Pendiente de modificación</option>
            <option value="0">Con placa</option>
          </select>
          <button onClick={buscar} style={btn}>Buscar</button>
        </div>

        <div style={{ fontSize: 13, color: COLOR.textSec, marginBottom: 8 }}>
          {estado || total.toLocaleString("es-PE") + " registro(s)"}
        </div>

        <div style={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Situación", "Documento", "Nombre", "Garantía", "Placa", "Físico"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${COLOR.border}`, color: COLOR.textSec }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.situacion}</td>
                  <td style={td}>{r.numero_documento}</td>
                  <td style={td}>{r.nombre}</td>
                  <td style={td}>{(r.folio || "—") + (r.estado_garantia ? " · " + r.estado_garantia : "")}</td>
                  <td style={td}>{r.falta_placa ? <span style={{ color: "#A32D2D", fontWeight: 600 }} title="Garantía vigente sin placa: falta incorporarla con un formulario de modificación">⚠ pendiente de modificación</span> : (r.placa || "—")}</td>
                  <td style={td}>{fisico(r)}</td>
                </tr>
              ))}
              {rows.length === 0 && estado === "" && (
                <tr><td style={td} colSpan={6}>Sin resultados.</td></tr>
              )}
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

const inp: CSSProperties = { fontSize: 16, padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff" };
const btn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const btnGhost: CSSProperties = { background: "#fff", border: "1px solid #D3D1C7", borderRadius: 8, padding: "9px 14px", fontSize: 14, cursor: "pointer" };
const td: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #E8E6DF" };
