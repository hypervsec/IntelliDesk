import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";

/* Genel uygulama temeli */
import "./index.css";
import "./styles/design-system.css";

/* Ticket listesi */
import "./styles/tickets-dark.css";

/* AI destek ekranı */
import "./styles/ai-support-form.css";
import "./styles/searchable-select.css";
import "./styles/AISupport.css";
import "./styles/theme-toggle.css";
import "./styles/theme-light.css";
import "./styles/ai-support-result.css";

/* Ticket zaman çizelgesi */
import "./styles/ticket-timeline.css";

/* Ticket detay ekranı */
import "./styles/ticket-detail-base.css";
import "./styles/ticket-detail-staff.css";
import "./styles/ticket-detail-user.css";
import "./styles/ticket-ai-visual-section.css";

/* Diğer sayfalar */
import "./styles/settings.css";
import "./styles/auth-input-fix.css";
import "./styles/user-management.css";

/*
 * Diğer tüm AI stillerinden sonra yüklenmelidir.
 * Çözüm adımları başlığının hizasını sabitler.
 */
import "./styles/ai-solution-layout-fix.css";

/*
 * Orijinal ve AI çözüm görsellerinin
 * sonuç ekranında daha kompakt görünmesini sağlar.
 */
import "./styles/ai-visual-guidance-compact.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
