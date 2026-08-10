import type { App } from "obsidian";
import type { EmbeddingProvider } from "./types";

export const UPLOADED_VECTORS_FILE = "uploaded-vectors.json";

export interface UploadedVectorsJson {
	version?: number;
	provider?: EmbeddingProvider | "custom";
	model?: string;
	dimensions?: number;
	entries: Record<string, { embedding: number[] }>;
}

export interface UploadedVectorsData {
	vectors: Map<string, number[]>;
	provider: EmbeddingProvider | "custom" | null;
	model: string | null;
	dimensions: number;
	fingerprint: string;
}

export interface ReadUploadedVectorsOptions {
	allowedPaths?: ReadonlySet<string>;
}

export function serializeUploadedVectors(
	vectors: Iterable<[string, number[]]>,
	metadata: { provider?: EmbeddingProvider | "custom"; model?: string } = {}
): string {
	const entries = Object.fromEntries(
		Array.from(vectors)
			.sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
			.map(([pathKey, embedding]) => [pathKey, { embedding }])
	);
	const first = Object.values(entries)[0];
	const dimensions = first?.embedding.length ?? 0;
	return JSON.stringify({
		version: 1,
		provider: metadata.provider ?? "custom",
		model: metadata.model ?? "",
		dimensions,
		entries,
	} satisfies UploadedVectorsJson, null, 2);
}

export async function readUploadedVectors(
	app: App,
	pluginDir: string,
	options: ReadUploadedVectorsOptions = {}
): Promise<Map<string, number[]>> {
	return (await readUploadedVectorsData(app, pluginDir, options)).vectors;
}

export async function readUploadedVectorsData(
	app: App,
	pluginDir: string,
	options: ReadUploadedVectorsOptions = {}
): Promise<UploadedVectorsData> {
	const path = `${pluginDir}/${UPLOADED_VECTORS_FILE}`;
	const adapter = app.vault.adapter;
	if (!(await adapter.exists(path))) {
		throw new Error("Uploaded vectors JSON file not found.");
	}

	const raw = await adapter.read(path);
	return parseUploadedVectorsJson(raw, options);
}

export function parseUploadedVectorsJson(
	raw: string,
	options: ReadUploadedVectorsOptions = {}
): UploadedVectorsData {
	const parsed = JSON.parse(raw) as UploadedVectorsJson;
	if (
		!parsed
		|| typeof parsed !== "object"
		|| !parsed.entries
		|| typeof parsed.entries !== "object"
		|| Array.isArray(parsed.entries)
	) {
		throw new Error('Invalid uploaded vectors JSON. Expected {"entries": {"path/to/note.md": {"embedding": [...]}}}.');
	}

	const vectors = new Map<string, number[]>();
	let dimensions = 0;
	for (const [pathKey, entry] of Object.entries(parsed.entries)) {
		const vector = entry?.embedding;
		if (!pathKey.trim()) {
			throw new Error("Vector paths must not be empty.");
		}
		if (
			!Array.isArray(vector)
			|| vector.length === 0
			|| vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
		) {
			throw new Error(`Invalid vector for "${pathKey}". Expected a finite array of numbers.`);
		}
		if (dimensions === 0) dimensions = vector.length;
		if (vector.length !== dimensions) {
			throw new Error(`Vector dimension mismatch for "${pathKey}". Expected ${dimensions}, received ${vector.length}.`);
		}
		if (!options.allowedPaths || options.allowedPaths.has(pathKey)) {
			vectors.set(pathKey, [...vector]);
		}
	}

	if (parsed.dimensions !== undefined && parsed.dimensions !== dimensions) {
		throw new Error(`Vector metadata says ${parsed.dimensions} dimensions, but entries contain ${dimensions}.`);
	}
	if (dimensions === 0) {
		throw new Error("Uploaded vectors file contains no vectors.");
	}
	if (options.allowedPaths && vectors.size === 0) {
		throw new Error("Uploaded vectors do not match any note paths in the current graph.");
	}

	return {
		vectors,
		provider: parsed.provider === "openai" || parsed.provider === "anthropic" || parsed.provider === "custom"
			? parsed.provider
			: null,
		model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : null,
		dimensions,
		fingerprint: hashRawVectors(raw),
	};
}

function hashRawVectors(raw: string): string {
	let hashA = 2166136261;
	let hashB = 0x9e3779b9;
	for (let i = 0; i < raw.length; i++) {
		const code = raw.charCodeAt(i);
		hashA = Math.imul(hashA ^ code, 16777619);
		hashB = Math.imul(hashB ^ code, -2048144789);
	}
	return `uploaded:${(hashA >>> 0).toString(36)}:${(hashB >>> 0).toString(36)}`;
}
