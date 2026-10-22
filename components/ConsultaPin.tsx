"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { COLOR } from "../lib/theme";

// Consulta de UN archivador con el PIN de Legal (sin cuenta). Solo lectura.
// El PIN se valida en el servidor; la constancia dura 2 horas en este equipo.

export type DestinoQR =
  | { tipo: "tomo"; src: string; region?: string; anio?: string; tomo: string }
  | { tipo: "gf_exp"; base: string }
  | { tipo: "gf_folder"; doc: string; folder: string };

type Fila = { documento: string; nombre: string | null; fecha: string | null; detalle: string | null };
const LLAVE = "archivo-legal:consulta";

function fmt(d: string | null) {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

export default function ConsultaPin({ destino, volver }: { destino: DestinoQR; volver: string }) {
  const [pin, setPin] = useState("");
  const [estado, setEstado] = useState<"inicio" | "pin" | "cargando" | "listo">("inicio");
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState<{ titulo: string; empresa: string; filas: Fila[] } | null>(null);

  async function consultar(conPin?: string) {
    setEstado("cargando"); setMsg("");
    let token = "";
    try { token = localStorage.getItem(LLAVE) || ""; } catch { /* sin almacenamiento */ }
    const r = await fetch("/api/consulta", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destino, pin: conPin, token: conPin ? undefined : token }),
    });
    const j = await r.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
    if (!r.ok) {
      try { localStorage.removeItem(LLAVE); } catch { /* */ }
      setEstado("pin");
      if (conPin || r.status !== 401) setMsg(j.error || "No se pudo consultar.");
      return;
    }
    try { localStorage.setItem(LLAVE, j.token); } catch { /* */ }
    setRes(j); setEstado("listo"); setPin("");
  }

  // Si este equipo ya tiene una constancia vigente, entra directo
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- intento inicial con la constancia guardada
  useEffect(() => { consultar(); }, []);

  if (estado === "listo" && res) {
    const conDetalle = res.filas.some((f) => f.detalle);
    return (
      <div>
        <div style={{ ...aviso, background: "#EEF4FB", color: "#0C447C" }}>
          Consulta con PIN · solo lectura · {res.empresa} · <b>{res.titulo}</b>
        </div>
        <div style={{ fontSize: 13, color: COLOR.textSec, margin: "10px 0" }}>{res.filas.length} documento(s)</div>
        <div style={{ overflowX: "auto", border: `1px solid ${COLOR.border}`, borderRadius: 10, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#F4F2EB", textAlign: "left" }}>
              <th style={th}>#</th><th style={th}>Documento</th><th style={th}>Nombre</th>
              <th style={th}>{conDetalle ? "Detalle" : "Fecha"}</th>
            </tr></thead>
            <tbody>{res.filas.map((f, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${COLOR.border}` }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{f.documento}</td>
                <td style={td}>{f.nombre || "—"}</td>
                <td style={td}>{conDetalle ? f.detalle : fmt(f.fecha)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: COLOR.textSec, marginTop: 14 }}>
          Los documentos de identidad se muestran parcialmente ocultos. Uso interno · Datos protegidos — Ley N° 29733.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: 20, maxWidth: 420 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Consultar este archivador</div>
      <div style={{ fontSize: 14, color: COLOR.textSec, marginBottom: 14 }}>
        Ingresa el PIN de consulta de Legal para ver su contenido en modo lectura.
      </div>
      <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(e) => e.key === "Enter" && pin && consultar(pin)}
        inputMode="numeric" autoComplete="one-time-code" placeholder="PIN" disabled={estado === "cargando"}
        style={{ fontSize: 22, letterSpacing: 6, textAlign: "center", padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 8, width: "100%", boxSizing: "border-box" }} />
      <button onClick={() => consultar(pin)} disabled={!pin || estado === "cargando"}
        style={{ marginTop: 12, width: "100%", background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "11px 16px", fontWeight: 600, fontSize: 15, cursor: "pointer", opacity: !pin || estado === "cargando" ? 0.6 : 1 }}>
        {estado === "cargando" ? "Verificando…" : "Consultar"}
      </button>
      {msg && <div style={{ fontSize: 13, color: "#C0392B", marginTop: 10 }}>{msg}</div>}
      <div style={{ borderTop: `1px solid ${COLOR.border}`, marginTop: 16, paddingTop: 12, fontSize: 13 }}>
        ¿Eres del Área Legal? <a href={`/login?next=${encodeURIComponent(volver)}`} style={{ color: COLOR.text, fontWeight: 600 }}>Ingresa con tu cuenta</a>
      </div>
    </div>
  );
}

const aviso: CSSProperties = { fontSize: 13, padding: "10px 12px", borderRadius: 8 };
const th: CSSProperties = { padding: "8px 10px", color: COLOR.textSec, fontWeight: 600, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
