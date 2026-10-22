"use client";

import { useEffect, useState, type CSSProperties } from "react";
import AdminBase from "../../components/AdminBase";
import { inp, btn, card, lbl } from "../../components/GfHeader";
import { supabase } from "../../lib/supabase";
import { NOMBRE_ROL, type Rol } from "../../lib/rol";

// Administración › Usuarios: perfiles de todo el archivo (un mismo perfil para todas las empresas).

type Usuario = { email: string; rol: Rol | null; estado: string; ultimo_ingreso: string | null };
const PERFILES: Rol[] = ["legal_admin", "legal_asistente", "legal_lector"];

function fecha(d: string | null) {
  return d ? new Date(d).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export default function Usuarios() {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("legal_asistente");
  const [msg, setMsg] = useState({ k: "", t: "" });

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
      ? `${correo}: perfil guardado. Se aplicará cuando acepte la invitación.`
      : `${correo}: ${perfil ? "perfil " + NOMBRE_ROL[perfil] : "acceso retirado"}.` });
    setEmail("");
    cargar();
  }

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
          Si la persona aún no tiene cuenta, invítala desde Supabase (Authentication › Users › Invite user). Su perfil se aplica solo cuando acepta la invitación.
        </div>
        {msg.t && <div style={{ fontSize: 13, marginTop: 8, color: msg.k === "err" ? "#C0392B" : "#1E7B34" }}>{msg.t}</div>}
      </div>

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
              <td style={td}></td>
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
