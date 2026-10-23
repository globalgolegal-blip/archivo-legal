"use client";

import { useEffect, useState, type CSSProperties } from "react";
import AdminBase from "../../components/AdminBase";
import { inp, btn, btnGhost, card, lbl } from "../../components/GfHeader";
import { supabase } from "../../lib/supabase";
import { NOMBRE_ROL, type Rol } from "../../lib/rol";

// Administración › Usuarios: perfiles de todo el archivo (un mismo perfil para
// todas las empresas) y cuentas con contraseña temporal.

type Usuario = { email: string; rol: Rol | null; estado: string; ultimo_ingreso: string | null };
type Clave = { email: string; clave: string };
const PERFILES: Rol[] = ["legal_admin", "legal_asistente", "legal_lector"];
const esPendiente = (u: Usuario) => /pend/i.test(u.estado || "");

function fecha(d: string | null) {
  return d ? new Date(d).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";
}

async function api(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch("/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "No se pudo completar la acción.");
  return j;
}

export default function Usuarios() {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("legal_asistente");
  const [msg, setMsg] = useState({ k: "", t: "" });
  const [claves, setClaves] = useState<Clave[]>([]);
  const [busy, setBusy] = useState(false);

  async function cargar() {
    const { data, error } = await supabase.rpc("usuarios_admin");
    if (error) { setMsg({ k: "err", t: error.message }); return; }
    setLista((data ?? []) as Usuario[]);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
  useEffect(() => { cargar(); }, []);

  async function fijar(correo: string, perfil: Rol | null) {
    setMsg({ k: "", t: "" });
    if (perfil === null && !confirm(`¿Quitar el acceso de ${correo}? Ya no podrá ver el archivo.`)) return;
    const { data, error } = await supabase.rpc("fijar_rol", { p_email: correo, p_rol: perfil });
    if (error) { setMsg({ k: "err", t: error.message }); return; }
    setMsg({ k: "ok", t: data === "pendiente"
      ? `${correo}: perfil guardado. Se aplicará cuando se cree su cuenta.`
      : `${correo}: ${perfil ? "perfil " + NOMBRE_ROL[perfil] : "acceso retirado"}.` });
    setEmail("");
    cargar();
  }

  async function crearPendientes() {
    if (!confirm("Se crearán las cuentas de todos los perfiles pendientes, con una contraseña temporal. ¿Continuar?")) return;
    setMsg({ k: "", t: "" }); setBusy(true);
    try {
      const j = await api({ accion: "crear_pendientes" });
      setClaves(j.creadas ?? []);
      const errs = (j.errores ?? []) as { email: string; error: string }[];
      setMsg({
        k: errs.length ? "err" : "ok",
        t: `${(j.creadas ?? []).length} cuenta(s) creada(s).` + (errs.length ? ` No se pudieron crear: ${errs.map((x) => `${x.email} (${x.error})`).join(", ")}.` : ""),
      });
      cargar();
    } catch (e) { setMsg({ k: "err", t: (e as Error).message }); }
    setBusy(false);
  }

  async function nuevaClave(correo: string) {
    if (!confirm(`¿Generar una contraseña nueva para ${correo}? La actual dejará de funcionar.`)) return;
    setMsg({ k: "", t: "" }); setBusy(true);
    try {
      const j = await api({ accion: "nueva_clave", email: correo });
      setClaves([{ email: j.email, clave: j.clave }]);
      setMsg({ k: "ok", t: `Contraseña temporal generada para ${correo}.` });
    } catch (e) { setMsg({ k: "err", t: (e as Error).message }); }
    setBusy(false);
  }

  const nPend = lista.filter(esPendiente).length;

  return (
    <AdminBase titulo="Administración · Usuarios" sub="Perfiles del Archivo Legal (aplican a todas las empresas)">
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Asignar perfil</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: 1, minWidth: 260 }}><label style={lbl}>Correo corporativo</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@globalgo.com.pe" style={inp} /></div>
          <div><label style={lbl}>Perfil</label>
            <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} style={{ ...inp, width: "auto" }}>
              {PERFILES.map((p) => <option key={p} value={p}>{NOMBRE_ROL[p]}</option>)}
            </select></div>
          <button onClick={() => fijar(email, rol)} disabled={!email.trim()} style={{ ...btn, opacity: email.trim() ? 1 : 0.5 }}>Guardar</button>
        </div>
        <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 10 }}>
          Si la persona aún no tiene cuenta, su perfil queda pendiente. Luego usa «Crear cuentas pendientes».
        </div>
        {msg.t && <div style={{ fontSize: 13, marginTop: 8, color: msg.k === "err" ? "#C0392B" : "#1E7B34" }}>{msg.t}</div>}
      </div>

      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Cuentas pendientes</div>
          <div style={{ fontSize: 13, color: "#5F5E5A" }}>Crea de una vez las cuentas de quienes ya tienen perfil, con contraseña temporal. Al primer ingreso deberán crear la suya.</div>
        </div>
        <button onClick={crearPendientes} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {nPend ? `Crear ${nPend} cuenta(s)` : "Crear cuentas pendientes"}
        </button>
      </div>

      {claves.length > 0 && (
        <div style={{ ...card, border: "2px solid #B26A00", background: "#FFF9EF" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Contraseñas temporales — cópialas ahora</div>
          <div style={{ fontSize: 13, color: "#8A5300", marginBottom: 10 }}>
            Se muestran una sola vez y no se guardan en ningún lado. Entrégalas a cada persona por privado (nunca en un grupo).
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr><th style={th}>Correo</th><th style={th}>Contraseña temporal</th></tr></thead>
            <tbody>{claves.map((c) => (
              <tr key={c.email}><td style={td}>{c.email}</td><td style={{ ...td, fontFamily: "monospace", fontSize: 15 }}>{c.clave}</td></tr>
            ))}</tbody>
          </table>
          <button onClick={() => setClaves([])} style={{ ...btnGhost, marginTop: 10 }}>Ya las copié, ocultar</button>
        </div>
      )}

      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Correo", "Perfil", "Estado", "Último ingreso", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{lista.map((u) => (
            <tr key={u.email}>
              <td style={td}>{u.email}</td>
              <td style={td}>
                <select value={u.rol ?? ""} onChange={(e) => fijar(u.email, (e.target.value || null) as Rol | null)} style={mini}>
                  <option value="">Sin acceso</option>
                  {PERFILES.map((p) => <option key={p} value={p}>{NOMBRE_ROL[p]}</option>)}
                </select>
              </td>
              <td style={{ ...td, color: u.estado === "activo" ? "#1E7B34" : u.estado === "sin perfil" ? "#B26A00" : "#5F5E5A" }}>{u.estado}</td>
              <td style={td}>{fecha(u.ultimo_ingreso)}</td>
              <td style={td}>
                {!esPendiente(u) && (
                  <button onClick={() => nuevaClave(u.email)} disabled={busy} style={{ ...btnGhost, padding: "4px 8px", fontSize: 12, whiteSpace: "nowrap" }}>Nueva contraseña</button>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </AdminBase>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #D3D1C7", color: "#5F5E5A", fontWeight: 600 };
const td: CSSProperties = { padding: "7px 6px", borderBottom: "1px solid #eee" };
const mini: CSSProperties = { fontSize: 13, padding: "3px 4px", border: "1px solid #D3D1C7", borderRadius: 6, background: "#fff" };
