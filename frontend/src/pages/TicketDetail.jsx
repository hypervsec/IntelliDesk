import { useCallback, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import TicketTimelinePanel from "../components/TicketTimelinePanel";

function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();

  const { account } = useAuth();

  const canManageTicket =
    account?.role === "technician" || account?.role === "admin";

  const [ticket, setTicket] = useState(null);

  const [recommendation, setRecommendation] = useState(null);

  const [feedback, setFeedback] = useState("accepted");
  const [feedbackNote, setFeedbackNote] = useState("");

  const [updateForm, setUpdateForm] = useState({
    status: "open",
    assigned_technician: "",
    department: "",
    category: "",
    subcategory: "",
    priority: "medium",
    resolution: "",
  });

  const [staffAccounts, setStaffAccounts] = useState([]);

  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [formOptionsLoading, setFormOptionsLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOptionsError, setFormOptionsError] = useState("");
  const [staffError, setStaffError] = useState("");

  const loadDependentOptions = useCallback(
    async (
      selectedDepartment = "",
      selectedCategory = "",
      currentSubcategory = "",
    ) => {
      try {
        setFormOptionsLoading(true);
        setFormOptionsError("");

        const categoryParams = {};

        if (selectedDepartment.trim()) {
          categoryParams.department = selectedDepartment.trim();
        }

        const categoryResponse = await api.get("/tickets/form-options", {
          params: categoryParams,
        });

        const departments = Array.isArray(categoryResponse.data?.departments)
          ? categoryResponse.data.departments
          : [];

        const categories = Array.isArray(categoryResponse.data?.categories)
          ? categoryResponse.data.categories
          : [];

        setDepartmentOptions(
          createUniqueOptions(departments, selectedDepartment),
        );

        setCategoryOptions(createUniqueOptions(categories, selectedCategory));

        if (!selectedDepartment || !selectedCategory) {
          setSubcategoryOptions([]);
          return;
        }

        const subcategoryResponse = await api.get("/tickets/form-options", {
          params: {
            department: selectedDepartment.trim(),
            category: selectedCategory.trim(),
          },
        });

        const subcategories = Array.isArray(
          subcategoryResponse.data?.subcategories,
        )
          ? subcategoryResponse.data.subcategories
          : [];

        setSubcategoryOptions(
          createUniqueOptions(subcategories, currentSubcategory),
        );
      } catch (err) {
        console.error(err);

        setDepartmentOptions((currentOptions) =>
          createUniqueOptions(currentOptions, selectedDepartment),
        );

        setCategoryOptions((currentOptions) =>
          createUniqueOptions(currentOptions, selectedCategory),
        );

        setSubcategoryOptions((currentOptions) =>
          createUniqueOptions(currentOptions, currentSubcategory),
        );

        setFormOptionsError(
          getApiErrorMessage(
            err,
            "Departman, kategori ve alt kategori seçenekleri alınamadı.",
          ),
        );
      } finally {
        setFormOptionsLoading(false);
      }
    },
    [],
  );

  const loadStaffAccounts = useCallback(async () => {
    if (!canManageTicket) {
      setStaffAccounts([]);
      setStaffError("");
      return;
    }

    try {
      setStaffLoading(true);
      setStaffError("");

      const response = await api.get("/auth/staff");

      const accounts = Array.isArray(response.data) ? response.data : [];

      const activeStaff = accounts.filter(
        (staffAccount) =>
          staffAccount?.is_active === true &&
          (staffAccount?.role === "technician" ||
            staffAccount?.role === "admin"),
      );

      setStaffAccounts(activeStaff);
    } catch (err) {
      console.error(err);

      setStaffAccounts([]);

      setStaffError(
        getApiErrorMessage(err, "Teknik personel listesi alınamadı."),
      );
    } finally {
      setStaffLoading(false);
    }
  }, [canManageTicket]);

  const loadTicket = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        setError("");

        const response = await api.get(`/tickets/${ticketId}`);

        const ticketData = response.data;

        const nextUpdateForm = {
          status: ticketData.status || "open",
          assigned_technician: ticketData.assigned_technician || "",
          department: ticketData.department || "",
          category: ticketData.category || "",
          subcategory: ticketData.subcategory || "",
          priority: ticketData.priority || "medium",
          resolution: ticketData.resolution || "",
        };

        setTicket(ticketData);
        setUpdateForm(nextUpdateForm);

        if (ticketData.ai_recommendation) {
          setRecommendation((currentRecommendation) => ({
            ticket_id: ticketData.ticket_id,

            recommendation: ticketData.ai_recommendation,

            confidence_score: normalizeConfidence(
              ticketData.ai_confidence_score,
            ),

            source_request_ids: currentRecommendation?.source_request_ids || [],
          }));
        } else {
          setRecommendation(null);
        }

        if (ticketData.ai_feedback) {
          setFeedback(ticketData.ai_feedback);
        } else {
          setFeedback("accepted");
        }

        if (canManageTicket) {
          await loadDependentOptions(
            nextUpdateForm.department,
            nextUpdateForm.category,
            nextUpdateForm.subcategory,
          );
        } else {
          setDepartmentOptions([]);
          setCategoryOptions([]);
          setSubcategoryOptions([]);
          setFormOptionsError("");
        }
      } catch (err) {
        console.error(err);

        setError(getApiErrorMessage(err, "Ticket bilgileri alınamadı."));
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [ticketId, canManageTicket, loadDependentOptions],
  );

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    loadStaffAccounts();
  }, [loadStaffAccounts]);

  function handleUpdateChange(event) {
    const { name, value } = event.target;

    setUpdateForm((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleDepartmentChange(event) {
    const nextDepartment = event.target.value;

    setUpdateForm((currentData) => ({
      ...currentData,
      department: nextDepartment,
      category: "",
      subcategory: "",
    }));

    setCategoryOptions([]);
    setSubcategoryOptions([]);

    await loadDependentOptions(nextDepartment, "", "");
  }

  async function handleCategoryChange(event) {
    const nextCategory = event.target.value;

    setUpdateForm((currentData) => ({
      ...currentData,
      category: nextCategory,
      subcategory: "",
    }));

    setSubcategoryOptions([]);

    await loadDependentOptions(updateForm.department, nextCategory, "");
  }

  async function updateTicket(event) {
    event.preventDefault();

    if (!canManageTicket) {
      setError("Bu işlem için teknisyen veya yönetici yetkisi gereklidir.");
      return;
    }

    try {
      setUpdateLoading(true);
      setError("");
      setMessage("");

      const requestData = {
        status: updateForm.status,

        assigned_technician: updateForm.assigned_technician.trim() || null,

        department: updateForm.department.trim() || null,

        category: updateForm.category.trim() || null,

        subcategory: updateForm.subcategory.trim() || null,

        priority: updateForm.priority,

        resolution: updateForm.resolution.trim() || null,
      };

      await api.put(`/tickets/${ticketId}`, requestData);

      setMessage("Ticket bilgileri güncellendi.");

      await loadTicket(false);
    } catch (err) {
      console.error(err);

      setError(getApiErrorMessage(err, "Ticket güncellenemedi."));
    } finally {
      setUpdateLoading(false);
    }
  }

  async function createRecommendation() {
    if (!canManageTicket) {
      setError("Bu işlem için teknisyen veya yönetici yetkisi gereklidir.");
      return;
    }

    try {
      setRecommendationLoading(true);
      setError("");
      setMessage("");

      const response = await api.post(`/tickets/${ticketId}/recommendation`);

      const recommendationData = response.data;

      setRecommendation({
        ...recommendationData,

        confidence_score: normalizeConfidence(
          recommendationData.confidence_score,
        ),

        source_request_ids: Array.isArray(recommendationData.source_request_ids)
          ? recommendationData.source_request_ids
          : [],
      });

      setMessage("AI çözüm önerisi oluşturuldu.");

      await loadTicket(false);
    } catch (err) {
      console.error(err);

      setError(getApiErrorMessage(err, "AI önerisi oluşturulamadı."));
    } finally {
      setRecommendationLoading(false);
    }
  }

  async function submitFeedback(event) {
    event.preventDefault();

    if (!canManageTicket) {
      setError("Bu işlem için teknisyen veya yönetici yetkisi gereklidir.");
      return;
    }

    if (!recommendation) {
      setError("Geri bildirim göndermeden önce AI önerisi oluştur.");
      return;
    }

    try {
      setFeedbackLoading(true);
      setError("");
      setMessage("");

      await api.post(`/tickets/${ticketId}/feedback`, {
        feedback,
        note: feedbackNote.trim() || null,
      });

      setMessage("Geri bildirim kaydedildi.");

      setFeedbackNote("");

      await loadTicket(false);
    } catch (err) {
      console.error(err);

      setError(getApiErrorMessage(err, "Geri bildirim kaydedilemedi."));
    } finally {
      setFeedbackLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <div className="page-loading">
          <div className="loading-spinner" aria-hidden="true" />

          <span>Ticket yükleniyor...</span>
        </div>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="page">
        <button
          type="button"
          className="back-link"
          onClick={() => navigate(-1)}
        >
          ← Ticketlara dön
        </button>

        <p className="error-message">{error || "Ticket bulunamadı."}</p>
      </main>
    );
  }

  const confidenceScore = normalizeConfidence(recommendation?.confidence_score);

  const confidencePercentage = confidenceScore * 100;

  const confidenceLevel = getConfidenceLevel(confidenceScore);

  const confidenceLabel = getConfidenceLabel(confidenceLevel);

  const technicianOptions = createStaffOptions(
    staffAccounts,
    updateForm.assigned_technician,
  );

  const timelineRefreshKey = [
    ticket.ticket_id,
    ticket.updated_at,
    ticket.first_responded_at,
  ].join("-");

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate(-1)}
          >
            ← Ticketlara dön
          </button>

          <span className="page-eyebrow">TICKET DETAYI</span>

          <h1>
            #{ticket.ticket_id} {ticket.title}
          </h1>

          <p>{ticket.requester_name || "Kullanıcı belirtilmemiş"}</p>
        </div>

        <div className="header-actions">
          <span className={`badge priority-${ticket.priority}`}>
            {translatePriority(ticket.priority)}
          </span>

          <span className={`badge status-${ticket.status}`}>
            {translateStatus(ticket.status)}
          </span>
        </div>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      {message ? <p className="success-message">{message}</p> : null}

      <section className="detail-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">GENEL BİLGİLER</span>

              <h2>Ticket Bilgileri</h2>

              <p>Destek talebinin mevcut kayıtları.</p>
            </div>
          </div>

          <DetailRow label="Açıklama" value={ticket.description} />

          <DetailRow label="Departman" value={ticket.department} />

          <DetailRow label="Kategori" value={ticket.category} />

          <DetailRow label="Alt kategori" value={ticket.subcategory} />

          <DetailRow
            label="Atanan teknisyen"
            value={ticket.assigned_technician}
          />

          <DetailRow label="Mevcut çözüm" value={ticket.resolution} />

          <DetailRow
            label="Oluşturulma zamanı"
            value={formatDate(ticket.created_at)}
          />

          <DetailRow
            label="Güncellenme zamanı"
            value={formatDate(ticket.updated_at)}
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">YAPAY ZEKÂ DESTEĞİ</span>

              <h2>AI Çözüm Önerisi</h2>

              <p>
                {canManageTicket
                  ? "Geçmiş benzer ticketlar kullanılır."
                  : "Mevcut AI çözüm önerisi görüntülenir."}
              </p>
            </div>

            {canManageTicket ? (
              <button
                type="button"
                className="primary-button"
                onClick={createRecommendation}
                disabled={recommendationLoading}
              >
                {recommendationLoading
                  ? "Oluşturuluyor..."
                  : recommendation
                    ? "Öneriyi Yenile"
                    : "Öneri Oluştur"}
              </button>
            ) : null}
          </div>

          {recommendation ? (
            <div className={`recommendation-box confidence-${confidenceLevel}`}>
              <p className="recommendation-text">
                {recommendation.recommendation ||
                  "AI tarafından çözüm önerisi oluşturulamadı."}
              </p>

              <div className="confidence-row">
                <div className="confidence-title">
                  <span>AI güven puanı</span>

                  <span
                    className={`confidence-badge confidence-badge-${confidenceLevel}`}
                  >
                    {confidenceLabel}
                  </span>
                </div>

                <strong>%{confidencePercentage.toFixed(2)}</strong>
              </div>

              <div
                className="confidence-track"
                role="progressbar"
                aria-label="AI güven puanı"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(confidencePercentage)}
              >
                <div
                  className="confidence-fill"
                  style={{
                    width: `${confidencePercentage}%`,
                  }}
                />
              </div>

              {recommendation.source_request_ids?.length > 0 ? (
                <div className="source-list">
                  <span>Kaynak ticketlar:</span>

                  <div>
                    {recommendation.source_request_ids.map((requestId) => (
                      <Link
                        className="source-badge"
                        key={requestId}
                        to={`/tickets/${requestId}`}
                      >
                        #{requestId}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="empty-message">
              Henüz AI çözüm önerisi oluşturulmadı.
            </p>
          )}
        </div>
      </section>

      {canManageTicket ? (
        <section className="panel management-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">OPERASYON</span>

              <h2>Ticket Yönetimi</h2>

              <p>
                Ticket durumunu, sınıflandırmasını, atamasını ve çözüm bilgisini
                güncelle.
              </p>
            </div>
          </div>

          {staffError ? <p className="error-message">{staffError}</p> : null}

          {formOptionsError ? (
            <p className="error-message">{formOptionsError}</p>
          ) : null}

          <form className="ticket-form" onSubmit={updateTicket}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="status">Durum</label>

                <select
                  id="status"
                  name="status"
                  value={updateForm.status}
                  disabled={updateLoading}
                  onChange={handleUpdateChange}
                >
                  <option value="open">Açık</option>

                  <option value="assigned">Atandı</option>

                  <option value="in_progress">İşlemde</option>

                  <option value="waiting_user">Kullanıcı Bekleniyor</option>

                  <option value="resolved">Çözüldü</option>

                  <option value="closed">Kapalı</option>

                  <option value="cancelled">İptal</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="assigned_technician">Atanan teknisyen</label>

                <select
                  id="assigned_technician"
                  name="assigned_technician"
                  value={updateForm.assigned_technician}
                  disabled={updateLoading || staffLoading}
                  onChange={handleUpdateChange}
                >
                  <option value="">
                    {staffLoading
                      ? "Teknik personel yükleniyor..."
                      : "Teknik personel seç"}
                  </option>

                  {technicianOptions.map((staffAccount) => (
                    <option
                      key={staffAccount.optionKey}
                      value={staffAccount.full_name}
                    >
                      {staffAccount.full_name}
                      {" — "}
                      {getStaffRoleLabel(staffAccount)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="department">Departman</label>

                <select
                  id="department"
                  name="department"
                  value={updateForm.department}
                  disabled={updateLoading || formOptionsLoading}
                  onChange={handleDepartmentChange}
                >
                  <option value="">
                    {formOptionsLoading && departmentOptions.length === 0
                      ? "Departmanlar yükleniyor..."
                      : "Departman seç"}
                  </option>

                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="category">Kategori</label>

                <select
                  id="category"
                  name="category"
                  value={updateForm.category}
                  disabled={
                    updateLoading ||
                    formOptionsLoading ||
                    !updateForm.department
                  }
                  onChange={handleCategoryChange}
                >
                  <option value="">
                    {!updateForm.department
                      ? "Önce departman seç"
                      : formOptionsLoading
                        ? "Kategoriler yükleniyor..."
                        : "Kategori seç"}
                  </option>

                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="subcategory">Alt kategori</label>

                <select
                  id="subcategory"
                  name="subcategory"
                  value={updateForm.subcategory}
                  disabled={
                    updateLoading || formOptionsLoading || !updateForm.category
                  }
                  onChange={handleUpdateChange}
                >
                  <option value="">
                    {!updateForm.category
                      ? "Önce kategori seç"
                      : formOptionsLoading
                        ? "Alt kategoriler yükleniyor..."
                        : "Alt kategori seç"}
                  </option>

                  {subcategoryOptions.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="priority">Öncelik</label>

                <select
                  id="priority"
                  name="priority"
                  value={updateForm.priority}
                  disabled={updateLoading}
                  onChange={handleUpdateChange}
                >
                  <option value="low">Düşük</option>

                  <option value="medium">Orta</option>

                  <option value="high">Yüksek</option>

                  <option value="critical">Kritik</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="resolution">Uygulanan çözüm</label>

              <textarea
                id="resolution"
                name="resolution"
                rows={5}
                value={updateForm.resolution}
                disabled={updateLoading}
                placeholder="Teknisyen tarafından uygulanan çözümü yaz..."
                onChange={handleUpdateChange}
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={updateLoading || formOptionsLoading || staffLoading}
              >
                {updateLoading ? "Güncelleniyor..." : "Ticketı Güncelle"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <TicketTimelinePanel
        key={timelineRefreshKey}
        ticketId={ticket.ticket_id}
        onTimelineChanged={() => loadTicket(false)}
      />

      {canManageTicket || ticket.ai_feedback ? (
        <section className="panel feedback-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">AI KALİTE KONTROLÜ</span>

              <h2>Teknisyen Geri Bildirimi</h2>

              <p>
                {canManageTicket
                  ? "AI önerisinin faydalı olup olmadığını kaydet."
                  : "AI önerisi için kaydedilen teknisyen geri bildirimi."}
              </p>
            </div>
          </div>

          {ticket.ai_feedback ? (
            <div
              className={`saved-feedback ${
                ticket.ai_feedback === "accepted"
                  ? "feedback-accepted"
                  : "feedback-rejected"
              }`}
            >
              <strong>
                Mevcut geri bildirim:{" "}
                {ticket.ai_feedback === "accepted"
                  ? "Kabul edildi"
                  : "Reddedildi"}
              </strong>

              {ticket.ai_feedback_note ? (
                <p>{ticket.ai_feedback_note}</p>
              ) : null}

              <span>{formatDate(ticket.ai_feedback_at)}</span>
            </div>
          ) : null}

          {canManageTicket ? (
            <form className="feedback-form" onSubmit={submitFeedback}>
              <div className="form-group">
                <label htmlFor="feedback">Geri bildirim</label>

                <select
                  id="feedback"
                  value={feedback}
                  disabled={feedbackLoading || !recommendation}
                  onChange={(event) => setFeedback(event.target.value)}
                >
                  <option value="accepted">Kabul et</option>

                  <option value="rejected">Reddet</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="feedbackNote">Açıklama</label>

                <textarea
                  id="feedbackNote"
                  rows={4}
                  value={feedbackNote}
                  disabled={feedbackLoading || !recommendation}
                  maxLength={1000}
                  placeholder={
                    recommendation
                      ? "Önerinin neden kabul veya reddedildiğini yaz..."
                      : "Önce AI çözüm önerisi oluşturulmalıdır."
                  }
                  onChange={(event) => setFeedbackNote(event.target.value)}
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={feedbackLoading || !recommendation}
                >
                  {feedbackLoading
                    ? "Kaydediliyor..."
                    : "Geri Bildirimi Kaydet"}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>

      <strong>{value || "Belirtilmemiş"}</strong>
    </div>
  );
}

function createStaffOptions(staffAccounts, currentTechnician) {
  const accounts = Array.isArray(staffAccounts) ? staffAccounts : [];

  const options = accounts
    .filter(
      (staffAccount) =>
        staffAccount?.full_name &&
        staffAccount?.is_active === true &&
        (staffAccount?.role === "technician" || staffAccount?.role === "admin"),
    )
    .map((staffAccount) => ({
      ...staffAccount,
      optionKey: `account-${staffAccount.account_id}`,
      isCurrentOnly: false,
    }));

  const cleanedCurrentTechnician = String(currentTechnician || "").trim();

  const currentTechnicianExists = options.some(
    (staffAccount) =>
      normalizeText(staffAccount.full_name) ===
      normalizeText(cleanedCurrentTechnician),
  );

  if (cleanedCurrentTechnician && !currentTechnicianExists) {
    options.unshift({
      account_id: null,
      full_name: cleanedCurrentTechnician,
      role: null,
      is_active: true,
      isCurrentOnly: true,
      optionKey: `current-${cleanedCurrentTechnician}`,
    });
  }

  return options;
}

function getStaffRoleLabel(staffAccount) {
  if (staffAccount.isCurrentOnly) {
    return "Mevcut kayıt";
  }

  if (staffAccount.role === "admin") {
    return "Yönetici";
  }

  return "Teknisyen";
}

function createUniqueOptions(values, currentValue) {
  const options = Array.isArray(values) ? [...values] : [];

  if (
    currentValue &&
    !options.some(
      (value) => normalizeText(value) === normalizeText(currentValue),
    )
  ) {
    options.unshift(currentValue);
  }

  const normalizedValues = new Set();

  return options.filter((value) => {
    const cleanedValue = String(value || "").trim();

    if (!cleanedValue) {
      return false;
    }

    const normalizedValue = normalizeText(cleanedValue);

    if (normalizedValues.has(normalizedValue)) {
      return false;
    }

    normalizedValues.add(normalizedValue);

    return true;
  });
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function normalizeConfidence(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(Math.max(numericValue, 0), 1);
}

function getConfidenceLevel(score) {
  if (score >= 0.8) {
    return "high";
  }

  if (score >= 0.5) {
    return "medium";
  }

  return "low";
}

function getConfidenceLabel(level) {
  const labels = {
    low: "Düşük güven",
    medium: "Orta güven",
    high: "Yüksek güven",
  };

  return labels[level] || "Bilinmiyor";
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

  return values[priority] || priority || "Belirtilmemiş";
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

  return values[status] || status || "Belirtilmemiş";
}

function formatDate(value) {
  if (!value) {
    return "Belirtilmemiş";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Belirtilmemiş";
  }

  return date.toLocaleString("tr-TR");
}

export default TicketDetail;
