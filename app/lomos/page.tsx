"use client";

import { useState, type CSSProperties } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { COLOR } from "../../lib/theme";
  import Nav from "../../components/Nav";

type Empresa = { label: string; color: string; logo: string; pref: string };
const EMPRESAS: Record<string, Empresa> = {
  globalgo: { label: "Global Go", color: "#1369B2", logo: "/global-go.png", pref: "GG" },
  factoring: { label: "Global Factoring", color: "#1070B7", logo: "/global-factoring.png", pref: "GFAC" },
  funding: { label: "Global Funding", color: "#3AAA35", logo: "/global-funding.png", pref: "GFUN" },
  coop: { label: "Cooperativa", color: "#0052FC", logo: "/cooperativa.png", pref: "COOP" },
};
const MES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];

type Tomo = {
  src: string; region: string; anio: string | null; tomo: string;
  items: number; fecha_min: string | null; fecha_max: string | null;
};

function chunk<T>(arr: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default function Lomos() {
  const [emp, setEmp] = useState("globalgo");
  const [tomos, setTomos] = useState<Tomo[]>([]);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [msg, setMsg] = useState("");

  const CO = EMPRESAS[emp];

  async function cargar() {
    setMsg("Cargando…");
    const { data, error } = await supabase.from("v_tomos").select("*");
    if (error) { setMsg(error.message); return; }
    const t = (data ?? []) as Tomo[];
    setTomos(t);
    const s: Record<number, boolean> = {};
    t.forEach((_, i) => (s[i] = true));
    setSel(s);
    setMsg(t.length ? "" : "No hay tomos aún (carga saneamiento primero).");
  }

  function rango(t: Tomo) {
    if (t.src === "lima") return t.anio ? "Año " + t.anio : "";
    if (!t.fecha_min && !t.fecha_max) return "s/f";
    const f = (d: string | null) => { if (!d) return ""; const p = d.split("-"); return MES[(+p[1] || 1) - 1] + " " + p[0]; };
    const a = f(t.fecha_min), b = f(t.fecha_max);
    return a === b ? a : a + " – " + b;
  }
  function codigo(t: Tomo) {
    const mid = t.src === "lima" ? (t.anio || "") : t.region;
    return `${CO.pref}-${mid}-T${t.tomo}`;
  }
  function qrUrl(t: Tomo) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    let u = `${base}/tomo?src=${t.src}&region=${encodeURIComponent(t.region)}&tomo=${encodeURIComponent(t.tomo)}`;
    if (t.src === "lima") u += `&anio=${encodeURIComponent(t.anio || "")}`;
    return u;
  }

  function Card(t: Tomo) {
    return (
      <div className="lomo-card" style={{ height: "100%", border: `1.5px solid ${COLOR.border}`, borderRadius: 6, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: "18px 10px 14px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 104, borderBottom: "1px solid #eee" }}>
          <img src={CO.logo} alt="" style={{ maxWidth: "94%", maxHeight: 90, objectFit: "contain" }} />
        </div>
        <div style={{ background: CO.color, color: "#fff", textAlign: "center", fontWeight: 800, letterSpacing: 5, fontSize: 17, padding: "8px 4px" }}>LEGAL</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <QRCodeCanvas value={qrUrl(t)} size={104} level="M" />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 14px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 1, fontWeight: 700, textTransform: "uppercase", color: CO.color }}>{CO.label}</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t.region}{t.anio ? " " + t.anio : ""}</div>
          <div><div style={{ fontSize: 11, color: "#888", letterSpacing: 3 }}>TOMO</div><div style={{ fontSize: 56, fontWeight: 800, lineHeight: 0.9, color: CO.color }}>{t.tomo}</div></div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{rango(t)}</div>
          <div style={{ fontSize: 11, color: "#666" }}>{t.items} expediente(s)</div>
        </div>
        <div style={{ padding: "8px 6px", textAlign: "center", borderTop: `2px solid ${CO.color}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1A2238", letterSpacing: 0.5 }}>{codigo(t)}</div>
          <div style={{ fontSize: 9, color: "#888780", marginTop: 3 }}>Uso interno · Datos protegidos — Ley N° 29733</div>
        </div>
      </div>
    );
  }

  const seleccionados = tomos.map((t, i) => ({ t, i })).filter((x) => sel[x.i]);
  const nSel = seleccionados.length;

  return (
    <main style={{ minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <style jsx global>{`
        .lomo-card, .lomo-card * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-only { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: #fff; }
          .noprint { display: none !important; }
          .print-only { display: block; }
          .lomo-page { box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; }
          .lomo-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div className="noprint"><Nav /></div>
      <header className="noprint" style={{ background: COLOR.navy, color: "#fff", padding: "18px 28px" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Lomos con QR</div>
        <div style={{ fontSize: 13, color: COLOR.navyText, marginTop: 2 }}>Generador de rótulos para los archivadores</div>
      </header>

      <section className="noprint" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontWeight: 600, fontSize: 14 }}>Empresa:</label>
          <select value={emp} onChange={(e) => setEmp(e.target.value)} style={inp}>
            {Object.keys(EMPRESAS).map((k) => (<option key={k} value={k}>{EMPRESAS[k].label}</option>))}
          </select>
          <button onClick={cargar} style={btn}>Cargar tomos</button>
          <button onClick={() => { const s: Record<number, boolean> = {}; tomos.forEach((_, i) => (s[i] = true)); setSel(s); }} style={btnGhost}>Seleccionar todos</button>
          <button onClick={() => setSel({})} style={btnGhost}>Ninguno</button>
          <button onClick={() => window.print()} style={btn}>Imprimir seleccionados</button>
          <span style={{ fontSize: 13, color: COLOR.textSec }}>{msg || (tomos.length ? `${nSel} de ${tomos.length} · ${Math.ceil(nSel / 3) || 0} hoja(s) A4` : "")}</span>
        </div>
      </section>

      <div className="noprint" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, maxWidth: 1100, margin: "0 auto", padding: "0 20px 40px" }}>
        {tomos.map((t, i) => (
          <div key={i} style={{ position: "relative", opacity: sel[i] ? 1 : 0.45 }}>
            {Card(t)}
            <input type="checkbox" checked={!!sel[i]} onChange={(e) => setSel({ ...sel, [i]: e.target.checked })} style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, cursor: "pointer" }} />
          </div>
        ))}
      </div>

      <div className="print-only">
        {chunk(seleccionados, 3).map((grupo, pi) => (
          <div key={pi} className="lomo-page" style={pageStyle}>
            {grupo.map(({ t, i }) => (<div key={i} style={{ flex: "1 1 0", display: "flex" }}>{Card(t)}</div>))}
          </div>
        ))}
      </div>
    </main>
  );
}

const inp: CSSProperties = { fontSize: 15, padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff" };
const btn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const btnGhost: CSSProperties = { background: "#fff", border: "1px solid #D3D1C7", borderRadius: 8, padding: "9px 14px", fontSize: 14, cursor: "pointer" };
const pageStyle: CSSProperties = { width: "210mm", minHeight: "297mm", background: "#fff", margin: "0 auto 12mm", padding: "8mm", display: "flex", gap: "4mm", boxShadow: "0 1px 8px rgba(0,0,0,.15)" };
