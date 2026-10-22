"use client";

import { useEffect, useState, type ReactNode } from "react";
import GfHeader, { main, inp, btn, card, lbl } from "../../../components/GfHeader";
import { useRol, puedeEditar } from "../../../lib/rol";
import { gf, TIPOS_DOC, normDoc, errorDocumento, obtenerContraparte, normFolder, ROLES, useSesion, filtroContraparte, docTexto, type Contraparte } from "../../../lib/gf";

// Registro de contratos, pagarés, letras, procesos y transacciones.
// Todo registro se amarra a una contraparte identificada por RUC/DNI.

type Tipo = "contrato" | "pagare" | "letra" | "proceso" | "transaccion";
const TABS: { k: Tipo; label: string }[] = [
  { k: "contrato", label: "Contrato" },
  { k: "pagare", label: "Pagaré" },
  { k: "letra", label: "Letra de cambio" },
  { k: "proceso", label: "Proceso" },
  { k: "transaccion", label: "Transacción" },
];
const FIRMAS = ["SIN REVISAR", "COMPLETO", "FALTA LIZ", "FALTA JC", "ADENDA"];

const VACIO: Record<string, string> = {
  tipo_contrato: "", fecha: "", estado_firma: "SIN REVISAR", cantidad: "1", folder: "", observacion: "",
  legalizado: "", juegos: "", numero: "", moneda: "PEN", importe: "",
  tipo_proceso: "CIVIL", expediente: "", organo: "", localidad: "", materia: "", rol: "DEMANDANTE",
};

function Campo({ label, children, ancho = 1 }: { label: string; children: ReactNode; ancho?: number }) {
  return <div style={{ gridColumn: `span ${ancho}` }}><label style={lbl}>{label}</label>{children}</div>;
}

