// ============================================================================
//  lib/rol.ts — perfil del usuario en todo el Archivo Legal.
//  La base de datos es la que hace cumplir los permisos (reglas por perfil);
//  esto solo sirve para mostrar u ocultar botones y pestañas.
// ============================================================================
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Rol = "legal_admin" | "legal_asistente" | "legal_lector";

export const NOMBRE_ROL: Record<Rol, string> = {
  legal_admin: "Administrador",
  legal_asistente: "Editor",
  legal_lector: "Lector",
};

export const puedeEditar = (r: Rol | null | undefined) => r === "legal_admin" || r === "legal_asistente";
export const esAdmin = (r: Rol | null | undefined) => r === "legal_admin";

// Se comparte entre componentes de la misma página para no consultar dos veces
let cache: Promise<Rol | null> | null = null;

export function leerRol(): Promise<Rol | null> {
  if (!cache) {
    cache = (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return null;
      const { data } = await supabase.from("usuario_rol").select("rol").eq("user_id", uid).maybeSingle();
      return (data?.rol as Rol) ?? null;
    })();
  }
  return cache;
}

/** undefined = cargando · null = sin perfil (o sin sesión) · Rol = perfil asignado */
export function useRol() {
  const [rol, setRol] = useState<Rol | null | undefined>(undefined);
  useEffect(() => { leerRol().then(setRol); }, []);
  return rol;
}
