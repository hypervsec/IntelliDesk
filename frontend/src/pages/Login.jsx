import { useEffect, useState } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

import ThemeToggle from "../components/ThemeToggle";

import "../auth/Auth.css";
import "../styles/auth-theme-toggle.css";

function getErrorMessage(error, fallbackMessage) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(" ");
  }

  return fallbackMessage;
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const { login, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    email: location.state?.email || "",

    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const registrationMessage = location.state?.registrationMessage || "";

  const destination = location.state?.from || "/";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, {
        replace: true,
      });
    }
  }, [destination, isAuthenticated, navigate]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setErrorMessage("");

    try {
      await login({
        email: formData.email,
        password: formData.password,
      });

      navigate(destination, {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Giriş işlemi başarısız oldu."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>

      <section className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-logo">ID</div>

          <p className="auth-brand-label">INTELLIDESK</p>

          <h1>Akıllı destek yönetimine hoş geldiniz.</h1>

          <p className="auth-brand-description">
            Ticket süreçlerini yönetin, geçmiş çözümleri inceleyin ve yapay zekâ
            destekli önerilerden yararlanın.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <span>01</span>

              <p>Merkezi ticket yönetimi</p>
            </div>

            <div className="auth-feature-item">
              <span>02</span>

              <p>Benzer ticket analizi</p>
            </div>

            <div className="auth-feature-item">
              <span>03</span>

              <p>Yapay zekâ çözüm önerileri</p>
            </div>
          </div>
        </div>
      </section>

      <main className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <p className="auth-form-eyebrow">GÜVENLİ GİRİŞ</p>

            <h2>Hesabına giriş yap</h2>

            <p>IntelliDesk paneline erişmek için hesap bilgilerini gir.</p>
          </div>

          {registrationMessage ? (
            <div className="auth-message auth-message-success">
              {registrationMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="auth-message auth-message-error">
              {errorMessage}
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="email">E-posta adresi</label>

              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                placeholder="ornek@intellidesk.com"
                autoComplete="email"
                required
                onChange={handleChange}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Parola</label>

              <div className="auth-password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  placeholder="Parolanı gir"
                  autoComplete="current-password"
                  required
                  onChange={handleChange}
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowPassword((currentValue) => !currentValue)
                  }
                >
                  {showPassword ? "Gizle" : "Göster"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-button"
              disabled={submitting}
            >
              {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          <p className="auth-switch-text">
            Henüz hesabın yok mu?
            <Link to="/register">Hesap oluştur</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default Login;
