import { COLOR } from "../lib/theme";

const EMPRESAS = [
  { nombre: "Global Go", logo: "/global-go.png", color: "#1369B2",
    desc: "Garantías mobiliarias, saneamiento del archivo físico y lomos por tomo.",
        activo: true, href: "/login" },
  { nombre: "Cooperativa Global Go", logo: "/cooperativa.png", color: "#0052FC",
    desc: "Garantías e inscripciones de la Cooperativa de Servicios Múltiples.",
    activo: false, href: "#" },
  { nombre: "Global Factoring", logo: "/global-factoring.png", color: "#1070B7",
    desc: "Contratos, letras y documentación de factoring.",
    activo: false, href: "#" },
  { nombre: "Global Funding", logo: "/global-funding.png", color: "#3AAA35",
    desc: "Contratos y documentación de financiamiento.",
    activo: false, href: "#" },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLOR.bg,
        color: COLOR.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <header style={{ background: COLOR.navy, color: "#fff", padding: "18px 28px" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Archivo Legal · Grupo Global</div>
        <div style={{ fontSize: 13, color: COLOR.navyText, marginTop: 2 }}>
          Repositorio documentario del Área Legal
        </div>
      </header>

      <section style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px" }}>
        <p style={{ fontSize: 15, color: COLOR.textSec, margin: "0 0 22px" }}>
          Selecciona la empresa cuyo archivo quieres consultar. Hoy está habilitado el
          archivo de Global Go; el resto se activará conforme se cargue su documentación.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {EMPRESAS.map((e) => (
            <div
              key={e.nombre}
              style={{
                background: COLOR.surface,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 12,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                opacity: e.activo ? 1 : 0.75,
              }}
            >
              <div
                style={{
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <img
                  src={e.logo}
                  alt={e.nombre}
                  style={{ maxHeight: 48, maxWidth: 150, objectFit: "contain" }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    color: e.activo ? "#fff" : "#888780",
                    background: e.activo ? e.color : "#E8E6DF",
                  }}
                >
                  {e.activo ? "Activo" : "Próximamente"}
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{e.nombre}</div>
              <div style={{ fontSize: 13, color: COLOR.textSec, marginTop: 4, flex: 1 }}>
                {e.desc}
              </div>
              {e.activo ? (
                <a
                  href={e.href}
                  style={{
                    marginTop: 14,
                    textAlign: "center",
                    padding: 11,
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#fff",
                    background: e.color,
                    textDecoration: "none",
                  }}
                >
                  Entrar →
                </a>
              ) : (
                <div
                  style={{
                    marginTop: 14,
                    textAlign: "center",
                    padding: 11,
                    borderRadius: 8,
                    fontSize: 14,
                    color: "#888780",
                    border: `1px dashed ${COLOR.border}`,
                  }}
                >
                  Sin datos aún
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
