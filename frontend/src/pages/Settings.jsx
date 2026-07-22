import { useState } from "react";

import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icon";

const roleLabels = {
  admin: "Yönetici",
  technician: "Teknisyen",
  user: "Kullanıcı",
};

const initialPasswordForm = {
  current_password: "",
  new_password: "",
  password_confirm: "",
};

function getErrorMessage(error, fallbackMessage) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const validationMessages = detail
      .map((item) => {
        if (typeof item?.msg !== "string") {
          return "";
        }

        return item.msg.replace(/^Value error,\s*/i, "");
      })
      .filter(Boolean);

    if (validationMessages.length > 0) {
      return validationMessages.join(" ");
    }
  }

  return fallbackMessage;
}

function validatePasswordForm(formData) {
  if (!formData.current_password) {
    return "Mevcut parolanızı girin.";
  }

  if (formData.new_password.length < 8) {
    return "Yeni parola en az 8 karakter olmalıdır.";
  }

  if (!/[a-zçğıöşü]/u.test(formData.new_password)) {
    return "Yeni parola en az bir küçük harf içermelidir.";
  }

  if (!/[A-ZÇĞİÖŞÜ]/u.test(formData.new_password)) {
    return "Yeni parola en az bir büyük harf içermelidir.";
  }

  if (!/\d/.test(formData.new_password)) {
    return "Yeni parola en az bir rakam içermelidir.";
  }

  if (formData.new_password !== formData.password_confirm) {
    return "Yeni parola ve parola tekrarı eşleşmiyor.";
  }

  if (formData.current_password === formData.new_password) {
    return "Yeni parola mevcut paroladan farklı olmalıdır.";
  }

  return "";
}

