export type CanvaAsset = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  thumbnail?: { url: string; width: number; height: number };
  url?: string;
};

export type FolderInfo = {
  key: string;
  envVar: string;
  configured: boolean;
};

export type AssetListResult = {
  items: CanvaAsset[];
  folderKey: string;
  warning?: string;
};

const FOLDER_KEYS = [
  "models",
  "products",
  "examples",
  "bottle_refs",
  "output",
  "video_examples",
  "video_output",
] as const;

export type FolderKey = (typeof FOLDER_KEYS)[number];

export const listAssets = async (folderKey: string): Promise<AssetListResult> => {
  const url = new URL(
    `/api/assets/${folderKey}`,
    process.env.BACKEND_URL,
  );
  const response = await fetch(url.toString(), { credentials: "include" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const hint = response.status === 401
      ? "Not connected to Canva — reconnect on the home page"
      : body || response.statusText;
    throw new Error(`${folderKey} (${response.status}): ${hint}`);
  }
  return response.json() as Promise<AssetListResult>;
};

export const listAllFolders = async (): Promise<FolderInfo[]> => {
  const url = new URL("/api/folders", process.env.BACKEND_URL);
  const response = await fetch(url.toString(), { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch folder list");
  }
  const data = await response.json() as { folders: FolderInfo[] };
  return data.folders;
};

export const AVAILABLE_FOLDER_KEYS = [...FOLDER_KEYS];

// ─── Ad Creator types ────────────────────────────────────────────────────

export type GenerateAdPayload = {
  brand: string;
  sessionName: string;
  productAssetId: string;
  modelAssetId?: string;
  styleAssetId?: string;
  bottleRefAssetId?: string;
  prompt: string;
  variations: number;
};

export type GenerateAdResult = {
  success: boolean;
  sessionDir: string;
  images: {
    name: string;
    localPath: string;
    dataUrl?: string;
    canvaAssetId?: string;
  }[];
};

export type EnhancePromptPayload = {
  brand: string;
  description: string;
  hasModel?: boolean;
  hasStyle?: boolean;
};

// ─── Ad Creator API calls ────────────────────────────────────────────────

export const generateAd = async (payload: GenerateAdPayload): Promise<GenerateAdResult> => {
  const url = new URL("/api/generate", process.env.BACKEND_URL);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json() as { error?: string };
    throw new Error(err.error ?? `Generation failed (${response.status})`);
  }
  return response.json() as Promise<GenerateAdResult>;
};

export const enhancePrompt = async (payload: EnhancePromptPayload): Promise<{ prompt: string }> => {
  const url = new URL("/api/claude/enhance-prompt", process.env.BACKEND_URL);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json() as { error?: string };
    throw new Error(err.error ?? `Prompt enhancement failed (${response.status})`);
  }
  return response.json() as Promise<{ prompt: string }>;
};
