"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) =>
      setUserEmail(data.session?.user?.email ?? null)
    );
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
      const { data } = await supabase.auth.getSession();
      setUserEmail(data.session?.user?.email ?? null);
    }
  }

  async function salir() {
    await supabase.auth.signOut();
    setUserEmail(null);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLOR.bg,
        color: COLOR.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
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

        {userEmail ? (
          <>
            <p style={{ fontSize: 14, color: COLOR.textSec }}>
              Sesión iniciada: <b>{userEmail}</b>
            </p>
            <button onClick={salir} style={btnStyle}>Salir</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: COLOR.textSec, marginTop: 0 }}>
              Ingresa con tu cuenta.
            </p>
            <input
              type="email"
              placeholder="correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="contraseña"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              style={inputStyle}
            />
            <button onClick={entrar} style={btnStyle}>Entrar</button>
            {msg && (
              <p style={{ color: "#A32D2D", fontSize: 13, marginBottom: 0 }}>{msg}</p>
            )}
          </>
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
