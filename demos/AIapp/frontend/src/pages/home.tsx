import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from "@mui/material";
import { getCanvaAuthorization } from "../services/auth";

type HomePageProps = {
  onConnected: () => void;
};

export const HomePage = ({ onConnected }: HomePageProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await getCanvaAuthorization();
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="#f5f5f5"
    >
      <Card sx={{ maxWidth: 420, width: "100%", p: 3 }}>
        <CardContent>
          <Typography variant="h5" align="center" gutterBottom fontWeight={700}>
            QCollection Asset Browser
          </Typography>
          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            paragraph
            sx={{ mb: 4 }}
          >
            Connect your Canva account to browse images and videos across all
            QCollection Parfums asset folders.
          </Typography>

          {error && (
            <Typography color="error" variant="body2" align="center" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          <Box display="flex" justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={handleConnect}
              disabled={loading}
              sx={{ minWidth: 200 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Connect to Canva"
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
