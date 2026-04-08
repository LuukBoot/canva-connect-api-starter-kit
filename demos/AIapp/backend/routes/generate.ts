import express from "express";
import { spawnSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { injectClient } from "../../../common/backend/middleware/client";
import { db } from "../database/database";

const router = express.Router();
router.use((req, res, next) => injectClient(req, res, next, db));

// Paths relative to this file (backend/routes/generate.ts):
// routes → backend → AIapp → demos → canva-connect-api-starter-kit → AINovalora root
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const PYTHON_SCRIPT = path.join(REPO_ROOT, "tools", "gemini_image_gen.py");
const WIKI_OUTPUTS = path.join(REPO_ROOT, "wiki-ainovalora", "ad-outputs");

const BRAND_OUTPUT_ENV: Record<string, string> = {
  novalora: "CANVA_FOLDER_NOVALORA_OUTPUT",
  qcollection: "CANVA_FOLDER_QCOLLECTION_OUTPUT",
};

async function downloadCanvaAsset(
  assetId: string,
  token: string,
  outPath: string,
): Promise<void> {
  const baseUrl = process.env.BASE_CANVA_CONNECT_API_URL!;

  const metaResp = await fetch(`${baseUrl}/v1/assets/${assetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaResp.ok) {
    throw new Error(`Asset metadata fetch failed (${metaResp.status}): ${await metaResp.text()}`);
  }

  const meta = (await metaResp.json()) as {
    asset?: { url?: string; download_url?: string };
    url?: string;
    download_url?: string;
  };
  const asset = meta.asset ?? meta;
  const downloadUrl = asset.url ?? asset.download_url;
  if (!downloadUrl) throw new Error(`No download URL for asset ${assetId}`);

  const fileResp = await fetch(downloadUrl);
  if (!fileResp.ok) {
    throw new Error(`CDN download failed for asset ${assetId} (${fileResp.status})`);
  }

  const buffer = Buffer.from(await fileResp.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
}

async function uploadToCanva(
  filePath: string,
  fileName: string,
  folderId: string,
  token: string,
): Promise<string | undefined> {
  const baseUrl = process.env.BASE_CANVA_CONNECT_API_URL!;
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "image/png" });
  const formData = new FormData();
  formData.append("asset", blob, fileName);

  const uploadResp = await fetch(`${baseUrl}/v1/asset-uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Asset-Upload-Metadata": JSON.stringify({
        name_base64: Buffer.from(fileName).toString("base64"),
        parent_folder_id: folderId,
      }),
    },
    body: formData,
  });

  if (!uploadResp.ok) return undefined;

  const job = (await uploadResp.json()) as {
    job?: { id?: string; status?: string; asset?: { id?: string } };
  };

  const jobId = job.job?.id;
  if (!jobId) return job.job?.asset?.id;

  // Poll for async upload
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusResp = await fetch(`${baseUrl}/v1/asset-uploads/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!statusResp.ok) return undefined;
    const status = (await statusResp.json()) as {
      job?: { status?: string; asset?: { id?: string } };
    };
    if (status.job?.status === "success") return status.job.asset?.id;
    if (status.job?.status === "failed" || status.job?.status === "error") return undefined;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// POST /api/generate
// ---------------------------------------------------------------------------

router.post("/api/generate", async (req, res) => {
  // Increase socket timeout to 10 minutes for long generation runs
  req.socket.setTimeout(600_000);

  const {
    brand,
    sessionName,
    productAssetId,
    modelAssetId,
    styleAssetId,
    bottleRefAssetId,
    prompt,
    variations,
  } = req.body as {
    brand: string;
    sessionName: string;
    productAssetId: string;
    modelAssetId?: string;
    styleAssetId?: string;
    bottleRefAssetId?: string;
    prompt: string;
    variations: number;
  };

  if (!brand || !sessionName || !productAssetId || !prompt || !variations) {
    return res.status(400).json({
      error: "Missing required fields: brand, sessionName, productAssetId, prompt, variations",
    });
  }

  const numVariations = Math.min(Math.max(1, Number(variations)), 10);
  const tmpDir = path.join(os.tmpdir(), `aiapp-gen-${randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // ── 1. Download source images from Canva ──────────────────────────
    const productPath = path.join(tmpDir, "product.jpg");
    await downloadCanvaAsset(productAssetId, req.token, productPath);

    let modelPath: string | undefined;
    if (modelAssetId) {
      modelPath = path.join(tmpDir, "model.jpg");
      await downloadCanvaAsset(modelAssetId, req.token, modelPath);
    }

    let stylePath: string | undefined;
    if (styleAssetId) {
      stylePath = path.join(tmpDir, "style.jpg");
      await downloadCanvaAsset(styleAssetId, req.token, stylePath);
    }

    let bottleRefPath: string | undefined;
    if (bottleRefAssetId) {
      bottleRefPath = path.join(tmpDir, "bottle_ref.jpg");
      await downloadCanvaAsset(bottleRefAssetId, req.token, bottleRefPath);
    }

    // ── 2. Create session output folder ───────────────────────────────
    const sessionDir = path.join(WIKI_OUTPUTS, brand, sessionName);
    fs.mkdirSync(sessionDir, { recursive: true });

    const results: {
      name: string;
      localPath: string;
      dataUrl?: string;
      canvaAssetId?: string;
    }[] = [];

    // ── 3. Generate each variation via Python ──────────────────────────
    for (let i = 1; i <= numVariations; i++) {
      const outName = `${brand}-ad-${i}.png`;
      const outPath = path.join(sessionDir, outName);

      const pyArgs = [
        PYTHON_SCRIPT,
        "generate",
        "--product", productPath,
        "--prompt", prompt,
        "--output", outPath,
      ];
      if (modelPath) pyArgs.push("--model", modelPath);
      if (stylePath) pyArgs.push("--style", stylePath);
      if (bottleRefPath) pyArgs.push("--bottle-ref", bottleRefPath);

      const result = spawnSync("python", pyArgs, {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        timeout: 120_000,
      });

      if (result.status !== 0) {
        const errText = result.stderr?.trim() || result.stdout?.trim() || "Unknown Python error";
        // Try to parse JSON error from stderr
        let errorMsg = errText;
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          if (parsed.error) errorMsg = parsed.error;
        } catch {}
        return res.status(500).json({
          error: `Generation failed for variation ${i}: ${errorMsg}`,
        });
      }

      // Read generated image as base64 data URL for inline preview
      let dataUrl: string | undefined;
      if (fs.existsSync(outPath)) {
        const imgBuffer = fs.readFileSync(outPath);
        dataUrl = `data:image/png;base64,${imgBuffer.toString("base64")}`;
      }

      results.push({ name: outName, localPath: outPath, dataUrl });
    }

    // ── 4. Upload to Canva output folder ──────────────────────────────
    const outputEnvVar = BRAND_OUTPUT_ENV[brand];
    const outputFolderId = outputEnvVar ? process.env[outputEnvVar] : undefined;

    if (outputFolderId) {
      for (const img of results) {
        try {
          const assetId = await uploadToCanva(img.localPath, img.name, outputFolderId, req.token);
          if (assetId) img.canvaAssetId = assetId;
        } catch {
          // Upload failure is non-fatal — image is saved locally
        }
      }
    }

    // Strip dataUrl from localPath to keep response clean
    return res.json({
      success: true,
      sessionDir,
      images: results.map(({ name, localPath, dataUrl, canvaAssetId }) => ({
        name,
        localPath,
        dataUrl,
        canvaAssetId,
      })),
    });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});

export default router;
