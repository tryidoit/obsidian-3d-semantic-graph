#!/usr/bin/env node
// MCP server (stdio, zero dependencies) that lets Claude read/write the
// 3D Semantic Graph data stored in your vault. The plugin watches the same
// folder, so vectors Claude writes show up in the graph automatically.
//
// Usage: node server.mjs --vault "/path/to/vault" [--folder _semantic-graph]
import fs from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const VAULT = path.resolve(arg("vault", process.env.OBSIDIAN_VAULT ?? ""));
const FOLDER = arg("folder", process.env.SEMANTIC_GRAPH_FOLDER ?? "_semantic-graph");
if (!arg("vault", process.env.OBSIDIAN_VAULT)) {
	console.error("Missing --vault <path> (or OBSIDIAN_VAULT)");
	process.exit(1);
}
const DIR = path.join(VAULT, ...FOLDER.split("/").filter(Boolean));
const VECTORS = path.join(DIR, "uploaded-vectors.json");
const LAYOUT = path.join(DIR, "layout-cache.json");

const readJson = async (file) => {
	try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return null; }
};
const atomicWrite = async (file, text) => {
	await fs.mkdir(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	await fs.writeFile(tmp, text);
	await fs.rename(tmp, file);
};
const safeNotePath = (p) => {
	const full = path.resolve(VAULT, p);
	if (full !== VAULT && !full.startsWith(VAULT + path.sep)) throw new Error(`Path escapes vault: ${p}`);
	return full;
};

async function walkNotes(dir = VAULT, out = []) {
	for (const e of await fs.readdir(dir, { withFileTypes: true })) {
		if (e.name.startsWith(".") || (dir === VAULT && e.name === FOLDER.split("/")[0])) continue;
		const full = path.join(dir, e.name);
		if (e.isDirectory()) await walkNotes(full, out);
		else if (e.name.endsWith(".md")) out.push(full);
	}
	return out;
}

const cosine = (a, b) => {
	let d = 0, na = 0, nb = 0;
	for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
	return na && nb ? d / Math.sqrt(na * nb) : 0;
};

const validVector = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "number" && Number.isFinite(x));

async function loadVectors() {
	const data = await readJson(VECTORS);
	return data?.entries ? data : { version: 1, provider: "custom", model: "", dimensions: 0, entries: {} };
}

