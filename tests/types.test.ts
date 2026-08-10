import { describe, expect, it } from "vitest";
import {
	EMBEDDING_PROVIDER_CAPABILITIES,
	createDefaultSettings,
	isPathExcluded,
	sanitizePluginSettings,
} from "../src/types";

describe("plugin settings", () => {
	it("sanitizes malformed persisted values", () => {
		const settings = sanitizePluginSettings({
			embeddingProvider: "ollama",
			nodeOpacity: 99,
			neighborCount: -10,
			layoutSeed: Number.NaN,
			excludeFolders: [" /Templates/ ", 42, "Templates"],
		});
		expect(settings.embeddingProvider).toBe("openai");
		expect(settings.embeddingModel).toBe("text-embedding-3-large");
		expect(settings.nodeOpacity).toBe(1);
		expect(settings.neighborCount).toBe(3);
		expect(Number.isFinite(settings.layoutSeed)).toBe(true);
		expect(settings.excludeFolders).toEqual(["Templates"]);
	});

	it("keeps Anthropic as an explicit non-embedding capability", () => {
		const settings = sanitizePluginSettings({ embeddingProvider: "anthropic" });
		expect(settings.embeddingProvider).toBe("anthropic");
		expect(settings.embeddingModel).toBe("");
		expect(EMBEDDING_PROVIDER_CAPABILITIES.anthropic.embeddings).toBe(false);
	});

	it("matches normalized excluded folder paths", () => {
		expect(isPathExcluded("Templates/note.md", ["/Templates/"])).toBe(true);
		expect(isPathExcluded("Templates2/note.md", ["Templates"])).toBe(false);
	});

	it("creates isolated default folder arrays", () => {
		const first = createDefaultSettings();
		const second = createDefaultSettings();
		first.excludeFolders.push("Private");
		expect(second.excludeFolders).toEqual([]);
	});
});
