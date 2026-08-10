import { describe, expect, it } from "vitest";
import { settingsRequireGraphReload } from "../src/settings-impact";
import { createDefaultSettings } from "../src/types";

describe("settings impact", () => {
	it("reloads for data and layout settings", () => {
		const previous = createDefaultSettings();
		expect(settingsRequireGraphReload(previous, { ...previous, nodeColorBy: "tag" })).toBe(true);
		expect(settingsRequireGraphReload(previous, { ...previous, umapMinDist: 0.2 })).toBe(true);
		expect(settingsRequireGraphReload(previous, { ...previous, suggestedLinkCount: 40 })).toBe(true);
		expect(settingsRequireGraphReload(previous, { ...previous, excludeFolders: ["Private"] })).toBe(true);
		expect(settingsRequireGraphReload(previous, { ...previous, uploadedVectorsRevision: 1 })).toBe(true);
	});

	it("does not reload for renderer-only settings", () => {
		const previous = createDefaultSettings();
		expect(settingsRequireGraphReload(previous, { ...previous, nodeOpacity: 0.5 })).toBe(false);
		expect(settingsRequireGraphReload(previous, { ...previous, showGrid: false })).toBe(false);
	});
});
