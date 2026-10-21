"use client";

import { useEffect, useState, type CSSProperties } from "react";
import GfHeader, { main, inp, btn, btnGhost, card } from "../../components/GfHeader";
import { gf, normDoc, normFolder, fmt, useSesion, DOCS, type DocKey, type Contraparte } from "../../lib/gf";

// Buscador de Global Factoring: por RUC/DNI, nombre o expediente.
// Los QR de los lomos abren esta pantalla con ?exp=<expediente base> o ?folder=<tipo>|<folder>.

type Resumen = Contraparte & { contratos: number; pagares: number; letras: number; procesos: number; transacciones: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- filas de tablas distintas
type Fila = Record<string, any>;
type Col = { k: string; t: string; f?: (r: Fila) => string };

const COLS: Record<DocKey | "proceso", Col[]> = {
  contrato: [{ k: "tipo", t: "Tipo" }, { k: "fecha_creacion", t: "Creación", f: (r) => fmt(r.fecha_creacion) }, { k: "estado_firma", t: "Firma" }, { k: "cantidad", t: "Cant." }, { k: "folder", t: "Folder" }, { k: "observacion", t: "Observación" }],
  pagare: [{ k: "fecha_creacion", t: "Creación", f: (r) => fmt(r.fecha_creacion) }, { k: "legalizado", t: "Legalizado", f: (r) => (r.legalizado == null ? "—" : r.legalizado ? "Sí" : "No") }, { k: "juegos", t: "Juegos" }, { k: "folder", t: "Folder" }, { k: "observacion", t: "Observación" }],
  letra: [{ k: "fecha_giro", t: "Giro", f: (r) => fmt(r.fecha_giro) }, { k: "numero", t: "N°" }, { k: "importe", t: "Importe", f: (r) => (r.importe == null ? "—" : `${r.moneda === "USD" ? "US$" : "S/"} ${Number(r.importe).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`) }, { k: "folder", t: "Folder" }, { k: "observacion", t: "Observación" }],
  proceso: [{ k: "tipo", t: "Tipo" }, { k: "expediente", t: "Expediente" }, { k: "organo", t: "Órgano" }, { k: "localidad", t: "Localidad" }, { k: "materia", t: "Materia" }, { k: "rol", t: "Rol de GF" }, { k: "folder", t: "Folder" }],
  transaccion: [{ k: "fecha_firma", t: "Firma", f: (r) => fmt(r.fecha_firma) }, { k: "folder", t: "Folder" }, { k: "observacion", t: "Observación" }],
};
const SECCIONES: { k: DocKey | "proceso"; label: string }[] = [
  { k: "contrato", label: "Contratos" }, { k: "pagare", label: "Pagarés" }, { k: "letra", label: "Letras de cambio" },
  { k: "proceso", label: "Procesos" }, { k: "transaccion", label: "Transacciones" },
];
const SEL = "*, contraparte:contraparte_id(tipo_documento, numero_documento, nombre)";
const nombreCp = (r: Fila) => r.contraparte ? (r.contraparte.nombre || "") + " · " + r.contraparte.tipo_documento + " " + r.contraparte.numero_documento : "";

export default function GfBuscar() {
  const sesion = useSesion();
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Resumen[]>([]);
  const [sel, setSel] = useState<Resumen | null>(null);
  const [datos, setDatos] = useState<Record<string, Fila[]>>({});
  const [vista, setVista] = useState<{ titulo: string; tabla: DocKey | "proceso"; filas: Fila[] } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!sesion) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("exp")) abrirExpediente(p.get("exp")!);
    else if (p.get("folder")) abrirFolder(p.get("folder")!);
    else if (p.get("q")) { setQ(p.get("q")!); buscar(p.get("q")!); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  async function buscar(texto = q) {
    const t = texto.trim();
    setSel(null); setVista(null); setMsg("");
    if (!t) return;
    const like = `%${t.replace(/[%,()]/g, " ")}%`;
    const doc = normDoc(t);
    const [r1, r2] = await Promise.all([
      gf().from("v_contraparte_resumen").select("*").or(`numero_documento.ilike.%${doc}%,nombre.ilike.${like}`).limit(50),
      gf().from("proceso").select("contraparte_id").ilike("expediente", like).limit(50),
    ]);
    if (r1.error) { setMsg(r1.error.message); return; }
    let res = (r1.data ?? []) as Resumen[];
    const ids = (r2.data ?? []).map((x: Fila) => x.contraparte_id).filter((id: string) => !res.some((r) => r.id === id));
    if (ids.length) {
      const { data } = await gf().from("v_contraparte_resumen").select("*").in("id", ids);
      res = res.concat((data ?? []) as Resumen[]);
    }
    setLista(res);
    if (!res.length) setMsg("Sin resultados. Si es una contraparte nueva, regístrala en la pestaña Registrar.");
    if (res.length === 1) abrir(res[0]);
  }

  async function abrir(c: Resumen) {
    setSel(c); setVista(null);
    const out: Record<string, Fila[]> = {};
    await Promise.all(SECCIONES.map(async (s) => {
      const { data } = await gf().from(s.k).select("*").eq("contraparte_id", c.id).order("creado_en");
      out[s.k] = data ?? [];
    }));
    setDatos(out);
  }

  async function abrirExpediente(base: string) {
    const { data, error } = await gf().from("proceso").select(SEL).eq("expediente_base", base).order("expediente");
    if (error) { setMsg(error.message); return; }
    setVista({ titulo: `Archivador del expediente ${base}`, tabla: "proceso", filas: data ?? [] });
  }

  async function abrirFolder(param: string) {
    const [tipo, folder] = param.split("|") as [DocKey, string];
    if (!DOCS[tipo]) { setMsg("Folder no reconocido."); return; }
    const { data, error } = await gf().from(DOCS[tipo].tabla).select(SEL).eq("folder", normFolder(folder || "")).order(DOCS[tipo].fecha);
    if (error) { setMsg(error.message); return; }
    setVista({ titulo: `${DOCS[tipo].label} · ${folder}`, tabla: tipo, filas: data ?? [] });
  }

  async function actualizar(tabla: string, id: string, cambio: Fila) {
    const { error } = await gf().from(tabla).update(cambio).eq("id", id);
    if (error) { alert(error.message); return; }
    if (sel) abrir(sel);
  }

  async function eliminar(tabla: string, id: string) {
    if (!confirm("¿Eliminar este registro? No se puede deshacer.")) return;
    const { error } = await gf().from(tabla).delete().eq("id", id);
    if (error) { alert(error.message); return; }
    if (sel) abrir(sel);
    else if (vista) setVista({ ...vista, filas: vista.filas.filter((f) => f.id !== id) });
  }

  function Tabla({ tabla, filas, conCp }: { tabla: DocKey | "proceso"; filas: Fila[]; conCp?: boolean }) {
    const cols = COLS[tabla];
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            {conCp && <th style={th}>Contraparte</th>}
            {cols.map((c) => <th key={c.k} style={th}>{c.t}</th>)}<th style={th}></th>
          </tr></thead>
          <tbody>{filas.map((r) => (
            <tr key={r.id}>
              {conCp && <td style={td}>{nombreCp(r)}</td>}
              {cols.map((c) => (
                <td key={c.k} style={td}>
                  {tabla === "contrato" && c.k === "tipo" ? (
                    <select value={r.tipo ?? ""} onChange={(e) => actualizar("contrato", r.id, { tipo: e.target.value || null })} style={mini}>
                      <option value="">Sin tipo</option><option>FACTORING</option><option>CONFIRMING</option>
                    </select>
                  ) : tabla === "contrato" && c.k === "estado_firma" ? (
                    <select value={r.estado_firma} onChange={(e) => actualizar("contrato", r.id, { estado_firma: e.target.value })} style={mini}>
                      {["SIN REVISAR", "COMPLETO", "FALTA LIZ", "FALTA JC", "ADENDA"].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  ) : (c.f ? c.f(r) : r[c.k] ?? "—")}
                </td>
              ))}
              <td style={td}><button onClick={() => eliminar(tabla, r.id)} style={{ ...btnGhost, padding: "4px 8px", fontSize: 12, color: "#C0392B" }}>Eliminar</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  if (!sesion) return <main style={main} />;

  return (
    <main style={main}>
      <GfHeader titulo="Global Factoring · Archivo" sub="Busca por RUC/DNI, nombre o n° de expediente" />
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="20614114071, Yoshival, 03204-2025…" style={inp} />
          <button onClick={() => buscar()} style={btn}>Buscar</button>
        </div>
        {msg && <div style={{ fontSize: 14, color: "#5F5E5A" }}>{msg}</div>}

        {vista && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{vista.titulo} <span style={{ fontWeight: 400, color: "#5F5E5A", fontSize: 13 }}>· {vista.filas.length} registro(s)</span></div>
            {vista.filas.length ? <Tabla tabla={vista.tabla} filas={vista.filas} conCp /> : <div style={{ fontSize: 14, color: "#5F5E5A" }}>Este archivador está vacío.</div>}
          </div>
        )}

        {!sel && !vista && lista.length > 1 && (
          <div style={card}>
            {lista.map((c) => (
              <button key={c.id} onClick={() => abrir(c)} style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 12, padding: "10px 4px", background: "none", border: 0, borderBottom: "1px solid #eee", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                <span><b>{c.nombre || "(sin nombre)"}</b> · {c.tipo_documento} {c.numero_documento}</span>
                <span style={{ color: "#5F5E5A", fontSize: 13 }}>{c.contratos} contr. · {c.pagares} pag. · {c.letras} let. · {c.procesos} proc. · {c.transacciones} trx.</span>
              </button>
            ))}
          </div>
        )}

        {sel && (<>
          <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{sel.nombre || "(sin nombre)"}</div>
              <div style={{ fontSize: 14, color: "#5F5E5A" }}>{sel.tipo_documento} {sel.numero_documento}</div>
            </div>
            {lista.length > 1 && <button onClick={() => setSel(null)} style={btnGhost}>← Volver a resultados</button>}
          </div>
          {SECCIONES.filter((s) => (datos[s.k] ?? []).length).map((s) => (
            <div key={s.k} style={card}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{s.label} <span style={{ fontWeight: 400, color: "#5F5E5A", fontSize: 13 }}>· {datos[s.k].length}</span></div>
              <Tabla tabla={s.k} filas={datos[s.k]} />
            </div>
          ))}
          {SECCIONES.every((s) => !(datos[s.k] ?? []).length) && <div style={{ fontSize: 14, color: "#5F5E5A" }}>Esta contraparte aún no tiene documentos registrados.</div>}
        </>)}
      </section>
    </main>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #D3D1C7", color: "#5F5E5A", fontWeight: 600, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "7px 6px", borderBottom: "1px solid #eee", verticalAlign: "top" };
const mini: CSSProperties = { fontSize: 13, padding: "3px 4px", border: "1px solid #D3D1C7", borderRadius: 6, background: "#fff" };
