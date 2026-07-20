import { useEffect, useRef, useState } from "react";

import { useTheme } from "../theme/ThemeContext";

const initialNotifications = [
  {
    id: 1,
    title: "Yeni ticket atandı",
    description: "Yazıcı bağlantı sorunu ticketı size atandı.",
    time: "5 dakika önce",
    type: "Ticket",
    isUnread: true,
  },
  {
    id: 2,
    title: "AI önerisi hazır",
    description: "Outlook bağlantı sorunu için çözüm önerisi oluşturuldu.",
    time: "18 dakika önce",
    type: "AI",
    isUnread: true,
  },
  {
    id: 3,
    title: "Ticket durumu değişti",
    description: "Ağ erişimi ticketı çözüldü olarak işaretlendi.",
    time: "1 saat önce",
    type: "Durum",
    isUnread: false,
  },
];

const containerStyle = {
  position: "relative",
};

const panelLayoutStyle = {
  position: "absolute",
  top: "calc(100% + 12px)",
  right: 0,
  zIndex: 50,
  width: "min(380px, calc(100vw - 32px))",
  overflow: "hidden",
  borderRadius: "16px",
};

const panelHeaderLayoutStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "17px 18px",
};

const panelTitleStyle = {
  margin: 0,
  fontSize: "15px",
};

const panelSubtitleLayoutStyle = {
  display: "block",
  marginTop: "4px",
  fontSize: "11px",
};

const markAllButtonLayoutStyle = {
  padding: 0,
  border: 0,
  background: "transparent",
  fontSize: "11px",
  fontWeight: 800,
  cursor: "pointer",
};

const listStyle = {
  display: "flex",
  maxHeight: "390px",
  overflowY: "auto",
  flexDirection: "column",
};

const notificationButtonLayoutStyle = {
  position: "relative",
  display: "flex",
  width: "100%",
  alignItems: "flex-start",
  gap: "12px",
  padding: "15px 18px",
  border: 0,
  textAlign: "left",
  cursor: "pointer",
};

const typeBadgeLayoutStyle = {
  display: "grid",
  width: "38px",
  height: "38px",
  flex: "0 0 38px",
  placeItems: "center",
  borderRadius: "11px",
  fontSize: "10px",
  fontWeight: 800,
};

const notificationContentStyle = {
  minWidth: 0,
  flex: 1,
};

const notificationTitleLayoutStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 800,
};

const notificationDescriptionLayoutStyle = {
  display: "block",
  marginTop: "5px",
  fontSize: "11px",
  lineHeight: 1.5,
};

const notificationTimeLayoutStyle = {
  display: "block",
  marginTop: "7px",
  fontSize: "10px",
};

const unreadDotLayoutStyle = {
  width: "8px",
  height: "8px",
  marginTop: "5px",
  flex: "0 0 8px",
  borderRadius: "50%",
};

const panelFooterLayoutStyle = {
  padding: "13px 18px",
  fontSize: "11px",
  textAlign: "center",
};

