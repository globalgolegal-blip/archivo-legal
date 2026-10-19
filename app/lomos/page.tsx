"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";

// ----------------------------------------------------------------------------
//  Configuración por empresa: color de banda, prefijo de código y logo.
//  Los logos viven en /public (global-go.png, etc.).
// ----------------------------------------------------------------------------
const EMPRESAS: Record<
  string,
  { nombre: string; color: string; prefijo: string; logo: string }
> = {
  globalgo:  { nombre: "Global Go",        color: "#1369B2", prefijo: "GG",   logo: "/global-go.png" },
  factoring: { nombre: "Global Factoring", color: "#1070B7", prefijo: "GFAC", logo: "/global-factoring.png" },
  funding:   { nombre: "Global Funding",   color: "#3AAA35", prefijo: "GFUN", logo: "/global-funding.png" },
  coop:      { nombre: "Cooperativa",      color: "#0052FC", prefijo: "COOP", logo: "/cooperativa.png" },
};

// Base pública de la app (para que el QR apunte al visor del tomo).
const BASE =
  typeof window !== "undefined" ? window.location.origin : "";

type Tomo = {
  src: string;
  region: string;
  anio: string | null;
  tomo: string;
  items: number;
  fecha_min: string | null;
  fecha_max: string | null;
};

// ----------------------------------------------------------------------------
//  Helpers
// ----------------------------------------------------------------------------
function rango(t: Tomo): string {
  // Lima va por año; provincias por rango de fechas de firma.
  if (t.src === "lima") return t.anio ? `Año ${t.anio}` : "—";
  if (t.fecha_min && t.fecha_max) {
    const f = (d: string) =>
      new Date(d).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    return t.fecha_min === t.fecha_max
      ? f(t.fecha_min)
      : `${f(t.fecha_min)} – ${f(t.fecha_max)}`;
  }
  return "—";
}

function codigo(emp: string, t: Tomo): string {
  const pref = EMPRESAS[emp].prefijo;
  const reg = (t.src === "lima" ? "LIMA" : t.region)
    .toUpperCase()
    .replace(/\s+/g, "");
  const n = String(t.tomo).padStart(3, "0");
  return `${pref}-${reg}-T${n}`;
}

function qrUrl(emp: string, t: Tomo): string {
  const p = new URLSearchParams({
    src: t.src,
    region: t.region,
    tomo: String(t.tomo),
  });
  if (t.anio) p.set("anio", t.anio);
  return `${BASE}/tomo?${p.toString()}`;
}

