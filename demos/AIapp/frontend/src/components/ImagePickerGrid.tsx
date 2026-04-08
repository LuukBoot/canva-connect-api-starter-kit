import React from "react";
import {
  Box,
  Grid,
  Paper,
  Tooltip,
  Typography,
  CircularProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ImageIcon from "@mui/icons-material/Image";
import type { CanvaAsset } from "../services/api";

type ImagePickerGridProps = {
  assets: CanvaAsset[];
  selectedId: string | null;
  onSelect: (asset: CanvaAsset | null) => void;
  loading?: boolean;
  emptyMessage?: string;
};

export const ImagePickerGrid = ({
  assets,
  selectedId,
  onSelect,
  loading = false,
  emptyMessage = "No images found.",
}: ImagePickerGridProps) => {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const images = assets.filter((a) => a.type === "IMAGE");

  if (images.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Grid container spacing={1.5}>
      {images.map((asset) => {
        const isSelected = asset.id === selectedId;
        const hasThumbnail = Boolean(asset.thumbnail?.url);

        return (
          <Grid item xs={6} sm={4} md={3} key={asset.id}>
            <Paper
              variant="outlined"
              onClick={() => onSelect(isSelected ? null : asset)}
              sx={{
                cursor: "pointer",
                position: "relative",
                border: isSelected ? "2px solid" : "1px solid",
                borderColor: isSelected ? "primary.main" : "divider",
                borderRadius: 1.5,
                overflow: "hidden",
                transition: "box-shadow 0.15s, border-color 0.15s",
                "&:hover": {
                  boxShadow: 3,
                  borderColor: "primary.light",
                },
              }}
            >
              {/* Thumbnail */}
              <Box
                sx={{
                  width: "100%",
                  aspectRatio: "1/1",
                  bgcolor: "#f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {hasThumbnail ? (
                  <img
                    src={asset.thumbnail!.url}
                    alt={asset.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <ImageIcon fontSize="large" sx={{ color: "text.disabled" }} />
                )}
              </Box>

              {/* Selection overlay */}
              {isSelected && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    bgcolor: "rgba(123, 47, 190, 0.15)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                    p: 0.5,
                  }}
                >
                  <CheckCircleIcon sx={{ color: "primary.main", fontSize: 22 }} />
                </Box>
              )}

              {/* Name */}
              <Tooltip title={asset.name} placement="top">
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    px: 0.75,
                    py: 0.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? "primary.main" : "text.secondary",
                  }}
                >
                  {asset.name}
                </Typography>
              </Tooltip>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
};
