type AdminTokenStatus = "idle" | "checking" | "valid" | "invalid";

let status: AdminTokenStatus = "idle";
let startupCheck: Promise<void> | null = null;
const listeners = new Set<(status: AdminTokenStatus) => void>();

export function getAdminTokenStatus() { return status; }
export function setAdminTokenStatus(next: AdminTokenStatus) {
  status = next;
  listeners.forEach((listener) => listener(status));
}
export function subscribeToAdminTokenStatus(listener: (status: AdminTokenStatus) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function checkAdminTokenAtStartup(check: () => Promise<boolean>) {
  if (!startupCheck) {
    setAdminTokenStatus("checking");
    startupCheck = check()
      .then((valid) => setAdminTokenStatus(valid ? "valid" : "invalid"))
      .catch(() => setAdminTokenStatus("invalid"));
  }
  return startupCheck;
}
