import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

function resolveDataPath(fileName: string): string {
  return path.resolve(process.cwd(), "data", fileName);
}

function ensureDataDirectory(filePath: string): void {
  const dirPath = path.dirname(filePath);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function loadJsonFile<T>(fileName: string, fallback: T): T {
  const filePath = resolveDataPath(fileName);
  if (!existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function saveJsonFile(fileName: string, value: unknown): void {
  const filePath = resolveDataPath(fileName);
  ensureDataDirectory(filePath);
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}
