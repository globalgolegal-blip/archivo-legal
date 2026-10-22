"use client";

import { useEffect, useState, type CSSProperties } from "react";
import AdminBase from "../../../components/AdminBase";
import { inp, btn, btnGhost, card } from "../../../components/GfHeader";
import { supabase } from "../../../lib/supabase";

// Administración › Auditoría: quién creó, editó o borró qué y cuándo. Permite restaurar.

type Fila = {
  id: number; fecha: string; usuario: string | null; esquema: string; tabla: string; operacion: string;
  registro_id: string | null; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null;
  filas: number | null; restaurado_en: string | null; restaurado_por: string | null;
};
const EMPRESA: Record<string, string> = { gm: "Global Go", gf: "Global Factoring" };
const OPER: Record<string, string> = { INSERT: "Creó", UPDATE: "Editó", DELETE: "Borró" };
const IGNORAR = ["id", "creado_en", "updated_at", "clave", "expediente_base"];

function cambios(f: Fila): string {
  if (f.filas != null) return `${f.filas} fila(s)`;
  const a = f.antes || {}, d = f.despues || {};
  if (f.operacion === "UPDATE") {
    const k = Object.keys(d).filter((x) => !IGNORAR.includes(x) && JSON.stringify(a[x]) !== JSON.stringify(d[x]));
    return k.map((x) => `${x}: ${a[x] ?? "—"} → ${d[x] ?? "—"}`).join(" · ");
  }
  const r = f.operacion === "DELETE" ? a : d;
  return Object.entries(r).filter(([k, v]) => !IGNORAR.includes(k) && !k.endsWith("_id") && v != null && v !== "").slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export default function Auditoria() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [limite, setLimite] = useState(200);

  async function cargar() {
    let query = supabase.from("auditoria").select("*").order("fecha", { ascending: false }).limit(limite);
    if (q.trim()) query = query.or(`usuario.ilike.%${q.trim()}%,tabla.ilike.%${q.trim()}%,registro_id.ilike.%${q.trim()}%`);
    const { data, error } = await query;
    if (error) { setMsg(error.message); return; }
    setFilas((data ?? []) as Fila[]);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
  useEffect(() => { cargar(); }, [limite]); // eslint-disable-line react-hooks/exhaustive-deps

  async function restaurar(f: Fila) {
    const que = f.operacion === "DELETE" ? "volver a crear el registro borrado" : "revertir esta edición";
    if (!confirm(`¿Seguro que quieres ${que}?`)) return;
    const { error } = await supabase.rpc("restaurar", { p_id: f.id });
    setMsg(error ? error.message : "Restaurado. El cambio quedó registrado en la auditoría.");
    cargar();
  }

  return (
    <AdminBase titulo="Administración · Auditoría" sub="Registro de cambios de todo el archivo (se conserva, no se puede borrar)">
      <div style={{ display: "flex", gap: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && cargar()} placeholder="Filtrar por usuario, tabla o registro…" style={inp} />
        <button onClick={cargar} style={btn}>Filtrar</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: "#5F5E5A" }}>{msg}</div>}
      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Fecha", "Usuario", "Acción", "Empresa · tabla", "Detalle", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{filas.map((f) => (
            <tr key={f.id}>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(f.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</td>
              <td style={td}>{f.usuario || "—"}</td>
              <td style={{ ...td, whiteSpace: "nowrap", color: f.operacion === "DELETE" ? "#C0392B" : undefined }}>{OPER[f.operacion] ?? f.operacion}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{EMPRESA[f.esquema] ?? f.esquema} · {f.tabla}</td>
              <td style={{ ...td, color: "#5F5E5A" }}>{cambios(f)}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>
                {f.restaurado_en
                  ? <span style={{ fontSize: 12, color: "#1E7B34" }}>Restaurado</span>
                  : (["DELETE", "UPDATE"].includes(f.operacion) && f.antes && !["usuario_rol", "rol_pendiente"].includes(f.tabla) &&
                    <button onClick={() => restaurar(f)} style={{ ...btnGhost, padding: "4px 8px", fontSize: 12 }}>{f.operacion === "DELETE" ? "Restaurar" : "Revertir"}</button>)}
              </td>
            </tr>
          ))}</tbody>
        </table>
        {filas.length >= limite && <button onClick={() => setLimite(limite + 200)} style={{ ...btnGhost, marginTop: 10 }}>Ver más</button>}
      </div>
    </AdminBase>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #D3D1C7", color: "#5F5E5A", fontWeight: 600, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "7px 6px", borderBottom: "1px solid #eee", verticalAlign: "top" };
