"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";

// Destino tras iniciar sesión: el parámetro ?next si es una ruta interna
// (p. ej. el QR del tomo manda ?next=/tomo?...), o /panel por defecto.
function destino() {
  if (typeof window === "undefined") return "/panel";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") ? n : "/panel";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [checando, setChecando] = useState(true);

  // Si ya hay sesión, redirige de una; si no, muestra el formulario.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = destino();
      } else {
        setChecando(false);
      }
    });
  }, []);

  async function entrar() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      setMsg(error.message);
    } else {
      window.location.href = destino();
    }
  }

  const centro: CSSProperties = {
    minHeight: "100vh",
    background: COLOR.bg,
    color: COLOR.text,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  };

  if (checando) {
    return (
      <main style={centro}>
        <p style={{ color: COLOR.textSec }}>Cargando…</p>
      </main>
    );
  }

  return (
    <main style={centro}>
      <div
        style={{
          background: COLOR.surface,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 340,
        }}
      >
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Archivo Legal</h1>
        <p style={{ fontSize: 13, color: COLOR.textSec, marginTop: 0 }}>
          Ingresa con tu cuenta.
        </p>
        <input
          type="email"
          placeholder="correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="contraseña"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          style={inputStyle}
        />
        <button onClick={entrar} style={btnStyle}>Entrar</button>
        {msg && (
          <p style={{ color: "#A32D2D", fontSize: 13, marginBottom: 0 }}>{msg}</p>
        )}
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  fontSize: 16,
  padding: "11px 12px",
  border: "1px solid #D3D1C7",
  borderRadius: 8,
  marginBottom: 10,
  boxSizing: "border-box",
};

const btnStyle: CSSProperties = {
  width: "100%",
  background: "#1A2238",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  padding: 12,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
