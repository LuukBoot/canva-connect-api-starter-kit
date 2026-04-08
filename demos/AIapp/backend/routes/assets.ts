import express from "express";
import multer from "multer";
import { injectClient } from "../../../common/backend/middleware/client";
import { db } from "../database/database";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const FOLDER_ENV_MAP: Record<string, string> = {
  // QCollection Parfums (short keys)
  models: "CANVA_FOLDER_QCOLLECTION_MODELS",
  products: "CANVA_FOLDER_QCOLLECTION_PRODUCTS",
  examples: "CANVA_FOLDER_QCOLLECTION_EXAMPLES",
  bottle_refs: "CANVA_FOLDER_QCOLLECTION_BOTTLE_REFS",
  output: "CANVA_FOLDER_QCOLLECTION_OUTPUT",
  video_examples: "CANVA_FOLDER_QCOLLECTION_VIDEO_EXAMPLES",
  video_output: "CANVA_FOLDER_QCOLLECTION_VIDEO_OUTPUT",
  // QCollection Parfums (full prefix aliases)
  "qcollection-models": "CANVA_FOLDER_QCOLLECTION_MODELS",
  "qcollection-products": "CANVA_FOLDER_QCOLLECTION_PRODUCTS",
  "qcollection-examples": "CANVA_FOLDER_QCOLLECTION_EXAMPLES",
  "qcollection-bottle_refs": "CANVA_FOLDER_QCOLLECTION_BOTTLE_REFS",
  "qcollection-output": "CANVA_FOLDER_QCOLLECTION_OUTPUT",
  "qcollection-video_examples": "CANVA_FOLDER_QCOLLECTION_VIDEO_EXAMPLES",
  "qcollection-video_output": "CANVA_FOLDER_QCOLLECTION_VIDEO_OUTPUT",
  // Novalora
  "novalora-models": "CANVA_FOLDER_NOVALORA_MODELS",
  "novalora-products": "CANVA_FOLDER_NOVALORA_PRODUCTS",
  "novalora-examples": "CANVA_FOLDER_NOVALORA_EXAMPLES",
  "novalora-bottle_refs": "CANVA_FOLDER_NOVALORA_BOTTLE_REFS",
  "novalora-output": "CANVA_FOLDER_NOVALORA_OUTPUT",
  "novalora-video_examples": "CANVA_FOLDER_NOVALORA_VIDEO_EXAMPLES",
  "novalora-video_output": "CANVA_FOLDER_NOVALORA_VIDEO_OUTPUT",
};

export const FOLDER_KEYS = Object.keys(FOLDER_ENV_MAP);

// ---------------------------------------------------------------------------
// GET /api/folders  — list configured named folders with status (no auth needed)
// Registered BEFORE the auth middleware so it works without a Canva session.
// ---------------------------------------------------------------------------

router.get("/api/folders", (_req, res) => {
  const seen = new Set<string>();
  const folders = FOLDER_KEYS
    .filter((key) => {
      const envVar = FOLDER_ENV_MAP[key];
      if (seen.has(envVar)) return false;
      seen.add(envVar);
      return true;
    })
    .map((key) => ({
      key,
      envVar: FOLDER_ENV_MAP[key],
      configured: Boolean(process.env[FOLDER_ENV_MAP[key]]),
    }));
  return res.json({ folders });
});

// All routes below require a valid Canva OAuth session
router.use((req, res, next) => injectClient(req, res, next, db));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Canva folder items API response types
type CanvaFolderItem =
  | { type: "image"; image: { id: string; name: string; thumbnail?: { url: string; width: number; height: number }; created_at?: number; updated_at?: number } }
  | { type: "folder"; folder: { id: string; name: string; created_at?: number; updated_at?: number } }
  | { type: "design"; design: { id: string; title?: string; thumbnail?: { url: string; width: number; height: number }; created_at?: number; updated_at?: number } };

// Normalize a Canva folder item into a flat asset shape the frontend expects
function normalizeItem(item: CanvaFolderItem): Record<string, unknown> {
  if (item.type === "image") {
    return {
      id: item.image.id,
      name: item.image.name,
      type: "IMAGE",
      thumbnail: item.image.thumbnail,
      created_at: item.image.created_at,
      updated_at: item.image.updated_at,
    };
  }
  if (item.type === "folder") {
    return {
      id: item.folder.id,
      name: item.folder.name,
      type: "FOLDER",
      created_at: item.folder.created_at,
      updated_at: item.folder.updated_at,
    };
  }
  // design
  return {
    id: item.design.id,
    name: item.design.title ?? item.design.id,
    type: "DESIGN",
    thumbnail: item.design.thumbnail,
    created_at: item.design.created_at,
    updated_at: item.design.updated_at,
  };
}

