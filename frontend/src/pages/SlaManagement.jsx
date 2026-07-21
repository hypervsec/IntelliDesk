import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/api";

import "../styles/sla-management.css";

const PAGE_SIZE = 100;

const SLA_POLICIES = [
  {
    priority: "critical",
    firstResponse: "15 dakika",
    resolution: "4 saat",
  },
  {
    priority: "high",
    firstResponse: "30 dakika",
    resolution: "8 saat",
  },
  {
    priority: "medium",
    firstResponse: "2 saat",
    resolution: "24 saat",
  },
  {
    priority: "low",
    firstResponse: "4 saat",
    resolution: "48 saat",
  },
];

const PRIORITY_LABELS = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

const TICKET_STATUS_LABELS = {
  open: "Açık",
  assigned: "Atandı",
  in_progress: "İşlemde",
  waiting_user: "Kullanıcı Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapandı",
  cancelled: "İptal",
};

const SLA_STATUS_LABELS = {
  on_track: "Normal",
  approaching: "Yaklaşıyor",
  breached: "İhlal Edildi",
  met: "Karşılandı",
  not_set: "Kapsam Dışı",
};

const SLA_SORT_ORDER = {
  breached: 0,
  approaching: 1,
  on_track: 2,
  met: 3,
  not_set: 4,
};

