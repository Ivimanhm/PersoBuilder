import { useEffect, useRef, useState } from "preact/hooks";
import { getApiUrl, normalizeApiUrl, saveApiUrl } from "../../services/appSettings";
import { checkApiHealth, type ConnectionStatus } from "../../services/connectionStatus";
import { TextField } from "../../components/TextField/TextField";
import { getAdminToken, saveAdminToken } from "../../services/adminToken";
import { validateFearlessAdminToken } from "../../services/fearlessSync";
import { setAdminTokenStatus } from "../../services/adminTokenStatus";

export function SettingsPage() {
  const [apiUrl, setApiUrl] = useState(getApiUrl);
  const [adminToken, setAdminToken] = useState(getAdminToken);
  const [adminStatus, setAdminStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [checking, setChecking] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionStatus | null>(null);
  const [diagnostic, setDiagnostic] = useState("");
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const diagnosticDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = diagnosticDialogRef.current;
    if (diagnosticOpen && dialog && !dialog.open) dialog.showModal();
  }, [diagnosticOpen]);
  const saveToken = async () => {
    saveAdminToken(adminToken);
    if (!adminToken.trim()) { setAdminStatus("idle"); setAdminTokenStatus("idle"); return; }
    setAdminStatus("checking");
    setAdminTokenStatus("checking");
    try {
      const valid = await validateFearlessAdminToken();
      setAdminStatus(valid ? "valid" : "invalid");
      setAdminTokenStatus(valid ? "valid" : "invalid");
    } catch {
      setAdminStatus("invalid");
      setAdminTokenStatus("invalid");
    }
  };
  const save = async () => {
    let normalizedApiUrl: string;
    try {
      normalizedApiUrl = normalizeApiUrl(apiUrl);
    } catch (error) {
      setConnectionResult("offline");
      setDiagnostic(error instanceof Error ? error.message : "La URL de la API no es válida.");
      setDiagnosticOpen(true);
      return;
    }
    // Persistir la preferencia local precede siempre a cualquier solicitud de red.
    saveApiUrl(normalizedApiUrl);
    setApiUrl(normalizedApiUrl);
    setChecking(true);
    setConnectionResult(null);
    const result = await checkApiHealth(normalizedApiUrl);
    setConnectionResult(result.status);
    setDiagnostic(result.detail);
    setDiagnosticOpen(true);
    setChecking(false);
  };

  return <section className="app-page settings-page">
    <section className="settings-card" aria-labelledby="api-url-title">
      <header className="settings-card-heading"><span className="settings-card-icon"><i className="bi bi-link-45deg" /></span><div><h2 id="api-url-title">URL de la API</h2><p>Introduce la dirección de la API para sincronizar los campeones disponibles en los drafts Fearless.</p></div></header>
      <label className="api-url-label" htmlFor="api-url">URL</label>
      <div className="api-url-input"><i className="bi bi-link-45deg" /><input id="api-url" type="url" value={apiUrl} onInput={(event) => { setApiUrl(event.currentTarget.value); setConnectionResult(null); }} placeholder="https://tu-api.com" /></div>
      <button className="gold-button save-api-button" type="button" onClick={save} disabled={checking}><i className="bi bi-floppy" />{checking ? "Comprobando conexión..." : "Guardar"}</button>
      {connectionResult && <p className={`settings-saved ${connectionResult}`} role="status"><i className={`bi ${connectionResult === "online" ? "bi-cloud-check-fill" : "bi-exclamation-triangle-fill"}`} />{connectionResult === "online" ? "Conexión con la API realizada con éxito." : "La URL se ha guardado, pero no ha sido posible establecer conexión con la API."}</p>}
    </section>
    <section className="settings-card" aria-labelledby="admin-token-title">
      <header className="settings-card-heading"><span className="settings-card-icon"><i className="bi bi-shield-lock" /></span><div><h2 id="admin-token-title">Admin Token</h2><p>Se usa para acciones administrativas de FearlessSync.</p></div></header>
      <span className="api-url-label">Admin Token</span>
      <TextField type="password" value={adminToken} onValueChange={(value) => { setAdminToken(value); setAdminStatus("idle"); }} containerClassName="api-url-input" prefix={<i className="bi bi-key" />} ariaLabel="Admin Token" />
      <button className="gold-button save-api-button" type="button" onClick={saveToken} disabled={adminStatus === "checking"}>Guardar y validar</button>
      <p className={`settings-saved admin-status ${adminStatus}`} role="status">{adminStatus === "valid" ? "● Token válido" : adminStatus === "invalid" ? "● Token inválido o validación no disponible" : adminStatus === "checking" ? "● Comprobando token..." : "● Sin comprobar"}</p>
    </section>
    {diagnosticOpen && <dialog ref={diagnosticDialogRef} className="health-diagnostic-backdrop" aria-labelledby="health-diagnostic-title" onClose={() => setDiagnosticOpen(false)}>
      <section className="health-diagnostic-modal">
        <header><div><small>DIAGNÓSTICO DE RED</small><h2 id="health-diagnostic-title">Salida del health check</h2></div><button type="button" aria-label="Cerrar" onClick={() => setDiagnosticOpen(false)}><i className="bi bi-x-lg" /></button></header>
        <pre>{diagnostic}</pre>
        <footer><button className="gold-button" type="button" onClick={() => setDiagnosticOpen(false)}>Cerrar</button></footer>
      </section>
    </dialog>}
  </section>;
}
