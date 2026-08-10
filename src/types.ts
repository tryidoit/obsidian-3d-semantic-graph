export type EmbeddingProvider = "openai" | "anthropic";

export interface EmbeddingProviderCapabilities {
	embeddings: boolean;
	queryEmbeddings: boolean;
}

export type SceneThemeSetting = "auto" | "dark" | "light";

export const GRAPH_GROUP_COLORS: readonly string[] = [
	"#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6",
	"#ef4444", "#22c55e", "#3b82f6", "#f97316", "#06b6d4",
];

export interface PluginSettings {
	language: "auto" | "en" | "ko";
	embeddingProvider: EmbeddingProvider;
	embeddingApiKey: string;
	embeddingModel: string;
	uploadedVectorsFileName: string;
	uploadedVectorsRevision: number;
	suggestedLinkCount: number;
	neighborCount: number;
	projectionMethod: "umap" | "pca";
	umapNNeighbors: number;
	umapMinDist: number;
	nodeColorBy: "folder" | "tag";
	timelineDateSource: "ctime" | "frontmatter";
	showLinks: boolean;
	showGrid: boolean;
	showClusters: "on" | "hover" | "off";
	clusterSource: "semantic" | "folder";
	sceneTheme: SceneThemeSetting;
	nodeOpacity: number;
	nodeSizeScale: number;
	dragSensitivity: number;
	autoOrbitSpeed: number;
	entryAnimation: boolean;
	layoutSeed: number;
	excludeFolders: string[];
}

export function generateRandomLayoutSeed(): number {
	return Math.floor(Math.random() * 2147483647);
}

export function createDefaultSettings(): PluginSettings {
	return {
		language: "auto",
		embeddingProvider: "openai",
		embeddingApiKey: "",
		embeddingModel: "text-embedding-3-large",
		uploadedVectorsFileName: "",
		uploadedVectorsRevision: 0,
		suggestedLinkCount: 20,
		neighborCount: 10,
		projectionMethod: "umap",
		umapNNeighbors: 40,
		umapMinDist: 0.8,
		nodeColorBy: "folder",
		timelineDateSource: "ctime",
		showLinks: false,
		showGrid: true,
		showClusters: "hover",
		clusterSource: "semantic",
		sceneTheme: "auto",
		nodeOpacity: 1,
		nodeSizeScale: 1.5,
		dragSensitivity: 1,
		autoOrbitSpeed: 0.2,
		entryAnimation: true,
		layoutSeed: generateRandomLayoutSeed(),
		excludeFolders: [],
	};
}

export function clonePluginSettings(settings: PluginSettings): PluginSettings {
	return {
		...settings,
		excludeFolders: [...settings.excludeFolders],
	};
}

export function sanitizePluginSettings(input: unknown): PluginSettings {
	const defaults = createDefaultSettings();
	if (!input || typeof input !== "object") return defaults;
	const raw = input as Record<string, unknown>;
	const provider: EmbeddingProvider = raw.embeddingProvider === "anthropic" ? "anthropic" : "openai";
	const model = typeof raw.embeddingModel === "string" ? raw.embeddingModel : "";

	return {
		language: isOneOf(raw.language, ["auto", "en", "ko"] as const) ? raw.language : defaults.language,
		embeddingProvider: provider,
		embeddingApiKey: typeof raw.embeddingApiKey === "string" ? raw.embeddingApiKey.trim() : "",
		embeddingModel: isPresetEmbeddingModel(provider, model) ? model : getDefaultEmbeddingModel(provider),
		uploadedVectorsFileName: typeof raw.uploadedVectorsFileName === "string" ? raw.uploadedVectorsFileName : "",
		uploadedVectorsRevision: boundedNumber(
			raw.uploadedVectorsRevision,
			0,
			Number.MAX_SAFE_INTEGER,
			defaults.uploadedVectorsRevision,
			true
		),
		suggestedLinkCount: boundedNumber(raw.suggestedLinkCount, 5, 100, defaults.suggestedLinkCount, true),
		neighborCount: boundedNumber(raw.neighborCount, 3, 30, defaults.neighborCount, true),
		projectionMethod: isOneOf(raw.projectionMethod, ["umap", "pca"] as const)
			? raw.projectionMethod
			: defaults.projectionMethod,
		umapNNeighbors: boundedNumber(raw.umapNNeighbors, 5, 50, defaults.umapNNeighbors, true),
		umapMinDist: boundedNumber(raw.umapMinDist, 0, 0.99, defaults.umapMinDist),
		nodeColorBy: isOneOf(raw.nodeColorBy, ["folder", "tag"] as const) ? raw.nodeColorBy : defaults.nodeColorBy,
		timelineDateSource: isOneOf(raw.timelineDateSource, ["ctime", "frontmatter"] as const)
			? raw.timelineDateSource
			: defaults.timelineDateSource,
		showLinks: typeof raw.showLinks === "boolean" ? raw.showLinks : defaults.showLinks,
		showGrid: typeof raw.showGrid === "boolean" ? raw.showGrid : defaults.showGrid,
		showClusters: isOneOf(raw.showClusters, ["on", "hover", "off"] as const)
			? raw.showClusters
			: defaults.showClusters,
		clusterSource: isOneOf(raw.clusterSource, ["semantic", "folder"] as const)
			? raw.clusterSource
			: defaults.clusterSource,
		sceneTheme: isOneOf(raw.sceneTheme, ["auto", "dark", "light"] as const) ? raw.sceneTheme : defaults.sceneTheme,
		nodeOpacity: boundedNumber(raw.nodeOpacity, 0.15, 1, defaults.nodeOpacity),
		nodeSizeScale: boundedNumber(raw.nodeSizeScale, 0.4, 2, defaults.nodeSizeScale),
		dragSensitivity: boundedNumber(raw.dragSensitivity, 0.2, 3, defaults.dragSensitivity),
		autoOrbitSpeed: boundedNumber(raw.autoOrbitSpeed, 0, 3, defaults.autoOrbitSpeed),
		entryAnimation: typeof raw.entryAnimation === "boolean" ? raw.entryAnimation : defaults.entryAnimation,
		layoutSeed: boundedNumber(raw.layoutSeed, 0, 2147483647, defaults.layoutSeed, true),
		excludeFolders: Array.isArray(raw.excludeFolders)
			? Array.from(new Set(raw.excludeFolders
				.filter((folder): folder is string => typeof folder === "string")
				.map(normalizeExcludedFolder)
				.filter(Boolean)))
			: [],
	};
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
	return typeof value === "string" && values.includes(value as T);
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number, integer = false): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const bounded = Math.max(min, Math.min(max, value));
	return integer ? Math.round(bounded) : bounded;
}

