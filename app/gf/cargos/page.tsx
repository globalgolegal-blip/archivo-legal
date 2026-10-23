"use client";

import { useEffect, useState, type CSSProperties } from "react";
import GfHeader, { main, inp, btn, btnGhost, card, lbl } from "../../../components/GfHeader";
import { useRol, puedeEditar } from "../../../lib/rol";
import { supabase } from "../../../lib/supabase";
import { gf, useSesion, docTexto, filtroContraparte, type Contraparte } from "../../../lib/gf";

// Libro de cargos de Global Factoring: préstamo de documentos puntuales y
// expedientes judiciales (control de custodia).

const AREAS = ["Legal", "Gerencia", "Operaciones", "Comercial", "Tesorería"];

type Tabla = "contrato" | "pagare" | "letra" | "transaccion" | "proceso";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- filas de tablas distintas
type Fila = Record<string, any>;
type Item = { tabla: Tabla; id: string; descripcion: string; folder: string | null };
type Prestamo = {
  id: string; tabla: Tabla; registro_id: string; descripcion: string; contraparte: string | null;
  folder: string | null; solicitante: string; entregado_por: string | null; motivo: string | null;
  fecha_salida: string; fecha_devolucion_esperada: string | null; fecha_devolucion_real: string | null;
};

const TABLAS: Tabla[] = ["contrato", "pagare", "letra", "transaccion", "proceso"];
const ETIQUETA: Record<Tabla, string> = { contrato: "Contrato", pagare: "Pagaré", letra: "Letra", transaccion: "Transacción", proceso: "Expediente" };