export default function Registrar() {
  const sesion = useSesion();
  const rol = useRol();
  const [tab, setTab] = useState<Tipo>("contrato");
  const [tdoc, setTdoc] = useState("RUC");
  const [ndoc, setNdoc] = useState("");
  const [nombre, setNombre] = useState("");
  const [existe, setExiste] = useState<null | boolean>(null);
  const [f, setF] = useState<Record<string, string>>({ ...VACIO });
  const [msg, setMsg] = useState<{ k: "" | "ok" | "err"; t: string }>({ k: "", t: "" });
  const [busy, setBusy] = useState(false);

  const [sug, setSug] = useState<Contraparte[]>([]);
  const [elegido, setElegido] = useState("");

  // Sugerencias de contrapartes ya registradas mientras se escribe el nombre (evita duplicados)
  useEffect(() => {
    const t = nombre.trim();
    if (t.length < 3 || t === elegido) { setSug([]); return; }
    const h = setTimeout(async () => {
      const { data } = await filtroContraparte(gf().from("contraparte").select("id, tipo_documento, numero_documento, nombre"), t).order("nombre").limit(6);
      setSug((data ?? []) as Contraparte[]);
    }, 250);
    return () => clearTimeout(h);
  }, [nombre, elegido]);

  function elegir(c: Contraparte) {
    setSug([]); setElegido(c.nombre || ""); setNombre(c.nombre || "");
    if (c.tipo_documento !== "PENDIENTE" && c.numero_documento) { setTdoc(c.tipo_documento); setNdoc(c.numero_documento); setExiste(true); }
  }

  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const docErr = ndoc ? errorDocumento(tdoc, normDoc(ndoc)) : "";

  async function buscarContraparte() {
    const n = normDoc(ndoc);
    if (!n || errorDocumento(tdoc, n)) { setExiste(null); return; }
    const { data } = await gf().from("contraparte").select("nombre").eq("tipo_documento", tdoc).eq("numero_documento", n).maybeSingle();
    setExiste(!!data);
    if (data?.nombre) setNombre(data.nombre);
  }

  const nulo = (v: string) => (v.trim() === "" ? null : v.trim());
  const entero = (v: string) => (v.trim() === "" ? null : parseInt(v, 10));

  async function guardar() {
    setMsg({ k: "", t: "" });
    if (docErr || !ndoc) { setMsg({ k: "err", t: docErr || "Ingresa el RUC o DNI de la contraparte." }); return; }
    if (tab === "proceso" && !f.expediente.trim()) { setMsg({ k: "err", t: "Ingresa el número de expediente o carpeta fiscal." }); return; }
    if (tab === "letra" && f.importe && isNaN(+f.importe)) { setMsg({ k: "err", t: "El importe debe ser un número." }); return; }
    setBusy(true);
    try {
      const cp = await obtenerContraparte(tdoc, ndoc, nombre);
      const base = { contraparte_id: cp.id, folder: normFolder(f.folder), observacion: nulo(f.observacion) };
      let fila: Record<string, unknown>;
      if (tab === "contrato") fila = { ...base, tipo: nulo(f.tipo_contrato), fecha_creacion: nulo(f.fecha), estado_firma: f.estado_firma, cantidad: entero(f.cantidad) ?? 1 };
      else if (tab === "pagare") fila = { ...base, fecha_creacion: nulo(f.fecha), legalizado: f.legalizado === "" ? null : f.legalizado === "SI", juegos: entero(f.juegos) };
      else if (tab === "letra") fila = { ...base, fecha_giro: nulo(f.fecha), numero: nulo(f.numero), moneda: f.moneda, importe: f.importe ? +f.importe : null };
      else if (tab === "proceso") fila = { ...base, tipo: f.tipo_proceso, expediente: f.expediente.trim().toUpperCase(), organo: nulo(f.organo), localidad: nulo(f.localidad.toUpperCase()), materia: nulo(f.materia), rol: f.rol };
      else fila = { ...base, fecha_firma: nulo(f.fecha) };
      const { error } = await gf().from(tab).insert(fila);
      if (error) throw new Error(error.message);
      setMsg({ k: "ok", t: `Registrado: ${TABS.find((t) => t.k === tab)!.label} de ${cp.nombre || cp.numero_documento}.` });
      setExiste(true);
      setF({ ...VACIO, folder: f.folder, tipo_proceso: f.tipo_proceso, rol: f.rol, moneda: f.moneda });
    } catch (e) {
      setMsg({ k: "err", t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!sesion || rol === undefined) return <main style={main} />;
  if (!puedeEditar(rol)) {
    return (
      <main style={main}>
        <GfHeader titulo="Global Factoring · Registrar" sub="Contratos, pagarés, letras, procesos y transacciones" />
        <section style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
          <div style={card}>Tu perfil es de solo lectura: no puedes registrar documentos. Si necesitas hacerlo, pide el perfil de Editor a un administrador.</div>
        </section>
      </main>
    );
  }

  const g3 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 } as const;

  return (
    <main style={main}>
      <GfHeader titulo="Global Factoring · Registrar" sub="Contratos, pagarés, letras, procesos y transacciones" />
      <section style={{ maxWidth: 900, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.k} onClick={() => { setTab(t.k); setMsg({ k: "", t: "" }); }}
              style={{ ...btn, background: tab === t.k ? "#1070B7" : "#fff", color: tab === t.k ? "#fff" : "#1A2238", border: "1px solid #D3D1C7" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Contraparte</div>
          <div style={g3}>
            <Campo label="Tipo de documento">
              <select value={tdoc} onChange={(e) => { setTdoc(e.target.value); setExiste(null); }} style={inp}>
                {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="N° de documento">
              <input value={ndoc} onChange={(e) => { setNdoc(e.target.value); setExiste(null); }} onBlur={buscarContraparte} inputMode="numeric" style={{ ...inp, borderColor: docErr ? "#C0392B" : "#D3D1C7" }} />
            </Campo>
            <Campo label="Nombre o razón social (opcional)">
              <div style={{ position: "relative" }}>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => setTimeout(() => setSug([]), 200)} placeholder="Escribe parte del nombre…" style={inp} />
                {sug.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4, background: "#fff", border: "1px solid #D3D1C7", borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,.12)", overflow: "hidden" }}>
                    <div style={{ fontSize: 11, color: "#888780", padding: "6px 10px 2px" }}>Ya registradas:</div>
                    {sug.map((c) => (
                      <button key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(c)}
                        style={{ display: "block", width: "100%", padding: "7px 10px", background: "none", border: 0, borderBottom: "1px solid #eee", cursor: "pointer", textAlign: "left", fontSize: 13 }}>
                        <b>{c.nombre}</b> <span style={{ color: c.tipo_documento === "PENDIENTE" ? "#B26A00" : "#5F5E5A" }}>· {docTexto(c)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Campo>
          </div>
          <div style={{ fontSize: 13, marginTop: 8, color: docErr ? "#C0392B" : "#5F5E5A" }}>
            {docErr || (existe === true ? "Contraparte ya registrada." : existe === false ? "Contraparte nueva: se creará al guardar." : "")}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{TABS.find((t) => t.k === tab)!.label}</div>
          <div style={g3}>
            {tab === "contrato" && (<>
              <Campo label="Tipo">
                <select value={f.tipo_contrato} onChange={set("tipo_contrato")} style={inp}>
                  <option value="">Sin tipo</option><option>FACTORING</option><option>CONFIRMING</option>
                </select>
              </Campo>
              <Campo label="Fecha de creación"><input type="date" value={f.fecha} onChange={set("fecha")} style={inp} /></Campo>
              <Campo label="Estado de firma">
                <select value={f.estado_firma} onChange={set("estado_firma")} style={inp}>{FIRMAS.map((x) => <option key={x}>{x}</option>)}</select>
              </Campo>
              <Campo label="Cantidad de contratos"><input type="number" min={1} value={f.cantidad} onChange={set("cantidad")} style={inp} /></Campo>
            </>)}

            {tab === "pagare" && (<>
              <Campo label="Fecha de creación"><input type="date" value={f.fecha} onChange={set("fecha")} style={inp} /></Campo>
              <Campo label="Legalizado">
                <select value={f.legalizado} onChange={set("legalizado")} style={inp}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
              </Campo>
              <Campo label="Cantidad de juegos"><input type="number" min={1} value={f.juegos} onChange={set("juegos")} style={inp} /></Campo>
            </>)}

            {tab === "letra" && (<>
              <Campo label="Fecha de giro"><input type="date" value={f.fecha} onChange={set("fecha")} style={inp} /></Campo>
              <Campo label="N° de letra"><input value={f.numero} onChange={set("numero")} style={inp} /></Campo>
              <Campo label="Moneda">
                <select value={f.moneda} onChange={set("moneda")} style={inp}><option value="PEN">Soles</option><option value="USD">Dólares</option></select>
              </Campo>
              <Campo label="Importe"><input inputMode="decimal" value={f.importe} onChange={set("importe")} style={inp} /></Campo>
            </>)}

            {tab === "proceso" && (<>
              <Campo label="Tipo de proceso">
                <select value={f.tipo_proceso} onChange={(e) => setF({ ...f, tipo_proceso: e.target.value, rol: ROLES[e.target.value][0] })} style={inp}>
                  <option value="CIVIL">Civil</option><option value="PENAL">Penal</option><option value="CONCURSAL">Concursal (INDECOPI)</option>
                </select>
              </Campo>
              <Campo label="Rol de Global Factoring">
                <select value={f.rol} onChange={set("rol")} style={inp}>{ROLES[f.tipo_proceso].map((r) => <option key={r}>{r}</option>)}</select>
              </Campo>
              <Campo label={f.tipo_proceso === "PENAL" ? "N° de expediente o carpeta fiscal" : "N° de expediente completo"} ancho={2}>
                <input value={f.expediente} onChange={set("expediente")} placeholder={f.tipo_proceso === "CONCURSAL" ? "42-2024/CCO-INDECOPI" : "03204-2025-63-1866-JP-CI-03"} style={inp} />
              </Campo>
              <Campo label={f.tipo_proceso === "PENAL" ? "Juzgado o fiscalía" : f.tipo_proceso === "CONCURSAL" ? "Comisión" : "Juzgado"} ancho={2}>
                <input value={f.organo} onChange={set("organo")} style={inp} />
              </Campo>
              <Campo label="Localidad (la de la resolución)"><input value={f.localidad} onChange={set("localidad")} placeholder="MIRAFLORES" style={inp} /></Campo>
              <Campo label="Materia"><input value={f.materia} onChange={set("materia")} style={inp} /></Campo>
            </>)}

            {tab === "transaccion" && (
              <Campo label="Fecha de firma"><input type="date" value={f.fecha} onChange={set("fecha")} style={inp} /></Campo>
            )}

            <Campo label={tab === "proceso" ? "Folder (opcional)" : "Folder"}>
              <input value={f.folder} onChange={set("folder")} placeholder="6" style={inp} />
            </Campo>
            <Campo label="Observación" ancho={2}><input value={f.observacion} onChange={set("observacion")} style={inp} /></Campo>
          </div>
          {tab === "proceso" && (
            <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 10 }}>
              Escribe el expediente completo, con su n° de cuaderno: el principal y sus cautelares se agrupan solos en un mismo archivador.
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={guardar} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
          <span style={{ fontSize: 14, color: msg.k === "err" ? "#C0392B" : "#1E7B34" }}>{msg.t}</span>
        </div>
      </section>
    </main>
  );
}
