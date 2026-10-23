// ============================================================================
//  lib/empresas.ts — configuración visual de cada empresa del Archivo Legal.
//  Los colores se extrajeron de cada logo (public/*.png). La barra y el
//  encabezado son iguales para todas (azul oscuro); cada empresa aporta su
//  logo, sus colores (franja, pestaña activa, lomos) y sus pestañas.
// ============================================================================

export type EmpresaKey = "globalgo" | "factoring" | "funding" | "cooperativa" | "admin";

export type Empresa = {
  nombre: string;
  logo: string;
  primario: string; // color principal del logo
  acento: string;   // segundo color del logo
  pref: string;     // prefijo de los códigos de lomo
  tabs: { href: string; label: string; min?: "editor" | "admin" }[];  // min = perfil mínimo para ver la pestaña
  salir: string;    // a dónde va al cerrar sesión
};

export const EMPRESAS: Record<EmpresaKey, Empresa> = {
  globalgo: {
    nombre: "Global Go", logo: "/global-go.png", primario: "#1268B1", acento: "#C40A0A", pref: "GG",
    tabs: [
      { href: "/panel", label: "Panel" },
      { href: "/base", label: "Base" },
      { href: "/lomos", label: "Lomos" },
      { href: "/cargas", label: "Cargas", min: "admin" },
      { href: "/cargos", label: "Libro de cargos" },
    ],
    salir: "/login",
  },
  factoring: {
    nombre: "Global Factoring", logo: "/global-factoring.png", primario: "#1772B8", acento: "#71CAF2", pref: "GFAC",
    tabs: [
      { href: "/gf", label: "Buscar" },
      { href: "/gf/base", label: "Base" },
      { href: "/gf/registrar", label: "Registrar", min: "editor" },
      { href: "/gf/lomos", label: "Lomos" },
      { href: "/gf/cargos", label: "Libro de cargos" },
    ],
    salir: "/",
  },
  funding: { nombre: "Global Funding", logo: "/global-funding.png", primario: "#3CAA39", acento: "#148F36", pref: "GFUN", tabs: [], salir: "/" },
  cooperativa: { nombre: "Cooperativa Global Go", logo: "/cooperativa.png", primario: "#0357FA", acento: "#F90505", pref: "COOP", tabs: [], salir: "/" },
  // Administración del archivo (común a todas las empresas; solo administradores)
  admin: {
    nombre: "Administración", logo: "", primario: "#4A5A8C", acento: "#9AA5C4", pref: "",
    tabs: [
      { href: "/admin", label: "Usuarios", min: "admin" },
      { href: "/admin/auditoria", label: "Auditoría", min: "admin" },
      { href: "/admin/pin", label: "PIN de consulta", min: "admin" },
    ],
    salir: "/",
  },
};
