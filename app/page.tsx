import { COLOR } from "../lib/theme";

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
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          Archivo Legal · Grupo Global
        </div>
        <div style={{ fontSize: 13, color: COLOR.navyText, marginTop: 2 }}>
          Repositorio documentario del Área Legal
        </div>
      </header>

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "48px 20px" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Bienvenido</h1>
        <p style={{ fontSize: 15, color: COLOR.textSec, margin: 0 }}>
          Esta es la nueva versión del Archivo Legal, en construcción. Aquí
          vivirá el acceso a las empresas del Grupo y sus documentos.
        </p>
      </section>
    </main>
  );
}
