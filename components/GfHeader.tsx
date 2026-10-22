"use client";

import type { CSSProperties } from "react";
import EmpresaHeader from "./EmpresaHeader";
import { COLOR } from "../lib/theme";

// Encabezado de Global Factoring: usa la barra y el encabezado únicos del archivo.
export default function GfHeader({ titulo, sub }: { titulo: string; sub: string }) {
  return <EmpresaHeader empresa="factoring" titulo={titulo} sub={sub} />;
}

export const main: CSSProperties = { minHeight: "100vh", background: COLOR.bg, color: COLOR.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" };
export const inp: CSSProperties = { fontSize: 15, padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", width: "100%", boxSizing: "border-box" };
export const btn: CSSProperties = { background: "#1A2238", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
export const btnGhost: CSSProperties = { background: "#fff", color: "#1A2238", border: "1px solid #D3D1C7", borderRadius: 8, padding: "9px 14px", fontSize: 14, cursor: "pointer" };
export const card: CSSProperties = { background: "#fff", border: "1px solid #D3D1C7", borderRadius: 12, padding: 18 };
export const lbl: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5, color: "#5F5E5A" };
