"use client";

import { useState } from "react";
import { LomoCard, LomosImpresion, hojasA4, type LomoDatos } from "../../../components/Lomo";
import GfHeader, { main, inp, btn, btnGhost } from "../../../components/GfHeader";
import { COLOR } from "../../../lib/theme";
import {
  gf, GF, DOCS, type DocKey, useSesion, expSimple, etiquetaContraparte, siglaConcursal,
  SIGLA_PROCESO, TAG_PROCESO, numFolder, mesAnio,
} from "../../../lib/gf";

// Lomos de Global Factoring: 6.2 x 19.4 cm, 4 por hoja A4 horizontal.
// Procesos: un lomo por expediente base (principal + cautelares). Documentos: un lomo por folder.

type Lomo = LomoDatos;
const MARCA = { logo: GF.logo, color: GF.color, empresa: GF.label };
type Modo = "proceso" | DocKey;
type PRow = {
  tipo: string; expediente_base: string; localidad: string | null; materia: string | null; rol: string;
  contraparte: { tipo_documento: string; numero_documento: string; nombre: string | null } | null;
};

export default function GfLomos() {
  const sesion = useSesion();
  const [modo, setModo] = useState<Modo>("proceso");
  const [lomos, setLomos] = useState<Lomo[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [aviso, setAviso] = useState("");

  const origen = () => (typeof window !== "undefined" ? window.location.origin : "");

  async function cargar() {
    setMsg("Cargando…"); setAviso("");
    let out: Lomo[] = [];
    if (modo === "proceso") {
      const { data, error } = await gf().from("proceso")
        .select("tipo, expediente, expediente_base, localidad, materia, rol, contraparte:contraparte_id(tipo_documento, numero_documento, nombre)")
        .not("expediente_base", "is", null).order("expediente");
      if (error) { setMsg(error.message); return; }
      const grupos = new Map<string, PRow[]>();
      ((data ?? []) as unknown as PRow[]).forEach((p) => grupos.set(p.expediente_base, [...(grupos.get(p.expediente_base) ?? []), p]));
      out = [...grupos.entries()].map(([base, ps]) => {
        const p = ps.find((x) => x.localidad) ?? ps[0];
        const cp = p.contraparte;
        const simple = expSimple(base);
        return {
          ...MARCA, key: base, tag: TAG_PROCESO[p.tipo] ?? p.tipo, big: simple, bigSize: simple.length > 10 ? 26 : 30,
          loc: p.localidad || "", extra: p.tipo === "CONCURSAL" ? siglaConcursal(p.materia) : "",
          parteEt: etiquetaContraparte(p.tipo, p.rol), parte: cp?.nombre || `${cp?.tipo_documento ?? ""} ${cp?.numero_documento ?? ""}`,
          codigo: `${GF.pref}-${SIGLA_PROCESO[p.tipo] ?? "PRO"}-${simple}`,
          qr: `${origen()}/gf?exp=${encodeURIComponent(base)}`,
        };
      });
      // Avisar si dos archivadores distintos quedarían con el mismo número y localidad en el lomo
      const vistos = new Map<string, number>();
      out.forEach((l) => vistos.set(l.big + "|" + l.loc, (vistos.get(l.big + "|" + l.loc) ?? 0) + 1));
      const rep = [...vistos.entries()].filter(([, n]) => n > 1).map(([k]) => k.replace("|", " · "));
      if (rep.length) setAviso(`Atención: estos lomos se verían iguales (revisa la localidad): ${rep.join(", ")}`);
    } else {
      const d = DOCS[modo];
      const { data, error } = await gf().from(d.tabla).select(`folder, ${d.fecha}`);
      if (error) { setMsg(error.message); return; }
      const grupos = new Map<string, { n: number; min: string | null; max: string | null }>();
      let sinFolder = 0;
      ((data ?? []) as unknown as Record<string, string | null>[]).forEach((r) => {
        if (!r.folder) { sinFolder++; return; }
        const g = grupos.get(r.folder) ?? { n: 0, min: null as string | null, max: null as string | null };
        const fe: string | null = r[d.fecha];
        g.n++;
        if (fe && (!g.min || fe < g.min)) g.min = fe;
        if (fe && (!g.max || fe > g.max)) g.max = fe;
        grupos.set(r.folder, g);
      });
      out = [...grupos.entries()]
        .sort(([a], [b]) => (parseInt(numFolder(a)) || 0) - (parseInt(numFolder(b)) || 0) || a.localeCompare(b))
        .map(([folder, g]) => {
          const num = numFolder(folder);
          const a = mesAnio(g.min), b = mesAnio(g.max);
          return {
            ...MARCA, key: folder, tag: d.label.toUpperCase(), big: num, bigSize: num.length > 4 ? 30 : 52, label: "FOLDER",
            extra: !a && !b ? "s/f" : a === b ? a : `${a} – ${b}`, nota: `${g.n} documento(s)`,
            codigo: `${GF.pref}-${d.sigla}-F${/^\d+$/.test(num) ? num.padStart(2, "0") : num}`,
            qr: `${origen()}/gf?folder=${encodeURIComponent(modo + "|" + folder)}`,
          };
        });
      if (sinFolder) setAviso(`${sinFolder} registro(s) de ${d.label.toLowerCase()} no tienen folder asignado y no aparecen aquí.`);
    }
    setLomos(out);
    const s: Record<string, boolean> = {};
    out.forEach((l) => (s[l.key] = true));
    setSel(s);
    setMsg(out.length ? "" : "No hay registros para generar lomos.");
  }

  if (!sesion) return <main style={main} />;
  const elegidos = lomos.filter((l) => sel[l.key]);

  return (
    <main style={main}>
      <GfHeader titulo="Global Factoring · Lomos" sub="6.2 × 19.4 cm · 4 por hoja A4 horizontal" />

      <section className="noprint" style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={modo} onChange={(e) => { setModo(e.target.value as Modo); setLomos([]); setMsg(""); setAviso(""); }} style={{ ...inp, width: "auto" }}>
            <option value="proceso">Procesos (por expediente)</option>
            {(Object.keys(DOCS) as DocKey[]).map((k) => <option key={k} value={k}>{DOCS[k].label} (por folder)</option>)}
          </select>
          <button onClick={cargar} style={btn}>Cargar lomos</button>
          <button onClick={() => { const s: Record<string, boolean> = {}; lomos.forEach((l) => (s[l.key] = true)); setSel(s); }} style={btnGhost}>Seleccionar todos</button>
          <button onClick={() => setSel({})} style={btnGhost}>Ninguno</button>
          <button onClick={() => window.print()} disabled={!elegidos.length} style={{ ...btn, opacity: elegidos.length ? 1 : 0.5 }}>Imprimir seleccionados</button>
          <span style={{ fontSize: 13, color: COLOR.textSec }}>{msg || (lomos.length ? `${elegidos.length} de ${lomos.length} · ${hojasA4(elegidos.length)} hoja(s) A4` : "")}</span>
        </div>
        {aviso && <div style={{ marginTop: 12, fontSize: 13, padding: "10px 12px", borderRadius: 8, background: "#FFF4E0", color: "#8A5300" }}>{aviso}</div>}
        <div style={{ marginTop: 10, fontSize: 12, color: COLOR.textSec }}>Al imprimir, verifica que la orientación sea horizontal y la escala al 100 %.</div>
      </section>

      <div className="noprint" style={{ display: "flex", flexWrap: "wrap", gap: 14, maxWidth: 1100, margin: "0 auto", padding: "0 20px 40px" }}>
        {lomos.map((l) => (
          <div key={l.key} style={{ position: "relative", opacity: sel[l.key] ? 1 : 0.45 }}>
            <LomoCard {...l} key={l.key} />
            <input type="checkbox" checked={!!sel[l.key]} onChange={(e) => setSel({ ...sel, [l.key]: e.target.checked })} style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, cursor: "pointer" }} />
          </div>
        ))}
      </div>

      <LomosImpresion lomos={elegidos} />
    </main>
  );
}
