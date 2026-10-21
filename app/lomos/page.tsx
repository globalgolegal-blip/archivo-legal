"use client";

import { useState, type CSSProperties } from "react";
import { LomoCard, LomosImpresion, hojasA4, type LomoDatos } from "../../components/Lomo";
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

  // Formato común de lomos: components/Lomo.tsx (6.2 x 19.4 cm, 4 por hoja A4 horizontal)
  function datos(t: Tomo, i: number): LomoDatos {
    return {
      key: String(i), logo: CO.logo, color: CO.color, empresa: CO.label,
      sub: t.region + (t.anio ? " " + t.anio : ""), label: "TOMO", big: t.tomo,
      extra: rango(t), nota: `${t.items} expediente(s)`, codigo: codigo(t), qr: qrUrl(t),
    };
  }

  const seleccionados = tomos.map((t, i) => ({ t, i })).filter((x) => sel[x.i]);
  const nSel = seleccionados.length;

  return (
    <main style={{ minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
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
          <span style={{ fontSize: 13, color: COLOR.textSec }}>{msg || (tomos.length ? `${nSel} de ${tomos.length} · ${hojasA4(nSel)} hoja(s) A4` : "")}</span>
        </div>
      </section>

      <div className="noprint" style={{ display: "flex", flexWrap: "wrap", gap: 14, maxWidth: 1100, margin: "0 auto", padding: "0 20px 40px" }}>
        {tomos.map((t, i) => (
          <div key={i} style={{ position: "relative", opacity: sel[i] ? 1 : 0.45 }}>
            <LomoCard {...datos(t, i)} key={String(i)} />
            <input type="checkbox" checked={!!sel[i]} onChange={(e) => setSel({ ...sel, [i]: e.target.checked })} style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, cursor: "pointer" }} />
          </div>
        ))}
      </div>

      <LomosImpresion lomos={seleccionados.map(({ t, i }) => datos(t, i))} />
    </main>
  );
}

const inp: CSSProperties = { fontSize: 15, padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff" };
const btn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const btnGhost: CSSProperties = { background: "#fff", border: "1px solid #D3D1C7", borderRadius: 8, padding: "9px 14px", fontSize: 14, cursor: "pointer" };
