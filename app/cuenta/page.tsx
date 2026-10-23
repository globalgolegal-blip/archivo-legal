"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { main, inp, btn, card, lbl } from "../../components/GfHeader";

// Mi cuenta: crear la contraseña propia. Es obligatorio en el primer ingreso
// (cuenta creada con contraseña temporal) y opcional después.
export default function Cuenta() {
  const [email, setEmail] = useState<string | null>(null);
  const [obligatorio, setObligatorio] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [msg, setMsg] = useState({ k: "", t: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) { window.location.href = "/login?next=/cuenta"; return; }
      setEmail(u.email ?? "");
      setObligatorio(!!u.app_metadata?.debe_cambiar_clave);
    });
  }, []);

  async function guardar() {
    setMsg({ k: "", t: "" });
    if (c1 !== c2) { setMsg({ k: "err", t: "Las dos contraseñas no coinciden." }); return; }
    if (c1.length < 8 || !/[A-Za-z]/.test(c1) || !/\d/.test(c1)) {
      setMsg({ k: "err", t: "Usa al menos 8 caracteres, con letras y números." }); return;
    }
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ accion: "cambiar_clave", clave: c1 }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ k: "err", t: j.error || "No se pudo guardar." }); setBusy(false); return; }
    // Renueva la sesión para que ya no lleve la marca de cambio obligatorio.
    await supabase.auth.refreshSession();
    setMsg({ k: "ok", t: "Contraseña guardada. Entrando…" });
    window.location.href = "/";
  }

  async function salir() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (email === null) return <main style={main} />;

  return (
    <main style={{ ...main, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ ...card, width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>{obligatorio ? "Crea tu contraseña" : "Cambiar contraseña"}</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A", marginTop: 0 }}>
          {obligatorio
            ? "Entraste con una contraseña temporal. Antes de continuar, crea una propia que solo tú conozcas."
            : "Escribe tu nueva contraseña."}
          <br /><b>{email}</b>
        </p>
        <label style={lbl}>Nueva contraseña</label>
        <input type="password" value={c1} onChange={(e) => setC1(e.target.value)} style={{ ...inp, marginBottom: 10 }} autoComplete="new-password" />
        <label style={lbl}>Repítela</label>
        <input type="password" value={c2} onChange={(e) => setC2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardar()}
          style={{ ...inp, marginBottom: 12 }} autoComplete="new-password" />
        <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 12 }}>Mínimo 8 caracteres, con letras y números.</div>
        <button onClick={guardar} disabled={busy} style={{ ...btn, width: "100%", opacity: busy ? 0.6 : 1 }}>Guardar contraseña</button>
        {msg.t && <div style={{ fontSize: 13, marginTop: 10, color: msg.k === "err" ? "#C0392B" : "#1E7B34" }}>{msg.t}</div>}
        <button onClick={salir} style={{ marginTop: 14, background: "none", border: 0, color: "#5F5E5A", fontSize: 13, cursor: "pointer", padding: 0 }}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
