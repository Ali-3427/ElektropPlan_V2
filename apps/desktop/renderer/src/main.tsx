import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import { App } from "./app";
import { queryClient } from "./query/client";
import { ThemeProvider } from "./features/shared/theme/ThemeContext";
import "./styles/theme.css";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Renderer mount point #root missing");
}

createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
