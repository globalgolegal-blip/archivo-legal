"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";

// Destino tras iniciar sesión: ?next si es una ruta interna (p. ej. el QR de
// un tomo), o el Panel de Global Go. Nunca la portada: la portada envía a
// /login y se formaría un bucle. Si la cuenta tiene contraseña temporal, primero /cuenta.
function destino() {
  if (typeof window === "undefined") return "/panel";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") && n !== "/" && !n.startsWith("/login") ? n : "/panel";
}
function irDespues(debeCambiar: boolean) {
  window.location.href = debeCambiar ? "/cuenta" : destino();
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [checando, setChecando] = useState(true);

  // Si ya hay sesión, redirige de una.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) irDespues(!!u.app_metadata?.debe_cambiar_clave);
      else setChecando(false);
    });
  }, []);

  async function entrar() {
    setMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) {
      setMsg(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
      return;
    }
    irDespues(!!data.user?.app_metadata?.debe_cambiar_clave);
  }

  const centro: CSSProperties = {
    minHeight: "100vh", background: COLOR.bg, color: COLOR.text,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  };

  if (checando) {
    return <main style={centro}><p style={{ color: COLOR.textSec }}>Cargando…</p></main>;
  }

  return (
    <main style={centro}>
      <div style={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: 24, width: "100%", maxWidth: 340 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Archivo Legal</h1>
        <p style={{ fontSize: 13, color: COLOR.textSec, marginTop: 0 }}>Ingresa con tu cuenta corporativa.</p>
        <input type="email" placeholder="correo" value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()} style={inputStyle} autoComplete="username" />
        <input type="password" placeholder="contraseña" value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()} style={inputStyle} autoComplete="current-password" />
        <button onClick={entrar} style={btnStyle}>Entrar</button>
        {msg && <p style={{ color: "#A32D2D", fontSize: 13, marginBottom: 0 }}>{msg}</p>}
        <p style={{ fontSize: 12, color: COLOR.textSec, marginBottom: 0 }}>¿Olvidaste tu contraseña? Pídele a un administrador del Área Legal que te genere una nueva.</p>
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: "100%", fontSize: 16, padding: "11px 12px", border: "1px solid #D3D1C7",
  borderRadius: 8, marginBottom: 10, boxSizing: "border-box",
};
const btnStyle: CSSProperties = {
  width: "100%", background: "#1A2238", color: "#fff", border: 0, borderRadius: 8,
  padding: 12, fontWeight: 600, fontSize: 14, cursor: "pointer",
};