function NotificationsMenu() {
  const containerRef = useRef(null);

  const { isDark } = useTheme();

  const [isOpen, setIsOpen] = useState(false);

  const [notifications, setNotifications] = useState(initialNotifications);

  const colors = getThemeColors(isDark);

  const unreadCount = notifications.filter(
    (notification) => notification.isUnread,
  ).length;

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

  function markNotificationAsRead(notificationId) {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              isUnread: false,
            }
          : notification,
      ),
    );
  }

  function markAllAsRead() {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({
        ...notification,
        isUnread: false,
      })),
    );
  }

  const triggerStyle = {
    position: "relative",
    display: "grid",
    width: "42px",
    height: "42px",
    padding: 0,
    placeItems: "center",
    border: `1px solid ${colors.border}`,
    borderRadius: "11px",
    background: isOpen ? colors.triggerActive : colors.trigger,
    color: colors.text,
    boxShadow: colors.triggerShadow,
    cursor: "pointer",
  };

  const badgeStyle = {
    position: "absolute",
    top: "-5px",
    right: "-5px",
    display: "grid",
    minWidth: "19px",
    height: "19px",
    padding: "0 5px",
    placeItems: "center",
    border: `2px solid ${colors.badgeBorder}`,
    borderRadius: "999px",
    background: "#e11d48",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1,
  };

  const panelStyle = {
    ...panelLayoutStyle,
    border: `1px solid ${colors.border}`,
    background: colors.panel,
    boxShadow: colors.panelShadow,
  };

  const panelHeaderStyle = {
    ...panelHeaderLayoutStyle,
    borderBottom: `1px solid ${colors.divider}`,
    background: colors.header,
  };

  const panelSubtitleStyle = {
    ...panelSubtitleLayoutStyle,
    color: colors.muted,
  };

  const markAllButtonStyle = {
    ...markAllButtonLayoutStyle,
    color: colors.primary,
  };

  const panelFooterStyle = {
    ...panelFooterLayoutStyle,
    borderTop: `1px solid ${colors.divider}`,
    background: colors.footer,
    color: colors.muted,
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
        onClick={() => {
          setIsOpen((currentValue) => !currentValue);
        }}
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
        >
          <header style={panelHeaderStyle}>
            <div>
              <h2
                style={{
                  ...panelTitleStyle,
                  color: colors.text,
                }}
              >
                Bildirimler
              </h2>

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
                onClick={markAllAsRead}
              >
                Tümünü okundu yap
              </button>
            ) : null}
          </header>

          <div style={listStyle}>
            {notifications.map((notification) => {
              const notificationStyle = {
                ...notificationButtonLayoutStyle,
                borderBottom: `1px solid ${colors.divider}`,
                background: notification.isUnread
                  ? colors.unread
                  : colors.panel,
                color: colors.text,
              };

              const typeBadgeStyle = {
                ...typeBadgeLayoutStyle,
                background: colors.typeBackground,
                color: colors.primary,
              };

              const notificationTitleStyle = {
                ...notificationTitleLayoutStyle,
                color: colors.text,
              };

              const notificationDescriptionStyle = {
                ...notificationDescriptionLayoutStyle,
                color: colors.muted,
              };

              const notificationTimeStyle = {
                ...notificationTimeLayoutStyle,
                color: colors.time,
              };

              const unreadDotStyle = {
                ...unreadDotLayoutStyle,
                background: colors.primary,
                boxShadow: `0 0 0 4px ${colors.dotShadow}`,
              };

              return (
                <button
                  key={notification.id}
                  type="button"
                  style={notificationStyle}
                  onClick={() => {
                    markNotificationAsRead(notification.id);
                  }}
                >
                  <span style={typeBadgeStyle}>{notification.type}</span>

                  <span style={notificationContentStyle}>
                    <strong style={notificationTitleStyle}>
                      {notification.title}
                    </strong>

                    <span style={notificationDescriptionStyle}>
                      {notification.description}
                    </span>

                    <span style={notificationTimeStyle}>
                      {notification.time}
                    </span>
                  </span>

                  {notification.isUnread ? (
                    <span style={unreadDotStyle} aria-label="Okunmamış" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <footer style={panelFooterStyle}>
            Bildirimler şu an örnek veriyle gösterilmektedir.
          </footer>
        </section>
      ) : null}
    </div>
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
      typeBackground: "rgb(59 130 246 / 17%)",
      dotShadow: "rgb(96 165 250 / 15%)",
      badgeBorder: "#1b2636",
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
    typeBackground: "rgb(37 99 235 / 12%)",
    dotShadow: "rgb(37 99 235 / 12%)",
    badgeBorder: "#eef3f9",
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
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />

      <path d="M10 21h4" />
    </svg>
  );
}

export default NotificationsMenu;
