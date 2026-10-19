"use client";

import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { COLOR } from "../lib/theme";

// ============================================================================
//  Nav — barra de navegación común para las pantallas internas.
//  Se coloca como primer elemento dentro del <main> de cada página:
//    import Nav from "../../components/Nav";
//    ...
//    return (<main ...><Nav /> ... </main>);
// ============================================================================
const LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/base", label: "Base" },
  { href: "/lomos", label: "Lomos" },
  { href: "/cargas", label: "Cargas" },
  { href: "/cargos", label: "Préstamos" },
];

export default function Nav() {
  const path = usePathname();

  async function salir() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav
      style={{
        background: COLOR.navy,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 16px",
        height: 50,
        overflowX: "auto",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <a
        href="/"
        style={{
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          textDecoration: "none",
          marginRight: 10,
          whiteSpace: "nowrap",
        }}
      >
        Archivo Legal
      </a>

      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {LINKS.map((l) => {
          const activo = path === l.href;
          return (
            <a
              key={l.href}
              href={l.href}
              style={{
                color: activo ? COLOR.navy : "#fff",
                background: activo ? "#fff" : "transparent",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: activo ? 700 : 500,
                padding: "7px 12px",
                borderRadius: 7,
                whiteSpace: "nowrap",
              }}
            >
              {l.label}
            </a>
          );
        })}
      </div>

      <button
        onClick={salir}
        style={{
          color: "#fff",
          background: "transparent",
          border: "1px solid rgba(255,255,255,.4)",
          borderRadius: 7,
          padding: "6px 12px",
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Salir
      </button>
    </nav>
  );
}
