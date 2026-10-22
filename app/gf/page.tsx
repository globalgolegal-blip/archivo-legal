"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import GfHeader, { main, inp, btn, btnGhost, card } from "../../components/GfHeader";
import ConsultaPin, { type DestinoQR } from "../../components/ConsultaPin";
import { useRol, puedeEditar, esAdmin } from "../../lib/rol";
import { gf, normDoc, normFolder, fmt, useSesion, DOCS, type DocKey, type Contraparte, docTexto, completarDocumento, TIPOS_DOC, filtroContraparte } from "../../lib/gf";

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
const nombreCp = (r: Fila) => r.contraparte ? (r.contraparte.nombre || "") + " · " + docTexto(r.contraparte) : "";

// Destino del QR del lomo (?exp=… o ?folder=tipo|folder), para la consulta con PIN
function destinoQR(): DestinoQR | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  if (p.get("exp")) return { tipo: "gf_exp", base: p.get("exp")! };
  const f = p.get("folder");
  if (f && f.includes("|")) { const [doc, folder] = f.split("|"); return { tipo: "gf_folder", doc, folder }; }
  return null;
}

export default function GfBuscar() {
  const [qr] = useState<DestinoQR | null>(destinoQR);
  const sesion = useSesion(!qr);
  const rol = useRol();
  const editor = puedeEditar(rol);
  const admin = esAdmin(rol);
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Resumen[]>([]);
  const [sel, setSel] = useState<Resumen | null>(null);
  const [datos, setDatos] = useState<Record<string, Fila[]>>({});
  const [vista, setVista] = useState<{ titulo: string; tabla: DocKey | "proceso"; filas: Fila[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [sug, setSug] = useState<Resumen[]>([]);
  const sinSug = useRef(false); // tras presionar Buscar no se muestran sugerencias hasta volver a escribir
  const [cTipo, setCTipo] = useState("RUC");
  const [cNum, setCNum] = useState("");
  const [cMsg, setCMsg] = useState("");

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
    setSug([]); sinSug.current = true;
    const like = `%${normDoc(t).replace(/[%,()]/g, "")}%`;
    const [r1, r2] = await Promise.all([
      filtroContraparte(gf().from("v_contraparte_resumen").select("*"), t).order("nombre").limit(100),
      /\d/.test(t) ? gf().from("proceso").select("contraparte_id").ilike("expediente", like).limit(50) : Promise.resolve({ data: [] as Fila[] }),
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

  // Sugerencias mientras se escribe (desde 2 caracteres)
  useEffect(() => {
    if (!sesion) return;
    const t = q.trim();
    if (t.length < 2 || (sel && (sel.nombre === t))) { setSug([]); return; }
    const h = setTimeout(async () => {
      if (sinSug.current) return;
      const { data } = await filtroContraparte(gf().from("v_contraparte_resumen").select("*"), t).order("nombre").limit(8);
      if (!sinSug.current) setSug((data ?? []) as Resumen[]);
    }, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sesion]);

  async function pendientes() {
    setSel(null); setVista(null); setMsg(""); setQ("");
    const { data, error } = await gf().from("v_contraparte_resumen").select("*").eq("tipo_documento", "PENDIENTE").order("nombre").limit(1000);
    if (error) { setMsg(error.message); return; }
    setLista((data ?? []) as Resumen[]);
    setMsg(data?.length ? `${data.length} contraparte(s) sin RUC/DNI.` : "Todas las contrapartes tienen RUC/DNI.");
  }

  async function guardarDocumento() {
    if (!sel) return;
    setCMsg("");
    try {
      const r = await completarDocumento(sel.id, cTipo, cNum);
      const { data } = await gf().from("v_contraparte_resumen").select("*").eq("id", r.id).single();
      setLista((l) => l.filter((x) => x.id !== sel.id));
      setCNum("");
      setCMsg(r.fusion ? "Ese documento ya estaba registrado: se unieron ambas fichas." : "Documento guardado.");
      if (data) abrir(data as Resumen, false);
    } catch (e) {
      setCMsg((e as Error).message);
    }
  }

  async function abrir(c: Resumen, limpiar = true) {
    setSel(c); setVista(null);
    if (limpiar) setCMsg("");
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
    if (sel) abrir(sel, false);
    else if (vista) setVista({ ...vista, filas: vista.filas.map((f) => (f.id === id ? { ...f, ...cambio } : f)) });
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
                  {!editor && (c.k === "tipo" || c.k === "estado_firma" || c.k === "folder") ? (
                    (c.f ? c.f(r) : r[c.k] ?? "—")
                  ) : tabla === "contrato" && c.k === "tipo" ? (
                    <select value={r.tipo ?? ""} onChange={(e) => actualizar("contrato", r.id, { tipo: e.target.value || null })} style={mini}>
                      <option value="">Sin tipo</option><option>FACTORING</option><option>CONFIRMING</option>
                    </select>
                  ) : tabla === "contrato" && c.k === "estado_firma" ? (
                    <select value={r.estado_firma} onChange={(e) => actualizar("contrato", r.id, { estado_firma: e.target.value })} style={mini}>
                      {["SIN REVISAR", "COMPLETO", "FALTA LIZ", "FALTA JC", "ADENDA"].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  ) : c.k === "folder" ? (
                    <input defaultValue={r.folder ? r.folder.replace(/^FOLDER\s*/, "") : ""} placeholder="—" title="Escribe el n° de folder y sal del campo para guardar"
                      onBlur={(e) => { const v = normFolder(e.target.value); if (v !== (r.folder ?? null)) actualizar(tabla, r.id, { folder: v }); }}
                      style={{ ...mini, width: 64 }} />
                  ) : (c.f ? c.f(r) : r[c.k] ?? "—")}
                </td>
              ))}
              <td style={td}>{admin && <button onClick={() => eliminar(tabla, r.id)} style={{ ...btnGhost, padding: "4px 8px", fontSize: 12, color: "#C0392B" }}>Eliminar</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  if (sesion === false && qr) {
    return (
      <main style={main}>
        <header style={{ background: "#1A2238", color: "#fff", padding: "18px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/global-factoring.png" alt="" style={{ height: 34, background: "#fff", borderRadius: 6, padding: 3 }} />
          <div><div style={{ fontSize: 12, letterSpacing: 2, color: "#9AA5C4", textTransform: "uppercase" }}>Archivo Legal · Consulta</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Global Factoring</div></div>
        </header>
        <section style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
          <ConsultaPin destino={qr} volver={window.location.pathname + window.location.search} />
        </section>
      </main>
    );
  }
  if (!sesion) return <main style={main} />;

  return (
    <main style={main}>
      <GfHeader titulo="Global Factoring · Archivo" sub="Busca por RUC/DNI, nombre o n° de expediente" />
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input value={q} onChange={(e) => { sinSug.current = false; setQ(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") buscar(); if (e.key === "Escape") setSug([]); }}
              onBlur={() => setTimeout(() => setSug([]), 200)} placeholder="Parte del nombre, RUC/DNI o expediente: setell, 20614, 03204…" style={inp} />
            {sug.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4, background: "#fff", border: "1px solid #D3D1C7", borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,.12)", overflow: "hidden" }}>
                {sug.map((c) => (
                  <button key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setSug([]); setQ(c.nombre || ""); setLista([c]); abrir(c); }}
                    style={{ display: "flex", justifyContent: "space-between", gap: 10, width: "100%", padding: "9px 12px", background: "none", border: 0, borderBottom: "1px solid #eee", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                    <span><b>{c.nombre || "(sin nombre)"}</b></span>
                    <span style={{ fontSize: 12, color: c.tipo_documento === "PENDIENTE" ? "#B26A00" : "#5F5E5A", whiteSpace: "nowrap" }}>{docTexto(c)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => buscar()} style={btn}>Buscar</button>
          <button onClick={pendientes} style={{ ...btnGhost, whiteSpace: "nowrap" }}>Sin RUC/DNI</button>
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
                <span><b>{c.nombre || "(sin nombre)"}</b> · <span style={{ color: c.tipo_documento === "PENDIENTE" ? "#B26A00" : undefined }}>{docTexto(c)}</span></span>
                <span style={{ color: "#5F5E5A", fontSize: 13 }}>{c.contratos} contr. · {c.pagares} pag. · {c.letras} let. · {c.procesos} proc. · {c.transacciones} trx.</span>
              </button>
            ))}
          </div>
        )}

        {sel && (<>
          <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{sel.nombre || "(sin nombre)"}</div>
              <div style={{ fontSize: 14, color: sel.tipo_documento === "PENDIENTE" ? "#B26A00" : "#5F5E5A" }}>{docTexto(sel)}</div>
              {sel.tipo_documento === "PENDIENTE" && editor && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={cTipo} onChange={(e) => setCTipo(e.target.value)} style={{ ...inp, width: "auto" }}>
                    {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input value={cNum} onChange={(e) => setCNum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardarDocumento()} placeholder="N° de documento" inputMode="numeric" style={{ ...inp, width: 180 }} />
                  <button onClick={guardarDocumento} style={btn}>Guardar documento</button>
                </div>
              )}
              {cMsg && <div style={{ fontSize: 13, marginTop: 6, color: /guardado|unieron/.test(cMsg) ? "#1E7B34" : "#C0392B" }}>{cMsg}</div>}
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
