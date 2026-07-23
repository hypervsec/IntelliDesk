import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import api from "../api/api";
import SearchableSelect from "../components/SearchableSelect";

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
      "Geçmiş kayıtlar ve teknik bilgiler kullanılarak çözüm adımları hazırlanıyor.",
  },
];

const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Düşük",
    tone: "low",
  },
  {
    value: "medium",
    label: "Orta",
    tone: "medium",
  },
  {
    value: "high",
    label: "Yüksek",
    tone: "high",
  },
  {
    value: "critical",
    label: "Kritik",
    tone: "critical",
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

  const assistantMessage = getAssistantMessage(aiSession);

  const resolutionStatus = aiSession?.resolution_status || null;

  const confidence = getConfidenceMeta(aiSession?.confidence_score);

  const parsedSolution = parseAiSolution(assistantMessage?.content);

  const sourceTicketIds = getSourceTicketIds(
    aiSession,
    parsedSolution.sourceTicketIds,
  );

  const isBusy = aiLoading || resolutionLoading;

  const shouldShowForm = !aiLoading && !aiSession;

  const shouldShowPageHeader = shouldShowForm;

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

  function updateFormField(name, value) {
    setError("");

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

  function handleChange(event) {
    const { name, value } = event.target;

    updateFormField(name, value);
  }

  function handleSelectChange(name, value) {
    updateFormField(name, value);
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
  }

  function handleCancel() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  }

  const departmentPlaceholder = optionsLoading
    ? "Departmanlar yükleniyor..."
    : departments.length === 0
      ? "Departman bulunamadı"
      : "Departman seçin";

  const categoryPlaceholder = !formData.department
    ? "Önce departman seçin"
    : optionsLoading
      ? "Kategoriler yükleniyor..."
      : categories.length === 0
        ? "Kategori bulunamadı"
        : "Kategori seçin";

  const subcategoryPlaceholder = !formData.category
    ? "Önce kategori seçin"
    : optionsLoading
      ? "Alt kategoriler yükleniyor..."
      : subcategories.length === 0
        ? "Alt kategori bulunamadı"
        : "Alt kategori seçin";

  return (
    <main className="page">
      {shouldShowPageHeader ? (
        <header className="page-header ai-support-page-header">
          <div>
            <h1>Çözüm Asistanı</h1>

            <p style={{ fontSize: "1.0625rem", lineHeight: 1.5 }}>
              Sorununuzu tanımlayın; geçmiş benzer kayıtlar incelenerek
              uygulanabilir bir çözüm planı hazırlansın.
            </p>
          </div>
        </header>
      ) : null}

      {optionsError ? <p className="error-message">{optionsError}</p> : null}

      {error ? <p className="error-message">{error}</p> : null}

      {shouldShowForm ? (
        <section className="panel form-panel">
          <div className="form-panel-heading">
            <div>
              <span className="section-kicker">SORUNUNUZU ANLATIN</span>

              <h2>Yaşadığınız sorunu ayrıntılı şekilde açıklayın</h2>
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
                <SearchableSelect
                  id="department"
                  value={formData.department}
                  options={departments}
                  placeholder={departmentPlaceholder}
                  searchPlaceholder="Departman ara..."
                  emptyMessage="Departman bulunamadı."
                  disabled={
                    isBusy || optionsLoading || departments.length === 0
                  }
                  onChange={(value) => {
                    handleSelectChange("department", value);
                  }}
                />
              </FormField>

              <FormField label="Kategori" htmlFor="category" required>
                <SearchableSelect
                  id="category"
                  value={formData.category}
                  options={categories}
                  placeholder={categoryPlaceholder}
                  searchPlaceholder="Kategori ara..."
                  emptyMessage="Kategori bulunamadı."
                  disabled={
                    isBusy ||
                    optionsLoading ||
                    !formData.department ||
                    categories.length === 0
                  }
                  onChange={(value) => {
                    handleSelectChange("category", value);
                  }}
                />
              </FormField>

              <FormField label="Alt kategori" htmlFor="subcategory" required>
                <SearchableSelect
                  id="subcategory"
                  value={formData.subcategory}
                  options={subcategories}
                  placeholder={subcategoryPlaceholder}
                  searchPlaceholder="Alt kategori ara..."
                  emptyMessage="Alt kategori bulunamadı."
                  disabled={
                    isBusy ||
                    optionsLoading ||
                    !formData.category ||
                    subcategories.length === 0
                  }
                  onChange={(value) => {
                    handleSelectChange("subcategory", value);
                  }}
                />
              </FormField>

              <FormField label="Öncelik" htmlFor="priority" required>
                <SearchableSelect
                  id="priority"
                  value={formData.priority}
                  options={PRIORITY_OPTIONS}
                  placeholder="Öncelik seçin"
                  searchable={false}
                  disabled={isBusy}
                  onChange={(value) => {
                    handleSelectChange("priority", value);
                  }}
                />
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
        <AISolutionResult
          solution={parsedSolution}
          confidence={confidence}
          sourceTicketIds={sourceTicketIds}
          resolutionStatus={resolutionStatus}
          resolutionLoading={resolutionLoading}
          pendingResolution={pendingResolution}
          onResolved={handleResolved}
          onUnresolved={handleUnresolved}
        />
      ) : null}

      {resolutionStatus === "resolved" ? (
        <ResolutionResultCard type="resolved" onNewIssue={handleNewIssue} />
      ) : null}

      {resolutionStatus === "unresolved" ? (
        <ResolutionResultCard type="unresolved" onNewIssue={handleNewIssue} />
      ) : null}
    </main>
  );
}

