import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const backendPath = path.join(root, "src", "backend", "resources", "data", "champions.json");
const frontendPath = path.join(root, "src", "frontend", "public", "champions.json");
const [backend, frontend] = await Promise.all([
  readFile(backendPath, "utf8"),
  readFile(frontendPath, "utf8"),
]);

if (backend !== frontend) {
  throw new Error("Los catálogos de frontend y backend no son idénticos.");
}

const champions = JSON.parse(backend);
if (!Array.isArray(champions) || champions.length < 150) {
  throw new Error("El catálogo no tiene el número mínimo de campeones.");
}

console.log(`Catálogo verificado: ${champions.length} campeones.`);
