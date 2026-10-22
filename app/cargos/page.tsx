"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";
import EmpresaHeader from "../../components/EmpresaHeader";

// Libro de cargos: préstamo de expedientes físicos (control de custodia).

const TIPOS = ["DNI", "CARNÉ DE EXTRANJERÍA", "PASAPORTE", "PTP"];
const AREAS = ["Cobranza", "Operaciones", "Legal", "Finanzas", "Comercial", "Administración", "Otro"];

type Prestamo = {
  id: string;
  tipo_documento: string | null;
  numero_documento: string;
  nombre: string | null;
  solicitante: string;
  entregado_por: string | null;
  motivo: string | null;
  fecha_salida: string;
  fecha_devolucion_esperada: string | null;
  fecha_devolucion_real: string | null;
};

const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
const hoy = () => new Date().toISOString().slice(0, 10);
function fmt(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt as any) ? "—" : dt.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CargosPage() {
  const [sesion, setSesion] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState("");

  // formulario
  const [tipo, setTipo] = useState("DNI");
  const [doc, setDoc] = useState("");
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("Cobranza");
  const [otro, setOtro] = useState("");
  const [entregado, setEntregado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [esperada, setEsperada] = useState("");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ k: "" | "ok" | "err"; t: string }>({ k: "", t: "" });

  // lista
  const [filas, setFilas] = useState<Prestamo[]>([]);
  const [tab, setTab] = useState<"fuera" | "todos">("fuera");
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
      const email = data.session.user?.email ?? "";
      setUserEmail(email);
      setEntregado(email);
      cargar();
    })();
  }, []);

  async function cargar() {
    const { data, error } = await supabase
      .from("prestamo")
      .select("*")
      .order("fecha_salida", { ascending: false });
    if (!error) setFilas((data ?? []) as Prestamo[]);
  }

  async function buscarNombre() {
    const nd = norm(doc);
    if (!nd) return;
    const { data } = await supabase.from("v_empate").select("nombre").eq("numero_documento", nd).limit(1);
    if (data && data[0]?.nombre) setNombre(data[0].nombre as string);
    else setMsg({ k: "", t: "No encontré ese documento en la base; escribe el nombre a mano." });
  }

  async function registrar() {
    const nd = norm(doc);
    const solicitante = area === "Otro" ? otro.trim() : area;
    if (!nd) { setMsg({ k: "err", t: "Falta el N° de documento." }); return; }
    if (!solicitante) { setMsg({ k: "err", t: "Falta el solicitante." }); return; }
    setBusy(true);
    const { error } = await supabase.from("prestamo").insert({
      tipo_documento: tipo,
      numero_documento: nd,
      nombre: nombre.trim() || null,
      solicitante,
      entregado_por: entregado.trim() || userEmail || null,
      motivo: motivo.trim() || null,
      fecha_devolucion_esperada: esperada || null,
      observaciones: obs.trim() || null,
    });
    if (error) {
      setMsg({ k: "err", t: "Error: " + error.message });
    } else {
      setMsg({ k: "ok", t: "Cargo registrado." });
      setDoc(""); setNombre(""); setOtro(""); setMotivo(""); setEsperada(""); setObs("");
      cargar();
    }
    setBusy(false);
  }

  async function devolver(id: string) {
    setBusy(true);
    const { error } = await supabase
      .from("prestamo")
      .update({ fecha_devolucion_real: new Date().toISOString() })
      .eq("id", id);
    if (error) setMsg({ k: "err", t: "Error: " + error.message });
    else cargar();
    setBusy(false);
  }

  if (sesion === null) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (sesion === false) return <div style={{ padding: 24 }}>Redirigiendo a iniciar sesión…</div>;

  const lista = tab === "fuera" ? filas.filter((f) => !f.fecha_devolucion_real) : filas;
  const afuera = filas.filter((f) => !f.fecha_devolucion_real).length;
  const vencido = (f: Prestamo) =>
    !f.fecha_devolucion_real && f.fecha_devolucion_esperada && f.fecha_devolucion_esperada < hoy();

  return (
    <main style={{ minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <EmpresaHeader empresa="globalgo" titulo="Libro de cargos" sub="Préstamo de expedientes físicos · control de custodia" />

      <section style={{ maxWidth: 980, margin: "0 auto", padding: 20, display: "grid", gap: 20, gridTemplateColumns: "minmax(280px, 360px) 1fr" }}>
        {/* Formulario de salida */}
        <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 12, background: "#fff", padding: 18, alignSelf: "start" }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Registrar salida</h2>

          <label style={lbl}>Tipo de documento</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inp}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={lbl}>N° de documento</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={doc} onChange={(e) => setDoc(e.target.value)} style={{ ...inp, flex: 1 }} />
            <button onClick={buscarNombre} style={ghost}>Buscar</button>
          </div>

          <label style={lbl}>Nombre del deudor</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inp} placeholder="(opcional / auto)" />

          <label style={lbl}>Solicitante</label>
          <select value={area} onChange={(e) => setArea(e.target.value)} style={inp}>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {area === "Otro" && (
            <input value={otro} onChange={(e) => setOtro(e.target.value)} style={inp} placeholder="Especifica el solicitante" />
          )}

          <label style={lbl}>Entregado por</label>
          <input value={entregado} onChange={(e) => setEntregado(e.target.value)} style={inp} />

          <label style={lbl}>Motivo (opcional)</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} style={inp} />

          <label style={lbl}>Devolución esperada (opcional)</label>
          <input type="date" value={esperada} onChange={(e) => setEsperada(e.target.value)} style={inp} />

          <label style={lbl}>Observaciones (opcional)</label>
          <input value={obs} onChange={(e) => setObs(e.target.value)} style={inp} />

          <button onClick={registrar} disabled={busy} style={{ ...btn, marginTop: 12, opacity: busy ? 0.5 : 1 }}>
            Registrar salida
          </button>
          {msg.t && (
            <div style={{ marginTop: 10, fontSize: 13, color: msg.k === "ok" ? "#1b7f3b" : msg.k === "err" ? "#b00020" : COLOR.textSec }}>{msg.t}</div>
          )}
        </div>

        {/* Lista */}
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <button onClick={() => setTab("fuera")} style={tab === "fuera" ? tabOn : tabOff}>Afuera ({afuera})</button>
            <button onClick={() => setTab("todos")} style={tab === "todos" ? tabOn : tabOff}>Todos</button>
          </div>

          <div style={{ overflowX: "auto", border: `1px solid ${COLOR.border}`, borderRadius: 10, background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F4F2EB", textAlign: "left" }}>
                  <th style={th}>Documento</th>
                  <th style={th}>Solicitante</th>
                  <th style={th}>Salida</th>
                  <th style={th}>Esperada</th>
                  <th style={th}>Estado</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td style={td} colSpan={6}>Sin registros.</td></tr>
                )}
                {lista.map((f) => (
                  <tr key={f.id} style={{ borderTop: `1px solid ${COLOR.border}`, background: vencido(f) ? "#FBECEC" : "transparent" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{f.tipo_documento ? f.tipo_documento + " " : ""}{f.numero_documento}</div>
                      {f.nombre && <div style={{ color: COLOR.textSec }}>{f.nombre}</div>}
                    </td>
                    <td style={td}>{f.solicitante}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(f.fecha_salida)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: vencido(f) ? "#b00020" : COLOR.text }}>
                      {fmt(f.fecha_devolucion_esperada)}{vencido(f) ? " ⚠" : ""}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {f.fecha_devolucion_real
                        ? <span style={{ color: "#1b7f3b" }}>Devuelto {fmt(f.fecha_devolucion_real)}</span>
                        : <span style={{ color: vencido(f) ? "#b00020" : COLOR.textSec }}>Afuera</span>}
                    </td>
                    <td style={td}>
                      {!f.fecha_devolucion_real && (
                        <button onClick={() => devolver(f.id)} disabled={busy} style={ghost}>Marcar devuelto</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, color: COLOR.textSec, marginTop: 12 }}>
            Uso interno · Datos protegidos — Ley N° 29733
          </div>
        </div>
      </section>
    </main>
  );
}

const lbl: CSSProperties = { display: "block", fontSize: 12, color: COLOR.textSec, margin: "12px 0 4px" };
const inp: CSSProperties = { width: "100%", fontSize: 14, padding: "9px 10px", border: `1px solid ${COLOR.border}`, borderRadius: 8, boxSizing: "border-box", background: "#fff" };
const btn: CSSProperties = { width: "100%", background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: 11, fontWeight: 600, fontSize: 14, cursor: "pointer" };
const ghost: CSSProperties = { background: "#fff", border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };
const th: CSSProperties = { padding: "9px 10px", fontWeight: 700, color: "#5F5E5A", borderBottom: `2px solid ${COLOR.border}` };
const td: CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
const tabOn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const tabOff: CSSProperties = { background: "#fff", color: "#1A2238", border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };
