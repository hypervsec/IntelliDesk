import { useCallback, useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useTheme } from "../theme/ThemeContext";

const MOBILE_QUERY = "(max-width: 720px)";

function getInitialMobileState() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(MOBILE_QUERY).matches;
}

function NotificationsMenu() {
  const containerRef = useRef(null);

  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [isMobile, setIsMobile] = useState(getInitialMobileState);
  const [isOpen, setIsOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [readingNotificationId, setReadingNotificationId] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");

  const colors = getThemeColors(isDark);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const response = await api.get("/notifications", {
        params: {
          limit: 20,
        },
      });

      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail || "Bildirimler yüklenemedi.",
      );
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);

    function handleMediaChange(event) {
      setIsMobile(event.matches);
    }

    setIsMobile(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(initialLoadTimer);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      void loadNotifications({
        silent: true,
      });
    }, 15000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobile) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMobile]);

  function handleToggleNotifications() {
    const nextIsOpen = !isOpen;

    setIsOpen(nextIsOpen);

    if (nextIsOpen) {
      void loadNotifications({
        silent: true,
      });
    }
  }

  async function markNotificationAsRead(notificationId) {
    const selectedNotification = notifications.find(
      (notification) => notification.notification_id === notificationId,
    );

    if (!selectedNotification || selectedNotification.is_read) {
      return true;
    }

    if (readingNotificationId !== null) {
      return false;
    }

    setReadingNotificationId(notificationId);

    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.notification_id === notificationId
            ? response.data
            : notification,
        ),
      );

      setUnreadCount((currentCount) => Math.max(currentCount - 1, 0));
      setErrorMessage("");

      return true;
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail || "Bildirim güncellenemedi.",
      );

      return false;
    } finally {
      setReadingNotificationId(null);
    }
  }

  async function handleNotificationClick(notification) {
    const readWasSuccessful = await markNotificationAsRead(
      notification.notification_id,
    );

    if (!readWasSuccessful) {
      return;
    }

    setIsOpen(false);

    if (notification.ticket_id) {
      navigate(`/tickets/${notification.ticket_id}`);
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0 || isMarkingAll) {
      return;
    }

    setIsMarkingAll(true);

    try {
      await api.patch("/notifications/read-all");

      const readTime = new Date().toISOString();

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at || readTime,
        })),
      );

      setUnreadCount(0);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail || "Bildirimler güncellenemedi.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  const containerStyle = {
    position: "relative",
    flex: "0 0 auto",
  };

  const triggerSize = isMobile ? "40px" : "42px";

  const triggerStyle = {
    position: "relative",

    width: triggerSize,
    height: triggerSize,

    display: "grid",
    placeItems: "center",

    flex: `0 0 ${triggerSize}`,

    border: `1px solid ${colors.border}`,
    borderRadius: "11px",
    padding: 0,

    color: colors.text,
    background: isOpen ? colors.triggerActive : colors.trigger,

    boxShadow: colors.triggerShadow,

    cursor: "pointer",
  };

  const badgeStyle = {
    position: "absolute",
    top: "-5px",
    right: "-5px",

    minWidth: "19px",
    height: "19px",

    display: "grid",
    placeItems: "center",

    border: `2px solid ${colors.badgeBorder}`,
    borderRadius: "999px",
    padding: "0 5px",

    color: "#ffffff",
    background: "#e11d48",

    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1,
  };

  const panelStyle = {
    position: isMobile ? "fixed" : "absolute",

    top: isMobile
      ? "calc(var(--topbar-height, 60px) + 8px)"
      : "calc(100% + 12px)",

    right: isMobile ? "12px" : 0,
    left: "auto",

    zIndex: 100,

    width: isMobile
      ? "min(350px, calc(100vw - 28px))"
      : "min(380px, calc(100vw - 32px))",

    maxWidth: isMobile ? "calc(100vw - 28px)" : "none",

    maxHeight: isMobile
      ? "min(560px, calc(100dvh - var(--topbar-height, 60px) - 28px))"
      : "min(560px, calc(100vh - 92px))",

    display: "flex",
    flexDirection: "column",

    overflow: "hidden",

    border: `1px solid ${colors.border}`,
    borderRadius: isMobile ? "13px" : "16px",

    background: colors.panel,
    boxShadow: colors.panelShadow,
  };

  const panelHeaderStyle = {
    minWidth: 0,

    display: "flex",
    alignItems: isMobile ? "flex-start" : "center",
    justifyContent: "space-between",
    gap: isMobile ? "8px" : "16px",

    flex: "0 0 auto",

    borderBottom: `1px solid ${colors.divider}`,
    padding: isMobile ? "11px 12px" : "17px 18px",

    background: colors.header,
  };

  const panelHeadingStyle = {
    minWidth: 0,
  };

  const panelTitleStyle = {
    margin: 0,

    color: colors.text,

    fontSize: isMobile ? "13px" : "15px",
    fontWeight: 800,
    lineHeight: 1.25,
  };

  const panelSubtitleStyle = {
    display: "block",

    marginTop: "3px",

    color: colors.muted,

    fontSize: isMobile ? "9px" : "11px",
    lineHeight: 1.4,
  };

  const markAllButtonStyle = {
    maxWidth: isMobile ? "112px" : "none",

    flex: "0 0 auto",

    border: 0,
    padding: 0,

    color: colors.primary,
    background: "transparent",

    fontSize: isMobile ? "9px" : "11px",
    fontWeight: 800,
    lineHeight: 1.3,
    textAlign: "right",
    whiteSpace: isMobile ? "normal" : "nowrap",

    cursor: isMarkingAll ? "wait" : "pointer",
    opacity: isMarkingAll ? 0.65 : 1,
  };

  const listStyle = {
    minHeight: 0,

    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",

    maxHeight: isMobile ? "none" : "390px",

    overflowY: "auto",
    overflowX: "hidden",

    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
  };

  const panelMessageStyle = {
    padding: isMobile ? "20px 14px" : "30px 20px",

    color: colors.muted,

    fontSize: isMobile ? "10px" : "12px",
    lineHeight: 1.55,
    textAlign: "center",
  };

  const errorMessageStyle = {
    ...panelMessageStyle,
    color: colors.error,
  };

  const panelFooterStyle = {
    flex: "0 0 auto",

    borderTop: `1px solid ${colors.divider}`,
    padding: isMobile ? "8px 10px" : "13px 18px",

    color: colors.muted,
    background: colors.footer,

    fontSize: isMobile ? "8.5px" : "11px",
    lineHeight: 1.35,
    textAlign: "center",
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      <button
        type="button"
        style={triggerStyle}
        aria-label="Bildirimleri aç"
        aria-expanded={isOpen}
        aria-controls="notifications-panel"
        title="Bildirimler"
        onClick={handleToggleNotifications}
      >
        <BellIcon />

        {unreadCount > 0 ? (
          <span style={badgeStyle}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          id="notifications-panel"
          style={panelStyle}
          aria-label="Bildirimler"
          role={isMobile ? "dialog" : undefined}
          aria-modal={isMobile ? "true" : undefined}
        >
          <header style={panelHeaderStyle}>
            <div style={panelHeadingStyle}>
              <h2 style={panelTitleStyle}>Bildirimler</h2>

              <span style={panelSubtitleStyle}>
                {unreadCount > 0
                  ? `${unreadCount} okunmamış bildirim`
                  : "Tüm bildirimler okundu"}
              </span>
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                style={markAllButtonStyle}
                disabled={isMarkingAll}
                onClick={() => {
                  void markAllAsRead();
                }}
              >
                {isMarkingAll ? "Güncelleniyor..." : "Tümünü okundu yap"}
              </button>
            ) : null}
          </header>

          <div style={listStyle}>
            {isLoading ? (
              <div style={panelMessageStyle}>Bildirimler yükleniyor...</div>
            ) : null}

            {!isLoading && errorMessage ? (
              <div style={errorMessageStyle} role="alert">
                {errorMessage}
              </div>
            ) : null}

            {!isLoading && !errorMessage && notifications.length === 0 ? (
              <div style={panelMessageStyle}>
                Henüz bildiriminiz bulunmuyor.
              </div>
            ) : null}

            {!isLoading && !errorMessage
              ? notifications.map((notification) => {
                  const isUnread = !notification.is_read;

                  const isReading =
                    readingNotificationId === notification.notification_id;

                  const notificationStyle = {
                    position: "relative",

                    width: "100%",

                    display: "flex",
                    alignItems: "flex-start",
                    gap: isMobile ? "8px" : "12px",

                    border: 0,
                    borderBottom: `1px solid ${colors.divider}`,
                    padding: isMobile ? "10px 11px" : "15px 18px",

                    color: colors.text,
                    background: isUnread ? colors.unread : colors.panel,

                    font: "inherit",
                    textAlign: "left",

                    cursor: isReading
                      ? "wait"
                      : notification.ticket_id
                        ? "pointer"
                        : "default",

                    opacity: isReading ? 0.7 : 1,
                  };

                  const typeBadgeSize = isMobile ? "28px" : "38px";

                  const typeBadgeStyle = {
                    width: typeBadgeSize,
                    height: typeBadgeSize,

                    display: "grid",
                    placeItems: "center",

                    flex: `0 0 ${typeBadgeSize}`,

                    borderRadius: isMobile ? "8px" : "11px",

                    color: colors.primary,
                    background: colors.typeBackground,

                    fontSize: isMobile ? "8px" : "10px",
                    fontWeight: 800,
                  };

                  const notificationContentStyle = {
                    minWidth: 0,
                    flex: 1,
                  };

                  const notificationTitleStyle = {
                    display: "block",

                    color: colors.text,

                    fontSize: isMobile ? "11px" : "12px",
                    fontWeight: 800,
                    lineHeight: 1.35,

                    overflowWrap: "anywhere",
                  };

                  const notificationDescriptionStyle = {
                    display: "block",

                    marginTop: isMobile ? "3px" : "5px",

                    color: colors.muted,

                    fontSize: isMobile ? "9.5px" : "11px",
                    lineHeight: isMobile ? 1.4 : 1.5,

                    overflowWrap: "anywhere",
                  };

                  const notificationTimeStyle = {
                    display: "block",

                    marginTop: isMobile ? "5px" : "7px",

                    color: colors.time,

                    fontSize: isMobile ? "8.5px" : "10px",
                    lineHeight: 1.3,
                  };

                  const unreadDotStyle = {
                    width: isMobile ? "7px" : "8px",
                    height: isMobile ? "7px" : "8px",

                    flex: isMobile ? "0 0 7px" : "0 0 8px",

                    marginTop: "4px",

                    borderRadius: "50%",

                    background: colors.primary,
                    boxShadow: `0 0 0 3px ${colors.dotShadow}`,
                  };

                  return (
                    <button
                      key={notification.notification_id}
                      type="button"
                      style={notificationStyle}
                      disabled={isReading}
                      onClick={() => {
                        void handleNotificationClick(notification);
                      }}
                    >
                      <span style={typeBadgeStyle}>
                        {getNotificationTypeLabel(
                          notification.notification_type,
                        )}
                      </span>

                      <span style={notificationContentStyle}>
                        <strong style={notificationTitleStyle}>
                          {notification.title}
                        </strong>

                        <span style={notificationDescriptionStyle}>
                          {notification.message}
                        </span>

                        <span style={notificationTimeStyle}>
                          {formatNotificationTime(notification.created_at)}
                        </span>
                      </span>

                      {isUnread ? (
                        <span style={unreadDotStyle} aria-label="Okunmamış" />
                      ) : null}
                    </button>
                  );
                })
              : null}
          </div>

          <footer style={panelFooterStyle}>
            Bildirimler 15 saniyede bir otomatik yenilenir.
          </footer>
        </section>
      ) : null}
    </div>
  );
}

