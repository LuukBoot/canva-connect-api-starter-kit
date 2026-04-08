import React, { useEffect, useState } from "react";
import { CssBaseline, Tab, Tabs, ThemeProvider, createTheme, Box, Button } from "@mui/material";
import { HomePage } from "./pages/home";
import { GalleryPage } from "./pages/gallery";
import { AdCreatorPage } from "./pages/AdCreatorPage";
import { DatabasePage } from "./pages/DatabasePage";
import { isAuthorized, getCanvaAuthorization } from "./services/auth";

const theme = createTheme({
  palette: {
    primary: { main: "#7B2FBE" },
    secondary: { main: "#E91E63" },
  },
  typography: {
    fontFamily: "Roboto, sans-serif",
  },
});

export const App = () => {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    isAuthorized().then((ok) => {
      if (ok) {
        setConnected(true);
      } else {
        // Auto-open Canva OAuth popup — no button click needed
        getCanvaAuthorization()
          .then(() => setConnected(true))
          .catch(() => {
            // Popup was blocked or failed — fall back to showing the connect page
            setConnected(false);
          });
      }
    });
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {connected ? (
        <>
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2, bgcolor: "background.paper", display: "flex", alignItems: "center" }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flex: 1 }}>
              <Tab label="Create Ad" />
              <Tab label="Asset Browser" />
              <Tab label="Database" />
            </Tabs>
            <Button
              size="small"
              variant="outlined"
              sx={{ ml: 2, whiteSpace: "nowrap" }}
              onClick={() => getCanvaAuthorization().then(() => setConnected(true)).catch(() => {})}
            >
              Reconnect to Canva
            </Button>
          </Box>
          {tab === 0 && <AdCreatorPage />}
          {tab === 1 && <GalleryPage onDisconnected={() => setConnected(false)} />}
          {tab === 2 && <DatabasePage />}
        </>
      ) : (
        // Shown only if popup was blocked — user clicks the button manually
        connected === false && <HomePage onConnected={() => setConnected(true)} />
      )}
    </ThemeProvider>
  );
};
