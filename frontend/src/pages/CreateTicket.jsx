import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import api from "../api/api";

const SERVICE_DESK_URL = (import.meta.env.VITE_SERVICE_DESK_URL || "").trim();

const AI_LOADING_STEPS = [
  {
    title: "Sorun bilgileri değerlendiriliyor",
    detail: "Teknik detaylar analiz ediliyor",
    description:
      "Sorununuzun konusu, açıklaması ve seçtiğiniz kategoriler değerlendiriliyor.",
  },
  {
    title: "Benzer ticketlar aranıyor",
    detail: "Geçmiş kayıtlar taranıyor",
    description:
      "Geçmiş Service Desk kayıtlarında benzer sorunlar ve çözümler aranıyor.",
  },
  {
    title: "Çözümler karşılaştırılıyor",
    detail: "En uygun kaynaklar seçiliyor",
    description:
      "Bulunan geçmiş çözümler benzerlik ve kullanılabilirlik açısından karşılaştırılıyor.",
  },
  {
    title: "AI çözümü hazırlanıyor",
    detail: "Son kontroller yapılıyor",
    description:
      "Gemini, geçmiş kayıtları ve teknik bilgileri kullanarak çözüm adımlarını hazırlıyor.",
  },
];

const initialFormData = {
  title: "",
  description: "",
  department: "",
  category: "",
  subcategory: "",
  priority: "medium",
};