async function listAssetsByFolderId(
  folderId: string,
  token: string,
  typeFilter?: string
): Promise<Record<string, unknown>[]> {
  const baseUrl = process.env.BASE_CANVA_CONNECT_API_URL;
  const items: Record<string, unknown>[] = [];
  let continuation: string | undefined;

  do {
    // Correct Canva API endpoint: GET /v1/folders/{folderId}/items
    const url = new URL(`${baseUrl}/v1/folders/${folderId}/items`);
    url.searchParams.set("limit", "100");
    if (continuation) url.searchParams.set("continuation", continuation);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw Object.assign(new Error(await response.text()), {
        status: response.status,
      });
    }

    const data = (await response.json()) as {
      items?: CanvaFolderItem[];
      continuation?: string;
    };

    const batch = (data.items ?? []).map(normalizeItem);
    const filtered = typeFilter
      ? batch.filter((i) => (i.type as string) === typeFilter.toUpperCase())
      : batch;
    items.push(...filtered);
    continuation = data.continuation;
  } while (continuation);

  return items;
}

// ---------------------------------------------------------------------------
// GET /api/assets/folder/:folderId  — list by raw folder ID
// MUST be registered before /api/assets/:folderKey to avoid "folder" matching
// as a folderKey.
// ---------------------------------------------------------------------------

router.get("/api/assets/folder/:folderId", async (req, res) => {
  const { folderId } = req.params;
  const typeFilter = req.query.type as string | undefined;

  try {
    const items = await listAssetsByFolderId(folderId, req.token, typeFilter);
    return res.json({ items, folderId });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/assets/:folderKey  — list by named folder key
// ---------------------------------------------------------------------------

router.get("/api/assets/:folderKey", async (req, res) => {
  const { folderKey } = req.params;
  const envVar = FOLDER_ENV_MAP[folderKey];

  if (!envVar) {
    return res.status(400).json({ error: `Unknown folder key: ${folderKey}` });
  }

  const folderId = process.env[envVar];
  if (!folderId) {
    return res.status(200).json({
      items: [],
      folderKey,
      warning: `Folder ID not configured (${envVar} is empty)`,
    });
  }

  try {
    const items = await listAssetsByFolderId(folderId, req.token);
    return res.json({ items, folderKey });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/download/:assetId  — download asset file
// ---------------------------------------------------------------------------

router.get("/api/download/:assetId", async (req, res) => {
  const { assetId } = req.params;
  const baseUrl = process.env.BASE_CANVA_CONNECT_API_URL;

  // Fetch asset metadata to get the presigned download URL
  const metaResp = await fetch(`${baseUrl}/v1/assets/${assetId}`, {
    headers: { Authorization: `Bearer ${req.token}` },
  });
  if (!metaResp.ok) {
    return res
      .status(metaResp.status)
      .json({ error: await metaResp.text() });
  }

  const meta = (await metaResp.json()) as {
    asset?: { name?: string; url?: string; download_url?: string };
    name?: string;
    url?: string;
    download_url?: string;
  };
  const asset = meta.asset ?? meta;
  const downloadUrl = asset.url ?? asset.download_url;
  const name = asset.name ?? assetId;

  if (!downloadUrl) {
    return res.status(404).json({ error: "No download URL found for asset" });
  }

  // Presigned URLs don't require auth headers
  const fileResp = await fetch(downloadUrl);
  if (!fileResp.ok) {
    return res
      .status(fileResp.status)
      .json({ error: "Download from Canva CDN failed" });
  }

  const contentType =
    fileResp.headers.get("content-type") ?? "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);

  const buffer = Buffer.from(await fileResp.arrayBuffer());
  return res.send(buffer);
});

// ---------------------------------------------------------------------------
// POST /api/upload  — upload file to a Canva asset folder
// Body: multipart/form-data with fields: file (file), folder_id (string)
// ---------------------------------------------------------------------------

router.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided (field name: file)" });
  }
  const body = req.body as { folder_id?: string; folder_key?: string };
  let folderId = body.folder_id;
  if (!folderId && body.folder_key) {
    const envVar = FOLDER_ENV_MAP[body.folder_key];
    if (!envVar) {
      return res.status(400).json({ error: `Unknown folder_key: ${body.folder_key}` });
    }
    folderId = process.env[envVar];
    if (!folderId) {
      return res.status(400).json({
        error: `Folder not configured (${envVar} is empty in AIapp .env)`,
      });
    }
  }
  if (!folderId) {
    return res.status(400).json({ error: "Either folder_id or folder_key is required" });
  }

  const baseUrl = process.env.BASE_CANVA_CONNECT_API_URL;
  const filename = req.file.originalname;
  const nameBase64 = Buffer.from(filename).toString("base64");
  const mimeType = req.file.mimetype;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(req.file.buffer)], { type: mimeType });
  formData.append("asset", blob, filename);

  const uploadResp = await fetch(`${baseUrl}/v1/asset-uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${req.token}`,
      "Asset-Upload-Metadata": JSON.stringify({
        name_base64: nameBase64,
        parent_folder_id: folderId,
      }),
    },
    body: formData,
  });

  if (!uploadResp.ok) {
    return res
      .status(uploadResp.status)
      .json({ error: await uploadResp.text() });
  }

  const job = (await uploadResp.json()) as {
    job?: { id?: string; status?: string; asset?: { id?: string; name?: string } };
    id?: string;
    asset?: { id?: string; name?: string };
  };

  const jobId = job.job?.id ?? job.id;

  // Synchronous upload — asset returned immediately
  if (!jobId) {
    const asset = job.job?.asset ?? job.asset ?? {};
    return res.json({
      asset_id: asset.id,
      name: asset.name ?? filename,
    });
  }

  // Async upload — poll until complete (max 120 s)
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResp = await fetch(`${baseUrl}/v1/asset-uploads/${jobId}`, {
      headers: { Authorization: `Bearer ${req.token}` },
    });
    if (!statusResp.ok) {
      return res
        .status(statusResp.status)
        .json({ error: await statusResp.text() });
    }

    const status = (await statusResp.json()) as {
      job?: { status?: string; asset?: { id?: string; name?: string } };
    };
    const jobStatus = status.job?.status;

    if (jobStatus === "success") {
      const asset = status.job?.asset ?? {};
      return res.json({ asset_id: asset.id, name: asset.name ?? filename });
    }
    if (jobStatus === "failed" || jobStatus === "error") {
      return res
        .status(500)
        .json({ error: "Upload job failed", details: status });
    }
  }

  return res.status(504).json({ error: "Upload timed out after 120 seconds" });
});

