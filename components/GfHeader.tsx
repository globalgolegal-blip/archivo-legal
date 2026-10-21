"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import Nav from "./Nav";
import { COLOR } from "../lib/theme";

// Encabezado común de las pantallas de Global Factoring, con sus sub-pestañas.
const TABS = [
  { href: "/gf", label: "Buscar" },
  { href: "/gf/registrar", label: "Registrar" },
  { href: "/gf/lomos", label: "Lomos" },
];

export default function GfHeader({ titulo, sub }: { titulo: string; sub: string }) {
  const path = usePathname();
  return (
    <div className="noprint">
      <Nav />
      <header style={{ background: COLOR.navy, color: "#fff", padding: "16px 28px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/global-factoring.png" alt="" style={{ height: 34, background: "#fff", borderRadius: 6, padding: 3 }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{titulo}</div>
            <div style={{ fontSize: 13, color: COLOR.navyText, marginTop: 2 }}>{sub}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {TABS.map((t) => {
            const activo = path === t.href;
            return (
              <a key={t.href} href={t.href} style={{
                color: activo ? COLOR.navy : "#fff", background: activo ? COLOR.bg : "transparent",
                textDecoration: "none", fontSize: 13, fontWeight: activo ? 700 : 500,
                padding: "8px 14px", borderRadius: "8px 8px 0 0",
              }}>{t.label}</a>
            );
          })}
        </div>
      </header>
    </div>
  );
}

export const main: CSSProperties = { minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" };
export const inp: CSSProperties = { fontSize: 15, padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", width: "100%", boxSizing: "border-box" };
export const btn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
export const btnGhost: CSSProperties = { background: "#fff", color: "#1A2238", border: "1px solid #D3D1C7", borderRadius: 8, padding: "9px 14px", fontSize: 14, cursor: "pointer" };
export const card: CSSProperties = { background: "#fff", border: "1px solid #D3D1C7", borderRadius: 12, padding: 18 };
export const lbl: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5, color: "#5F5E5A" };
