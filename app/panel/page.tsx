"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";
  import Nav from "../../components/Nav";

type Row = {
  situacion: string;
  total: number;
  con_garantia: number;
  con_fisico: number;
  sin_placa: number;
  completo: number;
};

export default function Panel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [estado, setEstado] = useState("Cargando…");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setEstado("no-auth");
        return;
      }
      const { data, error } = await supabase.from("v_empate_resumen").select("*");
      if (error) {
        setEstado(error.message);
        return;
      }
      setRows((data ?? []) as Row[]);
      setEstado("");
    })();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLOR.bg,
        color: COLOR.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
            <Nav />
      <header style={{ background: COLOR.navy, color: "#fff", padding: "18px 28px" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Panel · Global Go</div>
        <div style={{ fontSize: 13, color: COLOR.navyText, marginTop: 2 }}>
          Empate por situación
        </div>
      </header>

      <section style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px" }}>
        {estado === "no-auth" ? (
          <p>
            Debes iniciar sesión.{" "}
            <a href="/login" style={{ color: COLOR.navy }}>Ir al login →</a>
          </p>
        ) : estado ? (
          <p style={{ color: estado === "Cargando…" ? COLOR.textSec : "#A32D2D" }}>
            {estado}
          </p>
        ) : (
          <div
            style={{
              background: COLOR.surface,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 12,
              padding: 18,
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Situación", "Total", "Con garantía", "Con físico", "Sin placa", "Completos"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          borderBottom: `1px solid ${COLOR.border}`,
                          color: COLOR.textSec,
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.situacion}>
                    <td style={td}>{r.situacion}</td>
                    <td style={td}>{r.total?.toLocaleString("es-PE")}</td>
                    <td style={td}>{r.con_garantia?.toLocaleString("es-PE")}</td>
                    <td style={td}>{r.con_fisico?.toLocaleString("es-PE")}</td>
                    <td style={td}>{(r.sin_placa ?? 0).toLocaleString("es-PE")}</td>
                    <td style={td}>{r.completo?.toLocaleString("es-PE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const td: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #E8E6DF" };
