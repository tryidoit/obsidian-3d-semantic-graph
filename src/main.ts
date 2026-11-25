import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
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
import { ensureDataDir, getDataDir, migrateData } from "./data-dir";
import { parseUploadedVectorsJson, UPLOADED_VECTORS_FILE } from "./uploaded-vectors";

export default class SemanticGraphPlugin extends Plugin {
	settings: PluginSettings = createDefaultSettings();
	private activeDataDir = "";
	private lastVectorsFingerprint: string | null = null;
	private vectorsSyncTimer: number | null = null;

	/** Vault-relative folder holding vectors + caches. Lives in the vault so iCloud/Obsidian Sync carries it. */
	getDataDir(): string {
		return getDataDir(this.settings);
	}

	/** Called by the settings tab after it writes the vectors file itself. */
	markVectorsWritten(raw: string): void {
		try {
			this.lastVectorsFingerprint = parseUploadedVectorsJson(raw).fingerprint;
		} catch {
			this.lastVectorsFingerprint = null;
		}
	}

	async onload() {
		await this.loadSettings();
		applyLanguageSetting(this.settings.language);
		this.activeDataDir = this.getDataDir();

		this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => {
			return new SemanticGraphView(
				leaf,
				clonePluginSettings(this.settings),
				this.getDataDir(),
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
				this.getDataDir(),
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

		this.app.workspace.onLayoutReady(() => {
			void this.initDataFolder();
			// Registered after layout-ready so the initial vault indexing doesn't fire them.
			const onFile = (file: { path: string }) => this.onVaultFileChanged(file);
			this.registerEvent(this.app.vault.on("modify", onFile));
			this.registerEvent(this.app.vault.on("create", onFile));
		});
	}

	onunload() {
		if (this.vectorsSyncTimer !== null) window.clearTimeout(this.vectorsSyncTimer);
	}

	private vectorsPath(): string {
		return `${this.getDataDir()}/${UPLOADED_VECTORS_FILE}`;
	}

	private async initDataFolder(): Promise<void> {
		try {
			const dir = this.getDataDir();
			await ensureDataDir(this.app, dir);
			// One-time move of data from the old plugin folder (not synced reliably, hidden from tools).
			if (this.manifest.dir) await migrateData(this.app, this.manifest.dir, dir);
			const adapter = this.app.vault.adapter;
			const path = this.vectorsPath();
			if (await adapter.exists(path)) {
				const parsed = parseUploadedVectorsJson(await adapter.read(path));
				this.lastVectorsFingerprint = parsed.fingerprint;
				// Vectors arrived via sync (another device) or Claude before this device ever uploaded.
				if (!this.settings.uploadedVectorsFileName.trim()) {
					await this.activateVaultVectors(false);
				}
			}
		} catch {
			// no valid vectors file yet; nothing to do
		}
	}

	private onVaultFileChanged(file: { path: string }): void {
		if (file.path !== this.vectorsPath()) return;
		// iCloud and external writers produce bursts of events; wait for the file to settle.
		if (this.vectorsSyncTimer !== null) window.clearTimeout(this.vectorsSyncTimer);
		this.vectorsSyncTimer = window.setTimeout(() => {
			this.vectorsSyncTimer = null;
			void this.syncVectorsFromVault();
		}, 1500);
	}

	private async syncVectorsFromVault(): Promise<void> {
		try {
			const raw = await this.app.vault.adapter.read(this.vectorsPath());
			const { fingerprint } = parseUploadedVectorsJson(raw);
			if (fingerprint === this.lastVectorsFingerprint) return;
			this.lastVectorsFingerprint = fingerprint;
			await this.activateVaultVectors(true);
		} catch (error) {
			new Notice(t("notice.vectorsUploadFailed", { message: error instanceof Error ? error.message : String(error) }));
		}
	}

	private async activateVaultVectors(notify: boolean): Promise<void> {
		this.settings = {
			...clonePluginSettings(this.settings),
			uploadedVectorsFileName: this.settings.uploadedVectorsFileName.trim() || UPLOADED_VECTORS_FILE,
			uploadedVectorsRevision: this.settings.uploadedVectorsRevision + 1,
		};
		await this.saveSettings();
		if (notify) new Notice(t("notice.vectorsUploaded"));
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
		const nextDir = getDataDir(nextSettings);
		if (this.activeDataDir && nextDir !== this.activeDataDir) {
			const previousDir = this.activeDataDir;
			this.activeDataDir = nextDir;
			await migrateData(this.app, previousDir, nextDir);
		}
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
