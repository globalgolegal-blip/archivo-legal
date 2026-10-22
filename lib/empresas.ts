// ============================================================================
//  lib/empresas.ts — configuración visual de cada empresa del Archivo Legal.
//  Los colores se extrajeron de cada logo (public/*.png). La barra y el
//  encabezado son iguales para todas (azul oscuro); cada empresa aporta su
//  logo, sus colores (franja, pestaña activa, lomos) y sus pestañas.
// ============================================================================

export type EmpresaKey = "globalgo" | "factoring" | "funding" | "cooperativa";

export type Empresa = {
  nombre: string;
  logo: string;
  primario: string; // color principal del logo
  acento: string;   // segundo color del logo
  pref: string;     // prefijo de los códigos de lomo
  tabs: { href: string; label: string }[];
  salir: string;    // a dónde va al cerrar sesión
};

export const EMPRESAS: Record<EmpresaKey, Empresa> = {
  globalgo: {
    nombre: "Global Go", logo: "/global-go.png", primario: "#1268B1", acento: "#C40A0A", pref: "GG",
    tabs: [
      { href: "/panel", label: "Panel" },
      { href: "/base", label: "Base" },
      { href: "/lomos", label: "Lomos" },
      { href: "/cargas", label: "Cargas" },
      { href: "/cargos", label: "Préstamos" },
    ],
    salir: "/login",
  },
  factoring: {
    nombre: "Global Factoring", logo: "/global-factoring.png", primario: "#1772B8", acento: "#71CAF2", pref: "GFAC",
    tabs: [
      { href: "/gf", label: "Buscar" },
      { href: "/gf/base", label: "Base" },
      { href: "/gf/registrar", label: "Registrar" },
      { href: "/gf/lomos", label: "Lomos" },
    ],
    salir: "/",
  },
  funding: { nombre: "Global Funding", logo: "/global-funding.png", primario: "#3CAA39", acento: "#148F36", pref: "GFUN", tabs: [], salir: "/" },
  cooperativa: { nombre: "Cooperativa Global Go", logo: "/cooperativa.png", primario: "#0357FA", acento: "#F90505", pref: "COOP", tabs: [], salir: "/" },
};
