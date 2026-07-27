import { useEffect, useRef, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import api from "../api/api";
import AIImageUploadField from "../components/AIImageUploadField";
import AISessionImageGallery from "../components/AISessionImageGallery";
import SearchableSelect from "../components/SearchableSelect";

import {
  AISolutionLoading,
  AISolutionResult,
  FormField,
  PRIORITY_OPTIONS,
  ResolutionResultCard,
  getAiSessionId,
  getApiErrorMessage,
  getAssistantMessage,
  getConfidenceMeta,
  getSourceTicketIds,
  initialFormData,
  parseAiSolution,
  uploadSessionImages,
} from "./CreateTicketParts";

function CreateTicket() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeSessionId = getAiSessionId(location.search);

  const resolutionRequestInFlight = useRef(false);
  const imageUploadRef = useRef(null);

  const [formData, setFormData] = useState(initialFormData);

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const [sessionLoading, setSessionLoading] = useState(
    Boolean(activeSessionId),
  );

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

  const isBusy = aiLoading || sessionLoading || resolutionLoading;

  const shouldShowForm = !aiLoading && !sessionLoading && !aiSession;

  const shouldShowPageHeader = shouldShowForm;

  useEffect(() => {
    if (!activeSessionId) {
      setSessionLoading(false);

      return undefined;
    }

    if (aiSession?.session_id === activeSessionId) {
      setSessionLoading(false);

      return undefined;
    }

    let cancelled = false;

    async function loadAiSession() {
      try {
        setSessionLoading(true);
        setError("");

        const response = await api.get(`/ai/sessions/${activeSessionId}`);

        if (!cancelled) {
          setAiSession(response.data);
        }
      } catch (requestError) {
        console.error(requestError);

        if (!cancelled) {
          setAiSession(null);

          setError(
            getApiErrorMessage(
              requestError,
              "Önceki AI çözümü yeniden yüklenemedi.",
            ),
          );

          navigate("/ai-support", {
            replace: true,
          });
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    }

    loadAiSession();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, aiSession?.session_id, navigate]);

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

    /*
     * setAiLoading(true) formu ve görsel bileşenini ekrandan
     * kaldıracağı için dosyalar yükleme başlamadan önce alınır.
     */
    const selectedImages = [...(imageUploadRef.current?.getFiles?.() || [])];

    let requestStage = "session";

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

      if (selectedImages.length > 0) {
        requestStage = "images";

        await uploadSessionImages(sessionId, selectedImages);
      }

      requestStage = "solution";

      const solutionResponse = await api.post(
        `/ai/sessions/${sessionId}/solution`,
      );

      const completedSession = solutionResponse.data;

      imageUploadRef.current?.clear?.();

      setAiSession(completedSession);

      navigate(`/ai-support?session=${completedSession.session_id}`, {
        replace: true,
      });
    } catch (requestError) {
      console.error(requestError);

      let fallbackMessage =
        "AI çözümü oluşturulamadı. " + "Lütfen daha sonra tekrar deneyin.";

      if (requestStage === "session") {
        fallbackMessage =
          "AI oturumu oluşturulamadı. " + "Lütfen daha sonra tekrar deneyin.";
      }

      if (requestStage === "images") {
        fallbackMessage =
          "Görseller yüklenemedi. " + "AI çözümü oluşturulmadı.";
      }

      setError(getApiErrorMessage(requestError, fallbackMessage));
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

    imageUploadRef.current?.clear?.();

    setFormData(initialFormData);
    setAiSession(null);
    setPendingResolution(null);
    setError("");

    navigate("/ai-support", {
      replace: true,
    });
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

            <p
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.5,
              }}
            >
              Sorununuzu tanımlayın; geçmiş benzer kayıtlar incelenerek
              uygulanabilir bir çözüm planı hazırlansın.
            </p>
          </div>
        </header>
      ) : null}

      {optionsError ? <p className="error-message">{optionsError}</p> : null}

      {error ? <p className="error-message">{error}</p> : null}

      {sessionLoading ? (
        <section className="page-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />

          <span>Çözüm yeniden yükleniyor...</span>
        </section>
      ) : null}

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
                placeholder={
                  "Sorunu, hata mesajını ve daha önce " +
                  "denediğiniz işlemleri ayrıntılı " +
                  "şekilde açıklayın..."
                }
                disabled={isBusy}
                required
              />
            </FormField>

            <AIImageUploadField ref={imageUploadRef} disabled={isBusy} />

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
        <>
          <AISessionImageGallery sessionId={aiSession.session_id} />

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
        </>
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

export default CreateTicket;