const hoy = () => new Date().toISOString().slice(0, 10);
function fecha(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const conFecha = (t: string, d: string | null | undefined) => (fecha(d) ? `${t} · ${fecha(d)}` : t);

function describir(tabla: Tabla, r: Fila): string {
  switch (tabla) {
    case "contrato": return conFecha(`Contrato ${r.tipo || "sin tipo"}`, r.fecha_creacion);
    case "pagare": return conFecha("Pagaré", r.fecha_creacion);
    case "letra": return conFecha(`Letra${r.numero ? " N° " + r.numero : ""}`, r.fecha_giro);
    case "transaccion": return conFecha("Transacción", r.fecha_firma);
    case "proceso": return `Expediente ${r.expediente || "s/n"}${r.tipo ? " · " + r.tipo : ""}`;
  }
}

export default function GfCargos() {
  const sesion = useSesion(true);
  const rol = useRol();
  const editor = puedeEditar(rol);

  // búsqueda de contraparte y elección del documento
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Contraparte[]>([]);
  const [cp, setCp] = useState<Contraparte | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [elegido, setElegido] = useState<Item | null>(null);

  // formulario
  const [area, setArea] = useState(AREAS[0]);
  const [entregado, setEntregado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [esperada, setEsperada] = useState("");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ k: "" | "ok" | "err"; t: string }>({ k: "", t: "" });
  const [busy, setBusy] = useState(false);

  // libro
  const [filas, setFilas] = useState<Prestamo[]>([]);
  const [tab, setTab] = useState<"fuera" | "todos">("fuera");

  useEffect(() => {
    if (!sesion) return;
    supabase.auth.getSession().then(({ data }) => setEntregado(data.session?.user?.email ?? ""));
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  async function cargar() {
    const { data, error } = await gf().from("prestamo").select("*").order("fecha_salida", { ascending: false });
    if (!error) setFilas((data ?? []) as Prestamo[]);
  }

  async function buscar() {
    const t = q.trim();
    setMsg({ k: "", t: "" }); setCp(null); setItems([]); setElegido(null);
    if (!t) return;
    const r1 = await filtroContraparte(gf().from("v_contraparte_resumen").select("*"), t).order("nombre").limit(20);
    if (r1.error) { setMsg({ k: "err", t: r1.error.message }); return; }
    let lista = (r1.data ?? []) as Contraparte[];
    // también por n° de expediente
    if (/\d/.test(t)) {
      const { data: pr } = await gf().from("proceso").select("contraparte_id").ilike("expediente", `%${t.replace(/[%,()]/g, "")}%`).limit(20);
      const ids = (pr ?? []).map((x: Fila) => x.contraparte_id).filter((id: string) => !lista.some((c) => c.id === id));
      if (ids.length) {
        const { data } = await gf().from("v_contraparte_resumen").select("*").in("id", ids);
        lista = lista.concat((data ?? []) as Contraparte[]);
      }
    }
    setRes(lista);
    if (!lista.length) setMsg({ k: "", t: "Sin resultados." });
    if (lista.length === 1) elegirCp(lista[0]);
  }

  async function elegirCp(c: Contraparte) {
    setCp(c); setRes([]); setElegido(null);
    const out: Item[] = [];
    await Promise.all(TABLAS.map(async (t) => {
      const { data } = await gf().from(t).select("*").eq("contraparte_id", c.id);
      (data ?? []).forEach((r: Fila) => out.push({ tabla: t, id: String(r.id), descripcion: describir(t, r), folder: r.folder ?? null }));
    }));
    out.sort((a, b) => TABLAS.indexOf(a.tabla) - TABLAS.indexOf(b.tabla) || a.descripcion.localeCompare(b.descripcion));
    setItems(out);
    if (!out.length) setMsg({ k: "", t: "Esta contraparte no tiene documentos registrados." });
  }

  const afueraIds = new Set(filas.filter((f) => !f.fecha_devolucion_real).map((f) => `${f.tabla}|${f.registro_id}`));

  async function registrar() {
    if (!cp || !elegido) { setMsg({ k: "err", t: "Elige la contraparte y el documento que sale." }); return; }
    setBusy(true); setMsg({ k: "", t: "" });
    const { error } = await gf().from("prestamo").insert({
      tabla: elegido.tabla,
      registro_id: elegido.id,
      contraparte_id: cp.id,
      descripcion: elegido.descripcion,
      contraparte: `${cp.nombre || "(sin nombre)"} · ${docTexto(cp)}`,
      folder: elegido.folder,
      solicitante: area,
      entregado_por: entregado.trim() || null,
      motivo: motivo.trim() || null,
      fecha_devolucion_esperada: esperada || null,
      observaciones: obs.trim() || null,
    });
    if (error) {
      setMsg({ k: "err", t: /prestamo_afuera_uq|duplicate/i.test(error.message) ? "Ese documento ya figura afuera: primero márcalo como devuelto." : "Error: " + error.message });
    } else {
      setMsg({ k: "ok", t: "Cargo registrado." });
      setElegido(null); setMotivo(""); setEsperada(""); setObs("");
      cargar();
    }
    setBusy(false);
  }

  async function devolver(id: string) {
    setBusy(true);
    const { error } = await gf().from("prestamo").update({ fecha_devolucion_real: new Date().toISOString() }).eq("id", id);
    if (error) setMsg({ k: "err", t: "Error: " + error.message });
    else cargar();
    setBusy(false);
  }

  if (!sesion) return <main style={main} />;

  const lista = tab === "fuera" ? filas.filter((f) => !f.fecha_devolucion_real) : filas;
  const nAfuera = filas.filter((f) => !f.fecha_devolucion_real).length;
  const vencido = (f: Prestamo) => !f.fecha_devolucion_real && !!f.fecha_devolucion_esperada && f.fecha_devolucion_esperada < hoy();

  return (
    <main style={main}>
      <GfHeader titulo="Libro de cargos" sub="Préstamo de documentos y expedientes · control de custodia" />
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: 20, display: "grid", gap: 20, gridTemplateColumns: editor ? "minmax(300px, 400px) 1fr" : "1fr" }}>

        {/* Registrar salida (solo editores y administradores) */}
        {editor && (
          <div style={{ ...card, alignSelf: "start" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Registrar salida</div>

            <label style={lbl}>Contraparte (nombre, RUC/DNI o n° de expediente)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} style={inp} />
              <button onClick={buscar} style={{ ...btnGhost, whiteSpace: "nowrap" }}>Buscar</button>
            </div>

            {res.length > 1 && (
              <div style={{ marginTop: 8, border: "1px solid #D3D1C7", borderRadius: 8, maxHeight: 220, overflowY: "auto" }}>
                {res.map((c) => (
                  <button key={c.id} onClick={() => elegirCp(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: 0, borderBottom: "1px solid #eee", cursor: "pointer", fontSize: 13 }}>
                    <b>{c.nombre || "(sin nombre)"}</b> · <span style={{ color: "#5F5E5A" }}>{docTexto(c)}</span>
                  </button>
                ))}
              </div>
            )}

            {cp && (
              <>
                <div style={{ marginTop: 10, fontSize: 14 }}><b>{cp.nombre || "(sin nombre)"}</b> · <span style={{ color: "#5F5E5A" }}>{docTexto(cp)}</span></div>
                <label style={{ ...lbl, marginTop: 10 }}>¿Qué sale?</label>
                <div style={{ border: "1px solid #D3D1C7", borderRadius: 8, maxHeight: 260, overflowY: "auto" }}>
                  {items.map((it) => {
                    const fuera = afueraIds.has(`${it.tabla}|${it.id}`);
                    const sel = elegido?.tabla === it.tabla && elegido?.id === it.id;
                    return (
                      <label key={it.tabla + it.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, cursor: fuera ? "not-allowed" : "pointer", background: sel ? "#EEF3FB" : "transparent", opacity: fuera ? 0.5 : 1 }}>
                        <input type="radio" name="doc" disabled={fuera} checked={sel} onChange={() => setElegido(it)} style={{ marginTop: 2 }} />
                        <span>
                          {it.descripcion}
                          <span style={{ color: "#5F5E5A" }}>{it.folder ? " · " + it.folder : " · sin folder"}</span>
                          {fuera && <span style={{ color: "#B26A00" }}> · afuera</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            <label style={lbl}>Solicitante</label>
            <select value={area} onChange={(e) => setArea(e.target.value)} style={inp}>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>

            <label style={lbl}>Entregado por</label>
            <input value={entregado} onChange={(e) => setEntregado(e.target.value)} style={inp} />

            <label style={lbl}>Motivo (opcional)</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} style={inp} />

            <label style={lbl}>Devolución esperada (opcional)</label>
            <input type="date" value={esperada} onChange={(e) => setEsperada(e.target.value)} style={inp} />

            <label style={lbl}>Observaciones (opcional)</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} style={inp} />

            <button onClick={registrar} disabled={busy || !elegido} style={{ ...btn, width: "100%", marginTop: 14, opacity: busy || !elegido ? 0.5 : 1 }}>Registrar salida</button>
            {msg.t && <div style={{ marginTop: 10, fontSize: 13, color: msg.k === "ok" ? "#1E7B34" : msg.k === "err" ? "#C0392B" : "#5F5E5A" }}>{msg.t}</div>}
          </div>
        )}

        {/* Libro */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setTab("fuera")} style={tab === "fuera" ? tabOn : tabOff}>Afuera ({nAfuera})</button>
            <button onClick={() => setTab("todos")} style={tab === "todos" ? tabOn : tabOff}>Todos</button>
          </div>
          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#F4F2EB" }}>
                {["Qué salió", "Solicitante", "Salida", "Esperada", "Estado", ""].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lista.length === 0 && <tr><td style={td} colSpan={6}>Sin registros.</td></tr>}
                {lista.map((f) => (
                  <tr key={f.id} style={{ background: vencido(f) ? "#FBECEC" : "transparent" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{f.descripcion}{f.folder ? <span style={{ fontWeight: 400, color: "#5F5E5A" }}> · {f.folder}</span> : null}</div>
                      {f.contraparte && <div style={{ color: "#5F5E5A" }}>{f.contraparte}</div>}
                    </td>
                    <td style={td}>{f.solicitante}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fecha(f.fecha_salida) || "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: vencido(f) ? "#C0392B" : undefined }}>{fecha(f.fecha_devolucion_esperada) || "—"}{vencido(f) ? " ⚠" : ""}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {f.fecha_devolucion_real
                        ? <span style={{ color: "#1E7B34" }}>Devuelto {fecha(f.fecha_devolucion_real)}</span>
                        : <span style={{ color: vencido(f) ? "#C0392B" : "#5F5E5A" }}>Afuera</span>}
                    </td>
                    <td style={td}>
                      {!f.fecha_devolucion_real && editor && (
                        <button onClick={() => devolver(f.id)} disabled={busy} style={{ ...btnGhost, padding: "5px 10px", fontSize: 12, whiteSpace: "nowrap" }}>Marcar devuelto</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "#5F5E5A", marginTop: 12 }}>Uso interno · Datos protegidos — Ley N° 29733</div>
        </div>
      </section>
    </main>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "9px 10px", borderBottom: "2px solid #D3D1C7", color: "#5F5E5A", fontWeight: 600, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #eee", verticalAlign: "top" };
const tabOn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const tabOff: CSSProperties = { background: "#fff", color: "#1A2238", border: "1px solid #D3D1C7", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };
