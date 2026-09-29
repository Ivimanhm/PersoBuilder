const adminTokenKey = "perso-builder-admin-token";

export function getAdminToken() {
  return localStorage.getItem(adminTokenKey)?.trim() ?? "";
}

export function saveAdminToken(token: string) {
  const value = token.trim();
  if (value) localStorage.setItem(adminTokenKey, value);
  else localStorage.removeItem(adminTokenKey);
}
