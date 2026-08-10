import { describe, expect, it } from "vitest";
import { resolveCreatedTime } from "../src/note-dates";

describe("timeline dates", () => {
	it("uses valid frontmatter and falls back for invalid or future values", () => {
		const fallback = Date.UTC(2024, 0, 1);
		const now = Date.UTC(2026, 0, 1);
		expect(resolveCreatedTime({ created: "2025-05-03" }, fallback, now))
			.toBe(Date.parse("2025-05-03"));
		expect(resolveCreatedTime({ created: "not-a-date" }, fallback, now)).toBe(fallback);
		expect(resolveCreatedTime({ created: "2030-01-01" }, fallback, now)).toBe(fallback);
	});
});
