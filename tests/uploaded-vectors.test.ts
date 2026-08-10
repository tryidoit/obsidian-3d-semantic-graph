import { describe, expect, it } from "vitest";
import { parseUploadedVectorsJson, serializeUploadedVectors } from "../src/uploaded-vectors";

describe("uploaded vectors", () => {
	it("round-trips provider metadata and dimensions", () => {
		const raw = serializeUploadedVectors([
			["a.md", [1, 2, 3]],
			["b.md", [4, 5, 6]],
		], { provider: "openai", model: "text-embedding-3-large" });
		const parsed = parseUploadedVectorsJson(raw);
		expect(parsed.provider).toBe("openai");
		expect(parsed.model).toBe("text-embedding-3-large");
		expect(parsed.dimensions).toBe(3);
		expect(parsed.vectors.get("a.md")).toEqual([1, 2, 3]);
		expect(parsed.fingerprint).toMatch(/^uploaded:/);
	});

	it("rejects inconsistent dimensions", () => {
		const raw = JSON.stringify({
			entries: {
				"a.md": { embedding: [1, 2] },
				"b.md": { embedding: [1, 2, 3] },
			},
		});
		expect(() => parseUploadedVectorsJson(raw)).toThrow(/dimension mismatch/i);
	});

	it("filters paths to current graph and rejects a fully mismatched file", () => {
		const raw = serializeUploadedVectors([["a.md", [1, 2]]]);
		expect(parseUploadedVectorsJson(raw, { allowedPaths: new Set(["a.md"]) }).vectors.size).toBe(1);
		expect(() => parseUploadedVectorsJson(raw, { allowedPaths: new Set(["missing.md"]) }))
			.toThrow(/do not match/i);
	});
});
