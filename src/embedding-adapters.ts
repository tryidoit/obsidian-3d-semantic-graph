import { requestUrl } from "obsidian";
import {
	EmbeddingProvider,
	EmbeddingProviderCapabilities,
	EMBEDDING_PROVIDER_CAPABILITIES,
	getEffectiveEmbeddingModel,
	PluginSettings,
} from "./types";

export interface EmbeddingRequestOptions {
	inputType: "document" | "query";
}

export interface EmbeddingProviderAdapter {
	readonly provider: EmbeddingProvider;
	readonly batchSize: number;
	readonly capabilities: EmbeddingProviderCapabilities;
	embed(texts: string[], options?: EmbeddingRequestOptions): Promise<number[][]>;
}

export function createEmbeddingProviderAdapter(settings: PluginSettings): EmbeddingProviderAdapter {
	switch (settings.embeddingProvider) {
		case "anthropic":
			return new AnthropicEmbeddingAdapter(settings);
		case "openai":
			return new OpenAIEmbeddingAdapter(settings);
	}
}

abstract class BaseEmbeddingAdapter implements EmbeddingProviderAdapter {
	abstract readonly provider: EmbeddingProvider;
	readonly batchSize: number = 100;
	abstract readonly capabilities: EmbeddingProviderCapabilities;
	protected readonly settings: PluginSettings;
	protected readonly modelId: string;

	constructor(settings: PluginSettings) {
		this.settings = settings;
		this.modelId = getEffectiveEmbeddingModel(settings);
	}

	abstract embed(texts: string[], options?: EmbeddingRequestOptions): Promise<number[][]>;
}

interface OpenAIEmbeddingResponse {
	data?: { index: number; embedding: number[] }[];
	error?: { message?: string };
}

class OpenAIEmbeddingAdapter extends BaseEmbeddingAdapter {
	readonly provider = "openai" as const;
	readonly capabilities = EMBEDDING_PROVIDER_CAPABILITIES.openai;

	async embed(texts: string[], _options?: EmbeddingRequestOptions): Promise<number[][]> {
		const response = await requestUrl({
			url: "https://api.openai.com/v1/embeddings",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.settings.embeddingApiKey}`,
			},
			body: JSON.stringify({
				model: this.modelId,
				input: texts,
			}),
			throw: false,
		});

		const body = response.json as OpenAIEmbeddingResponse;
		if (response.status !== 200) {
			throw new Error(
				`OpenAI API error (${response.status}): ${body?.error?.message || "Unknown error"}`
			);
		}

		const data = body?.data;
		if (!Array.isArray(data) || data.length !== texts.length) {
			throw new Error("OpenAI returned an unexpected embedding response.");
		}
		const indexes = new Set(data.map((item) => item.index));
		if (
			indexes.size !== texts.length
			|| data.some((item) => !Number.isInteger(item.index) || item.index < 0 || item.index >= texts.length)
		) {
			throw new Error("OpenAI returned invalid embedding indexes.");
		}
		const embeddings = data
			.sort((a, b) => a.index - b.index)
			.map((item) => item.embedding);
		validateEmbeddingBatch(embeddings, texts.length, "OpenAI");
		return embeddings;
	}
}

class AnthropicEmbeddingAdapter extends BaseEmbeddingAdapter {
	readonly provider = "anthropic" as const;
	readonly capabilities = EMBEDDING_PROVIDER_CAPABILITIES.anthropic;

	embed(_texts: string[], _options?: EmbeddingRequestOptions): Promise<number[][]> {
		return Promise.reject(new Error(
			"Anthropic does not currently provide a native embeddings API. Select OpenAI or upload compatible vectors."
		));
	}
}

function validateEmbeddingBatch(embeddings: number[][], expectedCount: number, provider: string): void {
	if (embeddings.length !== expectedCount || embeddings.length === 0) {
		throw new Error(`${provider} returned an unexpected embedding count.`);
	}
	const dimensions = embeddings[0]?.length ?? 0;
	if (dimensions === 0) {
		throw new Error(`${provider} returned an empty embedding.`);
	}
	for (const vector of embeddings) {
		if (
			vector.length !== dimensions
			|| vector.some((value) => !Number.isFinite(value))
		) {
			throw new Error(`${provider} returned inconsistent or invalid embeddings.`);
		}
	}
}
