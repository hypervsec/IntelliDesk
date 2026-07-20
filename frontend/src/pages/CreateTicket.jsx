import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";

const initialFormData = {
  title: "",
  description: "",
  requester_name: "",
  department: "",
  category: "",
  subcategory: "",
  priority: "medium",
};

function CreateTicket() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(initialFormData);

  const [departments, setDepartments] = useState([]);

  const [categories, setCategories] = useState([]);

  const [subcategories, setSubcategories] = useState([]);

  const [loading, setLoading] = useState(false);

  const [optionsLoading, setOptionsLoading] = useState(true);

  const [error, setError] = useState("");

  const [optionsError, setOptionsError] = useState("");

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
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setDepartments([]);
          setCategories([]);
          setSubcategories([]);

          setOptionsError(
            getApiErrorMessage(
              err,
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

  function handleChange(event) {
    const { name, value } = event.target;

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

  async function handleSubmit(event) {
    event.preventDefault();

    const title = formData.title.trim();

    const description = formData.description.trim();

    if (title.length < 3) {
      setError("Konu en az 3 karakter olmalıdır.");
      return;
    }

    if (description.length < 3) {
      setError("Açıklama en az 3 karakter olmalıdır.");
      return;
    }

    if (!formData.department) {
      setError("Lütfen bir departman seçin.");
      return;
    }

    if (!formData.category) {
      setError("Lütfen bir kategori seçin.");
      return;
    }

    if (!formData.subcategory) {
      setError("Lütfen bir alt kategori seçin.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const requestData = {
        title,
        description,
        requester_name: formData.requester_name.trim() || null,
        department: formData.department,
        category: formData.category,
        subcategory: formData.subcategory,
        priority: formData.priority,
      };

      const response = await api.post("/tickets", requestData);

      navigate(`/tickets/${response.data.ticket_id}`);
    } catch (err) {
      console.error(err);

      setError(getApiErrorMessage(err, "Ticket oluşturulamadı."));
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/tickets");
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">YENİ KAYIT</span>

          <h1>Yeni Ticket</h1>

          <p>Talep bilgilerini eksiksiz doldurarak destek kaydı oluştur.</p>
        </div>
      </header>

      {optionsError ? <p className="error-message">{optionsError}</p> : null}

      {error ? <p className="error-message">{error}</p> : null}

      <section className="panel form-panel">
        <div className="form-panel-heading">
          <div>
            <span className="section-kicker">TICKET BİLGİLERİ</span>

            <h2>Destek talebi detayları</h2>

            <p>Zorunlu alanlar yıldız işaretiyle belirtilmiştir.</p>
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
              placeholder="Örneğin: Outlook açılmıyor"
              disabled={loading}
              required
            />
          </FormField>

          <FormField label="Açıklama" htmlFor="description" required>
            <textarea
              id="description"
              name="description"
              rows={6}
              value={formData.description}
              onChange={handleChange}
              minLength={3}
              placeholder="Sorunu ayrıntılı şekilde açıklayın..."
              disabled={loading}
              required
            />
          </FormField>

          <div className="form-grid">
            <FormField label="Talep sahibi" htmlFor="requester_name">
              <input
                id="requester_name"
                name="requester_name"
                type="text"
                value={formData.requester_name}
                onChange={handleChange}
                maxLength={150}
                placeholder="Ad soyad"
                disabled={loading}
              />
            </FormField>

            <FormField label="Departman" htmlFor="department" required>
              <select
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                disabled={loading || optionsLoading || departments.length === 0}
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
                  loading ||
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
                  loading ||
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
                disabled={loading}
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
              disabled={loading}
            >
              İptal
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={
                loading ||
                optionsLoading ||
                !formData.department ||
                !formData.category ||
                !formData.subcategory
              }
            >
              {loading ? "Oluşturuluyor..." : "Ticket Oluştur"}
            </button>
          </div>
        </form>
      </section>
    </main>
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

export default CreateTicket;
