// ============================================================================
//  app/api/pin/route.ts — el administrador ve o cambia el PIN de consulta.
//  Requiere la sesión de un usuario con perfil legal_admin.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { servicio, cifrarPin } from "../../../lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function admin(req: NextRequest) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const sb = servicio();
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: r } = await sb.from("usuario_rol").select("rol").eq("user_id", u.user.id).maybeSingle();
  return r?.rol === "legal_admin" ? { sb, email: u.user.email || "" } : null;
}

export async function GET(req: NextRequest) {
  try {
    const a = await admin(req);
    if (!a) return NextResponse.json({ error: "Solo un administrador puede ver el PIN de consulta." }, { status: 403 });
    const { data } = await a.sb.from("consulta_pin").select("vence, version, actualizado_por, actualizado_en").eq("id", 1).maybeSingle();
    const { data: ult } = await a.sb.from("consulta_registro").select("fecha, ip, exito, destino").order("fecha", { ascending: false }).limit(50);
    return NextResponse.json({ pin: data, consultas: ult ?? [] });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const a = await admin(req);
    if (!a) return NextResponse.json({ error: "Solo un administrador puede cambiar el PIN de consulta." }, { status: 403 });
    const { pin, dias, desactivar } = await req.json();
    if (desactivar) {
      await a.sb.from("consulta_pin").update({ vence: new Date().toISOString(), actualizado_por: a.email, actualizado_en: new Date().toISOString() }).eq("id", 1);
      await a.sb.from("auditoria").insert({ usuario: a.email, esquema: "gm", tabla: "consulta_pin", operacion: "PIN DESACTIVADO" });
      return NextResponse.json({ ok: true });
    }
    if (!/^\d{6,8}$/.test(String(pin || ""))) return NextResponse.json({ error: "El PIN debe tener entre 6 y 8 dígitos." }, { status: 400 });
    if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
      return NextResponse.json({ error: "El PIN es demasiado fácil de adivinar (números repetidos o seguidos)." }, { status: 400 });
    }
    const d = Math.min(Math.max(parseInt(dias, 10) || 30, 1), 180);
    const { sal, hash } = cifrarPin(String(pin));
    const { data: ant } = await a.sb.from("consulta_pin").select("version").eq("id", 1).maybeSingle();
    const fila = { id: 1, pin_hash: hash, sal, version: (ant?.version ?? 0) + 1, vence: new Date(Date.now() + d * 86400_000).toISOString(), actualizado_por: a.email, actualizado_en: new Date().toISOString() };
    const { error } = await a.sb.from("consulta_pin").upsert(fila);
    if (error) throw error;
    await a.sb.from("auditoria").insert({ usuario: a.email, esquema: "gm", tabla: "consulta_pin", operacion: "PIN CAMBIADO", despues: { vence: fila.vence } });
    return NextResponse.json({ ok: true, vence: fila.vence });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
