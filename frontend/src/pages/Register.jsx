import { useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

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

function Register() {
  const navigate = useNavigate();

  const { register, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    password_confirm: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", {
        replace: true,
      });
    }
  }, [isAuthenticated, navigate]);

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

    if (formData.password !== formData.password_confirm) {
      setErrorMessage("Parola ve parola tekrarı eşleşmiyor.");

      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await register(formData);

      navigate("/login", {
        replace: true,

        state: {
          email: formData.email,

          registrationMessage:
            "Hesabın başarıyla oluşturuldu. Giriş yapabilirsin.",
        },
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Kayıt işlemi başarısız oldu."));
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

          <h1>Destek süreçlerini tek bir merkezden yönet.</h1>

          <p className="auth-brand-description">
            IntelliDesk hesabını oluşturarak ticket yönetimi ve yapay zekâ
            destekli çözüm önerilerine eriş.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <span>01</span>

              <p>Hızlı ve kolay kayıt</p>
            </div>

            <div className="auth-feature-item">
              <span>02</span>

              <p>Güvenli parola saklama</p>
            </div>

            <div className="auth-feature-item">
              <span>03</span>

              <p>Rol tabanlı hesap altyapısı</p>
            </div>
          </div>
        </div>
      </section>

      <main className="auth-form-panel">
        <div className="auth-form-container auth-form-container-register">
          <div className="auth-form-header">
            <p className="auth-form-eyebrow">YENİ HESAP</p>

            <h2>Hesap oluştur</h2>

            <p>IntelliDesk kullanmaya başlamak için bilgilerini gir.</p>
          </div>

          {errorMessage ? (
            <div className="auth-message auth-message-error">
              {errorMessage}
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="full_name">Ad soyad</label>

              <input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                placeholder="Ad Soyad"
                autoComplete="name"
                minLength={2}
                maxLength={150}
                required
                onChange={handleChange}
              />
            </div>

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
                  placeholder="En az 8 karakter"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
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

            <div className="auth-field">
              <label htmlFor="password_confirm">Parola tekrarı</label>

              <input
                id="password_confirm"
                name="password_confirm"
                type={showPassword ? "text" : "password"}
                value={formData.password_confirm}
                placeholder="Parolanı tekrar gir"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                onChange={handleChange}
              />
            </div>

            <div className="auth-password-rules">
              Parola en az 8 karakter, bir büyük harf, bir küçük harf ve bir
              rakam içermelidir.
            </div>

            <button
              type="submit"
              className="auth-submit-button"
              disabled={submitting}
            >
              {submitting ? "Hesap oluşturuluyor..." : "Hesap Oluştur"}
            </button>
          </form>

          <p className="auth-switch-text">
            Zaten hesabın var mı?
            <Link to="/login">Giriş yap</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default Register;
