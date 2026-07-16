import { useState } from "react";
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

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const requestData = {
        ...formData,

        requester_name: formData.requester_name.trim() || null,

        department: formData.department.trim() || null,

        category: formData.category.trim() || null,

        subcategory: formData.subcategory.trim() || null,
      };

      const response = await api.post("/tickets", requestData);

      navigate(`/tickets/${response.data.ticket_id}`);
    } catch (err) {
      console.error(err);

      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((item) => item.msg).join(" "));
      } else {
        setError(detail || "Ticket oluşturulamadı.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Yeni Ticket</h1>
          <p>Yeni bir destek talebi oluştur</p>
        </div>
      </header>

      {error && <p className="error-message">{error}</p>}

      <section className="panel">
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
              />
            </FormField>

            <FormField label="Departman" htmlFor="department">
              <input
                id="department"
                name="department"
                type="text"
                value={formData.department}
                onChange={handleChange}
                maxLength={150}
                placeholder="Örneğin: İnsan Kaynakları"
              />
            </FormField>

            <FormField label="Kategori" htmlFor="category">
              <input
                id="category"
                name="category"
                type="text"
                value={formData.category}
                onChange={handleChange}
                maxLength={150}
                placeholder="Örneğin: E-posta"
              />
            </FormField>

            <FormField label="Alt kategori" htmlFor="subcategory">
              <input
                id="subcategory"
                name="subcategory"
                type="text"
                value={formData.subcategory}
                onChange={handleChange}
                maxLength={150}
                placeholder="Örneğin: Outlook"
              />
            </FormField>

            <FormField label="Öncelik" htmlFor="priority">
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
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
              onClick={() => navigate("/tickets")}
              disabled={loading}
            >
              İptal
            </button>

            <button type="submit" className="primary-button" disabled={loading}>
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

        {required && <span className="required-mark">*</span>}
      </label>

      {children}
    </div>
  );
}

export default CreateTicket;