function Settings() {
  const navigate = useNavigate();

  const { account, logout } = useAuth();

  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);

  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const roleLabel = roleLabels[account?.role] || "Kullanıcı";

  const accountStatus = account?.is_active ? "Aktif" : "Pasif";

  const initials = getAccountInitials(account?.full_name);

  function handlePasswordChange(event) {
    const { name, value } = event.target;

    setPasswordForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setErrorMessage("");
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    const validationMessage = validatePasswordForm(passwordForm);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const response = await api.patch("/auth/password", passwordForm);

      const successMessage =
        response.data?.message || "Parolanız başarıyla güncellendi.";

      setPasswordForm(initialPasswordForm);

      logout();

      navigate("/login", {
        replace: true,
        state: {
          email: account?.email || "",
          registrationMessage:
            `${successMessage} ` + "Yeni parolanızla tekrar giriş yapın.",
        },
      });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Parola güncellenirken bir hata oluştu."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page settings-page">
      <header className="settings-page-header">
        <div>
          <span className="page-eyebrow">HESAP AYARLARI</span>

          <h1>Ayarlar</h1>

          <p>
            Hesap bilgilerinizi görüntüleyin ve parolanızı güvenli şekilde
            güncelleyin.
          </p>
        </div>

        <span
          className={[
            "settings-account-status",
            account?.is_active
              ? "settings-account-status-active"
              : "settings-account-status-passive",
          ].join(" ")}
        >
          <span />
          {accountStatus} hesap
        </span>
      </header>

      <section className="settings-profile-card">
        <div className="settings-profile-main">
          <div className="settings-profile-avatar">{initials}</div>

          <div className="settings-profile-copy">
            <span className="settings-profile-label">OTURUM AÇIK HESAP</span>

            <h2>{account?.full_name || "Kullanıcı"}</h2>

            <p>{account?.email || "E-posta bilgisi bulunamadı"}</p>

            <div className="settings-profile-badges">
              <span className="settings-role-badge">{roleLabel}</span>

              <span
                className={[
                  "settings-status-badge",
                  account?.is_active
                    ? "settings-status-badge-active"
                    : "settings-status-badge-passive",
                ].join(" ")}
              >
                {accountStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="settings-profile-metrics">
          <SettingsMetric
            label="Hesap oluşturma"
            value={formatDate(account?.created_at)}
          />

          <SettingsMetric
            label="Son giriş"
            value={formatDate(account?.last_login_at)}
          />
        </div>
      </section>

      <div className="settings-content-grid">
        <section
          className={["panel", "settings-panel", "settings-account-panel"].join(
            " ",
          )}
        >
          <div className="settings-panel-header">
            <div className="settings-panel-icon">
              <Icon name="user" size={19} />
            </div>

            <div>
              <span className="section-kicker">HESAP BİLGİLERİ</span>

              <h2>Profil özeti</h2>

              <p>
                Bu bilgiler giriş yaptığınız IntelliDesk hesabından
                alınmaktadır.
              </p>
            </div>
          </div>

          <div className="settings-info-list">
            <SettingsInfoItem label="Ad soyad" value={account?.full_name} />

            <SettingsInfoItem label="E-posta adresi" value={account?.email} />

            <SettingsInfoItem label="Hesap rolü" value={roleLabel} />

            <SettingsInfoItem label="Hesap durumu" value={accountStatus} />

            <SettingsInfoItem
              label="Oluşturulma tarihi"
              value={formatDate(account?.created_at)}
            />

            <SettingsInfoItem
              label="Son başarılı giriş"
              value={formatDate(account?.last_login_at)}
            />
          </div>
        </section>

        <section
          className={[
            "panel",
            "settings-panel",
            "settings-password-panel",
          ].join(" ")}
        >
          <div className="settings-panel-header">
            <div
              className={["settings-panel-icon", "settings-password-icon"].join(
                " ",
              )}
            >
              <Icon name="activity" size={19} />
            </div>

            <div>
              <span className="section-kicker">PAROLA YÖNETİMİ</span>

              <h2>Parola değiştir</h2>

              <p>
                Mevcut parolanızı doğrulayarak hesabınız için yeni bir parola
                belirleyin.
              </p>
            </div>

            <span
              className={[
                "settings-account-status",
                "settings-account-status-active",
              ].join(" ")}
            >
              <span />
              Aktif
            </span>
          </div>

          <form
            className="settings-password-form"
            onSubmit={handlePasswordSubmit}
          >
            <div className="settings-password-grid">
              <SettingsPasswordField
                label="Mevcut parola"
                htmlFor="settings-current-password"
              >
                <input
                  id="settings-current-password"
                  name="current_password"
                  type="password"
                  value={passwordForm.current_password}
                  placeholder="Mevcut parolanız"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                  disabled={submitting}
                  onChange={handlePasswordChange}
                />
              </SettingsPasswordField>

              <SettingsPasswordField
                label="Yeni parola"
                htmlFor="settings-new-password"
              >
                <input
                  id="settings-new-password"
                  name="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  placeholder="Yeni parolanız"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={submitting}
                  onChange={handlePasswordChange}
                />
              </SettingsPasswordField>

              <SettingsPasswordField
                label="Yeni parola tekrarı"
                htmlFor="settings-password-confirm"
              >
                <input
                  id="settings-password-confirm"
                  name="password_confirm"
                  type="password"
                  value={passwordForm.password_confirm}
                  placeholder={"Yeni parolanızı tekrar girin"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={submitting}
                  onChange={handlePasswordChange}
                />
              </SettingsPasswordField>
            </div>

            <div className="settings-password-footer">
              {errorMessage ? (
                <div className="settings-password-notice" role="alert">
                  <span
                    style={{
                      background: "var(--color-danger)",
                      boxShadow: "0 0 0 4px rgba(251, 113, 133, 0.1)",
                    }}
                  />

                  <p
                    style={{
                      color: "var(--color-danger)",
                    }}
                  >
                    {errorMessage}
                  </p>
                </div>
              ) : (
                <div className="settings-password-notice">
                  <span />

                  <p>
                    En az 8 karakter, bir büyük harf, bir küçük harf ve bir
                    rakam kullanın.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className={["primary-button", "settings-password-button"].join(
                  " ",
                )}
                disabled={submitting}
              >
                {submitting ? "Güncelleniyor..." : "Parolayı Güncelle"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function SettingsMetric({ label, value }) {
  return (
    <div className="settings-profile-metric">
      <span>{label}</span>

      <strong>{value || "Belirtilmemiş"}</strong>
    </div>
  );
}

function SettingsInfoItem({ label, value }) {
  return (
    <div className="settings-info-item">
      <span>{label}</span>

      <strong>{value || "Belirtilmemiş"}</strong>
    </div>
  );
}

function SettingsPasswordField({ label, htmlFor, children }) {
  return (
    <div className="settings-password-field">
      <label htmlFor={htmlFor}>{label}</label>

      {children}
    </div>
  );
}

function getAccountInitials(fullName) {
  const nameParts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length === 0) {
    return "ID";
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }

  return (
    nameParts[0][0] + nameParts[nameParts.length - 1][0]
  ).toLocaleUpperCase("tr-TR");
}

function formatDate(value) {
  if (!value) {
    return "Henüz kayıt yok";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tarih bilgisi alınamadı";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default Settings;
