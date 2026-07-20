import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

function UserManagement() {
  const { account: currentAccount } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [drafts, setDrafts] = useState({});

  const [loading, setLoading] = useState(true);

  const [savingAccountId, setSavingAccountId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/auth/accounts");

      const accountList = Array.isArray(response.data) ? response.data : [];

      setAccounts(accountList);

      setDrafts(createAccountDrafts(accountList));
    } catch (err) {
      console.error(err);

      setError(getApiErrorMessage(err, "Kullanıcı hesapları alınamadı."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const statistics = useMemo(() => {
    return {
      total: accounts.length,

      active: accounts.filter((account) => account.is_active).length,

      admins: accounts.filter(
        (account) => account.role === "admin" && account.is_active,
      ).length,

      technicians: accounts.filter(
        (account) => account.role === "technician" && account.is_active,
      ).length,
    };
  }, [accounts]);

  function handleDraftChange(accountId, field, value) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,

      [accountId]: {
        ...currentDrafts[accountId],
        [field]: value,
      },
    }));

    setError("");
    setMessage("");
  }

  function hasAccountChanged(account) {
    const draft = drafts[account.account_id];

    if (!draft) {
      return false;
    }

    return draft.role !== account.role || draft.is_active !== account.is_active;
  }

  function resetAccountDraft(account) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,

      [account.account_id]: {
        role: account.role,
        is_active: account.is_active,
      },
    }));

    setError("");
    setMessage("");
  }

  async function saveAccount(account) {
    const draft = drafts[account.account_id];

    if (!draft) {
      return;
    }

    if (!hasAccountChanged(account)) {
      return;
    }

    try {
      setSavingAccountId(account.account_id);

      setError("");
      setMessage("");

      const response = await api.patch(`/auth/accounts/${account.account_id}`, {
        role: draft.role,
        is_active: draft.is_active,
      });

      const updatedAccount = response.data;

      setAccounts((currentAccounts) =>
        currentAccounts.map((currentItem) =>
          currentItem.account_id === updatedAccount.account_id
            ? updatedAccount
            : currentItem,
        ),
      );

      setDrafts((currentDrafts) => ({
        ...currentDrafts,

        [updatedAccount.account_id]: {
          role: updatedAccount.role,

          is_active: updatedAccount.is_active,
        },
      }));

      setMessage(`${updatedAccount.full_name} hesabı güncellendi.`);
    } catch (err) {
      console.error(err);

      setError(getApiErrorMessage(err, "Kullanıcı hesabı güncellenemedi."));
    } finally {
      setSavingAccountId(null);
    }
  }

  if (loading) {
    return (
      <main className="page account-management-page">
        <div className="page-loading">
          <div className="loading-spinner" aria-hidden="true" />

          <span>Kullanıcı hesapları yükleniyor...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="page account-management-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">YÖNETİM</span>

          <h1>Kullanıcı Yönetimi</h1>

          <p>Kullanıcı hesaplarının rollerini ve erişim durumlarını yönetin.</p>
        </div>

        <button
          type="button"
          className="account-refresh-button"
          onClick={loadAccounts}
          disabled={loading}
        >
          Listeyi Yenile
        </button>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      {message ? <p className="success-message">{message}</p> : null}

      <section className="account-metrics">
        <AccountMetric
          label="Toplam Hesap"
          value={statistics.total}
          description="Sistemde kayıtlı hesap"
        />

        <AccountMetric
          label="Aktif Hesap"
          value={statistics.active}
          description="Giriş yapabilen hesap"
        />

        <AccountMetric
          label="Aktif Yönetici"
          value={statistics.admins}
          description="Admin yetkisine sahip"
        />

        <AccountMetric
          label="Aktif Teknisyen"
          value={statistics.technicians}
          description="Ticket atanabilir personel"
        />
      </section>

      <section className="account-management-panel">
        <div className="account-management-heading">
          <div>
            <span className="section-kicker">HESAPLAR</span>

            <h2>Kayıtlı Kullanıcılar</h2>

            <p>
              Yeni kayıt olan hesaplar varsayılan olarak kullanıcı rolüyle
              oluşturulur.
            </p>
          </div>

          <span className="account-list-count">{accounts.length} hesap</span>
        </div>

        {accounts.length === 0 ? (
          <div className="account-empty-state">
            <strong>Kullanıcı hesabı bulunamadı.</strong>

            <span>
              Yeni kayıtlar oluşturulduğunda burada görüntülenecektir.
            </span>
          </div>
        ) : (
          <div className="account-table-wrapper">
            <table className="account-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Mevcut Rol</th>
                  <th>Yeni Rol</th>
                  <th>Hesap Durumu</th>
                  <th>Son Giriş</th>
                  <th>İşlem</th>
                </tr>
              </thead>

              <tbody>
                {accounts.map((account) => {
                  const draft = drafts[account.account_id];

                  const isCurrentAccount =
                    account.account_id === currentAccount?.account_id;

                  const isSaving = savingAccountId === account.account_id;

                  const hasChanges = hasAccountChanged(account);

                  return (
                    <tr key={account.account_id}>
                      <td>
                        <div className="account-user-cell">
                          <div className="account-avatar">
                            {getAccountInitials(account.full_name)}
                          </div>

                          <div>
                            <strong>{account.full_name}</strong>

                            <span>{account.email}</span>

                            {isCurrentAccount ? (
                              <small>Oturum açtığınız hesap</small>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`account-role-badge account-role-${account.role}`}
                        >
                          {getRoleLabel(account.role)}
                        </span>
                      </td>

                      <td>
                        <select
                          className="account-select"
                          value={draft?.role || account.role}
                          disabled={isCurrentAccount || isSaving}
                          onChange={(event) =>
                            handleDraftChange(
                              account.account_id,
                              "role",
                              event.target.value,
                            )
                          }
                        >
                          <option value="user">Kullanıcı</option>

                          <option value="technician">Teknisyen</option>

                          <option value="admin">Yönetici</option>
                        </select>
                      </td>

                      <td>
                        <select
                          className="account-select"
                          value={draft?.is_active ? "active" : "passive"}
                          disabled={isCurrentAccount || isSaving}
                          onChange={(event) =>
                            handleDraftChange(
                              account.account_id,
                              "is_active",
                              event.target.value === "active",
                            )
                          }
                        >
                          <option value="active">Aktif</option>

                          <option value="passive">Pasif</option>
                        </select>
                      </td>

                      <td>
                        <span className="account-date">
                          {formatDate(account.last_login_at)}
                        </span>
                      </td>

                      <td>
                        <div className="account-actions">
                          <button
                            type="button"
                            className="account-save-button"
                            disabled={
                              isCurrentAccount || isSaving || !hasChanges
                            }
                            onClick={() => saveAccount(account)}
                          >
                            {isSaving ? "Kaydediliyor..." : "Kaydet"}
                          </button>

                          <button
                            type="button"
                            className="account-reset-button"
                            disabled={
                              isCurrentAccount || isSaving || !hasChanges
                            }
                            onClick={() => resetAccountDraft(account)}
                          >
                            Vazgeç
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function AccountMetric({ label, value, description }) {
  return (
    <article className="account-metric-card">
      <span>{label}</span>

      <strong>{value}</strong>

      <p>{description}</p>
    </article>
  );
}

function createAccountDrafts(accounts) {
  return accounts.reduce(
    (drafts, account) => ({
      ...drafts,

      [account.account_id]: {
        role: account.role,

        is_active: account.is_active,
      },
    }),
    {},
  );
}

function getAccountInitials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "ID";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("tr-TR");
}

function getRoleLabel(role) {
  const labels = {
    admin: "Yönetici",
    technician: "Teknisyen",
    user: "Kullanıcı",
  };

  return labels[role] || role;
}

function formatDate(value) {
  if (!value) {
    return "Henüz giriş yapmadı";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Belirtilmemiş";
  }

  return date.toLocaleString("tr-TR");
}

function getApiErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item?.msg === "string") {
          return item.msg;
        }

        if (typeof item === "string") {
          return item;
        }

        return null;
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return fallbackMessage;
}

export default UserManagement;