// ---------------------------------------------------------------------------
// GET /api/asset-info/:assetId  — asset metadata
// ---------------------------------------------------------------------------

router.get("/api/asset-info/:assetId", async (req, res) => {
  const { assetId } = req.params;
  const baseUrl = process.env.BASE_CANVA_CONNECT_API_URL;

  const response = await fetch(`${baseUrl}/v1/assets/${assetId}`, {
    headers: { Authorization: `Bearer ${req.token}` },
  });
  if (!response.ok) {
    return res.status(response.status).json({ error: await response.text() });
  }
  const data = (await response.json()) as { asset?: unknown };
  return res.json(data.asset ?? data);
});

// ---------------------------------------------------------------------------
// Helper: list folders inside a given parent folder ID using correct API
// ---------------------------------------------------------------------------

async function listFoldersInFolder(
  parentFolderId: string,
  token: string,
): Promise<{ id: string; name: string }[]> {
  const baseUrl = process.env.BASE_CANVA_CONNECT_API_URL;
  const folders: { id: string; name: string }[] = [];
  let continuation: string | undefined;

  do {
    // Correct Canva API endpoint: GET /v1/folders/{folderId}/items
    const url = new URL(`${baseUrl}/v1/folders/${parentFolderId}/items`);
    url.searchParams.set("item_types", "folder");
    url.searchParams.set("limit", "100");
    if (continuation) url.searchParams.set("continuation", continuation);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw Object.assign(new Error(await response.text()), { status: response.status });
    }
    const data = (await response.json()) as {
      items?: Array<{ type: string; folder?: { id: string; name: string } }>;
      continuation?: string;
    };
    for (const item of data.items ?? []) {
      if (item.type === "folder" && item.folder) {
        folders.push({ id: item.folder.id, name: item.folder.name });
      }
    }
    continuation = data.continuation;
  } while (continuation);

  return folders;
}

// ---------------------------------------------------------------------------
// GET /api/canva-folders  — list all root-level folders in workspace
// ---------------------------------------------------------------------------

router.get("/api/canva-folders", async (req, res) => {
  try {
    // "root" is the special ID for the Canva workspace root
    const folders = await listFoldersInFolder("root", req.token);
    return res.json({ folders });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/canva-folders/:folderId  — list subfolders inside a specific folder
// ---------------------------------------------------------------------------

router.get("/api/canva-folders/:folderId", async (req, res) => {
  try {
    const folders = await listFoldersInFolder(req.params.folderId, req.token);
    return res.json({ folders });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return res.status(e.status ?? 500).json({ error: e.message });
  }
});


export default router;
