import { useAuth } from "../auth/AuthContext";

const roleLabels = {
  admin: "Yönetici",
  technician: "Teknisyen",
  user: "Kullanıcı",
};

function Settings() {
  const { account } = useAuth();

  const roleLabel = roleLabels[account?.role] || "Kullanıcı";

  const accountStatus = account?.is_active ? "Aktif" : "Pasif";

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">HESAP VE GÜVENLİK</span>

          <h1>Ayarlar</h1>

          <p>
            Hesap bilgilerinizi görüntüleyin ve güvenlik ayarlarınızı yönetin.
          </p>
        </div>
      </header>

      <section className="panel form-panel">
        <div className="form-panel-heading">
          <div>
            <span className="section-kicker">HESAP BİLGİLERİ</span>

            <h2>Profil özeti</h2>

            <p>Bu bilgiler giriş yaptığınız hesaptan alınmaktadır.</p>
          </div>
        </div>

        <div className="ticket-form">
          <div className="form-grid">
            <SettingsField label="Ad soyad" htmlFor="settings-full-name">
              <input
                id="settings-full-name"
                type="text"
                value={account?.full_name || "Belirtilmemiş"}
                readOnly
              />
            </SettingsField>

            <SettingsField label="E-posta" htmlFor="settings-email">
              <input
                id="settings-email"
                type="text"
                value={account?.email || "Belirtilmemiş"}
                readOnly
              />
            </SettingsField>

            <SettingsField label="Hesap rolü" htmlFor="settings-role">
              <input
                id="settings-role"
                type="text"
                value={roleLabel}
                readOnly
              />
            </SettingsField>

            <SettingsField label="Hesap durumu" htmlFor="settings-status">
              <input
                id="settings-status"
                type="text"
                value={accountStatus}
                readOnly
              />
            </SettingsField>

            <SettingsField
              label="Hesap oluşturulma tarihi"
              htmlFor="settings-created-at"
            >
              <input
                id="settings-created-at"
                type="text"
                value={formatDate(account?.created_at)}
                readOnly
              />
            </SettingsField>

            <SettingsField label="Son giriş" htmlFor="settings-last-login">
              <input
                id="settings-last-login"
                type="text"
                value={formatDate(account?.last_login_at)}
                readOnly
              />
            </SettingsField>
          </div>
        </div>
      </section>

      <section
        className="panel form-panel"
        style={{
          marginTop: "24px",
        }}
      >
        <div className="form-panel-heading">
          <div>
            <span className="section-kicker">GÜVENLİK</span>

            <h2>Parola değiştir</h2>

            <p>
              Parola değiştirme arayüzü hazırdır. Backend bağlantısı daha sonra
              eklenecektir.
            </p>
          </div>

          <span className="form-step-badge">Yakında aktif</span>
        </div>

        <form
          className="ticket-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="form-grid">
            <SettingsField
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
            </SettingsField>

            <SettingsField label="Yeni parola" htmlFor="settings-new-password">
              <input
                id="settings-new-password"
                name="new_password"
                type="password"
                placeholder="Yeni parolanız"
                autoComplete="new-password"
                disabled
              />
            </SettingsField>

            <SettingsField
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
            </SettingsField>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled>
              Parolayı Güncelle
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function SettingsField({ label, htmlFor, children }) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>

      {children}
    </div>
  );
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