function CreateTicket() {
  const navigate = useNavigate();

  const resolutionRequestInFlight = useRef(false);

  const [formData, setFormData] = useState(initialFormData);

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  const [optionsLoading, setOptionsLoading] = useState(true);

  const [aiLoading, setAiLoading] = useState(false);

  const [resolutionLoading, setResolutionLoading] = useState(false);

  const [loadingStage, setLoadingStage] = useState(0);

  const [pendingResolution, setPendingResolution] = useState(null);

  const [aiSession, setAiSession] = useState(null);

  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const assistantMessage = getAssistantMessage(aiSession);

  const resolutionStatus = aiSession?.resolution_status || null;

  const confidenceLabel = formatConfidenceScore(aiSession?.confidence_score);

  const isBusy = aiLoading || resolutionLoading;

  const shouldShowForm = !aiLoading && !aiSession;

  useEffect(() => {
    let cancelled = false;

    async function loadFormOptions() {
      try {
        setOptionsLoading(true);
        setOptionsError("");

        const params = {};

        if (formData.department) {
          params.department = formData.department;
        }

        if (formData.category) {
          params.category = formData.category;
        }

        const response = await api.get("/tickets/form-options", {
          params,
        });

        if (cancelled) {
          return;
        }

        const nextDepartments = Array.isArray(response.data.departments)
          ? response.data.departments
          : [];

        const nextCategories = Array.isArray(response.data.categories)
          ? response.data.categories
          : [];

        const nextSubcategories = Array.isArray(response.data.subcategories)
          ? response.data.subcategories
          : [];

        setDepartments(nextDepartments);
        setCategories(nextCategories);
        setSubcategories(nextSubcategories);

        setFormData((currentData) => {
          const categoryIsValid =
            !currentData.category ||
            nextCategories.includes(currentData.category);

          const subcategoryIsValid =
            !currentData.subcategory ||
            nextSubcategories.includes(currentData.subcategory);

          return {
            ...currentData,
            category: categoryIsValid ? currentData.category : "",
            subcategory: subcategoryIsValid ? currentData.subcategory : "",
          };
        });
      } catch (requestError) {
        console.error(requestError);

        if (!cancelled) {
          setDepartments([]);
          setCategories([]);
          setSubcategories([]);

          setOptionsError(
            getApiErrorMessage(
              requestError,
              "Departman, kategori ve alt kategori seçenekleri alınamadı.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    }

    loadFormOptions();

    return () => {
      cancelled = true;
    };
  }, [formData.department, formData.category]);

  useEffect(() => {
    if (!aiLoading) {
      setLoadingStage(0);
      return undefined;
    }

    setLoadingStage(0);

    const stageTimers = [
      window.setTimeout(() => {
        setLoadingStage(1);
      }, 2200),

      window.setTimeout(() => {
        setLoadingStage(2);
      }, 4700),

      window.setTimeout(() => {
        setLoadingStage(3);
      }, 7600),
    ];

    return () => {
      stageTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, [aiLoading]);

  function handleChange(event) {
    const { name, value } = event.target;

    setError("");
    setSuccessMessage("");

    setFormData((currentData) => {
      if (name === "department") {
        return {
          ...currentData,
          department: value,
          category: "",
          subcategory: "",
        };
      }

      if (name === "category") {
        return {
          ...currentData,
          category: value,
          subcategory: "",
        };
      }

      return {
        ...currentData,
        [name]: value,
      };
    });
  }

  function validateForm() {
    const title = formData.title.trim();

    const description = formData.description.trim();

    if (title.length < 3) {
      return "Konu en az 3 karakter olmalıdır.";
    }

    if (description.length < 3) {
      return "Açıklama en az 3 karakter olmalıdır.";
    }

    if (!formData.department) {
      return "Lütfen bir departman seçin.";
    }

    if (!formData.category) {
      return "Lütfen bir kategori seçin.";
    }

    if (!formData.subcategory) {
      return "Lütfen bir alt kategori seçin.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setAiLoading(true);
      setError("");
      setSuccessMessage("");
      setAiSession(null);

      const sessionResponse = await api.post("/ai/sessions", {
        title: formData.title.trim(),
        description: formData.description.trim(),
        department: formData.department,
        category: formData.category,
        subcategory: formData.subcategory,
        priority: formData.priority,
      });

      const sessionId = sessionResponse.data.session_id;

      const solutionResponse = await api.post(
        `/ai/sessions/${sessionId}/solution`,
      );

      setAiSession(solutionResponse.data);
    } catch (requestError) {
      console.error(requestError);

      setError(
        getApiErrorMessage(
          requestError,
          "AI çözümü oluşturulamadı. Lütfen daha sonra tekrar deneyin.",
        ),
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function handleResolution(resolutionValue) {
    if (!aiSession?.session_id || resolutionRequestInFlight.current) {
      return;
    }

    resolutionRequestInFlight.current = true;

    try {
      setResolutionLoading(true);
      setPendingResolution(resolutionValue);
      setError("");
      setSuccessMessage("");

      const response = await api.patch(
        `/ai/sessions/${aiSession.session_id}/resolution`,
        {
          resolution_status: resolutionValue,
        },
      );

      const returnedResolution = response.data?.resolution_status;

      if (returnedResolution !== resolutionValue) {
        throw new Error("Çözüm sonucu beklenen değerle eşleşmedi.");
      }

      setAiSession(response.data);

      if (resolutionValue === "resolved") {
        setSuccessMessage("Sorununuzun çözüldüğü bilgisi kaydedildi.");
      }
    } catch (requestError) {
      console.error(requestError);

      setError(getApiErrorMessage(requestError, "Çözüm sonucu kaydedilemedi."));
    } finally {
      resolutionRequestInFlight.current = false;

      setResolutionLoading(false);
      setPendingResolution(null);
    }
  }

  function handleResolved() {
    handleResolution("resolved");
  }

  function handleUnresolved() {
    handleResolution("unresolved");
  }

  function handleNewIssue() {
    resolutionRequestInFlight.current = false;

    setFormData(initialFormData);
    setAiSession(null);
    setPendingResolution(null);
    setError("");
    setSuccessMessage("");
  }

  function handleCancel() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>AI Destek</h1>

          <p>
            Sorununuzu açıklayın; IntelliDesk geçmiş kayıtları inceleyerek yapay
            zekâ destekli çözüm hazırlasın.
          </p>
        </div>
      </header>

      {optionsError ? <p className="error-message">{optionsError}</p> : null}

      {error ? <p className="error-message">{error}</p> : null}

      {successMessage ? (
        <p className="success-message">{successMessage}</p>
      ) : null}

      {shouldShowForm ? (
        <section className="panel form-panel">
          <div className="form-panel-heading">
            <div>
              <span className="section-kicker">SORUN BİLGİLERİ</span>

              <h2>Yaşadığınız sorunu açıklayın</h2>

              <p>
                Bu form doğrudan ticket oluşturmaz. Bilgiler yalnızca yapay zekâ
                çözümü hazırlamak için kullanılır.
              </p>
            </div>
          </div>

          <form className="ticket-form" onSubmit={handleSubmit}>
            <FormField label="Konu" htmlFor="title" required>
              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                minLength={3}
                maxLength={500}
                placeholder="Örneğin: Bilgisayar internete bağlanmıyor"
                disabled={isBusy}
                required
              />
            </FormField>

            <FormField label="Sorun açıklaması" htmlFor="description" required>
              <textarea
                id="description"
                name="description"
                rows={6}
                value={formData.description}
                onChange={handleChange}
                minLength={3}
                placeholder="Sorunu, hata mesajını ve daha önce denediğiniz işlemleri ayrıntılı şekilde açıklayın..."
                disabled={isBusy}
                required
              />
            </FormField>

            <div className="form-grid">
              <FormField label="Departman" htmlFor="department" required>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  disabled={
                    isBusy || optionsLoading || departments.length === 0
                  }
                  required
                >
                  <option value="">
                    {optionsLoading
                      ? "Departmanlar yükleniyor..."
                      : departments.length === 0
                        ? "Departman bulunamadı"
                        : "Departman seçin"}
                  </option>

                  {departments.map((departmentValue) => (
                    <option key={departmentValue} value={departmentValue}>
                      {departmentValue}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Kategori" htmlFor="category" required>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={
                    isBusy ||
                    optionsLoading ||
                    !formData.department ||
                    categories.length === 0
                  }
                  required
                >
                  <option value="">
                    {!formData.department
                      ? "Önce departman seçin"
                      : optionsLoading
                        ? "Kategoriler yükleniyor..."
                        : categories.length === 0
                          ? "Kategori bulunamadı"
                          : "Kategori seçin"}
                  </option>

                  {categories.map((categoryValue) => (
                    <option key={categoryValue} value={categoryValue}>
                      {categoryValue}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Alt kategori" htmlFor="subcategory" required>
                <select
                  id="subcategory"
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleChange}
                  disabled={
                    isBusy ||
                    optionsLoading ||
                    !formData.category ||
                    subcategories.length === 0
                  }
                  required
                >
                  <option value="">
                    {!formData.category
                      ? "Önce kategori seçin"
                      : optionsLoading
                        ? "Alt kategoriler yükleniyor..."
                        : subcategories.length === 0
                          ? "Alt kategori bulunamadı"
                          : "Alt kategori seçin"}
                  </option>

                  {subcategories.map((subcategoryValue) => (
                    <option key={subcategoryValue} value={subcategoryValue}>
                      {subcategoryValue}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Öncelik" htmlFor="priority" required>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  disabled={isBusy}
                  required
                >
                  <option value="low">Düşük</option>

                  <option value="medium">Orta</option>

                  <option value="high">Yüksek</option>

                  <option value="critical">Kritik</option>
                </select>
              </FormField>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancel}
                disabled={isBusy}
              >
                İptal
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  isBusy ||
                  optionsLoading ||
                  !formData.department ||
                  !formData.category ||
                  !formData.subcategory
                }
              >
                AI Çözümü Oluştur
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {aiLoading ? <AISolutionLoading activeStep={loadingStage} /> : null}

      {assistantMessage ? (
        <section
          className="panel"
          style={{
            marginTop: "20px",
          }}
        >
          <div className="panel-header">
            <div>
              <h2
                style={{
                  margin: "0 0 9px",
                  color: "var(--color-primary)",
                  fontSize: "20px",
                  fontWeight: 800,
                  lineHeight: "1.25",
                  letterSpacing: "0.035em",
                }}
              >
                AI ÇÖZÜM ÖNERİSİ
              </h2>

              <p>
                Gemini ve benzer geçmiş Service Desk kayıtları kullanılarak
                hazırlanmıştır.
              </p>
            </div>

            {confidenceLabel ? (
              <span className="badge priority-medium">
                Güven: {confidenceLabel}
              </span>
            ) : null}
          </div>

          <div
            style={{
              whiteSpace: "pre-wrap",
              color: "var(--color-text-soft)",
              fontSize: "14px",
              lineHeight: "1.8",
              overflowWrap: "anywhere",
            }}
          >
            {normalizeAiContent(assistantMessage.content)}
          </div>

          {!resolutionStatus ? (
            <div
              style={{
                marginTop: "24px",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  color: "var(--color-text)",
                  fontWeight: 700,
                }}
              >
                Önerilen adımlar sorununuzu çözdü mü?
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleUnresolved}
                  disabled={resolutionLoading}
                >
                  {pendingResolution === "unresolved"
                    ? "Çözülmedi olarak kaydediliyor..."
                    : "Sorunum Çözülmedi"}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleResolved}
                  disabled={resolutionLoading}
                >
                  {pendingResolution === "resolved"
                    ? "Çözüldü olarak kaydediliyor..."
                    : "Sorunum Çözüldü"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {resolutionStatus === "resolved" ? (
        <section
          className="panel"
          style={{
            marginTop: "20px",
          }}
        >
          <div className="form-panel-heading">
            <div>
              <span className="section-kicker">SORUN ÇÖZÜLDÜ</span>

              <h2>Geri bildiriminiz kaydedildi</h2>

              <p>AI çözüm önerisinin sorununuzu çözdüğü bilgisi kaydedildi.</p>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleNewIssue}
            >
              Yeni Bir Sorun Bildir
            </button>
          </div>
        </section>
      ) : null}

      {resolutionStatus === "unresolved" ? (
        <section
          className="panel"
          style={{
            marginTop: "20px",
          }}
        >
          <div className="form-panel-heading">
            <div>
              <span className="section-kicker">SORUN DEVAM EDİYOR</span>

              <h2>Service Desk üzerinden destek alın</h2>

              <p>
                Yapay zekâ tarafından önerilen adımlar sorununuzu çözmediyse
                kurumunuzun ayrı Service Desk sistemi üzerinden destek kaydı
                oluşturabilirsiniz.
              </p>
            </div>
          </div>

          <p
            style={{
              margin: "0",
              border: "1px solid rgba(251, 191, 36, 0.27)",
              borderRadius: "12px",
              padding: "14px 16px",
              color: "#fcd34d",
              background: "rgba(245, 158, 11, 0.1)",
              fontSize: "13px",
              lineHeight: "1.7",
            }}
          >
            IntelliDesk bu aşamada otomatik ticket oluşturmaz. Service Desk
            kaydınızı kurumunuzun mevcut destek sistemi üzerinden ayrıca açmanız
            gerekir.
          </p>

          <div
            className="form-actions"
            style={{
              marginTop: "18px",
            }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={handleNewIssue}
            >
              Yeni Bir Sorun Bildir
            </button>

            {SERVICE_DESK_URL ? (
              <a
                href={SERVICE_DESK_URL}
                className="primary-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                Service Desk Sistemine Git
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function AISolutionLoading({ activeStep }) {
  const currentStep = AI_LOADING_STEPS[activeStep] || AI_LOADING_STEPS[0];

  return (
    <section
      className="panel ai-loading-panel"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="ai-loading-glow" aria-hidden="true" />

      <div className="ai-loading-content">
        <div className="ai-loading-heading">
          <div className="ai-loading-orb" aria-hidden="true">
            <div className="ai-loading-orb-ring" />

            <div className="ai-loading-orb-core">
              <span>✦</span>
            </div>
          </div>

          <div className="ai-loading-heading-copy">
            <span className="ai-loading-brand">IntelliDesk AI</span>

            <h2>{currentStep.title}</h2>
          </div>
        </div>

        <p className="ai-loading-description">{currentStep.description}</p>

        <div className="ai-loading-progress" aria-hidden="true" />

        <div className="ai-loading-steps">
          {AI_LOADING_STEPS.map((step, index) => {
            const isDone = index < activeStep;

            const isActive = index === activeStep;

            const statusClass = isDone
              ? "ai-loading-step-done"
              : isActive
                ? "ai-loading-step-active"
                : "ai-loading-step-pending";

            return (
              <div
                className={`ai-loading-step ${statusClass}`}
                key={step.title}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="ai-loading-step-icon">
                  {isDone ? (
                    "✓"
                  ) : isActive ? (
                    <span className="ai-loading-step-pulse" />
                  ) : (
                    index + 1
                  )}
                </span>

                <span className="ai-loading-step-copy">
                  <strong>{step.title}</strong>

                  <span>{step.detail}</span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="ai-loading-footer">
          <span className="ai-loading-footer-dot" aria-hidden="true" />
          Bu işlem genellikle birkaç saniye sürer. Lütfen sayfayı kapatmayın.
        </p>
      </div>
    </section>
  );
}

function FormField({ label, htmlFor, required = false, children }) {
  return (
    <div className="form-group">
      <label htmlFor={htmlFor}>
        {label}

        {required ? <span className="required-mark">*</span> : null}
      </label>

      {children}
    </div>
  );
}

function getAssistantMessage(aiSession) {
  if (!Array.isArray(aiSession?.messages)) {
    return null;
  }

  return (
    aiSession.messages.find((message) => message.sender_type === "assistant") ||
    null
  );
}

function formatConfidenceScore(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  const normalizedValue = Math.max(0, Math.min(numericValue, 1));

  return `%${(normalizedValue * 100).toFixed(2)}`;
}

function normalizeAiContent(content) {
  if (typeof content !== "string") {
    return "";
  }

  return content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*\*\s+/gm, "• ");
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

  if (
    typeof error?.message === "string" &&
    error.message === "Çözüm sonucu beklenen değerle eşleşmedi."
  ) {
    return error.message;
  }

  return fallbackMessage;
}

export default CreateTicket;
