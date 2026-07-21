import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icon";

const roleLabels = {
  admin: "Yönetici",
  technician: "Teknisyen",
  user: "Kullanıcı",
};

function Settings() {
  const { account } = useAuth();

  const roleLabel = roleLabels[account?.role] || "Kullanıcı";

  const accountStatus = account?.is_active ? "Aktif" : "Pasif";

  const initials = getAccountInitials(account?.full_name);

  return (
    <main className="page settings-page">
      <header className="settings-page-header">
        <div>
          <span className="page-eyebrow">HESAP AYARLARI</span>

          <h1>Ayarlar</h1>

          <p>
            Hesap bilgilerinizi görüntüleyin ve parola yönetimi durumunu kontrol
            edin.
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
        <section className="panel settings-panel settings-account-panel">
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

        <section className="panel settings-panel settings-password-panel">
          <div className="settings-panel-header">
            <div className="settings-panel-icon settings-password-icon">
              <Icon name="activity" size={19} />
            </div>

            <div>
              <span className="section-kicker">PAROLA YÖNETİMİ</span>

              <h2>Parola değiştir</h2>

              <p>
                Backend bağlantısı tamamlandığında parolanızı bu bölümden
                güncelleyebileceksiniz.
              </p>
            </div>

            <span className="settings-coming-soon-badge">Yakında aktif</span>
          </div>

          <form
            className="settings-password-form"
            onSubmit={(event) => {
              event.preventDefault();
            }}
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
                  placeholder="Mevcut parolanız"
                  autoComplete="current-password"
                  disabled
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
                  placeholder="Yeni parolanız"
                  autoComplete="new-password"
                  disabled
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
                  placeholder="Yeni parolanızı tekrar girin"
                  autoComplete="new-password"
                  disabled
                />
              </SettingsPasswordField>
            </div>

            <div className="settings-password-footer">
              <div className="settings-password-notice">
                <span />

                <p>Parola değiştirme işlemi henüz kullanıma açık değildir.</p>
              </div>

              <button
                type="submit"
                className="primary-button settings-password-button"
                disabled
              >
                Parolayı Güncelle
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
