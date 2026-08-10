import type { PluginSettings } from "./types";

/** Settings that change graph data, embeddings, layout, colors, or insights. */
export function settingsRequireGraphReload(previous: PluginSettings, next: PluginSettings): boolean {
	return previous.embeddingProvider !== next.embeddingProvider
		|| previous.embeddingApiKey !== next.embeddingApiKey
		|| previous.embeddingModel !== next.embeddingModel
		|| previous.uploadedVectorsFileName !== next.uploadedVectorsFileName
		|| previous.uploadedVectorsRevision !== next.uploadedVectorsRevision
		|| previous.projectionMethod !== next.projectionMethod
		|| previous.umapNNeighbors !== next.umapNNeighbors
		|| previous.umapMinDist !== next.umapMinDist
		|| previous.nodeColorBy !== next.nodeColorBy
		|| previous.timelineDateSource !== next.timelineDateSource
		|| previous.clusterSource !== next.clusterSource
		|| previous.layoutSeed !== next.layoutSeed
		|| previous.suggestedLinkCount !== next.suggestedLinkCount
		|| previous.excludeFolders.length !== next.excludeFolders.length
		|| previous.excludeFolders.some((folder, index) => folder !== next.excludeFolders[index]);
}