function SlaManagement() {
  const [tickets, setTickets] = useState([]);

  const [search, setSearch] = useState("");
  const [slaFilter, setSlaFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const loadTickets = useCallback(async (showMainLoading = true) => {
    try {
      if (showMainLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      let requestedPage = 1;
      let totalPages = 1;

      const loadedTickets = [];

      do {
        const response = await api.get("/tickets/paged", {
          params: {
            page: requestedPage,
            page_size: PAGE_SIZE,
            sort: "newest",
          },
        });

        const responseData = response.data || {};

        const pageItems = Array.isArray(responseData.items)
          ? responseData.items
          : [];

        loadedTickets.push(...pageItems);

        totalPages = Math.max(1, Number(responseData.total_pages) || 1);

        requestedPage += 1;
      } while (requestedPage <= totalPages);

      const uniqueTickets = Array.from(
        new Map(
          loadedTickets.map((ticket) => [ticket.ticket_id, ticket]),
        ).values(),
      );

      setTickets(uniqueTickets);
    } catch (err) {
      console.error(err);

      setTickets([]);

      setError(getApiErrorMessage(err, "SLA takip verileri alınamadı."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const trackedTickets = useMemo(() => {
    return tickets
      .filter((ticket) => ticket.status !== "cancelled")
      .map((ticket) => ({
        ...ticket,
        combined_sla_status: getCombinedSlaStatus(ticket),
      }));
  }, [tickets]);

  const summary = useMemo(() => {
    return trackedTickets.reduce(
      (result, ticket) => {
        const status = ticket.combined_sla_status;

        if (status === "not_set") {
          return result;
        }

        result.total += 1;

        if (status === "breached") {
          result.breached += 1;
        }

        if (status === "approaching") {
          result.approaching += 1;
        }

        if (status === "on_track") {
          result.onTrack += 1;
        }

        if (status === "met") {
          result.met += 1;
        }

        return result;
      },
      {
        total: 0,
        breached: 0,
        approaching: 0,
        onTrack: 0,
        met: 0,
      },
    );
  }, [trackedTickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return trackedTickets
      .filter((ticket) => {
        if (slaFilter && ticket.combined_sla_status !== slaFilter) {
          return false;
        }

        if (priorityFilter && ticket.priority !== priorityFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableContent = [
          ticket.ticket_id,
          ticket.title,
          ticket.requester_name,
          ticket.department,
          ticket.category,
          ticket.subcategory,
          ticket.assigned_technician,
        ]
          .filter((value) => value !== null && value !== undefined)
          .join(" ");

        return normalizeText(searchableContent).includes(normalizedSearch);
      })
      .sort((firstTicket, secondTicket) => {
        const firstStatusOrder =
          SLA_SORT_ORDER[firstTicket.combined_sla_status] ?? 99;

        const secondStatusOrder =
          SLA_SORT_ORDER[secondTicket.combined_sla_status] ?? 99;

        if (firstStatusOrder !== secondStatusOrder) {
          return firstStatusOrder - secondStatusOrder;
        }

        const firstRemaining = getUrgentRemainingMinutes(firstTicket);

        const secondRemaining = getUrgentRemainingMinutes(secondTicket);

        if (firstRemaining !== secondRemaining) {
          return firstRemaining - secondRemaining;
        }

        return Number(secondTicket.ticket_id) - Number(firstTicket.ticket_id);
      });
  }, [trackedTickets, search, slaFilter, priorityFilter]);

  function clearFilters() {
    setSearch("");
    setSlaFilter("");
    setPriorityFilter("");
  }

  const hasActiveFilters = Boolean(search || slaFilter || priorityFilter);

  return (
    <main className="page sla-page">
      <header className="page-header sla-page-header">
        <div>
          <span className="page-eyebrow">SERVİS SEVİYESİ YÖNETİMİ</span>

          <h1>SLA Yönetimi</h1>

          <p>
            İlk cevap ve çözüm hedeflerini takip edin, yaklaşan süreleri ve SLA
            ihlallerini yönetin.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button sla-refresh-button"
          disabled={loading || refreshing}
          onClick={() => {
            loadTickets(false);
          }}
        >
          {refreshing ? "Yenileniyor..." : "Verileri Yenile"}
        </button>
      </header>

      {error ? (
        <div className="error-message" role="alert">
          {error}
        </div>
      ) : null}

      <section className="sla-summary-grid" aria-label="SLA özeti">
        <SummaryCard
          label="Takip Edilen"
          value={summary.total}
          description="SLA kapsamındaki ticketlar"
          status="total"
        />

        <SummaryCard
          label="SLA İhlali"
          value={summary.breached}
          description="Hedef süresi geçmiş ticketlar"
          status="breached"
        />

        <SummaryCard
          label="Süresi Yaklaşan"
          value={summary.approaching}
          description="Sürenin yüzde 25'i veya daha azı kaldı"
          status="approaching"
        />

        <SummaryCard
          label="Normal İlerleyen"
          value={summary.onTrack}
          description="SLA hedefi içinde devam ediyor"
          status="on_track"
        />

        <SummaryCard
          label="SLA Karşılandı"
          value={summary.met}
          description="Hedef süre içinde tamamlandı"
          status="met"
        />
      </section>

      <section className="panel sla-policy-panel">
        <div className="sla-section-heading">
          <div>
            <span className="section-kicker">SLA POLİTİKALARI</span>

            <h2>Öncelik bazlı hedef süreler</h2>

            <p>Süreler ticket oluşturulduğu andan itibaren 7/24 hesaplanır.</p>
          </div>

          <span className="sla-policy-badge">Otomatik hesaplama</span>
        </div>

        <div className="sla-policy-grid">
          {SLA_POLICIES.map((policy) => (
            <article
              className={`sla-policy-card sla-policy-${policy.priority}`}
              key={policy.priority}
            >
              <div className="sla-policy-card-header">
                <span className={`priority-badge priority-${policy.priority}`}>
                  {PRIORITY_LABELS[policy.priority]}
                </span>
              </div>

              <dl>
                <div>
                  <dt>İlk cevap</dt>
                  <dd>{policy.firstResponse}</dd>
                </div>

                <div>
                  <dt>Çözüm</dt>
                  <dd>{policy.resolution}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="panel sla-tracking-panel">
        <div className="sla-section-heading">
          <div>
            <span className="section-kicker">CANLI SLA TAKİBİ</span>

            <h2>Ticket SLA durumları</h2>

            <p>
              En acil ve SLA ihlali bulunan ticketlar listenin başında
              gösterilir.
            </p>
          </div>

          <span className="sla-result-count">
            {filteredTickets.length} ticket
          </span>
        </div>

        <div className="sla-toolbar">
          <div className="sla-filter-field sla-search-field">
            <label htmlFor="sla-search">Ticket ara</label>

            <input
              id="sla-search"
              type="search"
              value={search}
              placeholder="Numara, konu, kullanıcı..."
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>

          <div className="sla-filter-field">
            <label htmlFor="sla-status-filter">SLA durumu</label>

            <select
              id="sla-status-filter"
              value={slaFilter}
              onChange={(event) => {
                setSlaFilter(event.target.value);
              }}
            >
              <option value="">Tüm SLA durumları</option>

              <option value="breached">İhlal edildi</option>

              <option value="approaching">Yaklaşıyor</option>

              <option value="on_track">Normal</option>

              <option value="met">Karşılandı</option>

              <option value="not_set">Kapsam dışı</option>
            </select>
          </div>

          <div className="sla-filter-field">
            <label htmlFor="sla-priority-filter">Öncelik</label>

            <select
              id="sla-priority-filter"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value);
              }}
            >
              <option value="">Tüm öncelikler</option>

              <option value="critical">Kritik</option>

              <option value="high">Yüksek</option>

              <option value="medium">Orta</option>

              <option value="low">Düşük</option>
            </select>
          </div>

          <div className="sla-filter-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
            >
              Filtreleri Temizle
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sla-loading-state">
            <div className="loading-spinner" aria-hidden="true" />

            <span>SLA verileri yükleniyor...</span>
          </div>
        ) : null}

        {!loading && filteredTickets.length === 0 ? (
          <div className="sla-empty-state">
            <strong>Gösterilecek ticket bulunamadı.</strong>

            <p>Filtreleri değiştirerek tekrar deneyin.</p>
          </div>
        ) : null}

        {!loading && filteredTickets.length > 0 ? (
          <div className="sla-table-wrapper">
            <table className="sla-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Öncelik</th>
                  <th>Operasyon Durumu</th>
                  <th>İlk Cevap SLA</th>
                  <th>Çözüm SLA</th>
                  <th>Genel SLA</th>
                  <th>Atanan</th>
                  <th aria-label="İşlem" />
                </tr>
              </thead>

              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.ticket_id}>
                    <td>
                      <div className="sla-ticket-cell">
                        <Link to={`/tickets/${ticket.ticket_id}`}>
                          #{ticket.ticket_id}
                        </Link>

                        <strong title={ticket.title}>{ticket.title}</strong>

                        <span>
                          {ticket.department || "Departman belirtilmemiş"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`priority-badge priority-${ticket.priority}`}
                      >
                        {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                      </span>
                    </td>

                    <td>
                      <span className="ticket-status-text">
                        {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </td>

                    <td>
                      <SlaDeadlineCell
                        status={ticket.first_response_sla_status}
                        remainingMinutes={
                          ticket.first_response_remaining_minutes
                        }
                        dueAt={ticket.first_response_due_at}
                      />
                    </td>

                    <td>
                      <SlaDeadlineCell
                        status={ticket.resolution_sla_status}
                        remainingMinutes={ticket.resolution_remaining_minutes}
                        dueAt={ticket.resolution_due_at}
                      />
                    </td>

                    <td>
                      <SlaBadge status={ticket.combined_sla_status} />
                    </td>

                    <td>
                      <span className="sla-technician-name">
                        {ticket.assigned_technician || "Atanmadı"}
                      </span>
                    </td>

                    <td>
                      <Link
                        className="sla-detail-link"
                        to={`/tickets/${ticket.ticket_id}`}
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SummaryCard({ label, value, description, status }) {
  return (
    <article className={`sla-summary-card sla-summary-${status}`}>
      <div className="sla-summary-card-top">
        <span className="sla-summary-label">{label}</span>

        <span className="sla-summary-dot" aria-hidden="true" />
      </div>

      <strong>{value}</strong>

      <p>{description}</p>
    </article>
  );
}

function SlaDeadlineCell({ status, remainingMinutes, dueAt }) {
  return (
    <div className="sla-deadline-cell">
      <SlaBadge status={status} compact />

      <strong>{formatRemainingTime(status, remainingMinutes)}</strong>

      <span>{dueAt ? formatDate(dueAt) : "SLA kapsamı dışında"}</span>
    </div>
  );
}

function SlaBadge({ status = "not_set", compact = false }) {
  const normalizedStatus = SLA_STATUS_LABELS[status] ? status : "not_set";

  return (
    <span
      className={[
        "sla-status-badge",
        `sla-status-${normalizedStatus}`,
        compact ? "sla-status-badge-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {SLA_STATUS_LABELS[normalizedStatus]}
    </span>
  );
}

function getCombinedSlaStatus(ticket) {
  const statuses = [
    ticket.first_response_sla_status,
    ticket.resolution_sla_status,
  ].filter((status) => status && status !== "not_set");

  if (statuses.length === 0) {
    return "not_set";
  }

  if (statuses.includes("breached")) {
    return "breached";
  }

  if (statuses.includes("approaching")) {
    return "approaching";
  }

  if (statuses.every((status) => status === "met")) {
    return "met";
  }

  return "on_track";
}

function getUrgentRemainingMinutes(ticket) {
  const remainingValues = [];

  if (
    ticket.first_response_sla_status !== "met" &&
    Number.isFinite(Number(ticket.first_response_remaining_minutes))
  ) {
    remainingValues.push(Number(ticket.first_response_remaining_minutes));
  }

  if (
    ticket.resolution_sla_status !== "met" &&
    Number.isFinite(Number(ticket.resolution_remaining_minutes))
  ) {
    remainingValues.push(Number(ticket.resolution_remaining_minutes));
  }

  if (remainingValues.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.min(...remainingValues);
}

function formatRemainingTime(status, remainingMinutes) {
  if (status === "met") {
    return "Süre içinde tamamlandı";
  }

  if (status === "not_set") {
    return "SLA kapsamı dışında";
  }

  if (remainingMinutes === null || remainingMinutes === undefined) {
    return "Süre tanımsız";
  }

  const numericMinutes = Number(remainingMinutes);

  if (!Number.isFinite(numericMinutes)) {
    return "Süre hesaplanamadı";
  }

  if (status === "breached") {
    if (numericMinutes < 0) {
      return `${formatDuration(Math.abs(numericMinutes))} gecikti`;
    }

    return "Süre aşıldı";
  }

  if (numericMinutes <= 0) {
    return "Son dakikalar";
  }

  return `${formatDuration(numericMinutes)} kaldı`;
}

function formatDuration(totalMinutes) {
  const normalizedMinutes = Math.max(0, Math.floor(totalMinutes));

  const days = Math.floor(normalizedMinutes / 1440);

  const hours = Math.floor((normalizedMinutes % 1440) / 60);

  const minutes = normalizedMinutes % 60;

  if (days > 0) {
    if (hours > 0) {
      return `${days} gün ${hours} saat`;
    }

    return `${days} gün`;
  }

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours} saat ${minutes} dk`;
    }

    return `${hours} saat`;
  }

  return `${minutes} dk`;
}

function formatDate(value) {
  if (!value) {
    return "Tarih belirtilmedi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Geçersiz tarih";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function getApiErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return fallbackMessage;
}

export default SlaManagement;
