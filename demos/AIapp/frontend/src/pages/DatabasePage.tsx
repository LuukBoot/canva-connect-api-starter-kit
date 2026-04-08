import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import FolderIcon from "@mui/icons-material/Folder";
import RefreshIcon from "@mui/icons-material/Refresh";
import { listAllFolders, type FolderInfo } from "../services/api";

type CanvaFolder = {
  id: string;
  name: string;
};

export const DatabasePage = () => {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [canvaFolders, setCanvaFolders] = useState<CanvaFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingCanva, setLoadingCanva] = useState(false);
  const [canvaError, setCanvaError] = useState<string | null>(null);

  useEffect(() => {
    listAllFolders()
      .then(setFolders)
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false));
  }, []);

  const fetchCanvaFolders = async () => {
    setLoadingCanva(true);
    setCanvaError(null);
    try {
      const res = await fetch("/api/canva-folders", { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data = await res.json() as { folders: CanvaFolder[] };
      setCanvaFolders(data.folders ?? []);
    } catch (err: unknown) {
      setCanvaError((err as Error).message ?? "Failed to load Canva folders");
    } finally {
      setLoadingCanva(false);
    }
  };

  const configured = folders.filter((f) => f.configured);
  const missing = folders.filter((f) => !f.configured);

  // Deduplicate: only show one entry per envVar (skip aliased duplicates)
  const seen = new Set<string>();
  const uniqueFolders = folders.filter((f) => {
    if (seen.has(f.envVar)) return false;
    seen.add(f.envVar);
    return true;
  });

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h4" fontWeight={700} mb={0.5}>
        Database
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Canva connection status and configured folder IDs
      </Typography>

      {/* ── Summary chips ── */}
      <Box display="flex" gap={1.5} mb={3} flexWrap="wrap">
        <Chip
          icon={<CheckCircleIcon />}
          label={`${configured.length} folders configured`}
          color="success"
          variant="outlined"
        />
        {missing.length > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${missing.length} folders missing`}
            color="error"
            variant="outlined"
          />
        )}
      </Box>

      {/* ── Folder config table ── */}
      <Typography variant="h6" fontWeight={600} mb={1}>
        Folder Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        These are the folder IDs read from <code>AIapp/.env</code>. Missing ones show "Not set" — add the Canva folder ID from the section below.
      </Typography>

      {loadingFolders ? (
        <CircularProgress size={24} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Folder Key</strong></TableCell>
                <TableCell><strong>Env Variable</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uniqueFolders.map((f) => (
                <TableRow key={f.envVar} sx={{ opacity: f.configured ? 1 : 0.6 }}>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {f.key}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {f.envVar}
                  </TableCell>
                  <TableCell>
                    {f.configured ? (
                      <Chip label="Configured" size="small" color="success" variant="outlined" />
                    ) : (
                      <Chip label="Not set" size="small" color="error" variant="outlined" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Divider sx={{ my: 3 }} />

      {/* ── Canva folder browser ── */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Canva Folder Browser
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Browse your real Canva workspace folders to find the IDs you need.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={loadingCanva ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={fetchCanvaFolders}
          disabled={loadingCanva}
        >
          {canvaFolders.length > 0 ? "Refresh" : "Load Canva Folders"}
        </Button>
      </Box>

      {canvaError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {canvaError} — make sure you are connected to Canva (visit the home page and click "Connect to Canva").
        </Alert>
      )}

      {canvaFolders.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Folder Name</strong></TableCell>
                <TableCell><strong>Folder ID</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {canvaFolders.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <FolderIcon fontSize="small" color="action" />
                      {f.name}
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{ fontFamily: "monospace", fontSize: "0.8rem", cursor: "pointer" }}
                    onClick={() => navigator.clipboard.writeText(f.id)}
                    title="Click to copy"
                  >
                    {f.id}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {canvaFolders.length > 0 && (
        <Typography variant="caption" color="text.secondary" mt={1} display="block">
          Click any Folder ID to copy it. Then add it to <code>canva-connect-api-starter-kit/demos/AIapp/.env</code> and restart the server.
        </Typography>
      )}
    </Box>
  );
};