// Parte una lista en grupos de n (para armar las hojas A4 de 3 lomos).
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ----------------------------------------------------------------------------
//  Página
// ----------------------------------------------------------------------------
export default function LomosPage() {
  const [emp, setEmp] = useState<string>("globalgo");
  const [tomos, setTomos] = useState<Tomo[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      setError(null);
      const { data, error } = await supabase
        .from("v_tomos")
        .select("*");
      if (error) {
        setError(error.message);
        setTomos([]);
      } else {
        setTomos((data as Tomo[]) || []);
      }
      setCargando(false);
    })();
  }, []);

  const key = (t: Tomo) => `${t.src}|${t.region}|${t.anio ?? ""}|${t.tomo}`;

  function toggle(t: Tomo) {
    const k = key(t);
    const s = new Set(sel);
    s.has(k) ? s.delete(k) : s.add(k);
    setSel(s);
  }
  function todos() {
    setSel(new Set(tomos.map(key)));
  }
  function ninguno() {
    setSel(new Set());
  }

  const seleccionados = tomos.filter((t) => sel.has(key(t)));
  const hojas = chunk(seleccionados, 3);
  const CO = EMPRESAS[emp];

  // --------------------------------------------------------------------------
  //  Tarjeta de lomo  (QR arriba, pegado bajo la banda LEGAL)
  // --------------------------------------------------------------------------
  function Card(t: Tomo) {
    return (
      <div
        className="lomo-card"
        style={{
          width: "6.3cm",
          height: "9cm",
          border: `1px solid ${COLOR.border}`,
          borderRadius: 10,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: COLOR.surface,
          boxSizing: "border-box",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 104,
            padding: "12px 10px 6px",
          }}
        >
          <img
            src={CO.logo}
            alt={CO.nombre}
            style={{ maxHeight: 90, maxWidth: "90%", objectFit: "contain" }}
          />
        </div>

        {/* Banda LEGAL */}
        <div
          style={{
            background: CO.color,
            color: "#FFFFFF",
            textAlign: "center",
            fontWeight: 800,
            letterSpacing: 6,
            fontSize: 22,
            padding: "6px 0",
          }}
        >
          LEGAL
        </div>

        {/* QR pegado debajo de la banda */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 12,
            paddingBottom: 4,
          }}
        >
          <QRCodeCanvas value={qrUrl(emp, t)} size={104} level="M" />
        </div>

        {/* Cuerpo centrado debajo del QR */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "4px 14px 10px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 12, color: COLOR.textSec }}>
            {CO.nombre}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLOR.text }}>
            {t.src === "lima" ? "LIMA" : t.region}
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1,
              color: COLOR.text,
            }}
          >
            T{String(t.tomo).padStart(3, "0")}
          </div>
          <div style={{ fontSize: 12, color: COLOR.textSec }}>
            {rango(t)}
          </div>
          <div style={{ fontSize: 11, color: COLOR.textSec }}>
            {t.items} {t.items === 1 ? "documento" : "documentos"}
          </div>
        </div>

        {/* Pie: código + Ley 29733 */}
        <div
          style={{
            borderTop: `1px solid ${COLOR.border}`,
            padding: "6px 10px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: COLOR.text,
              letterSpacing: 1,
            }}
          >
            {codigo(emp, t)}
          </div>
          <div style={{ fontSize: 7.5, color: COLOR.textSec, marginTop: 2 }}>
            Datos protegidos — Ley N° 29733
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  return (
    <div style={{ background: COLOR.bg, minHeight: "100vh" }}>
      {/* Barra de controles (no se imprime) */}
      <div
        className="no-print"
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${COLOR.border}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          background: COLOR.surface,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <strong style={{ color: COLOR.text }}>Generador de lomos</strong>

        <select
          value={emp}
          onChange={(e) => {
            setEmp(e.target.value);
            setSel(new Set());
          }}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${COLOR.border}`,
          }}
        >
          {Object.entries(EMPRESAS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.nombre}
            </option>
          ))}
        </select>

        <button onClick={todos} style={btn}>
          Seleccionar todos
        </button>
        <button onClick={ninguno} style={btn}>
          Ninguno
        </button>
        <button
          onClick={() => window.print()}
          disabled={seleccionados.length === 0}
          style={{
            ...btn,
            background: COLOR.navy,
            color: "#fff",
            opacity: seleccionados.length === 0 ? 0.5 : 1,
          }}
        >
          Imprimir {seleccionados.length > 0 ? `(${seleccionados.length})` : ""}
        </button>

        <span style={{ color: COLOR.textSec, fontSize: 13 }}>
          {cargando
            ? "Cargando tomos…"
            : `${tomos.length} tomos · ${seleccionados.length} seleccionados`}
        </span>
      </div>

      {error && (
        <div style={{ padding: 20, color: "#b00" }}>Error: {error}</div>
      )}

      {/* Lista de selección (no se imprime) */}
      <div
        className="no-print"
        style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        {tomos.map((t) => {
          const k = key(t);
          const checked = sel.has(k);
          return (
            <label
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${checked ? CO.color : COLOR.border}`,
                background: checked ? "#fff" : COLOR.surface,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(t)}
              />
              <span style={{ fontSize: 13, color: COLOR.text }}>
                <strong>{codigo(emp, t)}</strong>
                <br />
                <span style={{ color: COLOR.textSec }}>
                  {t.src === "lima" ? "LIMA" : t.region} · {rango(t)} ·{" "}
                  {t.items} doc.
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Hojas A4 para imprimir (3 lomos por hoja) */}
      <div className="print-area">
        {hojas.map((hoja, i) => (
          <div key={i} className="hoja">
            {hoja.map((t) => (
              <div key={key(t)}>{Card(t)}</div>
            ))}
          </div>
        ))}
      </div>

      <style jsx global>{`
        .print-area {
          display: none;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .print-area {
            display: block;
          }
          .hoja {
            display: flex;
            gap: 0.4cm;
            justify-content: center;
            align-items: flex-start;
            page-break-after: always;
            padding: 0.6cm 0;
          }
          .lomo-card,
          .lomo-card * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4;
            margin: 0.8cm;
          }
        }
      `}</style>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${COLOR.border}`,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};
