import { describe, expect, it } from "vitest";
import {
	MAX_DUPLICATE_RESULTS,
	computeNeighbors,
	computePairInsights,
	cosineSimilarity,
} from "../src/insights";

describe("semantic insights", () => {
	it("computes cosine similarity and nearest neighbors", () => {
		expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
		const neighbors = computeNeighbors(new Map([
			["a.md", [1, 0]],
			["b.md", [0.9, 0.1]],
			["c.md", [0, 1]],
		]), "a.md", 1);
		expect(neighbors[0]?.path).toBe("b.md");
	});

	it("rejects cosine similarity across mixed dimensions", () => {
		expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow(/dimension mismatch/i);
	});

	it("does not suggest an existing link", async () => {
		const result = await computePairInsights(
			new Map([
				["a.md", [1, 0]],
				["b.md", [0.99, 0.01]],
				["c.md", [0, 1]],
			]),
			[{ source: "a.md", target: "b.md" }],
			5
		);
		expect(result.suggestions.some((item) => item.source === "a.md" && item.target === "b.md")).toBe(false);
	});

	it("bounds duplicate result memory", async () => {
		const vectors = new Map<string, number[]>();
		for (let i = 0; i < 33; i++) vectors.set(`${i}.md`, [1, 0]);
		const result = await computePairInsights(vectors, [], 0);
		expect(result.duplicates).toHaveLength(MAX_DUPLICATE_RESULTS);
	});

	it("rejects mixed vector dimensions", async () => {
		await expect(computePairInsights(new Map([
			["a.md", [1, 0]],
			["b.md", [1, 0, 0]],
		]), [], 5)).rejects.toThrow(/dimension mismatch/i);
	});
});
