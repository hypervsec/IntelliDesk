import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import api from "../api/api";

const SEARCH_DELAY = 350;
const PAGE_SIZE = 10;

function Tickets() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);

  const [optionsLoading, setOptionsLoading] = useState(true);

  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");

  const search = searchParams.get("search") || "";

  const status = searchParams.get("status") || "";

  const priority = searchParams.get("priority") || "";

  const category = searchParams.get("category") || "";

  const department = searchParams.get("department") || "";

  const sort = searchParams.get("sort") || "newest";

  const requestedPage = Number(searchParams.get("page") || "1");

  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cleanedSearch = searchInput.trim();

      if (cleanedSearch === search) {
        return;
      }

      updateUrlParameter("search", cleanedSearch);
    }, SEARCH_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, search, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadFilterOptions() {
      try {
        setOptionsLoading(true);
        setOptionsError("");

        const params = {};

        if (search) {
          params.search = search;
        }

        if (status) {
          params.status = status;
        }

        if (priority) {
          params.priority = priority;
        }

        if (category) {
          params.category = category;
        }

        if (department) {
          params.department = department;
        }

        const response = await api.get("/tickets/filter-options", {
          params,
        });

        if (cancelled) {
          return;
        }

        const nextCategories = Array.isArray(response.data.categories)
          ? response.data.categories
          : [];

        const nextDepartments = Array.isArray(response.data.departments)
          ? response.data.departments
          : [];

        setCategories(nextCategories);
        setDepartments(nextDepartments);

        const categoryIsValid =
          !category ||
          nextCategories.some(
            (value) => normalizeText(value) === normalizeText(category),
          );

        const departmentIsValid =
          !department ||
          nextDepartments.some(
            (value) => normalizeText(value) === normalizeText(department),
          );

        if (!categoryIsValid || !departmentIsValid) {
          setSearchParams(
            (currentParams) => {
              const nextParams = new URLSearchParams(currentParams);

              if (!categoryIsValid) {
                nextParams.delete("category");
              }

              if (!departmentIsValid) {
                nextParams.delete("department");
              }

              nextParams.delete("page");

              return nextParams;
            },
            {
              replace: true,
            },
          );
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setCategories([]);
          setDepartments([]);

          setOptionsError(
            getApiErrorMessage(err, "Filtre seçenekleri alınamadı."),
          );
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    }

    loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [search, status, priority, category, department, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      try {
        setLoading(true);
        setError("");

        const params = {
          page,
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

        if (category) {
          params.category = category;
        }

        if (department) {
          params.department = department;
        }

        const response = await api.get("/tickets/paged", {
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

        if (responsePage !== page) {
          setSearchParams(
            (currentParams) => {
              const nextParams = new URLSearchParams(currentParams);

              if (responsePage > 1) {
                nextParams.set("page", String(responsePage));
              } else {
                nextParams.delete("page");
              }

              return nextParams;
            },
            {
              replace: true,
            },
          );
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setTickets([]);
          setTotalItems(0);
          setTotalPages(1);
          setCurrentPage(1);

          setError(getApiErrorMessage(err, "Ticketlar alınamadı."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTickets();

    return () => {
      cancelled = true;
    };
  }, [
    search,
    status,
    priority,
    category,
    department,
    sort,
    page,
    setSearchParams,
  ]);

  function updateUrlParameter(name, value) {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (value) {
          nextParams.set(name, value);
        } else {
          nextParams.delete(name);
        }

        nextParams.delete("page");

        return nextParams;
      },
      {
        replace: true,
      },
    );
  }

  function updateSort(value) {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (value === "newest") {
          nextParams.delete("sort");
        } else {
          nextParams.set("sort", value);
        }

        nextParams.delete("page");

        return nextParams;
      },
      {
        replace: true,
      },
    );
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

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (pageNumber === 1) {
          nextParams.delete("page");
        } else {
          nextParams.set("page", String(pageNumber));
        }

        return nextParams;
      },
      {
        replace: true,
      },
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function clearFilters() {
    setSearchInput("");

    setSearchParams(
      {},
      {
        replace: true,
      },
    );
  }

  const hasActiveFilters = Boolean(
    search || status || priority || category || department || sort !== "newest",
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
          <span className="page-eyebrow">DESTEK TALEPLERİ</span>
          <h1>Ticketlar</h1>
          <p>Sistemde kayıtlı destek taleplerini ara, filtrele ve yönet.</p>
        </div>

        <Link className="primary-button" to="/tickets/new">
          + Yeni Ticket
        </Link>
      </header>

      <section className="panel ticket-list-panel">
        <div className="ticket-filters">
          <div className="ticket-filter-field">
            <label htmlFor="ticket-search">Ticket ara</label>

            <input
              id="ticket-search"
              type="search"
              value={searchInput}
              placeholder="Konu, açıklama, kullanıcı..."
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />
          </div>

          <div className="ticket-filter-field">
            <label htmlFor="status-filter">Durum</label>

            <select
              id="status-filter"
              value={status}
              onChange={(event) => {
                updateUrlParameter("status", event.target.value);
              }}
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
            <label htmlFor="priority-filter">Öncelik</label>

            <select
              id="priority-filter"
              value={priority}
              onChange={(event) => {
                updateUrlParameter("priority", event.target.value);
              }}
            >
              <option value="">Tüm öncelikler</option>

              <option value="low">Düşük</option>

              <option value="medium">Orta</option>

              <option value="high">Yüksek</option>

              <option value="critical">Kritik</option>
            </select>
          </div>

          <div className="ticket-filter-field">
            <label htmlFor="category-filter">Kategori</label>

            <select
              id="category-filter"
              value={category}
              disabled={optionsLoading}
              onChange={(event) => {
                updateUrlParameter("category", event.target.value);
              }}
            >
              <option value="">
                {optionsLoading
                  ? "Kategoriler yükleniyor..."
                  : "Tüm kategoriler"}
              </option>

              {categories.map((categoryValue) => (
                <option key={categoryValue} value={categoryValue}>
                  {categoryValue}
                </option>
              ))}
            </select>
          </div>

          <div className="ticket-filter-field">
            <label htmlFor="department-filter">Departman</label>

            <select
              id="department-filter"
              value={department}
              disabled={optionsLoading}
              onChange={(event) => {
                updateUrlParameter("department", event.target.value);
              }}
            >
              <option value="">
                {optionsLoading
                  ? "Departmanlar yükleniyor..."
                  : "Tüm departmanlar"}
              </option>

              {departments.map((departmentValue) => (
                <option key={departmentValue} value={departmentValue}>
                  {departmentValue}
                </option>
              ))}
            </select>
          </div>

          <div className="ticket-filter-field">
            <label htmlFor="sort-filter">Sıralama</label>

            <select
              id="sort-filter"
              value={sort}
              onChange={(event) => {
                updateSort(event.target.value);
              }}
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

        {optionsError ? <p className="error-message">{optionsError}</p> : null}

        <div className="ticket-filter-summary">
          <span>
            {loading
              ? "Ticketlar yükleniyor..."
              : `${totalItems} ticket bulundu`}
          </span>
        </div>

        {error ? <p className="error-message">{error}</p> : null}

        {!error && loading ? <p>Ticketlar yükleniyor...</p> : null}

        {!error && !loading && totalItems === 0 ? (
          <p className="empty-message">
            Arama kriterlerine uygun ticket bulunamadı.
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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
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

export default Tickets;
