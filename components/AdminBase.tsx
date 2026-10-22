"use client";

import type { ReactNode } from "react";
import EmpresaHeader from "./EmpresaHeader";
import { main, card } from "./GfHeader";
import { useSesion } from "../lib/gf";
import { useRol, esAdmin } from "../lib/rol";

// Marco común de las pantallas de Administración: exige sesión y perfil de administrador.
export default function AdminBase({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  const sesion = useSesion();
  const rol = useRol();
  if (!sesion || rol === undefined) return <main style={main} />;
  return (
    <main style={main}>
      <EmpresaHeader empresa="admin" titulo={titulo} sub={sub} />
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {esAdmin(rol) ? children : <div style={card}>Esta sección es solo para administradores del Archivo Legal.</div>}
      </section>
    </main>
  );
}
