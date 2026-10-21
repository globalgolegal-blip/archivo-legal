"use client";

import type { CSSProperties } from "react";
import { QRCodeCanvas } from "qrcode.react";

// ============================================================================
//  Lomo — formato único de todos los lomos del proyecto (todas las empresas).
//  6.2 × 19.4 cm · 4 por hoja A4 horizontal (área útil del archivador: 25 × 8 cm).
//  Para cambiar el formato de TODOS los lomos, se edita solo este archivo.
// ============================================================================

export type LomoDatos = {
  key: string;
  logo: string;          // ruta del logo de la empresa
  color: string;         // color de la empresa (franja LEGAL y número)
  empresa: string;       // "Global Go", "Global Factoring"…
  tag?: string;          // etiqueta resaltada: "PROCESO CIVIL", "CONTRATOS"…
  sub?: string;          // línea en negrita sobre el número (ej. región y año)
  label?: string;        // texto pequeño sobre el número: "TOMO", "FOLDER"
  big: string;           // número principal
  bigSize?: number;
  loc?: string;          // localidad bajo el número
  extra?: string;        // rango de fechas, PCO…
  parteEt?: string;      // "DDO", "DEUDORA"…
  parte?: string;
  nota?: string;         // "30 documento(s)"
  codigo: string;
  qr: string;
};

export const LOMOS_POR_HOJA = 4;

export function LomoCard(l: LomoDatos) {
  return (
    <div className="lomo-card" style={{ width: "62mm", height: "194mm", border: "1.5px solid #D3D1C7", borderRadius: 6, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", color: "#1A2238", textAlign: "center", boxSizing: "border-box" }}>
      <div style={{ padding: "14px 10px 10px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 90, borderBottom: "1px solid #eee" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.logo} alt="" style={{ maxWidth: "88%", maxHeight: 76, objectFit: "contain" }} />
      </div>
      <div style={{ background: l.color, color: "#fff", fontWeight: 800, letterSpacing: 5, fontSize: 17, padding: "8px 4px" }}>LEGAL</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <QRCodeCanvas value={l.qr} size={96} level="M" />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 14px 14px" }}>
        <div style={{ fontSize: 12, letterSpacing: 1, fontWeight: 700, textTransform: "uppercase", color: l.color }}>{l.empresa}</div>
        {l.tag && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", borderRadius: 4, background: "#E6F1FB", color: "#0C447C" }}>{l.tag}</div>}
        {l.sub && <div style={{ fontSize: 15, fontWeight: 700 }}>{l.sub}</div>}
        <div>
          {l.label && <div style={{ fontSize: 11, color: "#888", letterSpacing: 3 }}>{l.label}</div>}
          <div style={{ fontSize: l.bigSize ?? 52, fontWeight: 800, lineHeight: 1, color: l.color, whiteSpace: "nowrap" }}>{l.big}</div>
        </div>
        {l.loc && <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, marginTop: -4 }}>{l.loc}</div>}
        {l.extra && <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>{l.extra}</div>}
        {l.parte && <div style={{ fontSize: 13, lineHeight: 1.35 }}><b style={{ color: "#5F5E5A" }}>{l.parteEt}:</b> {l.parte}</div>}
        {l.nota && <div style={{ fontSize: 13 }}>{l.nota}</div>}
      </div>
      <div style={{ padding: "8px 6px", borderTop: `2px solid ${l.color}` }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>{l.codigo}</div>
        <div style={{ fontSize: 9, color: "#888780", marginTop: 3 }}>Uso interno · Datos protegidos — Ley N° 29733</div>
      </div>
    </div>
  );
}

/** Estilos de impresión + hojas A4 horizontales con 4 lomos cada una. */
export function LomosImpresion({ lomos }: { lomos: LomoDatos[] }) {
  const hojas: LomoDatos[][] = [];
  for (let i = 0; i < lomos.length; i += LOMOS_POR_HOJA) hojas.push(lomos.slice(i, i + LOMOS_POR_HOJA));
  return (
    <>
      <style jsx global>{`
        .lomo-card, .lomo-card * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .print-only { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; min-height: 0 !important; height: auto !important; }
          main { min-height: 0 !important; }
          .noprint { display: none !important; }
          .print-only { display: block; }
          /* Hoja con holgura: 4 × 6.2 cm + espacios = 26.6 cm de ancho y 20.2 cm de alto,
             para que entre en A4 (29.7 × 21) e incluso en carta (27.9 × 21.6) sin cortarse */
          .lomo-page { width: 100% !important; height: auto !important; margin: 0 !important; padding: 4mm 0 0 !important;
                       box-shadow: none !important; display: flex !important; justify-content: center; align-items: flex-start;
                       break-inside: avoid; page-break-inside: avoid; break-after: page; page-break-after: always; overflow: hidden; }
          .lomo-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div className="print-only">
        {hojas.map((grupo, i) => (
          <div key={i} className="lomo-page" style={pageStyle}>
            {grupo.map((l) => <LomoCard {...l} key={l.key} />)}
          </div>
        ))}
      </div>
    </>
  );
}

export const hojasA4 = (n: number) => Math.ceil(n / LOMOS_POR_HOJA);

const pageStyle: CSSProperties = { background: "#fff", display: "flex", justifyContent: "center", gap: "4mm", boxSizing: "border-box" };
