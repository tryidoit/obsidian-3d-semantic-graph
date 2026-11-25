import type { App } from "obsidian";
import { normalizeDataFolder } from "./types";
import { UPLOADED_VECTORS_FILE } from "./uploaded-vectors";

/** Files the plugin persists; all live in the vault data folder so they sync with the vault. */
export const DATA_FILES = [
	UPLOADED_VECTORS_FILE,
	"embeddings-cache.json",
	"embeddings-hashes.json",
	"layout-cache.json",
] as const;

export function getDataDir(settings: { dataFolder: string }): string {
	return normalizeDataFolder(settings.dataFolder);
}

export async function ensureDataDir(app: App, dir: string): Promise<void> {
	const adapter = app.vault.adapter;
	let current = "";
	for (const part of dir.split("/")) {
		current = current ? `${current}/${part}` : part;
		if (!(await adapter.exists(current))) await adapter.mkdir(current);
	}
}

/**
 * Copy files from a previous location (the plugin folder in .obsidian, or an
 * earlier data folder) when the new location doesn't have them yet.
 * Returns the number of files copied.
 */
export async function migrateData(app: App, fromDir: string, toDir: string): Promise<number> {
	if (!fromDir || fromDir === toDir) return 0;
	const adapter = app.vault.adapter;
	await ensureDataDir(app, toDir);
	let copied = 0;
	for (const name of DATA_FILES) {
		const from = `${fromDir}/${name}`;
		const to = `${toDir}/${name}`;
		try {
			if ((await adapter.exists(from)) && !(await adapter.exists(to))) {
				await adapter.write(to, await adapter.read(from));
				copied++;
			}
		} catch {
			// best-effort migration
		}
	}
	return copied;
}
