import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Slider,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DownloadIcon from "@mui/icons-material/Download";
import { ImagePickerGrid } from "../components/ImagePickerGrid";
import {
  listAssets,
  generateAd,
  enhancePrompt,
  type CanvaAsset,
  type GenerateAdPayload,
  type GenerateAdResult,
} from "../services/api";

// ─── Types ──────────────────────────────────────────────────────────────────

type Brand = "novalora" | "qcollection";

type ImageSelections = {
  product: CanvaAsset | null;
  model: CanvaAsset | null;
  style: CanvaAsset | null;
  bottleRef: CanvaAsset | null;
};

type FolderAssets = Record<string, CanvaAsset[]>;
type FolderLoading = Record<string, boolean>;

// ─── Brand folder key helpers ─────────────────────────────────────────────

function folderKey(brand: Brand, suffix: string): string {
  return brand === "novalora" ? `novalora-${suffix}` : suffix;
}

// ─── Step labels ─────────────────────────────────────────────────────────

const STEPS = ["Select Brand", "Choose Images", "Creative Brief", "Generate"];

// ─── Component ───────────────────────────────────────────────────────────

export const AdCreatorPage = () => {
  const [activeStep, setActiveStep] = useState(0);

  // Step 1
  const [brand, setBrand] = useState<Brand | null>(null);

  // Step 2
  const [folderAssets, setFolderAssets] = useState<FolderAssets>({});
  const [folderLoading, setFolderLoading] = useState<FolderLoading>({});
  const [selections, setSelections] = useState<ImageSelections>({
    product: null,
    model: null,
    style: null,
    bottleRef: null,
  });

  // Step 3
  const [sessionName, setSessionName] = useState("");
  const [description, setDescription] = useState("");
  const [variations, setVariations] = useState(3);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  // Step 4
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<GenerateAdResult | null>(null);

  // Step 2 load error
  const [loadError, setLoadError] = useState<string | null>(null);
  const [folderWarnings, setFolderWarnings] = useState<Record<string, string>>({});

  // ── Load images when brand is set ─────────────────────────────────────
  useEffect(() => {
    if (!brand) return;
    setLoadError(null);
    setFolderWarnings({});

    const keys = ["products", "models", "examples", "bottle_refs"];
    keys.forEach(async (suffix) => {
      const key = folderKey(brand, suffix);
      setFolderLoading((prev) => ({ ...prev, [suffix]: true }));
      try {
        const result = await listAssets(key);
        setFolderAssets((prev) => ({ ...prev, [suffix]: result.items }));
        if (result.warning) {
          setFolderWarnings((prev) => ({ ...prev, [suffix]: result.warning! }));
        }
      } catch (err: unknown) {
        const msg = (err as Error).message ?? "Unknown error";
        setFolderAssets((prev) => ({ ...prev, [suffix]: [] }));
        setLoadError(`${msg}`);
      } finally {
        setFolderLoading((prev) => ({ ...prev, [suffix]: false }));
      }
    });

    // Reset selections when brand changes
    setSelections({ product: null, model: null, style: null, bottleRef: null });
  }, [brand]);

  // ── Navigation ────────────────────────────────────────────────────────
  const handleSelectBrand = (b: Brand) => {
    setBrand(b);
    setActiveStep(1);
  };

  const canProceedFromImages = Boolean(selections.product);

  const handleEnhancePrompt = async () => {
    if (!brand || !description) return;
    setEnhancing(true);
    setEnhanceError(null);
    try {
      const result = await enhancePrompt({
        brand,
        description,
        hasModel: Boolean(selections.model),
        hasStyle: Boolean(selections.style),
      });
      setDescription(result.prompt);
    } catch (err: unknown) {
      setEnhanceError((err as Error).message ?? "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  };

  const canProceedFromBrief =
    sessionName.trim().length > 0 && description.trim().length > 0;

  const handleGenerate = async () => {
    if (!brand || !selections.product) return;
    setGenerating(true);
    setGenError(null);
    setGenResult(null);

    const payload: GenerateAdPayload = {
      brand,
      sessionName: sessionName.trim(),
      productAssetId: selections.product.id,
      modelAssetId: selections.model?.id,
      styleAssetId: selections.style?.id,
      bottleRefAssetId: selections.bottleRef?.id,
      prompt: description.trim(),
      variations,
    };

    try {
      const result = await generateAd(payload);
      setGenResult(result);
    } catch (err: unknown) {
      setGenError((err as Error).message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setBrand(null);
    setSelections({ product: null, model: null, style: null, bottleRef: null });
    setSessionName("");
    setDescription("");
    setVariations(3);
    setGenResult(null);
    setGenError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h4" fontWeight={700} mb={0.5}>
        Ad Creator
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Generate Gemini-powered ad images from your Canva assets
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* ── Step 0: Brand selection ── */}
      {activeStep === 0 && (
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} sm={5}>
            <BrandCard
              name="Novalora"
              description="Hormone-free lash serum · Rose-gold bottle · Soft feminine aesthetic"
              color="#c9a96e"
              onClick={() => handleSelectBrand("novalora")}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <BrandCard
              name="QCollection Parfums"
              description="Designer-inspired fragrances · Dark luxury bottle · Bold editorial style"
              color="#2c2c3e"
              onClick={() => handleSelectBrand("qcollection")}
            />
          </Grid>
        </Grid>
      )}

      {/* ── Step 1: Image selection ── */}
      {activeStep === 1 && brand && (
        <Box>
          {loadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {loadError}
            </Alert>
          )}
          <ImageSection
            label="Product Image"
            required
            assets={folderAssets["products"] ?? []}
            loading={folderLoading["products"] ?? true}
            selected={selections.product}
            onSelect={(a) => setSelections((s) => ({ ...s, product: a }))}
            tip="The main product that will be featured in the ad."
            warning={folderWarnings["products"]}
          />
          <ImageSection
            label="Model Image"
            assets={folderAssets["models"] ?? []}
            loading={folderLoading["models"] ?? true}
            selected={selections.model}
            onSelect={(a) => setSelections((s) => ({ ...s, model: a }))}
            tip="Optional. A person/model wearing or using the product."
            warning={folderWarnings["models"]}
          />
          <ImageSection
            label="Style / Example"
            assets={folderAssets["examples"] ?? []}
            loading={folderLoading["examples"] ?? true}
            selected={selections.style}
            onSelect={(a) => setSelections((s) => ({ ...s, style: a }))}
            tip="Optional. A reference image for the visual style or mood."
            warning={folderWarnings["examples"]}
          />
          <ImageSection
            label="Bottle Reference"
            assets={folderAssets["bottle_refs"] ?? []}
            loading={folderLoading["bottle_refs"] ?? true}
            selected={selections.bottleRef}
            onSelect={(a) => setSelections((s) => ({ ...s, bottleRef: a }))}
            tip="Optional. A precise bottle/packaging reference photo."
            warning={folderWarnings["bottle_refs"]}
          />

          <Box display="flex" gap={2} mt={3}>
            <Button variant="outlined" onClick={() => setActiveStep(0)}>
              Back
            </Button>
            <Button
              variant="contained"
              disabled={!canProceedFromImages}
              onClick={() => setActiveStep(2)}
            >
              Next — Creative Brief
            </Button>
          </Box>

          {!canProceedFromImages && (
            <Typography variant="caption" color="text.secondary" mt={1} display="block">
              Select a product image to continue.
            </Typography>
          )}
        </Box>
      )}

      {/* ── Step 2: Creative brief ── */}
      {activeStep === 2 && brand && (
        <Box>
          <SelectionSummary selections={selections} />
          <Divider sx={{ my: 3 }} />

          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              label="Session Name"
              placeholder="spring-lash-hero"
              value={sessionName}
              onChange={(e) =>
                setSessionName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              helperText="Short slug used for the output folder (e.g. spring-lash-hero)"
              fullWidth
            />

            <Box>
              <TextField
                label="Creative Description"
                placeholder="A close-up of the lash serum bottle on a marble surface, soft morning light, dewy and fresh..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                minRows={4}
                fullWidth
                helperText="Describe the ad you want to create. Be specific about mood, setting, and composition."
              />
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    enhancing ? <CircularProgress size={14} /> : <AutoAwesomeIcon />
                  }
                  onClick={handleEnhancePrompt}
                  disabled={enhancing || !description.trim()}
                >
                  {enhancing ? "Enhancing…" : "Enhance with AI"}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Rewrites your description into a detailed Gemini prompt
                </Typography>
              </Box>
              {enhanceError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {enhanceError}
                </Alert>
              )}
            </Box>

            <Box>
              <Typography gutterBottom>
                Variations:{" "}
                <strong>{variations}</strong>
              </Typography>
              <Slider
                value={variations}
                onChange={(_, v) => setVariations(v as number)}
                min={1}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                sx={{ maxWidth: 300 }}
              />
            </Box>
          </Box>

          <Box display="flex" gap={2} mt={4}>
            <Button variant="outlined" onClick={() => setActiveStep(1)}>
              Back
            </Button>
            <Button
              variant="contained"
              disabled={!canProceedFromBrief}
              onClick={() => setActiveStep(3)}
            >
              Next — Generate
            </Button>
          </Box>
        </Box>
      )}

      {/* ── Step 3: Generate ── */}
      {activeStep === 3 && brand && selections.product && (
        <Box>
          <GenerateSummary
            brand={brand}
            selections={selections}
            sessionName={sessionName}
            prompt={description}
            variations={variations}
          />
          <Divider sx={{ my: 3 }} />

          {!generating && !genResult && !genError && (
            <Box display="flex" gap={2}>
              <Button variant="outlined" onClick={() => setActiveStep(2)}>
                Back
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleGenerate}
                startIcon={<AutoAwesomeIcon />}
              >
                Generate {variations} Ad{variations !== 1 ? "s" : ""}
              </Button>
            </Box>
          )}

          {generating && (
            <Box display="flex" alignItems="center" gap={2} py={3}>
              <CircularProgress />
              <Box>
                <Typography fontWeight={600}>Generating your ads…</Typography>
                <Typography variant="body2" color="text.secondary">
                  Calling Gemini AI — this takes ~20–40 seconds per variation.
                </Typography>
              </Box>
            </Box>
          )}

          {genError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {genError}
            </Alert>
          )}

          {genResult && (
            <Box>
              <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 3 }}>
                Generated {genResult.images.length} image
                {genResult.images.length !== 1 ? "s" : ""} — saved to{" "}
                <code>{genResult.sessionDir}</code>
              </Alert>

              <Grid container spacing={2}>
                {genResult.images.map((img) => (
                  <Grid item xs={12} sm={6} md={4} key={img.name}>
                    <GeneratedImageCard img={img} />
                  </Grid>
                ))}
              </Grid>

              <Box mt={3}>
                <Button variant="outlined" onClick={handleReset}>
                  Create Another Ad
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────

const BrandCard = ({
  name,
  description,
  color,
  onClick,
}: {
  name: string;
  description: string;
  color: string;
  onClick: () => void;
}) => (
  <Card
    variant="outlined"
    sx={{
      borderRadius: 2,
      transition: "box-shadow 0.15s",
      "&:hover": { boxShadow: 4 },
    }}
  >
    <CardActionArea onClick={onClick} sx={{ p: 0 }}>
      <Box sx={{ height: 8, bgcolor: color, borderRadius: "8px 8px 0 0" }} />
      <CardContent sx={{ pt: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {description}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

const ImageSection = ({
  label,
  required,
  assets,
  loading,
  selected,
  onSelect,
  tip,
  warning,
}: {
  label: string;
  required?: boolean;
  assets: CanvaAsset[];
  loading: boolean;
  selected: CanvaAsset | null;
  onSelect: (a: CanvaAsset | null) => void;
  tip?: string;
  warning?: string;
}) => (
  <Accordion defaultExpanded={required} sx={{ mb: 1 }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Box display="flex" alignItems="center" gap={1.5}>
        <Typography fontWeight={600}>{label}</Typography>
        {required && (
          <Chip label="Required" size="small" color="primary" variant="outlined" />
        )}
        {!required && (
          <Chip label="Optional" size="small" variant="outlined" />
        )}
        {selected && (
          <Chip
            icon={<CheckCircleOutlineIcon />}
            label={selected.name}
            size="small"
            color="success"
            variant="outlined"
            sx={{ maxWidth: 200 }}
          />
        )}
        {tip && (
          <Tooltip title={tip} placement="right">
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 0.5, cursor: "help", display: { xs: "none", md: "block" } }}
            >
              {tip}
            </Typography>
          </Tooltip>
        )}
      </Box>
    </AccordionSummary>
    <AccordionDetails>
      {warning && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {warning}
        </Alert>
      )}
      <ImagePickerGrid
        assets={assets}
        selectedId={selected?.id ?? null}
        onSelect={onSelect}
        loading={loading}
        emptyMessage="No images found for this folder."
      />
    </AccordionDetails>
  </Accordion>
);

const SelectionSummary = ({ selections }: { selections: ImageSelections }) => (
  <Box>
    <Typography variant="subtitle2" color="text.secondary" mb={1}>
      Selected images
    </Typography>
    <Box display="flex" gap={1} flexWrap="wrap">
      {selections.product && (
        <Chip label={`Product: ${selections.product.name}`} size="small" color="primary" />
      )}
      {selections.model && (
        <Chip label={`Model: ${selections.model.name}`} size="small" />
      )}
      {selections.style && (
        <Chip label={`Style: ${selections.style.name}`} size="small" />
      )}
      {selections.bottleRef && (
        <Chip label={`Bottle Ref: ${selections.bottleRef.name}`} size="small" />
      )}
    </Box>
  </Box>
);

const GenerateSummary = ({
  brand,
  selections,
  sessionName,
  prompt,
  variations,
}: {
  brand: Brand;
  selections: ImageSelections;
  sessionName: string;
  prompt: string;
  variations: number;
}) => (
  <Box display="flex" flexDirection="column" gap={1.5}>
    <Box display="flex" gap={2} flexWrap="wrap">
      <Box>
        <Typography variant="caption" color="text.secondary">Brand</Typography>
        <Typography fontWeight={600}>{brand === "novalora" ? "Novalora" : "QCollection Parfums"}</Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Session</Typography>
        <Typography fontWeight={600}>{sessionName}</Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Variations</Typography>
        <Typography fontWeight={600}>{variations}</Typography>
      </Box>
    </Box>
    <Box display="flex" gap={1} flexWrap="wrap">
      {selections.product && <Chip label={`Product: ${selections.product.name}`} size="small" color="primary" />}
      {selections.model && <Chip label={`Model: ${selections.model.name}`} size="small" />}
      {selections.style && <Chip label={`Style: ${selections.style.name}`} size="small" />}
      {selections.bottleRef && <Chip label={`Bottle Ref: ${selections.bottleRef.name}`} size="small" />}
    </Box>
    <Box>
      <Typography variant="caption" color="text.secondary">Prompt</Typography>
      <Typography
        variant="body2"
        sx={{
          mt: 0.25,
          p: 1.5,
          bgcolor: "grey.50",
          borderRadius: 1,
          fontFamily: "monospace",
          fontSize: "0.78rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {prompt}
      </Typography>
    </Box>
  </Box>
);

const GeneratedImageCard = ({
  img,
}: {
  img: GenerateAdResult["images"][number];
}) => (
  <Box
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      overflow: "hidden",
    }}
  >
    {img.dataUrl && (
      <Box
        component="img"
        src={img.dataUrl}
        alt={img.name}
        sx={{ width: "100%", display: "block" }}
      />
    )}
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px={1.5}
      py={1}
    >
      <Typography variant="caption" fontWeight={600} noWrap>
        {img.name}
      </Typography>
      {img.dataUrl && (
        <Tooltip title="Download">
          <Button
            size="small"
            component="a"
            href={img.dataUrl}
            download={img.name}
            startIcon={<DownloadIcon />}
            sx={{ minWidth: 0 }}
          >
            Save
          </Button>
        </Tooltip>
      )}
    </Box>
    {img.canvaAssetId && (
      <Box px={1.5} pb={1}>
        <Chip label="Uploaded to Canva" size="small" color="success" variant="outlined" />
      </Box>
    )}
  </Box>
);
