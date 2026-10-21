"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { COLOR } from "../lib/theme";

// Encabezado de Global Factoring: es un archivo aparte dentro del Archivo Legal,
// con su propia barra (no usa la barra de Global Go).
const TABS = [
  { href: "/gf", label: "Buscar" },
  { href: "/gf/registrar", label: "Registrar" },
  { href: "/gf/lomos", label: "Lomos" },
];

export default function GfHeader({ titulo, sub }: { titulo: string; sub: string }) {
  const path = usePathname();

  async function salir() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="noprint">
      <nav style={{ background: COLOR.navy, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "0 16px", height: 50, overflowX: "auto" }}>
        <Link href="/" style={{ color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", marginRight: 4, whiteSpace: "nowrap" }}>Archivo Legal</Link>
        <span style={{ color: COLOR.navyText, fontSize: 14, marginRight: 10, whiteSpace: "nowrap" }}>› Global Factoring</span>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {TABS.map((t) => {
            const activo = path === t.href;
            return (
              <a key={t.href} href={t.href} style={{
                color: activo ? COLOR.navy : "#fff", background: activo ? "#fff" : "transparent",
                textDecoration: "none", fontSize: 13, fontWeight: activo ? 700 : 500,
                padding: "7px 12px", borderRadius: 7, whiteSpace: "nowrap",
              }}>{t.label}</a>
            );
          })}
        </div>
        <button onClick={salir} style={{ color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,.4)", borderRadius: 7, padding: "6px 12px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Salir</button>
      </nav>
      <header style={{ background: COLOR.navy, color: "#fff", padding: "14px 28px 18px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/global-factoring.png" alt="" style={{ height: 34, background: "#fff", borderRadius: 6, padding: 3 }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{titulo}</div>
            <div style={{ fontSize: 13, color: COLOR.navyText, marginTop: 2 }}>{sub}</div>
          </div>
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
