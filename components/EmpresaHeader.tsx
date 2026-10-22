"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { COLOR } from "../lib/theme";
import { EMPRESAS, type EmpresaKey } from "../lib/empresas";

// ============================================================================
//  EmpresaHeader — barra y encabezado únicos para todas las empresas.
//  Barra azul oscuro común: Archivo Legal › Empresa · pestañas · Salir.
//  Encabezado: logo + título + subtítulo, con la franja de colores del logo.
// ============================================================================
export default function EmpresaHeader({ empresa, titulo, sub }: { empresa: EmpresaKey; titulo: string; sub?: string }) {
  const e = EMPRESAS[empresa];
  const path = usePathname();

  async function salir() {
    await supabase.auth.signOut();
    window.location.href = e.salir;
  }

  return (
    <div className="noprint" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <nav style={{ background: COLOR.navy, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "0 16px", height: 50, overflowX: "auto" }}>
        <Link href="/" style={{ color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>Archivo Legal</Link>
        <span style={{ color: COLOR.navyText, fontSize: 14, margin: "0 10px 0 2px", whiteSpace: "nowrap" }}>› {e.nombre}</span>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {e.tabs.map((t) => {
            const activo = path === t.href;
            return (
              <a key={t.href} href={t.href} style={{
                color: activo ? COLOR.navy : "#fff", background: activo ? "#fff" : "transparent",
                textDecoration: "none", fontSize: 13, fontWeight: activo ? 700 : 500,
                padding: "7px 12px", borderRadius: 7, whiteSpace: "nowrap",
                boxShadow: activo ? `inset 0 -3px 0 ${e.primario}` : "none",
              }}>{t.label}</a>
            );
          })}
        </div>
        <button onClick={salir} style={{ color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,.4)", borderRadius: 7, padding: "6px 12px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Salir</button>
      </nav>
      <header style={{ background: COLOR.navy, color: "#fff", padding: "14px 28px 18px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.logo} alt="" style={{ height: 34, background: "#fff", borderRadius: 6, padding: 3 }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{titulo}</div>
            {sub && <div style={{ fontSize: 13, color: COLOR.navyText, marginTop: 2 }}>{sub}</div>}
          </div>
        </div>
      </header>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${e.primario} 0%, ${e.primario} 70%, ${e.acento} 100%)` }} />
    </div>
  );
}
