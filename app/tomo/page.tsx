"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";
import ConsultaPin from "../../components/ConsultaPin";

type Fila = {
  src: string;
  region: string;
  anio: string | null;
  tomo: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  nombre: string | null;
  fecha_firma: string | null;
};

const MES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
function fecha(d: string | null) {
  if (!d) return "";
  const p = d.split("-");
  return `${p[2] || ""} ${MES[(+p[1] || 1) - 1]} ${p[0]}`.trim();
}
// Normaliza para buscar sin tildes ni mayúsculas.
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function TomoView() {
  const sp = useSearchParams();
  const src = sp.get("src") || "";
  const region = sp.get("region") || "";
  const tomo = sp.get("tomo") || "";
  const anio = sp.get("anio") || "";

  const [sesion, setSesion] = useState<boolean | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [msg, setMsg] = useState("Cargando…");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        // Sin sesión: se ofrece consultar con el PIN de Legal o ingresar con cuenta
        setSesion(false);
        return;
      }
      setSesion(true);

      let q2 = supabase.from("v_tomo_detalle").select("*").eq("tomo", tomo);
      if (src === "lima") q2 = q2.eq("src", "lima").eq("anio", anio);
      else q2 = q2.eq("src", "fisico").eq("region", region);

      const { data, error } = await q2;
      if (error) { setMsg(error.message); return; }
      const f = (data ?? []) as Fila[];
      // Orden: provincias por fecha de firma; Lima por nombre.
      f.sort((a, b) =>
        src === "lima"
          ? (a.nombre || "").localeCompare(b.nombre || "")
          : (a.fecha_firma || "").localeCompare(b.fecha_firma || "")
      );
      setFilas(f);
      setMsg(f.length ? "" : "No se encontraron expedientes para este tomo.");
    })();
  }, [src, region, tomo, anio]);

  const esLima = src === "lima";
  const titulo = esLima ? `LIMA · ${anio}` : region;

  // Filtro dentro del tomo (por documento o nombre). No consulta la base de nuevo.
  const vis = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return filas;
    return filas.filter((f) => norm(`${f.numero_documento || ""} ${f.nombre || ""}`).includes(t));
  }, [filas, q]);

  return (
    <main style={{ minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <header style={{ background: COLOR.navy, color: "#fff", padding: "20px 24px" }}>
        <div style={{ fontSize: 12, color: COLOR.navyText, letterSpacing: 2, textTransform: "uppercase" }}>Archivo Legal · Contenido del tomo</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{titulo}</span>
          <span style={{ fontSize: 13, color: COLOR.navyText }}>TOMO</span>
          <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{tomo}</span>
        </div>
      </header>

      <section style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
        {sesion === false && (
          <ConsultaPin
            destino={{ tipo: "tomo", src, region, anio, tomo }}
            volver={typeof window !== "undefined" ? window.location.pathname + window.location.search : "/tomo"}
          />
        )}

        {sesion === true && (
          <>
            {filas.length > 0 && (
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar en este tomo (documento o nombre)…"
                style={{
                  width: "100%", fontSize: 14, padding: "10px 12px", marginBottom: 10,
                  border: `1px solid ${COLOR.border}`, borderRadius: 8, boxSizing: "border-box", background: "#fff",
                }}
              />
            )}

            <div style={{ fontSize: 13, color: COLOR.textSec, margin: "4px 0 12px" }}>
              {msg || (q.trim()
                ? `${vis.length} de ${filas.length} expediente(s)`
                : `${filas.length} expediente(s) en este tomo`)}
            </div>

            {filas.length > 0 && (
              <div style={{ overflowX: "auto", border: `1px solid ${COLOR.border}`, borderRadius: 10, background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F4F2EB", textAlign: "left" }}>
                      <th style={th}>#</th>
                      {esLima ? (
                        <th style={th}>Nombre</th>
                      ) : (
                        <>
                          <th style={th}>Documento</th>
                          <th style={th}>Nombre</th>
                          <th style={th}>Fecha de firma</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {vis.length === 0 && (
                      <tr><td style={td} colSpan={esLima ? 2 : 4}>Sin coincidencias para “{q}”.</td></tr>
                    )}
                    {vis.map((f, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${COLOR.border}` }}>
                        <td style={td}>{i + 1}</td>
                        {esLima ? (
                          <td style={td}>{f.nombre || "—"}</td>
                        ) : (
                          <>
                            <td style={{ ...td, whiteSpace: "nowrap" }}>
                              {f.tipo_documento ? `${f.tipo_documento} ` : ""}{f.numero_documento || "—"}
                            </td>
                            <td style={td}>{f.nombre || "—"}</td>
                            <td style={{ ...td, whiteSpace: "nowrap" }}>{fecha(f.fecha_firma) || "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ fontSize: 11, color: COLOR.textSec, marginTop: 16 }}>
              Uso interno · Datos protegidos — Ley N° 29733
            </div>
          </>
        )}

        {sesion === null && (
          <div style={{ fontSize: 14, color: COLOR.textSec }}>Cargando…</div>
        )}
      </section>
    </main>
  );
}

export default function TomoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando…</div>}>
      <TomoView />
    </Suspense>
  );
}

const card: CSSProperties = { border: `1px solid ${COLOR.border}`, borderRadius: 12, background: "#fff", padding: 24 };
const btn: CSSProperties = { display: "inline-block", background: "#1A2238", color: "#fff", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 14, textDecoration: "none" };
const th: CSSProperties = { padding: "10px 12px", fontWeight: 700, color: "#5F5E5A", borderBottom: `2px solid ${COLOR.border}` };
const td: CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
