"use client";

import { useEffect, useState, type CSSProperties } from "react";
import AdminBase from "../../../components/AdminBase";
import { inp, btn, btnGhost, card, lbl } from "../../../components/GfHeader";
import { supabase } from "../../../lib/supabase";

// Administración › PIN de consulta: el PIN único que permite ver un archivador al escanear su QR.

type Estado = { pin: { vence: string; version: number; actualizado_por: string | null; actualizado_en: string } | null;
  consultas: { fecha: string; ip: string; exito: boolean; destino: Record<string, string> }[] };

const f = (d: string) => new Date(d).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
function destinoTexto(d: Record<string, string>) {
  if (!d) return "—";
  if (d.tipo === "tomo") return `Global Go · ${d.src === "lima" ? "Lima " + d.anio : d.region} · Tomo ${d.tomo}`;
  if (d.tipo === "gf_exp") return `Global Factoring · Expediente ${d.base}`;
  return `Global Factoring · ${d.doc} · ${d.folder}`;
}

export default function PinConsulta() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [pin, setPin] = useState("");
  const [dias, setDias] = useState("30");
  const [msg, setMsg] = useState({ k: "", t: "" });

  async function api(metodo: "GET" | "POST", cuerpo?: unknown) {
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/pin", {
      method: metodo,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { ok: r.ok, j: await r.json().catch(() => ({ error: "Respuesta inválida" })) };
  }
  async function cargar() {
    const { ok, j } = await api("GET");
    if (!ok) { setMsg({ k: "err", t: j.error }); return; }
    setEstado(j);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setMsg({ k: "", t: "" });
    const { ok, j } = await api("POST", { pin, dias });
    if (!ok) { setMsg({ k: "err", t: j.error }); return; }
    setMsg({ k: "ok", t: `PIN actualizado. Vence el ${f(j.vence)}. Las consultas abiertas con el PIN anterior dejan de funcionar.` });
    setPin(""); cargar();
  }
  async function desactivar() {
    if (!confirm("¿Desactivar la consulta con PIN? Nadie podrá consultar sin cuenta hasta que crees un PIN nuevo.")) return;
    const { ok, j } = await api("POST", { desactivar: true });
    setMsg(ok ? { k: "ok", t: "Consulta con PIN desactivada." } : { k: "err", t: j.error }); cargar();
  }

  // eslint-disable-next-line react-hooks/purity -- comparación con la hora actual
  const vigente = estado?.pin && new Date(estado.pin.vence).getTime() > Date.now();

  return (
    <AdminBase titulo="Administración · PIN de consulta" sub="Permite ver un archivador al escanear su QR, sin cuenta y en modo lectura">
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {vigente ? <span style={{ color: "#1E7B34" }}>Consulta con PIN activa</span> : <span style={{ color: "#B26A00" }}>Consulta con PIN desactivada</span>}
        </div>
        {estado?.pin && <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4 }}>
          {vigente ? `Vence el ${f(estado.pin.vence)}` : `Venció el ${f(estado.pin.vence)}`} · último cambio por {estado.pin.actualizado_por || "—"} el {f(estado.pin.actualizado_en)}
        </div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 14 }}>
          <div><label style={lbl}>Nuevo PIN (6 a 8 dígitos)</label>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" style={{ ...inp, width: 180, letterSpacing: 4 }} /></div>
          <div><label style={lbl}>Vigencia</label>
            <select value={dias} onChange={(e) => setDias(e.target.value)} style={{ ...inp, width: "auto" }}>
              {["7", "15", "30", "60", "90"].map((d) => <option key={d} value={d}>{d} días</option>)}
            </select></div>
          <button onClick={guardar} disabled={pin.length < 6} style={{ ...btn, opacity: pin.length < 6 ? 0.5 : 1 }}>{vigente ? "Cambiar PIN" : "Activar con este PIN"}</button>
          {vigente && <button onClick={desactivar} style={{ ...btnGhost, color: "#C0392B" }}>Desactivar</button>}
        </div>
        <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 10 }}>
          El PIN se guarda cifrado: no se puede volver a ver, solo cambiar. Compártelo solo de forma verbal o por un canal interno. Tras 5 intentos fallidos el equipo queda bloqueado 15 minutos.
        </div>
        {msg.t && <div style={{ fontSize: 13, marginTop: 8, color: msg.k === "err" ? "#C0392B" : "#1E7B34" }}>{msg.t}</div>}
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Últimas consultas con PIN</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Fecha", "Resultado", "Archivador", "Equipo (IP)"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{(estado?.consultas ?? []).map((c, i) => (
            <tr key={i}>
              <td style={td}>{f(c.fecha)}</td>
              <td style={{ ...td, color: c.exito ? "#1E7B34" : "#C0392B" }}>{c.exito ? "Consultó" : "PIN incorrecto"}</td>
              <td style={td}>{destinoTexto(c.destino)}</td>
              <td style={td}>{c.ip}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </AdminBase>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #D3D1C7", color: "#5F5E5A", fontWeight: 600 };
const td: CSSProperties = { padding: "7px 6px", borderBottom: "1px solid #eee" };
