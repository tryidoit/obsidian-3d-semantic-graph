import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	clonePluginSettings,
	createDefaultSettings,
	PluginSettings,
	sanitizePluginSettings,
} from "./types";
import { SemanticGraphSettingTab } from "./settings";
import { SemanticGraphView, VIEW_TYPE } from "./graph-view";
import { NeighborsView, NEIGHBORS_VIEW_TYPE } from "./neighbors-view";
import { applyLanguageSetting, t } from "./i18n";

export default class SemanticGraphPlugin extends Plugin {
	settings: PluginSettings = createDefaultSettings();

	async onload() {
		await this.loadSettings();
		applyLanguageSetting(this.settings.language);

		this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => {
			return new SemanticGraphView(
				leaf,
				clonePluginSettings(this.settings),
				this.manifest.dir!,
				() => clonePluginSettings(this.settings),
				async (nextSettings: PluginSettings, sourceView?: SemanticGraphView) => {
					this.settings = clonePluginSettings(nextSettings);
					await this.saveSettings(sourceView);
				}
			);
		});

		this.registerView(NEIGHBORS_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
			return new NeighborsView(
				leaf,
				clonePluginSettings(this.settings),
				this.manifest.dir!,
				() => clonePluginSettings(this.settings)
			);
		});

		this.addRibbonIcon("network", t("view.graph.title"), () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-semantic-graph",
			name: t("command.openGraph"),
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: "open-semantic-neighbors",
			name: t("command.openNeighbors"),
			callback: () => {
				void this.activateNeighborsView();
			},
		});

		this.addSettingTab(new SemanticGraphSettingTab(this.app, this));
	}

	async loadSettings() {
		const loadedData: unknown = await this.loadData();
		const raw = loadedData && typeof loadedData === "object"
			? { ...(loadedData as Record<string, unknown>) }
			: {};
		// Migrate the pre-1.3 OpenAI-specific key into the provider-neutral field.
		if (typeof raw.openaiApiKey === "string" && typeof raw.embeddingApiKey !== "string") {
			raw.embeddingApiKey = raw.openaiApiKey;
		}
		this.settings = sanitizePluginSettings(raw);
	}

	async saveSettings(_sourceView?: SemanticGraphView) {
		const nextSettings = sanitizePluginSettings(this.settings);
		this.settings = nextSettings;
		await this.saveData(nextSettings);
		applyLanguageSetting(nextSettings.language);
		// Update existing views with new settings
		this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
			if (leaf.view instanceof SemanticGraphView) {
				leaf.view.updateSettings(clonePluginSettings(nextSettings));
			}
		});
		this.app.workspace.getLeavesOfType(NEIGHBORS_VIEW_TYPE).forEach((leaf) => {
			if (leaf.view instanceof NeighborsView) {
				leaf.view.updateSettings(clonePluginSettings(this.settings));
			}
		});
	}

	async activateNeighborsView() {
		const existing = this.app.workspace.getLeavesOfType(NEIGHBORS_VIEW_TYPE);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({
			type: NEIGHBORS_VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}

	async activateView() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}
}
