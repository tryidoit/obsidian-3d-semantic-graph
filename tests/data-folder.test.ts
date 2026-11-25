import { describe, expect, it } from "vitest";
import { DEFAULT_DATA_FOLDER, normalizeDataFolder } from "../src/types";

describe("normalizeDataFolder", () => {
	it("falls back to the default for empty, non-string or escaping values", () => {
		expect(normalizeDataFolder(undefined)).toBe(DEFAULT_DATA_FOLDER);
		expect(normalizeDataFolder("  ")).toBe(DEFAULT_DATA_FOLDER);
		expect(normalizeDataFolder("../outside")).toBe(DEFAULT_DATA_FOLDER);
	});
	it("normalizes slashes and whitespace", () => {
		expect(normalizeDataFolder("/Graph Data/")).toBe("Graph Data");
		expect(normalizeDataFolder("a\\b//c")).toBe("a/b/c");
	});
});
