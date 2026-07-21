import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/api";

import "../styles/system-logs.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const EMPTY_FILTERS = {
  search: "",
  actionType: "",
  ticketId: "",
  startDate: "",
  endDate: "",
};

const ACTION_LABELS = {
  ticket_created: "Ticket oluşturuldu",
  ticket_updated: "Ticket güncellendi",
  ticket_comment_added: "Yorum eklendi",
  ticket_deleted: "Ticket silindi",
  ai_recommendation_created: "AI önerisi oluşturuldu",
  ai_feedback_created: "AI geri bildirimi",
  account_created: "Kullanıcı oluşturuldu",
  account_updated: "Kullanıcı güncellendi",
  account_disabled: "Kullanıcı pasifleştirildi",
  login_succeeded: "Giriş başarılı",
  login_failed: "Giriş başarısız",
};

const ROLE_LABELS = {
  admin: "Yönetici",
  technician: "Teknisyen",
  user: "Kullanıcı",
};

const ENTITY_LABELS = {
  ticket: "Ticket",
  ticket_comment: "Ticket yorumu",
  account: "Kullanıcı",
  authentication: "Oturum",
};

const DETAIL_LABELS = {
  changed_fields: "Değişen alanlar",
  changed_field_labels: "Değişen alan adları",
  ticket_title: "Ticket başlığı",
  priority: "Öncelik",
  status: "Durum",
  timeline_entry_id: "Zaman çizelgesi kaydı",
};

