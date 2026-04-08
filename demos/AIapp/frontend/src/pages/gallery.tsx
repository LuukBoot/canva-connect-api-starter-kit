import React, { useEffect, useState, useCallback } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Link,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageIcon from "@mui/icons-material/Image";
import VideocamIcon from "@mui/icons-material/Videocam";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  listAssets,
  listAllFolders,
  type AssetListResult,
  type FolderInfo,
  AVAILABLE_FOLDER_KEYS,
} from "../services/api";
import { revokeAuthorization } from "../services/auth";

type GalleryPageProps = {
  onDisconnected: () => void;
};

const FOLDER_LABELS: Record<string, string> = {
  models: "Models",
  products: "Products",
  examples: "Examples",
  bottle_refs: "Bottle References",
  output: "Output",
  video_examples: "Video Examples",
  video_output: "Video Output",
};

export const GalleryPage = ({ onDisconnected }: GalleryPageProps) => {
  const [results, setResults] = useState<Record<string, AssetListResult>>({});
  const [folderInfo, setFolderInfo] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [folders, ...assetResults] = await Promise.all([
        listAllFolders(),
        ...AVAILABLE_FOLDER_KEYS.map((key) => listAssets(key)),
      ]);
      setFolderInfo(folders);
      const map: Record<string, AssetListResult> = {};
      AVAILABLE_FOLDER_KEYS.forEach((key, i) => {
        map[key] = assetResults[i];
      });
      setResults(map);
    } catch (err) {
      console.error("Failed to fetch assets", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await revokeAuthorization();
    onDisconnected();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading assets…</Typography>
      </Box>
    );
  }

  const totalImages = Object.values(results).reduce(
    (sum, r) => sum + r.items.filter((a: any) => a.type === "IMAGE").length,
    0,
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", py: 4, px: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            QCollection Asset Browser
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totalImages} images across {AVAILABLE_FOLDER_KEYS.length} folders
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={fetchAll}>
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? <CircularProgress size={20} /> : "Disconnect"}
          </Button>
        </Box>
      </Box>

      {AVAILABLE_FOLDER_KEYS.map((key) => {
        const result = results[key];
        const info = folderInfo.find((f) => f.key === key);
        const label = FOLDER_LABELS[key] ?? key;
        const images = result?.items.filter((a: any) => a.type === "IMAGE") ?? [];
        const videos = result?.items.filter((a: any) => a.type === "VIDEO") ?? [];

        return (
          <Accordion key={key} defaultExpanded={images.length > 0} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={2} width="100%">
                <Typography fontWeight={600}>{label}</Typography>
                {info && !info.configured && (
                  <Chip
                    icon={<WarningAmberIcon />}
                    label="Not configured"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
                {images.length > 0 && (
                  <Chip
                    icon={<ImageIcon />}
                    label={`${images.length} image${images.length !== 1 ? "s" : ""}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
                {videos.length > 0 && (
                  <Chip
                    icon={<VideocamIcon />}
                    label={`${videos.length} video${videos.length !== 1 ? "s" : ""}`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {result?.warning && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {result.warning}
                </Typography>
              )}
              {result?.items.length === 0 && !result?.warning && (
                <Typography variant="body2" color="text.secondary">
                  No assets found in this folder.
                </Typography>
              )}
              {result?.items.length > 0 && (
                <Grid container spacing={2}>
                  {(result.items as any[]).map((asset) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                      <AssetCard asset={asset} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

const AssetCard = ({ asset }: { asset: any }) => {
  const isVideo = asset.type === "VIDEO";
  const canvaUrl = `https://www.canva.com/design/${asset.id}`;
  const hasThumbnail = Boolean(asset.thumbnail?.url);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, height: "100%", display: "flex", flexDirection: "column", gap: 1 }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "4/3",
          bgcolor: "#f0f0f0",
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {hasThumbnail ? (
          <img
            src={asset.thumbnail.url}
            alt={asset.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box display="flex" flexDirection="column" alignItems="center" color="text.secondary">
            {isVideo ? <VideocamIcon fontSize="large" /> : <ImageIcon fontSize="large" />}
            <Typography variant="caption">{isVideo ? "Video" : "Image"}</Typography>
          </Box>
        )}
      </Box>

      <Tooltip title={asset.name} placement="top">
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {asset.name}
        </Typography>
      </Tooltip>

      <Divider />

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Chip label={asset.type} size="small" variant="outlined" />
        <Link href={canvaUrl} target="_blank" rel="noopener" variant="caption">
          Open in Canva
        </Link>
      </Box>
    </Paper>
  );
};
