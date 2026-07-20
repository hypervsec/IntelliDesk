import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/api";

const PAGE_SIZE = 10;
const SEARCH_DELAY = 350;

function AssignedTickets() {
  const [tickets, setTickets] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("newest");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, SEARCH_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignedTickets() {
      try {
        setLoading(true);
        setError("");

        const params = {
          page: currentPage,
          page_size: PAGE_SIZE,
          sort,
        };

        if (search) {
          params.search = search;
        }

        if (status) {
          params.status = status;
        }

        if (priority) {
          params.priority = priority;
        }

        const response = await api.get("/tickets/assigned-to-me/paged", {
          params,
        });

        if (cancelled) {
          return;
        }

        const responseData = response.data;

        setTickets(Array.isArray(responseData.items) ? responseData.items : []);

        setTotalItems(Number(responseData.total_items) || 0);

        setTotalPages(Math.max(1, Number(responseData.total_pages) || 1));

        const responsePage = Math.max(
          1,
          Number(responseData.current_page) || 1,
        );

        setCurrentPage(responsePage);
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setTickets([]);
          setTotalItems(0);
          setTotalPages(1);

          setError(getApiErrorMessage(err, "Atanan ticketlar alınamadı."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssignedTickets();

    return () => {
      cancelled = true;
    };
  }, [search, status, priority, sort, currentPage]);

  function handleStatusChange(event) {
    setStatus(event.target.value);
    setCurrentPage(1);
  }

  function handlePriorityChange(event) {
    setPriority(event.target.value);
    setCurrentPage(1);
  }

  function handleSortChange(event) {
    setSort(event.target.value);
    setCurrentPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setPriority("");
    setSort("newest");
    setCurrentPage(1);
  }

  function changePage(pageNumber) {
    if (
      pageNumber < 1 ||
      pageNumber > totalPages ||
      pageNumber === currentPage ||
      loading
    ) {
      return;
    }

    setCurrentPage(pageNumber);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const hasActiveFilters = Boolean(
    searchInput || status || priority || sort !== "newest",
  );

  const previousDisabled = currentPage <= 1 || loading;

  const nextDisabled = currentPage >= totalPages || loading;

  const firstVisibleTicket =
    totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const lastVisibleTicket = Math.min(currentPage * PAGE_SIZE, totalItems);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">TEKNİSYEN ÇALIŞMA ALANI</span>

          <h1>Bana Atananlar</h1>

          <p>Üzerinize atanmış destek taleplerini görüntüleyin ve yönetin.</p>
        </div>
      </header>

      <section className="panel ticket-list-panel">
        <div className="ticket-filters">
          <div className="ticket-filter-field">
            <label htmlFor="assigned-ticket-search">Ticket ara</label>

            <input
              id="assigned-ticket-search"
              type="search"
              value={searchInput}
              placeholder="Konu, açıklama, kullanıcı..."
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />
          </div>

          <div className="ticket-filter-field">
            <label htmlFor="assigned-status-filter">Durum</label>

            <select
              id="assigned-status-filter"
              value={status}
              onChange={handleStatusChange}
            >
              <option value="">Tüm durumlar</option>
              <option value="open">Açık</option>
              <option value="assigned">Atandı</option>
              <option value="in_progress">İşlemde</option>
              <option value="waiting_user">Kullanıcı Bekleniyor</option>
              <option value="resolved">Çözüldü</option>
              <option value="closed">Kapalı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>

          <div className="ticket-filter-field">
            <label htmlFor="assigned-priority-filter">Öncelik</label>

            <select
              id="assigned-priority-filter"
              value={priority}
              onChange={handlePriorityChange}
            >
              <option value="">Tüm öncelikler</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </select>
          </div>

          <div className="ticket-filter-field">
            <label htmlFor="assigned-sort-filter">Sıralama</label>

            <select
              id="assigned-sort-filter"
              value={sort}
              onChange={handleSortChange}
            >
              <option value="newest">En yeni</option>

              <option value="oldest">En eski</option>

              <option value="priority_high">Öncelik yüksekten düşüğe</option>

              <option value="priority_low">Öncelik düşükten yükseğe</option>
            </select>
          </div>

          <button
            type="button"
            className="clear-filters-button"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
          >
            Filtreleri temizle
          </button>
        </div>

        <div className="ticket-filter-summary">
          <span>
            {loading
              ? "Atanan ticketlar yükleniyor..."
              : `${totalItems} atanmış ticket bulundu`}
          </span>
        </div>

        {error ? <p className="error-message">{error}</p> : null}

        {!error && loading ? <p>Atanan ticketlar yükleniyor...</p> : null}

        {!error && !loading && totalItems === 0 ? (
          <p className="empty-message">
            Üzerinize atanmış uygun bir ticket bulunamadı.
          </p>
        ) : null}

        {!error && !loading && totalItems > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Konu</th>
                    <th>Kategori</th>
                    <th>Departman</th>
                    <th>Öncelik</th>
                    <th>Durum</th>
                    <th>AI Güveni</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.ticket_id}>
                      <td>#{ticket.ticket_id}</td>

                      <td>
                        <div className="ticket-title-cell">
                          <strong>{ticket.title}</strong>

                          <span>
                            {ticket.requester_name || "Kullanıcı belirtilmemiş"}
                          </span>
                        </div>
                      </td>

                      <td>{ticket.category || "Belirtilmemiş"}</td>

                      <td>{ticket.department || "Belirtilmemiş"}</td>

                      <td>
                        <span className={`badge priority-${ticket.priority}`}>
                          {translatePriority(ticket.priority)}
                        </span>
                      </td>

                      <td>
                        <span className={`badge status-${ticket.status}`}>
                          {translateStatus(ticket.status)}
                        </span>
                      </td>

                      <td>{formatConfidence(ticket.ai_confidence_score)}</td>

                      <td>
                        <Link
                          className="detail-link"
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

            <div className="ticket-pagination">
              <span className="ticket-pagination-info">
                {firstVisibleTicket}–{lastVisibleTicket} arası gösteriliyor.
                Toplam {totalItems} ticket.
              </span>

              <div className="ticket-pagination-actions">
                <button
                  type="button"
                  className="ticket-pagination-button"
                  disabled={previousDisabled}
                  onClick={() => {
                    changePage(currentPage - 1);
                  }}
                >
                  Önceki
                </button>

                <span className="ticket-page-indicator">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  className="ticket-pagination-button"
                  disabled={nextDisabled}
                  onClick={() => {
                    changePage(currentPage + 1);
                  }}
                >
                  Sonraki
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function formatConfidence(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return `%${(numericValue * 100).toFixed(2)}`;
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

function translatePriority(priority) {
  const values = {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  };

  return values[priority] || priority;
}

function translateStatus(status) {
  const values = {
    open: "Açık",
    assigned: "Atandı",
    in_progress: "İşlemde",
    waiting_user: "Kullanıcı Bekleniyor",
    resolved: "Çözüldü",
    closed: "Kapalı",
    cancelled: "İptal",
  };

  return values[status] || status;
}

export default AssignedTickets;
