import { useCallback, useEffect, useRef, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

import StaffTicketDetail from "../components/StaffTicketDetail";
import UserTicketDetail from "../components/UserTicketDetail";

import {
  createUniqueOptions,
  getApiErrorMessage,
  getUserStatusMessage,
  normalizeConfidence,
  translatePriority,
  translateStatus,
} from "../utils/ticketDetailUtils";

const INITIAL_UPDATE_FORM = {
  status: "open",
  assigned_technician: "",
  department: "",
  category: "",
  subcategory: "",
  priority: "medium",
  resolution: "",
};

function TicketDetail() {
  const { ticketId } = useParams();

  const navigate = useNavigate();

  const { account } = useAuth();

  const resolutionRequestInFlight = useRef(false);

  const canManageTicket =
    account?.role === "technician" || account?.role === "admin";

  const [ticket, setTicket] = useState(null);

  const [aiSession, setAiSession] = useState(null);

  const [recommendation, setRecommendation] = useState(null);

  const [feedback, setFeedback] = useState("accepted");

  const [feedbackNote, setFeedbackNote] = useState("");

  const [updateForm, setUpdateForm] = useState(INITIAL_UPDATE_FORM);

  const [staffAccounts, setStaffAccounts] = useState([]);

  const [departmentOptions, setDepartmentOptions] = useState([]);

  const [categoryOptions, setCategoryOptions] = useState([]);

  const [subcategoryOptions, setSubcategoryOptions] = useState([]);

  const [loading, setLoading] = useState(true);

  const [aiSessionLoading, setAiSessionLoading] = useState(false);

  const [recommendationLoading, setRecommendationLoading] = useState(false);

  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [updateLoading, setUpdateLoading] = useState(false);

  const [formOptionsLoading, setFormOptionsLoading] = useState(false);

  const [staffLoading, setStaffLoading] = useState(false);

  const [resolutionLoading, setResolutionLoading] = useState(false);

  const [pendingResolution, setPendingResolution] = useState(null);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [aiSessionError, setAiSessionError] = useState("");

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
      } catch (requestError) {
        console.error(requestError);

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
            requestError,
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
    } catch (requestError) {
      console.error(requestError);

      setStaffAccounts([]);

      setStaffError(
        getApiErrorMessage(requestError, "Teknik personel listesi alınamadı."),
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

        setFeedback(ticketData.ai_feedback || "accepted");

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
      } catch (requestError) {
        console.error(requestError);

        setTicket(null);

        setError(
          getApiErrorMessage(requestError, "Ticket bilgileri alınamadı."),
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [ticketId, canManageTicket, loadDependentOptions],
  );

  const loadAiSession = useCallback(async () => {
    try {
      setAiSessionLoading(true);
      setAiSessionError("");

      const response = await api.get(`/ai/tickets/${ticketId}`);

      setAiSession(response.data);
    } catch (requestError) {
      console.error(requestError);

      setAiSession(null);

      if (requestError?.response?.status === 404) {
        setAiSessionError(
          canManageTicket
            ? "Bu ticketa bağlı kullanıcı AI oturumu bulunamadı."
            : "Bu talebe bağlı AI çözümü bulunamadı.",
        );
      } else {
        setAiSessionError(
          getApiErrorMessage(
            requestError,
            canManageTicket
              ? "Kullanıcının AI oturumu alınamadı."
              : "AI çözümü alınamadı.",
          ),
        );
      }
    } finally {
      setAiSessionLoading(false);
    }
  }, [ticketId, canManageTicket]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    void loadStaffAccounts();
  }, [loadStaffAccounts]);

  useEffect(() => {
    void loadAiSession();
  }, [loadAiSession]);

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
    } catch (requestError) {
      console.error(requestError);

      setError(getApiErrorMessage(requestError, "Ticket güncellenemedi."));
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
    } catch (requestError) {
      console.error(requestError);

      setError(getApiErrorMessage(requestError, "AI önerisi oluşturulamadı."));
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
    } catch (requestError) {
      console.error(requestError);

      setError(
        getApiErrorMessage(requestError, "Geri bildirim kaydedilemedi."),
      );
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function handleAiResolution(resolutionValue) {
    if (!aiSession?.session_id || resolutionRequestInFlight.current) {
      return;
    }

    resolutionRequestInFlight.current = true;

    try {
      setResolutionLoading(true);

      setPendingResolution(resolutionValue);

      setAiSessionError("");

      const response = await api.patch(
        `/ai/sessions/${aiSession.session_id}/resolution`,
        {
          resolution_status: resolutionValue,
        },
      );

      setAiSession(response.data);
    } catch (requestError) {
      console.error(requestError);

      setAiSessionError(
        getApiErrorMessage(requestError, "Çözüm sonucu kaydedilemedi."),
      );
    } finally {
      resolutionRequestInFlight.current = false;

      setResolutionLoading(false);

      setPendingResolution(null);
    }
  }

  function handleFeedbackChange(event) {
    setFeedback(event.target.value);
  }

  function handleFeedbackNoteChange(event) {
    setFeedbackNote(event.target.value);
  }

  if (loading) {
    return (
      <main className="page">
        <div className="page-loading">
          <div className="loading-spinner" aria-hidden="true" />

          <span>
            {canManageTicket
              ? "Ticket yükleniyor..."
              : "Talebiniz yükleniyor..."}
          </span>
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
          ← {canManageTicket ? "Ticketlara dön" : "Taleplerime dön"}
        </button>

        <p className="error-message">
          {error ||
            (canManageTicket ? "Ticket bulunamadı." : "Talep bulunamadı.")}
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate(-1)}
          >
            ← {canManageTicket ? "Ticketlara dön" : "Taleplerime dön"}
          </button>

          <span className="page-eyebrow">
            {canManageTicket ? "TICKET DETAYI" : "AI DESTEK SONUCU"}
          </span>

          <h1>
            #{ticket.ticket_id} {ticket.title}
          </h1>

          <p>
            {canManageTicket
              ? ticket.requester_name || "Kullanıcı belirtilmemiş"
              : getUserStatusMessage(ticket.status)}
          </p>
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

      {canManageTicket ? (
        <StaffTicketDetail
          ticket={ticket}
          aiSession={aiSession}
          aiSessionLoading={aiSessionLoading}
          aiSessionError={aiSessionError}
          recommendation={recommendation}
          recommendationLoading={recommendationLoading}
          onCreateRecommendation={createRecommendation}
          updateForm={updateForm}
          staffAccounts={staffAccounts}
          departmentOptions={departmentOptions}
          categoryOptions={categoryOptions}
          subcategoryOptions={subcategoryOptions}
          formOptionsLoading={formOptionsLoading}
          staffLoading={staffLoading}
          updateLoading={updateLoading}
          staffError={staffError}
          formOptionsError={formOptionsError}
          feedback={feedback}
          feedbackNote={feedbackNote}
          feedbackLoading={feedbackLoading}
          onUpdateChange={handleUpdateChange}
          onDepartmentChange={handleDepartmentChange}
          onCategoryChange={handleCategoryChange}
          onUpdateTicket={updateTicket}
          onFeedbackChange={handleFeedbackChange}
          onFeedbackNoteChange={handleFeedbackNoteChange}
          onSubmitFeedback={submitFeedback}
          onTimelineChanged={() => loadTicket(false)}
        />
      ) : (
        <UserTicketDetail
          ticket={ticket}
          aiSession={aiSession}
          aiSessionLoading={aiSessionLoading}
          aiSessionError={aiSessionError}
          resolutionLoading={resolutionLoading}
          pendingResolution={pendingResolution}
          onResolved={() => handleAiResolution("resolved")}
          onUnresolved={() => handleAiResolution("unresolved")}
          onNewIssue={() => navigate("/ai-support")}
        />
      )}
    </main>
  );
}

export default TicketDetail;