function getNotificationTypeLabel(notificationType) {
  if (notificationType?.startsWith("sla_")) {
    return "SLA";
  }

  const typeLabels = {
    ticket_assigned: "Ticket",
    ticket_status_changed: "Durum",
    ai_recommendation_created: "AI",
  };

  return typeLabels[notificationType] || "Bilgi";
}

function formatNotificationTime(createdAt) {
  if (!createdAt) {
    return "";
  }

  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return "";
  }

  const differenceInSeconds = Math.round(
    (createdDate.getTime() - Date.now()) / 1000,
  );

  const absoluteDifference = Math.abs(differenceInSeconds);

  if (absoluteDifference < 60) {
    return "Az önce";
  }

  const relativeTimeFormat = new Intl.RelativeTimeFormat("tr", {
    numeric: "auto",
  });

  if (absoluteDifference < 3600) {
    return relativeTimeFormat.format(
      Math.round(differenceInSeconds / 60),
      "minute",
    );
  }

  if (absoluteDifference < 86400) {
    return relativeTimeFormat.format(
      Math.round(differenceInSeconds / 3600),
      "hour",
    );
  }

  return relativeTimeFormat.format(
    Math.round(differenceInSeconds / 86400),
    "day",
  );
}

function getThemeColors(isDark) {
  if (isDark) {
    return {
      trigger: "#1b2636",
      triggerActive: "#24344a",
      triggerShadow: "0 8px 20px rgb(2 6 23 / 22%)",

      panel: "#141d2a",
      header: "#1a2636",
      footer: "#182333",
      unread: "#1d2d43",

      border: "#304158",
      divider: "#29384c",

      text: "#f1f5f9",
      muted: "#a4b2c5",
      time: "#7f91aa",

      primary: "#60a5fa",
      error: "#fda4af",

      typeBackground: "rgb(59 130 246 / 17%)",
      dotShadow: "rgb(96 165 250 / 15%)",

      badgeBorder: "#1b2636",
      panelShadow: "0 24px 60px rgb(2 6 23 / 36%)",
    };
  }

  return {
    trigger: "#eef3f9",
    triggerActive: "#e1eaf6",
    triggerShadow: "0 6px 18px rgb(31 45 72 / 8%)",

    panel: "#f5f8fc",
    header: "#edf3fa",
    footer: "#edf3fa",
    unread: "#e7f0ff",

    border: "#d7e0ec",
    divider: "#dce4ef",

    text: "#172033",
    muted: "#66758b",
    time: "#8b98aa",

    primary: "#2563eb",
    error: "#be123c",

    typeBackground: "rgb(37 99 235 / 12%)",
    dotShadow: "rgb(37 99 235 / 12%)",

    badgeBorder: "#eef3f9",
    panelShadow: "0 24px 60px rgb(31 45 72 / 18%)",
  };
}

function BellIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"} />

      <path d="M10 21h4" />
    </svg>
  );
}

export default NotificationsMenu;