function AISolutionResult({
  solution,
  confidence,
  sourceTicketIds,
  resolutionStatus,
  resolutionLoading,
  pendingResolution,
  onResolved,
  onUnresolved,
}) {
  const hasStructuredContent =
    solution.evaluation ||
    solution.steps.length > 0 ||
    solution.solutionIntro ||
    solution.warning ||
    solution.control ||
    solution.nextAction;

  return (
    <section className="panel ai-solution-panel">
      <header className="ai-solution-header">
        <div className="ai-solution-title-area">
          <span className="ai-solution-header-icon" aria-hidden="true">
            ✦
          </span>

          <div className="ai-solution-title-copy">
            <span className="ai-solution-eyebrow">ÇÖZÜM PLANI</span>

            <h2 className="ai-solution-title">Çözüm Önerisi</h2>
          </div>
        </div>

        {confidence ? <ConfidenceIndicator confidence={confidence} /> : null}
      </header>

      {hasStructuredContent ? (
        <div className="ai-solution-content">
          {solution.evaluation ? (
            <section className="ai-evaluation-card">
              <div className="ai-evaluation-accent" aria-hidden="true" />

              <div className="ai-evaluation-body">
                <div className="ai-evaluation-heading">
                  <span className="ai-evaluation-badge">AI ÖZETİ</span>

                  <h3>Kök neden analizi</h3>
                </div>

                <p>{solution.evaluation}</p>
              </div>
            </section>
          ) : null}

          {solution.steps.length > 0 || solution.solutionIntro ? (
            <section className="ai-solution-main-section">
              <div className="ai-section-heading">
                <span
                  className="ai-section-heading-icon ai-section-heading-icon-primary"
                  aria-hidden="true"
                >
                  ✦
                </span>

                <div>
                  <h3>Uygulanacak adımlar</h3>

                  <span className="ai-section-description">
                    İşlemleri sırayla uygulayın.
                  </span>
                </div>
              </div>

              {solution.solutionIntro ? (
                <p className="ai-solution-intro">{solution.solutionIntro}</p>
              ) : null}

              {solution.steps.length > 0 ? (
                <ol className="ai-solution-timeline">
                  {solution.steps.map((step, index) => {
                    const isLastStep = index === solution.steps.length - 1;

                    return (
                      <li
                        className={[
                          "ai-solution-timeline-item",
                          isLastStep ? "ai-solution-timeline-item-last" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={`${index}-${step}`}
                      >
                        <div className="ai-solution-timeline-rail">
                          <span className="ai-solution-timeline-number">
                            {index + 1}
                          </span>

                          {!isLastStep ? (
                            <span
                              className="ai-solution-timeline-line"
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>

                        <div className="ai-solution-timeline-content">
                          <p>{step}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </section>
          ) : null}

          {solution.warning ? (
            <aside className="ai-solution-warning">
              <span className="ai-solution-warning-icon" aria-hidden="true">
                !
              </span>

              <div>
                <strong>Önemli uyarı</strong>

                <p>{solution.warning}</p>
              </div>
            </aside>
          ) : null}

          {solution.control || solution.nextAction ? (
            <div className="ai-solution-info-grid">
              {solution.control ? (
                <section className="ai-info-card ai-info-card-control">
                  <span
                    className="ai-info-card-icon ai-info-card-icon-control"
                    aria-hidden="true"
                  >
                    ✓
                  </span>

                  <div>
                    <span className="ai-info-card-label">DOĞRULAMA</span>

                    <h3>Kontrol</h3>

                    <p>{solution.control}</p>
                  </div>
                </section>
              ) : null}

              {solution.nextAction ? (
                <section className="ai-info-card ai-info-card-next">
                  <span
                    className="ai-info-card-icon ai-info-card-icon-next"
                    aria-hidden="true"
                  >
                    →
                  </span>

                  <div>
                    <span className="ai-info-card-label">DEVAM EDİYORSA</span>

                    <h3>Sonraki işlem</h3>

                    <p>{solution.nextAction}</p>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ai-solution-fallback">{solution.fallback}</div>
      )}

      {sourceTicketIds.length > 0 ? (
        <footer className="ai-solution-sources">
          <div>
            <span className="ai-solution-sources-label">Benzer kayıtlar</span>

            <p>Çözümle ilişkili geçmiş Service Desk kayıtları</p>
          </div>

          <div className="ai-source-ticket-list">
            {sourceTicketIds.map((requestId) => (
              <span
                className="ai-source-ticket"
                title={`Kaynak ticket ${formatSourceTicketId(requestId)}`}
                key={requestId}
              >
                <span aria-hidden="true">#</span>

                {String(requestId).replace(/^#/, "")}
              </span>
            ))}
          </div>
        </footer>
      ) : null}

      {!resolutionStatus ? (
        <section className="ai-feedback-box">
          <div className="ai-feedback-copy">
            <span className="ai-feedback-label">SONUÇ</span>

            <h3>Bu adımlar sorununuzu çözdü mü?</h3>

            <p>Çözülmediyse gerçek IT desteğine yönlendirileceksiniz.</p>
          </div>

          <div className="ai-feedback-actions">
            <button
              type="button"
              className="ai-feedback-button ai-feedback-button-secondary"
              onClick={onUnresolved}
              disabled={resolutionLoading}
            >
              {pendingResolution === "unresolved"
                ? "Kaydediliyor..."
                : "Sorunum Çözülmedi"}
            </button>

            <button
              type="button"
              className="ai-feedback-button ai-feedback-button-primary"
              onClick={onResolved}
              disabled={resolutionLoading}
            >
              {pendingResolution === "resolved"
                ? "Kaydediliyor..."
                : "Sorunum Çözüldü"}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function ConfidenceIndicator({ confidence }) {
  const style = {
    "--confidence-progress": `${confidence.progress}deg`,
  };

  return (
    <div
      className={[
        "ai-confidence-card",
        `ai-confidence-card-${confidence.tone}`,
      ].join(" ")}
      style={style}
      aria-label={`Güven puanı yüzde ${confidence.value.toFixed(2)}`}
    >
      <span className="ai-confidence-ring" aria-hidden="true">
        <span className="ai-confidence-ring-center">
          {Math.round(confidence.value)}
        </span>
      </span>

      <span className="ai-confidence-copy">
        <span className="ai-confidence-label">Güven puanı</span>

        <strong className="ai-confidence-value">{confidence.label}</strong>

        <span className="ai-confidence-status">{confidence.status}</span>
      </span>
    </div>
  );
}

function ResolutionResultCard({ type, onNewIssue }) {
  const isResolved = type === "resolved";

  return (
    <section
      className={[
        "panel",
        "ai-resolution-card",
        isResolved
          ? "ai-resolution-card-success"
          : "ai-resolution-card-warning",
      ].join(" ")}
    >
      <span className="ai-resolution-icon" aria-hidden="true">
        {isResolved ? "✓" : "!"}
      </span>

      <div className="ai-resolution-copy">
        <span className="ai-resolution-kicker">
          {isResolved ? "GERİ BİLDİRİM ALINDI" : "IT DESTEĞİ GEREKİYOR"}
        </span>

        <h2>
          {isResolved
            ? "Sorun çözüldü olarak kaydedildi"
            : "Service Desk kaydı oluşturun"}
        </h2>

        <p>
          {isResolved
            ? "Teşekkürler. Yeni bir sorun için formu yeniden açabilirsiniz."
            : "Sorunun ayrıntılarını kurumunuzun Service Desk sistemine ileterek IT ekibinden destek alın."}
        </p>
      </div>

      <div className="ai-resolution-actions">
        <button
          type="button"
          className="ai-resolution-secondary-button"
          onClick={onNewIssue}
        >
          Yeni Sorun Bildir
        </button>

        {!isResolved && SERVICE_DESK_URL ? (
          <a
            href={SERVICE_DESK_URL}
            className="ai-resolution-primary-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            IT Destek Kaydı Aç
          </a>
        ) : null}
      </div>
    </section>
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

function parseAiSolution(content) {
  const emptySolution = {
    evaluation: "",
    solutionIntro: "",
    steps: [],
    warning: "",
    control: "",
    nextAction: "",
    sourceTicketIds: [],
    fallback: "",
  };

  if (typeof content !== "string") {
    return emptySolution;
  }

  const normalizedContent = normalizeAiContent(content);

  const sections = {
    evaluation: [],
    solution: [],
    control: [],
    nextAction: [],
    metadata: [],
    other: [],
  };

  let currentSection = "other";

  normalizedContent.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    if (/^-{3,}$/.test(line)) {
      currentSection = "metadata";
      return;
    }

    const sectionMatch = matchAiSection(line);

    if (sectionMatch) {
      currentSection = sectionMatch.section;

      if (sectionMatch.value) {
        sections[currentSection].push(sectionMatch.value);
      }

      return;
    }

    sections[currentSection].push(line);
  });

  const parsedSteps = parseSolutionSteps(sections.solution);

  const metadataText = sections.metadata.join("\n");

  const sourceTicketIds = extractSourceTicketIds(metadataText);

  const fallback =
    cleanParagraph(sections.other.join(" ")) ||
    cleanParagraph(normalizedContent);

  return {
    evaluation:
      cleanParagraph(sections.evaluation.join(" ")) ||
      cleanParagraph(sections.other.join(" ")),
    solutionIntro: parsedSteps.intro,
    steps: parsedSteps.steps,
    warning: parsedSteps.warning,
    control: cleanParagraph(sections.control.join(" ")),
    nextAction: cleanParagraph(sections.nextAction.join(" ")),
    sourceTicketIds,
    fallback,
  };
}

function matchAiSection(line) {
  const sectionDefinitions = [
    {
      section: "evaluation",
      pattern: /^sorun\s+değerlendirmesi\s*:?\s*(.*)$/i,
    },
    {
      section: "solution",
      pattern: /^önerilen\s+çözüm\s*:?\s*(.*)$/i,
    },
    {
      section: "control",
      pattern: /^kontrol\s*:?\s*(.*)$/i,
    },
    {
      section: "nextAction",
      pattern: /^sonraki\s+işlem\s*:?\s*(.*)$/i,
    },
    {
      section: "metadata",
      pattern: /^rag\s+bilgileri\s*:?\s*(.*)$/i,
    },
  ];

  for (const definition of sectionDefinitions) {
    const match = line.match(definition.pattern);

    if (match) {
      return {
        section: definition.section,
        value: cleanTextLine(match[1] || ""),
      };
    }
  }

  return null;
}

function parseSolutionSteps(lines) {
  const steps = [];
  const introParts = [];
  const warningParts = [];

  let activeStepIndex = -1;

  lines.forEach((rawLine) => {
    const line = cleanTextLine(rawLine);

    if (!line) {
      return;
    }

    const warningMatch = line.match(/^(?:uyarı|önemli\s+uyarı)\s*:?\s*(.*)$/i);

    if (warningMatch) {
      warningParts.push(warningMatch[1] || line);
      return;
    }

    const numberedStep = line.match(/^\d+[.)]\s*(.+)$/);

    const bulletStep = line.match(/^[•-]\s*(.+)$/);

    const stepMatch = numberedStep || bulletStep;

    if (stepMatch) {
      steps.push(stepMatch[1].trim());
      activeStepIndex = steps.length - 1;
      return;
    }

    if (activeStepIndex >= 0) {
      steps[activeStepIndex] = `${steps[activeStepIndex]} ${line}`.trim();

      return;
    }

    introParts.push(line);
  });

  return {
    intro: cleanParagraph(introParts.join(" ")),
    steps,
    warning: cleanParagraph(warningParts.join(" ")),
  };
}

function extractSourceTicketIds(metadataText) {
  const sourceLine = metadataText
    .split("\n")
    .find((line) => /^kaynak\s+ticketlar\s*:/i.test(line.trim()));

  if (!sourceLine) {
    return [];
  }

  return sourceLine
    .replace(/^kaynak\s+ticketlar\s*:/i, "")
    .split(",")
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);
}

function getSourceTicketIds(aiSession, parsedSourceIds) {
  const directSourceIds = Array.isArray(aiSession?.source_request_ids)
    ? aiSession.source_request_ids
    : [];

  const selectedSourceIds =
    directSourceIds.length > 0 ? directSourceIds : parsedSourceIds;

  return [
    ...new Set(
      selectedSourceIds
        .map((requestId) => String(requestId).replace(/^#/, "").trim())
        .filter(Boolean),
    ),
  ];
}

function formatSourceTicketId(requestId) {
  const normalizedId = String(requestId || "").replace(/^#/, "");

  return `#${normalizedId}`;
}

function getConfidenceMeta(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const percentage =
    numericValue > 1
      ? clamp(numericValue, 0, 100)
      : clamp(numericValue, 0, 1) * 100;

  let tone = "low";
  let status = "Düşük eşleşme";

  if (percentage >= 80) {
    tone = "high";
    status = "Yüksek eşleşme";
  } else if (percentage >= 60) {
    tone = "medium";
    status = "Orta eşleşme";
  }

  return {
    value: percentage,
    label: `%${percentage.toFixed(2)}`,
    progress: percentage * 3.6,
    tone,
    status,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAiContent(content) {
  if (typeof content !== "string") {
    return "";
  }

  return content
    .replace(/\r\n/g, "\n")
    .replace(/\bBT\s+ekibi\b/gi, "IT ekibi")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*\*\s+/gm, "• ")
    .trim();
}

function cleanTextLine(value) {
  return String(value || "")
    .replace(/^\*+|\*+$/g, "")
    .trim();
}

function cleanParagraph(value) {
  return cleanTextLine(value).replace(/\s+/g, " ").trim();
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
