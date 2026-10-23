// ============================================================================
//  app/api/usuarios/route.ts — cuentas del Archivo Legal.
//    · crear_pendientes (admin): crea de una vez las cuentas de los perfiles
//      pendientes, con contraseña temporal y cambio obligatorio.
//    · nueva_clave (admin): restablece la contraseña de un usuario.
//    · cambiar_clave (cualquier usuario con sesión): fija su contraseña propia
//      y quita la marca de cambio obligatorio.
//  El perfil lo aplica la base sola al crearse la cuenta (disparador sobre
//  auth.users que lee gm.rol_pendiente). Las contraseñas nunca se guardan en
//  la auditoría ni en ninguna tabla.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { servicio } from "../../../lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMINIOS = ["globalgo.com.pe", "globalfactoring.com.pe"];
const okDominio = (e: string) => DOMINIOS.includes((e.split("@")[1] || "").toLowerCase());

// 12 caracteres sin letras ni números que se confundan (O/0, l/1/I).
function temporal() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += A[randomInt(A.length)];
  return s;
}

type Sb = ReturnType<typeof servicio>;

async function quien(req: NextRequest) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const sb = servicio();
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: r } = await sb.from("usuario_rol").select("rol").eq("user_id", u.user.id).maybeSingle();
  return { sb, user: u.user, email: u.user.email || "", admin: r?.rol === "legal_admin" };
}

async function todos(sb: Sb) {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

export async function POST(req: NextRequest) {
  try {
    const q = await quien(req);
    if (!q) return NextResponse.json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const accion = String(body?.accion || "");

    // ---- Cualquier usuario: fijar su contraseña propia ----------------------
    if (accion === "cambiar_clave") {
      const clave = String(body?.clave || "");
      if (clave.length < 8 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) {
        return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres, con letras y números." }, { status: 400 });
      }
      const { error } = await q.sb.auth.admin.updateUserById(q.user.id, {
        password: clave,
        app_metadata: { ...(q.user.app_metadata || {}), debe_cambiar_clave: false },
      });
      if (error) throw error;
      await q.sb.from("auditoria").insert({ usuario: q.email, esquema: "auth", tabla: "users", operacion: "CLAVE PROPIA FIJADA" });
      return NextResponse.json({ ok: true });
    }

    // ---- Desde aquí, solo administradores -----------------------------------
    if (!q.admin) return NextResponse.json({ error: "Solo un administrador puede gestionar cuentas." }, { status: 403 });

    if (accion === "crear_pendientes") {
      const { data: pend, error: e1 } = await q.sb.from("rol_pendiente").select("*");
      if (e1) throw e1;
      const existentes = new Set((await todos(q.sb)).map((u) => (u.email || "").toLowerCase()));
      const creadas: { email: string; clave: string }[] = [];
      const errores: { email: string; error: string }[] = [];
      for (const p of (pend ?? []) as Record<string, unknown>[]) {
        const email = String(p.email ?? p.correo ?? "").trim().toLowerCase();
        if (!email || existentes.has(email)) continue;
        if (!okDominio(email)) { errores.push({ email, error: "Dominio no permitido" }); continue; }
        const clave = temporal();
        const { error } = await q.sb.auth.admin.createUser({
          email, password: clave, email_confirm: true,
          app_metadata: { debe_cambiar_clave: true },
        });
        if (error) errores.push({ email, error: error.message });
        else creadas.push({ email, clave });
      }
      if (creadas.length) {
        await q.sb.from("auditoria").insert({
          usuario: q.email, esquema: "auth", tabla: "users", operacion: "CUENTAS CREADAS",
          despues: { cuentas: creadas.map((c) => c.email) },
        });
      }
      return NextResponse.json({ creadas, errores });
    }

    if (accion === "nueva_clave") {
      const email = String(body?.email || "").trim().toLowerCase();
      const u = (await todos(q.sb)).find((x) => (x.email || "").toLowerCase() === email);
      if (!u) return NextResponse.json({ error: "Ese correo todavía no tiene cuenta. Usa «Crear cuentas pendientes»." }, { status: 404 });
      const clave = temporal();
      const { error } = await q.sb.auth.admin.updateUserById(u.id, {
        password: clave,
        app_metadata: { ...(u.app_metadata || {}), debe_cambiar_clave: true },
      });
      if (error) throw error;
      await q.sb.from("auditoria").insert({
        usuario: q.email, esquema: "auth", tabla: "users", operacion: "CLAVE RESTABLECIDA",
        despues: { cuenta: email },
      });
      return NextResponse.json({ email, clave });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
