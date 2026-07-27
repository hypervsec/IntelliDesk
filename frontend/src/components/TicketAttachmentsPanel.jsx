import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

import "../styles/tickets/ticket-attachments.css";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".pdf",
  ".txt",
  ".log",
]);

function TicketAttachmentsPanel({ ticketId, onAttachmentsChanged }) {
  const { account } = useAuth();

  const fileInputRef = useRef(null);

  const [attachments, setAttachments] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);

  const [attachmentsLoading, setAttachmentsLoading] = useState(true);

  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const [attachmentActionId, setAttachmentActionId] = useState(null);

  const [attachmentActionType, setAttachmentActionType] = useState("");

  const [attachmentError, setAttachmentError] = useState("");

  const [attachmentMessage, setAttachmentMessage] = useState("");

  const loadAttachments = useCallback(
    async ({ showLoading = true } = {}) => {
      if (!ticketId) {
        setAttachments([]);
        setAttachmentsLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setAttachmentsLoading(true);
        }

        setAttachmentError("");

        const response = await api.get(`/tickets/${ticketId}/attachments`);

        const attachmentList = Array.isArray(response.data)
          ? response.data
          : [];

        setAttachments(attachmentList);
      } catch (requestError) {
        console.error(requestError);

        setAttachmentError(
          getApiErrorMessage(requestError, "Ticket dosyaları alınamadı."),
        );
      } finally {
        setAttachmentsLoading(false);
      }
    },
    [ticketId],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadAttachments();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [loadAttachments]);

  const sortedAttachments = useMemo(
    () =>
      [...attachments].sort(
        (firstAttachment, secondAttachment) =>
          getTimestamp(secondAttachment.created_at) -
          getTimestamp(firstAttachment.created_at),
      ),
    [attachments],
  );

  function selectAttachment(event) {
    const file = event.target.files?.[0] || null;

    setAttachmentError("");
    setAttachmentMessage("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = getFileExtension(file.name);

    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      setSelectedFile(null);
      resetFileInput();

      setAttachmentError(
        "Yalnızca PNG, JPG, JPEG, WEBP, PDF, TXT ve LOG dosyaları yüklenebilir.",
      );

      return;
    }

    if (file.size <= 0) {
      setSelectedFile(null);
      resetFileInput();

      setAttachmentError("Boş dosya yüklenemez.");

      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      resetFileInput();

      setAttachmentError("Dosya boyutu en fazla 10 MB olabilir.");

      return;
    }

    setSelectedFile(file);
  }

  async function uploadAttachment(event) {
    event.preventDefault();

    if (!selectedFile) {
      setAttachmentError("Yüklenecek dosyayı seç.");

      return;
    }

    const formData = new FormData();

    formData.append("file", selectedFile);

    try {
      setAttachmentUploading(true);
      setAttachmentError("");
      setAttachmentMessage("");

      const response = await api.post(
        `/tickets/${ticketId}/attachments`,
        formData,
      );

      setAttachments((currentAttachments) => [
        response.data,
        ...currentAttachments,
      ]);

      setSelectedFile(null);
      resetFileInput();

      setAttachmentMessage("Dosya ticket üzerine başarıyla yüklendi.");

      if (typeof onAttachmentsChanged === "function") {
        await onAttachmentsChanged();
      }
    } catch (requestError) {
      console.error(requestError);

      setAttachmentError(
        getApiErrorMessage(requestError, "Dosya yüklenemedi."),
      );
    } finally {
      setAttachmentUploading(false);
    }
  }

  async function openAttachment(attachment, download) {
    let previewWindow = null;

    if (!download) {
      previewWindow = window.open("about:blank", "_blank");

      if (previewWindow) {
        previewWindow.opener = null;

        previewWindow.document.title = "Dosya yükleniyor...";
      }
    }

    try {
      setAttachmentActionId(attachment.attachment_id);

      setAttachmentActionType(download ? "download" : "open");

      setAttachmentError("");
      setAttachmentMessage("");

      const response = await api.get(
        `/tickets/${ticketId}/attachments/${attachment.attachment_id}/content`,
        {
          params: {
            download,
          },
          responseType: "blob",
        },
      );

      const contentType =
        response.headers?.["content-type"] ||
        attachment.content_type ||
        "application/octet-stream";

      const blob = new Blob([response.data], {
        type: contentType,
      });

      const objectUrl = URL.createObjectURL(blob);

      if (download) {
        const downloadLink = document.createElement("a");

        downloadLink.href = objectUrl;

        downloadLink.download = attachment.original_filename;

        document.body.appendChild(downloadLink);

        downloadLink.click();
        downloadLink.remove();
      } else if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, "_blank");
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (requestError) {
      console.error(requestError);

      if (previewWindow && !previewWindow.closed) {
        previewWindow.close();
      }

      setAttachmentError(
        getApiErrorMessage(
          requestError,
          download ? "Dosya indirilemedi." : "Dosya açılamadı.",
        ),
      );
    } finally {
      setAttachmentActionId(null);
      setAttachmentActionType("");
    }
  }

  async function deleteAttachment(attachment) {
    const deleteConfirmed = window.confirm(
      `${attachment.original_filename} dosyası silinsin mi?`,
    );

    if (!deleteConfirmed) {
      return;
    }

    try {
      setAttachmentActionId(attachment.attachment_id);

      setAttachmentActionType("delete");

      setAttachmentError("");
      setAttachmentMessage("");

      await api.delete(
        `/tickets/${ticketId}/attachments/${attachment.attachment_id}`,
      );

      setAttachments((currentAttachments) =>
        currentAttachments.filter(
          (currentAttachment) =>
            currentAttachment.attachment_id !== attachment.attachment_id,
        ),
      );

      setAttachmentMessage("Dosya eki başarıyla silindi.");

      if (typeof onAttachmentsChanged === "function") {
        await onAttachmentsChanged();
      }
    } catch (requestError) {
      console.error(requestError);

      setAttachmentError(getApiErrorMessage(requestError, "Dosya silinemedi."));
    } finally {
      setAttachmentActionId(null);
      setAttachmentActionType("");
    }
  }

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function canDeleteAttachment(attachment) {
    const isStaff = account?.role === "admin" || account?.role === "technician";

    const isUploader =
      Number(account?.account_id) === Number(attachment.uploader_account_id);

    return isStaff || isUploader;
  }

  return (
    <section className="panel ticket-attachments-panel ticket-attachments-section">
      <div className="panel-header ticket-attachments-panel-header">
        <div>
          <span className="section-kicker">DOSYA EKLERİ</span>

          <h2>Ticket Dosyaları</h2>

          <p>Ekran görüntüsü, PDF, metin veya log dosyası ekle.</p>
        </div>

        <div className="ticket-attachments-header-actions">
          <span className="ticket-attachments-count">
            {attachments.length} dosya
          </span>

          <button
            type="button"
            className="secondary-button ticket-attachments-refresh"
            disabled={attachmentsLoading}
            onClick={() => {
              void loadAttachments({
                showLoading: false,
              });
            }}
          >
            Yenile
          </button>
        </div>
      </div>

      <form className="ticket-attachment-form" onSubmit={uploadAttachment}>
        <label
          className="ticket-file-selector"
          htmlFor={`ticketAttachment-${ticketId}`}
        >
          <input
            ref={fileInputRef}
            id={`ticketAttachment-${ticketId}`}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log,image/png,image/jpeg,image/webp,application/pdf,text/plain"
            disabled={attachmentUploading}
            onChange={selectAttachment}
          />

          <span className="ticket-file-selector-icon">+</span>

          <span className="ticket-file-selector-text">
            <strong>{selectedFile ? selectedFile.name : "Dosya seç"}</strong>

            <small>PNG, JPG, WEBP, PDF, TXT veya LOG · En fazla 10 MB</small>
          </span>
        </label>

        <button
          type="submit"
          className="primary-button ticket-attachment-upload-button"
          disabled={attachmentUploading || !selectedFile}
        >
          {attachmentUploading ? "Yükleniyor..." : "Dosyayı Yükle"}
        </button>
      </form>

      {attachmentError ? (
        <p className="error-message ticket-attachment-message">
          {attachmentError}
        </p>
      ) : null}

      {attachmentMessage ? (
        <p className="success-message ticket-attachment-message">
          {attachmentMessage}
        </p>
      ) : null}

      {attachmentsLoading ? (
        <div className="ticket-attachments-loading">
          <div className="loading-spinner" aria-hidden="true" />

          <span>Ticket dosyaları yükleniyor...</span>
        </div>
      ) : null}

      {!attachmentsLoading && sortedAttachments.length === 0 ? (
        <div className="ticket-attachments-empty">
          <strong>Henüz dosya eklenmemiş.</strong>

          <span>
            İlk ekran görüntüsü, PDF veya log dosyası burada görünecek.
          </span>
        </div>
      ) : null}

      {!attachmentsLoading && sortedAttachments.length > 0 ? (
        <div className="ticket-attachments-list">
          {sortedAttachments.map((attachment) => {
            const actionInProgress =
              attachmentActionId === attachment.attachment_id;

            return (
              <article
                className="ticket-attachment-card"
                key={attachment.attachment_id}
              >
                <div className="ticket-attachment-type">
                  {getAttachmentMarker(attachment.file_extension)}
                </div>

                <div className="ticket-attachment-info">
                  <strong title={attachment.original_filename}>
                    {attachment.original_filename}
                  </strong>

                  <span>
                    {getAttachmentTypeLabel(attachment.file_extension)}
                    {" · "}
                    {formatFileSize(attachment.size_bytes)}
                  </span>

                  <small>
                    {attachment.uploader_name || "Bilinmeyen kullanıcı"}
                    {" · "}
                    {formatDate(attachment.created_at)}
                  </small>
                </div>

                <div className="ticket-attachment-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={actionInProgress}
                    onClick={() => {
                      void openAttachment(attachment, false);
                    }}
                  >
                    {actionInProgress && attachmentActionType === "open"
                      ? "Açılıyor..."
                      : "Aç"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={actionInProgress}
                    onClick={() => {
                      void openAttachment(attachment, true);
                    }}
                  >
                    {actionInProgress && attachmentActionType === "download"
                      ? "İndiriliyor..."
                      : "İndir"}
                  </button>

                  {canDeleteAttachment(attachment) ? (
                    <button
                      type="button"
                      className="danger-button ticket-attachment-delete-button"
                      disabled={actionInProgress}
                      onClick={() => {
                        void deleteAttachment(attachment);
                      }}
                    >
                      {actionInProgress && attachmentActionType === "delete"
                        ? "Siliniyor..."
                        : "Sil"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function getFileExtension(filename) {
  const normalizedFilename = String(filename || "")
    .trim()
    .toLowerCase();

  const lastDotIndex = normalizedFilename.lastIndexOf(".");

  if (lastDotIndex < 0) {
    return "";
  }

  return normalizedFilename.slice(lastDotIndex);
}

function getAttachmentMarker(extension) {
  if (
    extension === ".png" ||
    extension === ".jpg" ||
    extension === ".jpeg" ||
    extension === ".webp"
  ) {
    return "G";
  }

  if (extension === ".pdf") {
    return "P";
  }

  if (extension === ".log") {
    return "L";
  }

  if (extension === ".txt") {
    return "T";
  }

  return "D";
}

function getAttachmentTypeLabel(extension) {
  if (
    extension === ".png" ||
    extension === ".jpg" ||
    extension === ".jpeg" ||
    extension === ".webp"
  ) {
    return "Görsel";
  }

  if (extension === ".pdf") {
    return "PDF belgesi";
  }

  if (extension === ".log") {
    return "Log dosyası";
  }

  if (extension === ".txt") {
    return "Metin dosyası";
  }

  return "Dosya";
}

function formatFileSize(sizeBytes) {
  const normalizedSize = Number(sizeBytes);

  if (!Number.isFinite(normalizedSize) || normalizedSize < 0) {
    return "Boyut bilinmiyor";
  }

  if (normalizedSize < 1024) {
    return `${normalizedSize} B`;
  }

  if (normalizedSize < 1024 * 1024) {
    return `${(normalizedSize / 1024).toFixed(1)} KB`;
  }

  return `${(normalizedSize / (1024 * 1024)).toFixed(2)} MB`;
}

function getTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function formatDate(value) {
  if (!value) {
    return "Tarih belirtilmemiş";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tarih belirtilmemiş";
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

export default TicketAttachmentsPanel;