const TOOLS = [
	{
		name: "semantic_graph_status",
		description: "Show where the 3D Semantic Graph data lives, how many notes have vectors, vector dimensions, and whether a computed layout exists.",
		inputSchema: { type: "object", properties: {} },
		run: async () => {
			const v = await loadVectors();
			const notes = await walkNotes();
			const have = new Set(Object.keys(v.entries));
			const layout = await readJson(LAYOUT);
			return {
				dataFolder: DIR,
				notesInVault: notes.length,
				notesWithVectors: notes.filter((n) => have.has(path.relative(VAULT, n).split(path.sep).join("/"))).length,
				vectorEntries: have.size,
				dimensions: v.dimensions ?? 0,
				model: v.model ?? "",
				layoutCached: Boolean(layout?.coords),
				clusters: layout?.clusters?.length ?? null,
			};
		},
	},
	{
		name: "semantic_graph_list_notes",
		description: "List vault notes (vault-relative paths) with a short excerpt and whether each has a vector yet. Use to decide what to embed. Paginated.",
		inputSchema: {
			type: "object",
			properties: {
				offset: { type: "number" }, limit: { type: "number", description: "default 50, max 200" },
				excerptChars: { type: "number", description: "default 300" },
				onlyMissing: { type: "boolean", description: "only notes without a vector" },
			},
		},
		run: async ({ offset = 0, limit = 50, excerptChars = 300, onlyMissing = false }) => {
			const v = await loadVectors();
			let notes = (await walkNotes()).map((n) => path.relative(VAULT, n).split(path.sep).join("/")).sort();
			if (onlyMissing) notes = notes.filter((n) => !v.entries[n]);
			const page = notes.slice(offset, offset + Math.min(limit, 200));
			const items = [];
			for (const n of page) {
				const text = await fs.readFile(safeNotePath(n), "utf8");
				items.push({ path: n, hasVector: Boolean(v.entries[n]), excerpt: text.slice(0, excerptChars) });
			}
			return { total: notes.length, offset, items };
		},
	},
	{
		name: "semantic_graph_set_vectors",
		description: "Write embedding vectors for notes into the vault's uploaded-vectors.json (merged with existing entries). Obsidian picks the change up automatically and refreshes the graph on every device. All vectors must share one dimension.",
		inputSchema: {
			type: "object",
			properties: {
				entries: { type: "object", description: "{ \"folder/note.md\": [numbers...] }", additionalProperties: { type: "array", items: { type: "number" } } },
				replaceAll: { type: "boolean", description: "discard existing entries first (default false)" },
				provider: { type: "string", enum: ["openai", "anthropic", "custom"] },
				model: { type: "string" },
			},
			required: ["entries"],
		},
		run: async ({ entries, replaceAll = false, provider, model }) => {
			const current = replaceAll ? { entries: {} } : await loadVectors();
			const merged = { ...current.entries };
			let dim = Object.values(merged)[0]?.embedding?.length ?? 0;
			for (const [p, vec] of Object.entries(entries ?? {})) {
				if (!validVector(vec)) throw new Error(`Invalid vector for ${p}`);
				if (!dim) dim = vec.length;
				if (vec.length !== dim) throw new Error(`Dimension mismatch for ${p}: expected ${dim}, got ${vec.length}`);
				merged[p] = { embedding: vec };
			}
			const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
			await atomicWrite(VECTORS, JSON.stringify({
				version: 1, provider: provider ?? current.provider ?? "custom", model: model ?? current.model ?? "",
				dimensions: dim, entries: sorted,
			}));
			return { written: Object.keys(entries ?? {}).length, totalEntries: Object.keys(sorted).length, dimensions: dim, file: VECTORS };
		},
	},
	{
		name: "semantic_graph_remove_vectors",
		description: "Remove vectors by note path, or all vectors whose note no longer exists (stale: true).",
		inputSchema: { type: "object", properties: { paths: { type: "array", items: { type: "string" } }, stale: { type: "boolean" } } },
		run: async ({ paths = [], stale = false }) => {
			const v = await loadVectors();
			let removed = 0;
			for (const p of paths) if (delete v.entries[p]) removed++;
			if (stale) {
				for (const p of Object.keys(v.entries)) {
					try { await fs.access(safeNotePath(p)); } catch { delete v.entries[p]; removed++; }
				}
			}
			v.dimensions = Object.values(v.entries)[0]?.embedding?.length ?? 0;
			await atomicWrite(VECTORS, JSON.stringify(v));
			return { removed, remaining: Object.keys(v.entries).length };
		},
	},
	{
		name: "semantic_graph_neighbors",
		description: "Find the semantically closest notes to a given note (cosine similarity over stored vectors).",
		inputSchema: { type: "object", properties: { path: { type: "string" }, k: { type: "number", description: "default 10" } }, required: ["path"] },
		run: async ({ path: p, k = 10 }) => {
			const v = await loadVectors();
			const base = v.entries[p]?.embedding;
			if (!base) throw new Error(`No vector for ${p}`);
			return Object.entries(v.entries)
				.filter(([q]) => q !== p)
				.map(([q, e]) => ({ path: q, similarity: Number(cosine(base, e.embedding).toFixed(4)) }))
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, k);
		},
	},
	{
		name: "semantic_graph_get_clusters",
		description: "Read the clusters and 3D coordinates last computed by the plugin (layout-cache.json). Requires the graph to have been opened once in Obsidian.",
		inputSchema: { type: "object", properties: { includeCoords: { type: "boolean" } } },
		run: async ({ includeCoords = false }) => {
			const layout = await readJson(LAYOUT);
			if (!layout) throw new Error("No layout yet. Open the 3D Semantic Graph in Obsidian once to compute it.");
			return { clusters: layout.clusters, ...(includeCoords ? { coords: layout.coords } : { noteCount: Object.keys(layout.coords ?? {}).length }) };
		},
	},
];

// --- minimal JSON-RPC over stdio (newline-delimited) ---
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
async function handle(msg) {
	const { id, method, params } = msg;
	if (id === undefined) return; // notification
	try {
		if (method === "initialize") {
			return send({ jsonrpc: "2.0", id, result: {
				protocolVersion: params?.protocolVersion ?? "2024-11-05",
				capabilities: { tools: {} },
				serverInfo: { name: "obsidian-3d-semantic-graph", version: "1.0.0" },
			} });
		}
		if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
		if (method === "tools/list") {
			return send({ jsonrpc: "2.0", id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
		}
		if (method === "tools/call") {
			const tool = TOOLS.find((t) => t.name === params?.name);
			if (!tool) return send({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool ${params?.name}` } });
			try {
				const out = await tool.run(params.arguments ?? {});
				return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } });
			} catch (e) {
				return send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: String(e?.message ?? e) }] } });
			}
		}
		send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
	} catch (e) {
		send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(e?.message ?? e) } });
	}
}

let buf = "";
let queue = Promise.resolve(); // handle requests in order so writes/reads don't race
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
	buf += chunk;
	let nl;
	while ((nl = buf.indexOf("\n")) >= 0) {
		const line = buf.slice(0, nl).trim();
		buf = buf.slice(nl + 1);
		if (!line) continue;
		try { const m = JSON.parse(line); queue = queue.then(() => handle(m)); } catch { /* ignore malformed */ }
	}
});