export function normalizeExcludedFolder(folder: string): string {
	return folder.trim().replace(/^\/+|\/+$/g, "");
}

export const EMBEDDING_PROVIDER_LABELS: Record<EmbeddingProvider, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic (Claude — reserved)",
};

/**
 * Capabilities are explicit so a future local or cloud adapter can be added
 * without teaching the graph, search, or settings layers provider-specific
 * rules. Anthropic currently has no native embeddings API.
 */
export const EMBEDDING_PROVIDER_CAPABILITIES: Record<EmbeddingProvider, EmbeddingProviderCapabilities> = {
	openai: { embeddings: true, queryEmbeddings: true },
	anthropic: { embeddings: false, queryEmbeddings: false },
};

export const PRESET_EMBEDDING_MODELS: Record<EmbeddingProvider, readonly string[]> = {
	openai: [
		"text-embedding-3-large",
		"text-embedding-3-small",
		"text-embedding-ada-002",
	],
	anthropic: [],
};

export function getDefaultEmbeddingModel(provider: EmbeddingProvider): string {
	return PRESET_EMBEDDING_MODELS[provider][0] ?? "";
}

export function isPresetEmbeddingModel(provider: EmbeddingProvider, model: string): boolean {
	return PRESET_EMBEDDING_MODELS[provider].includes(model);
}

export function getEffectiveEmbeddingModel(settings: PluginSettings): string {
	return settings.embeddingModel;
}

export function getEmbeddingCacheModelId(settings: PluginSettings): string {
	return `${settings.embeddingProvider}::${settings.embeddingModel}`;
}

export function canGenerateEmbeddings(settings: PluginSettings): boolean {
	if (settings.uploadedVectorsFileName.trim()) {
		return true;
	}
	return canGenerateProviderEmbeddings(settings);
}

export function canGenerateProviderEmbeddings(settings: PluginSettings): boolean {
	return EMBEDDING_PROVIDER_CAPABILITIES[settings.embeddingProvider].embeddings
		&& Boolean(settings.embeddingApiKey.trim())
		&& Boolean(settings.embeddingModel.trim());
}

export function canGenerateQueryEmbeddings(settings: PluginSettings): boolean {
	return EMBEDDING_PROVIDER_CAPABILITIES[settings.embeddingProvider].queryEmbeddings
		&& Boolean(settings.embeddingApiKey.trim())
		&& Boolean(settings.embeddingModel.trim());
}

export function getNodePath(nodeRef: string | GraphNode): string | null {
	if (typeof nodeRef === "string") return nodeRef;
	return nodeRef?.path ?? nodeRef?.id ?? null;
}

export function isPathExcluded(path: string, excludeFolders: string[]): boolean {
	return excludeFolders.some(
		(rawFolder) => {
			const folder = normalizeExcludedFolder(rawFolder);
			return Boolean(folder) && (path.startsWith(`${folder}/`) || path === folder);
		}
	);
}

export interface GraphVisualOptions {
	sceneTheme: "dark" | "light";
	nodeOpacity: number;
	nodeSizeScale: number;
	dragSensitivity: number;
	showGrid: boolean;
	autoOrbitSpeed: number;
	entryAnimation: boolean;
	sceneExtent: number;
}

export interface EmbeddingCacheEntry {
	contentHash: string;
	embedding: number[];
	lastModified: number;
}

export interface EmbeddingCache {
	modelId: string;
	version: number;
	entries: Record<string, EmbeddingCacheEntry>;
}

export interface GraphNode {
	id: string;
	name: string;
	path: string;
	color: string;
	size: number;
	tags?: string[];
	ctime?: number;
	x?: number;
	y?: number;
	z?: number;
	fx?: number;
	fy?: number;
	fz?: number;
}

export interface GraphLink {
	source: string;
	target: string;
}

export interface GraphData {
	nodes: GraphNode[];
	links: GraphLink[];
}