function SystemLogs() {
  const [logs, setLogs] = useState([]);

  const [actionTypes, setActionTypes] = useState([]);

  const [filterForm, setFilterForm] = useState({
    ...EMPTY_FILTERS,
  });

  const [appliedFilters, setAppliedFilters] = useState({
    ...EMPTY_FILTERS,
  });

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(25);

  const [total, setTotal] = useState(0);

  const [totalPages, setTotalPages] = useState(1);

  const [expandedRows, setExpandedRows] = useState(() => new Set());

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const loadActionTypes = useCallback(async () => {
    try {
      const response = await api.get("/audit-logs/action-types");

      setActionTypes(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      console.error(requestError);

      setActionTypes([]);
    }
  }, []);

  const loadLogs = useCallback(
    async (showMainLoading = true) => {
      try {
        if (showMainLoading) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const params = {
          page,
          page_size: pageSize,
        };

        if (appliedFilters.search) {
          params.search = appliedFilters.search;
        }

        if (appliedFilters.actionType) {
          params.action_type = appliedFilters.actionType;
        }

        if (appliedFilters.ticketId) {
          params.ticket_id = Number(appliedFilters.ticketId);
        }

        if (appliedFilters.startDate) {
          params.start_date = `${appliedFilters.startDate}T00:00:00`;
        }

        if (appliedFilters.endDate) {
          params.end_date = `${appliedFilters.endDate}T23:59:59.999999`;
        }

        const response = await api.get("/audit-logs", {
          params,
        });

        const responseData = response.data || {};

        setLogs(Array.isArray(responseData.items) ? responseData.items : []);

        setTotal(Number(responseData.total) || 0);

        setTotalPages(Math.max(1, Number(responseData.total_pages) || 1));
      } catch (requestError) {
        console.error(requestError);

        setLogs([]);
        setTotal(0);
        setTotalPages(1);

        setError(getApiErrorMessage(requestError, "Sistem logları alınamadı."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedFilters, page, pageSize],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadActionTypes();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [loadActionTypes]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadLogs();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [loadLogs]);

  const visibleActionTypes = useMemo(() => {
    const combinedTypes = new Set(actionTypes);

    logs.forEach((log) => {
      if (log.action_type) {
        combinedTypes.add(log.action_type);
      }
    });

    return Array.from(combinedTypes).sort((firstType, secondType) =>
      getActionLabel(firstType).localeCompare(getActionLabel(secondType), "tr"),
    );
  }, [actionTypes, logs]);

  const currentPageActorCount = useMemo(() => {
    const actors = new Set();

    logs.forEach((log) => {
      actors.add(log.actor_account_id || log.actor_name || "Sistem");
    });

    return actors.size;
  }, [logs]);

  const hasActiveFilters = Boolean(
    appliedFilters.search ||
    appliedFilters.actionType ||
    appliedFilters.ticketId ||
    appliedFilters.startDate ||
    appliedFilters.endDate,
  );

  function updateFilter(fieldName, value) {
    setFilterForm((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  }

  function applyFilters(event) {
    event.preventDefault();

    setPage(1);

    setAppliedFilters({
      search: filterForm.search.trim(),
      actionType: filterForm.actionType,
      ticketId: filterForm.ticketId.trim(),
      startDate: filterForm.startDate,
      endDate: filterForm.endDate,
    });
  }

  function clearFilters() {
    setFilterForm({
      ...EMPTY_FILTERS,
    });

    setAppliedFilters({
      ...EMPTY_FILTERS,
    });

    setPage(1);
  }

  function changePageSize(event) {
    setPageSize(Number(event.target.value));

    setPage(1);
  }

  function toggleRow(auditLogId) {
    setExpandedRows((currentRows) => {
      const nextRows = new Set(currentRows);

      if (nextRows.has(auditLogId)) {
        nextRows.delete(auditLogId);
      } else {
        nextRows.add(auditLogId);
      }

      return nextRows;
    });
  }

  return (
    <main className="page audit-page">
      <header className="audit-hero">
        <div className="audit-hero-copy">
          <span className="page-eyebrow">DENETİM MERKEZİ</span>

          <h1>Sistem Logları</h1>

          <p>
            IntelliDesk üzerinde gerçekleşen kullanıcı, ticket ve sistem
            hareketlerini kronolojik olarak inceleyin.
          </p>
        </div>

        <div className="audit-hero-actions">
          <div className="audit-live-indicator">
            <span />
            Sistem kayıtları aktif
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={loading || refreshing}
            onClick={() => {
              void loadLogs(false);
            }}
          >
            {refreshing ? "Yenileniyor..." : "Akışı Yenile"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-message" role="alert">
          {error}
        </div>
      ) : null}

      <section className="audit-console">
        <aside className="panel audit-filter-sidebar">
          <div className="audit-filter-heading">
            <span className="section-kicker">FİLTRELER</span>

            <h2>Kayıtları daralt</h2>

            <p>
              Aradığınız işlemi kullanıcı, ticket veya tarih üzerinden bulun.
            </p>
          </div>

          <form className="audit-filter-form" onSubmit={applyFilters}>
            <div className="audit-filter-field">
              <label htmlFor="audit-search">Genel arama</label>

              <input
                id="audit-search"
                type="search"
                value={filterForm.search}
                placeholder="Kullanıcı, IP, işlem..."
                onChange={(event) => {
                  updateFilter("search", event.target.value);
                }}
              />
            </div>

            <div className="audit-filter-field">
              <label htmlFor="audit-action-type">İşlem türü</label>

              <select
                id="audit-action-type"
                value={filterForm.actionType}
                onChange={(event) => {
                  updateFilter("actionType", event.target.value);
                }}
              >
                <option value="">Tüm işlemler</option>

                {visibleActionTypes.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {getActionLabel(actionType)}
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-filter-field">
              <label htmlFor="audit-ticket-id">Ticket numarası</label>

              <input
                id="audit-ticket-id"
                type="number"
                min="1"
                value={filterForm.ticketId}
                placeholder="Örn. 9"
                onChange={(event) => {
                  updateFilter("ticketId", event.target.value);
                }}
              />
            </div>

            <div className="audit-date-fields">
              <div className="audit-filter-field">
                <label htmlFor="audit-start-date">Başlangıç</label>

                <input
                  id="audit-start-date"
                  type="date"
                  value={filterForm.startDate}
                  onChange={(event) => {
                    updateFilter("startDate", event.target.value);
                  }}
                />
              </div>

              <div className="audit-filter-field">
                <label htmlFor="audit-end-date">Bitiş</label>

                <input
                  id="audit-end-date"
                  type="date"
                  value={filterForm.endDate}
                  onChange={(event) => {
                    updateFilter("endDate", event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="audit-filter-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                Filtrele
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={
                  loading ||
                  (!hasActiveFilters &&
                    !filterForm.search &&
                    !filterForm.actionType &&
                    !filterForm.ticketId &&
                    !filterForm.startDate &&
                    !filterForm.endDate)
                }
                onClick={clearFilters}
              >
                Temizle
              </button>
            </div>
          </form>

          <div className="audit-filter-info">
            <span>Görüntülenen</span>

            <strong>{logs.length}</strong>

            <small>toplam {total} kayıttan</small>
          </div>
        </aside>

        <section className="audit-feed-area">
          <div className="audit-feed-toolbar">
            <div className="audit-feed-title">
              <span className="audit-feed-pulse" />

              <div>
                <strong>İşlem akışı</strong>

                <span>En yeni kayıtlar üstte gösterilir</span>
              </div>
            </div>

            <div className="audit-feed-metrics">
              <div>
                <span>Toplam</span>

                <strong>{total}</strong>
              </div>

              <div>
                <span>Kullanıcı</span>

                <strong>{currentPageActorCount}</strong>
              </div>

              <label>
                <span>Sayfa başına</span>

                <select value={pageSize} onChange={changePageSize}>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="audit-loading-state">
              <div className="loading-spinner" aria-hidden="true" />

              <span>Sistem hareketleri yükleniyor...</span>
            </div>
          ) : null}

          {!loading && logs.length === 0 ? (
            <div className="audit-empty-state">
              <span className="audit-empty-icon">!</span>

              <strong>Log kaydı bulunamadı</strong>

              <p>Seçilen filtrelere uyan herhangi bir sistem hareketi yok.</p>
            </div>
          ) : null}

          {!loading && logs.length > 0 ? (
            <div className="audit-feed">
              {logs.map((log) => (
                <AuditLogCard
                  key={log.audit_log_id}
                  log={log}
                  expanded={expandedRows.has(log.audit_log_id)}
                  onToggle={() => {
                    toggleRow(log.audit_log_id);
                  }}
                />
              ))}
            </div>
          ) : null}

          {!loading ? (
            <footer className="audit-feed-footer">
              <span>
                Sayfa <strong>{page}</strong> / {totalPages}
              </span>

              <div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((currentPage) => Math.max(1, currentPage - 1));
                  }}
                >
                  Önceki
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((currentPage) =>
                      Math.min(totalPages, currentPage + 1),
                    );
                  }}
                >
                  Sonraki
                </button>
              </div>
            </footer>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function AuditLogCard({ log, expanded, onToggle }) {
  const actionTone = getActionTone(log.action_type);

  return (
    <article className={`audit-log-card audit-log-${actionTone}`}>
      <div className="audit-log-rail">
        <span />
      </div>

      <div className="audit-log-content">
        <header className="audit-log-header">
          <div className="audit-log-action">
            <span className={`audit-action-badge audit-action-${actionTone}`}>
              {getActionLabel(log.action_type)}
            </span>

            <time dateTime={log.created_at || undefined}>
              {formatDate(log.created_at)}
            </time>
          </div>

          <span className={getStatusClassName(log.status_code)}>
            {log.status_code || "Sistem"}
          </span>
        </header>

        <div className="audit-log-description">
          <p>{log.description}</p>
        </div>

        <div className="audit-log-meta">
          <div className="audit-log-actor">
            <span className="audit-avatar">{getInitials(log.actor_name)}</span>

            <div>
              <strong>{log.actor_name || "Sistem"}</strong>

              <span>{getRoleLabel(log.actor_role)}</span>
            </div>
          </div>

          <div className="audit-log-request">
            <span
              className={`audit-method audit-method-${String(
                log.http_method || "system",
              ).toLowerCase()}`}
            >
              {log.http_method || "SİSTEM"}
            </span>

            <code>{log.request_path || "Arka plan işlemi"}</code>
          </div>

          <div className="audit-log-network">
            <span>IP</span>

            <strong>{log.ip_address || "Belirtilmemiş"}</strong>
          </div>

          <div className="audit-log-target">
            <span>Hedef</span>

            {log.ticket_id ? (
              <Link to={`/tickets/${log.ticket_id}`}>
                Ticket #{log.ticket_id}
              </Link>
            ) : (
              <strong>{getEntityLabel(log.entity_type)}</strong>
            )}
          </div>
        </div>

        <button
          type="button"
          className="audit-expand-button"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span>
            {expanded ? "Teknik detayları gizle" : "Teknik detayları göster"}
          </span>

          <span
            className={
              expanded ? "audit-expand-symbol expanded" : "audit-expand-symbol"
            }
          >
            +
          </span>
        </button>

        {expanded ? <AuditLogDetails log={log} /> : null}
      </div>
    </article>
  );
}

function AuditLogDetails({ log }) {
  const parsedDetails = parseDetails(log.details);

  return (
    <div className="audit-technical-details">
      <div className="audit-technical-grid">
        <DetailItem label="Log numarası" value={`#${log.audit_log_id}`} />

        <DetailItem
          label="Varlık"
          value={`${getEntityLabel(log.entity_type)}${
            log.entity_id ? ` #${log.entity_id}` : ""
          }`}
        />

        <DetailItem
          label="HTTP isteği"
          value={`${log.http_method || "Sistem"} · ${
            log.request_path || "Arka plan işlemi"
          }`}
        />

        <DetailItem
          label="IP adresi"
          value={log.ip_address || "Belirtilmemiş"}
        />
      </div>

      <div className="audit-details-object">
        <span>Kayıt verileri</span>

        {parsedDetails ? (
          <dl>
            {Object.entries(parsedDetails).map(([detailKey, detailValue]) => (
              <div key={detailKey}>
                <dt>{DETAIL_LABELS[detailKey] || formatKey(detailKey)}</dt>

                <dd>{formatDetailValue(detailValue)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Bu kayıt için ek teknik veri bulunmuyor.</p>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="audit-detail-item">
      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

function getActionLabel(actionType) {
  return ACTION_LABELS[actionType] || formatKey(actionType);
}

function getActionTone(actionType) {
  if (actionType === "ticket_comment_added") {
    return "comment";
  }

  if (actionType === "ticket_created") {
    return "created";
  }

  if (actionType === "ticket_updated") {
    return "updated";
  }

  if (
    String(actionType).includes("failed") ||
    String(actionType).includes("deleted")
  ) {
    return "danger";
  }

  if (String(actionType).includes("ai_")) {
    return "ai";
  }

  return "default";
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || "Sistem";
}

function getEntityLabel(entityType) {
  return ENTITY_LABELS[entityType] || formatKey(entityType);
}

function getInitials(name) {
  if (!name) {
    return "S";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "S";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("tr-TR");
}

function getStatusClassName(statusCode) {
  const numericStatus = Number(statusCode);

  if (numericStatus >= 200 && numericStatus < 300) {
    return "audit-status audit-status-success";
  }

  if (numericStatus >= 400 && numericStatus < 500) {
    return "audit-status audit-status-warning";
  }

  if (numericStatus >= 500) {
    return "audit-status audit-status-danger";
  }

  return "audit-status audit-status-neutral";
}

function parseDetails(details) {
  if (!details) {
    return null;
  }

  if (typeof details === "object") {
    return details;
  }

  try {
    const parsedValue = JSON.parse(details);

    if (parsedValue && typeof parsedValue === "object") {
      return parsedValue;
    }

    return null;
  } catch {
    return {
      details,
    };
  }
}

function formatDetailValue(value) {
  if (value === null || value === undefined) {
    return "Belirtilmemiş";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Boş";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function formatKey(value) {
  if (!value) {
    return "Belirtilmemiş";
  }

  const normalizedValue = String(value).replaceAll("_", " ").trim();

  return (
    normalizedValue.charAt(0).toLocaleUpperCase("tr-TR") +
    normalizedValue.slice(1)
  );
}

function formatDate(value) {
  if (!value) {
    return "Tarih yok";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tarih yok";
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

export default SystemLogs;
