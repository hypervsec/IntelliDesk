import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";

import "./index.css";
import "./styles/design-system.css";
import "./styles/tickets-dark.css";
import "./styles/ticket-detail-dark.css";
import "./styles/create-ticket-dark.css";
import "./styles/theme-toggle.css";
import "./styles/theme-light.css";
import "./styles/auth-input-fix.css";
import "./styles/user-management.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
