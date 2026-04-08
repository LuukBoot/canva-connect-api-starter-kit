import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

const BRAND_CONTEXT: Record<string, string> = {
  novalora: `
Novalora is a cosmetics brand. Hero product: hormone-free lash serum for sensitive-eye users.
Positioned as a sustainable daily routine alternative to mascara/extensions. ~4-week visible results.
Rose-gold bottle. Soft cream, off-white, and pale pink color palette. Premium but approachable.
Ad tone: clean, soft, feminine, aspirational. Focus on natural beauty and daily skincare routine.
  `.trim(),
  qcollection: `
QCollection Parfums is a Dutch DTC fragrance brand (founded 2023). Designer-inspired perfumes at accessible prices (~€27).
Dark luxury bottle: 10cm height, 4cm body diameter, 3cm cap, 2.8cm cap diameter.
Meta/social-first, premium dark aesthetic with direct-response selling.
Ad tone: dark, luxurious, editorial, bold. Cinematic lighting, deep shadows, moody atmosphere.
  `.trim(),
};

// ---------------------------------------------------------------------------
// POST /api/claude/enhance-prompt
// ---------------------------------------------------------------------------

router.post("/api/claude/enhance-prompt", async (req, res) => {
  const { brand, description, hasModel, hasStyle } = req.body as {
    brand: string;
    description: string;
    hasModel?: boolean;
    hasStyle?: boolean;
  };

  if (!brand || !description) {
    return res.status(400).json({ error: "Missing required fields: brand, description" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured in .env" });
  }

  const brandContext = BRAND_CONTEXT[brand] ?? `Brand: ${brand}`;

  const referenceImages = [
    hasModel ? "a photo of a model/person wearing or using the product" : null,
    hasStyle ? "a style/mood reference image" : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const systemPrompt = [
    "You are an expert ad creative director specializing in Gemini AI image generation prompts.",
    "You write highly specific, vivid prompts that produce compelling product ad images.",
    "",
    "Brand context:",
    brandContext,
    "",
    referenceImages
      ? `The generation pipeline also includes ${referenceImages} as visual references — mention how they should influence the result.`
      : "",
    "",
    "Your prompt should be 3–5 sentences. Be specific about:",
    "- Visual composition (foreground/background, framing)",
    "- Lighting (soft, harsh, rim, studio, natural, etc.)",
    "- Color palette and mood",
    "- How the product is positioned and presented",
    "- The overall feel and emotion the ad should convey",
    "",
    "Return ONLY the prompt text. No introduction, no explanation, no quotes.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write a Gemini image generation prompt for this ad concept:\n\n${description}`,
        },
      ],
    });

    const text =
      message.content[0]?.type === "text" ? message.content[0].text.trim() : "";

    return res.json({ prompt: text });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return res.status(e.status ?? 500).json({
      error: `Claude API error: ${e.message ?? "Unknown error"}`,
    });
  }
});

export default router;
