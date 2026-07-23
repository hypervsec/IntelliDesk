import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

function SearchableSelect({
  id,
  value,
  options = [],
  placeholder,
  disabled = false,
  searchable = true,
  searchPlaceholder = "Ara...",
  emptyMessage = "Sonuç bulunamadı.",
  onChange,
}) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState(null);

  const normalizedOptions = useMemo(
    () =>
      options
        .map((option) => {
          if (typeof option === "string") {
            return {
              value: option,
              label: option,
              tone: "",
            };
          }

          return {
            value: String(option?.value ?? ""),
            label: String(option?.label ?? ""),
            tone: option?.tone || "",
          };
        })
        .filter((option) => option.value.length > 0 && option.label.length > 0),
    [options],
  );

  const selectedOption =
    normalizedOptions.find((option) => option.value === value) || null;

  const filteredOptions = useMemo(() => {
    const normalizedSearch = normalizeText(searchValue);

    if (!normalizedSearch) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((option) =>
      normalizeText(option.label).includes(normalizedSearch),
    );
  }, [normalizedOptions, searchValue]);

  function updateMenuPosition() {
    const triggerElement = triggerRef.current;

    if (!triggerElement) {
      return;
    }

    const viewportPadding = 12;
    const menuGap = 8;

    const triggerRect = triggerElement.getBoundingClientRect();

    const estimatedSearchHeight = searchable ? 56 : 12;

    const estimatedOptionsHeight = Math.min(filteredOptions.length, 6) * 44;

    const estimatedMenuHeight = Math.min(
      340,
      estimatedSearchHeight + estimatedOptionsHeight + 18,
    );

    const spaceBelow =
      window.innerHeight - triggerRect.bottom - viewportPadding;

    const spaceAbove = triggerRect.top - viewportPadding;

    const openAbove =
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

    const availableHeight = openAbove
      ? spaceAbove - menuGap
      : spaceBelow - menuGap;

    const menuWidth = Math.min(
      triggerRect.width,
      window.innerWidth - viewportPadding * 2,
    );

    const maximumLeft = window.innerWidth - menuWidth - viewportPadding;

    const menuLeft = Math.max(
      viewportPadding,
      Math.min(triggerRect.left, maximumLeft),
    );

    setMenuPosition({
      position: "fixed",
      top: openAbove ? "auto" : `${triggerRect.bottom + menuGap}px`,
      bottom: openAbove
        ? `${window.innerHeight - triggerRect.top + menuGap}px`
        : "auto",
      left: `${menuLeft}px`,
      right: "auto",
      width: `${menuWidth}px`,
      maxHeight: `${Math.max(150, Math.min(340, availableHeight))}px`,
      zIndex: 1000,
    });
  }

  function closeDropdown({ restoreFocus = false } = {}) {
    setIsOpen(false);
    setSearchValue("");
    setActiveIndex(0);
    setMenuPosition(null);

    if (restoreFocus) {
      window.setTimeout(() => {
        triggerRef.current?.focus();
      }, 0);
    }
  }

  function openDropdown() {
    if (disabled) {
      return;
    }

    setIsOpen(true);
  }

  function toggleDropdown() {
    if (isOpen) {
      closeDropdown();
      return;
    }

    openDropdown();
  }

  function selectOption(option) {
    if (typeof onChange === "function") {
      onChange(option.value);
    }

    closeDropdown({
      restoreFocus: true,
    });
  }

  function moveActiveOption(direction) {
    if (filteredOptions.length === 0) {
      return;
    }

    setActiveIndex((currentIndex) => {
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0) {
        return filteredOptions.length - 1;
      }

      if (nextIndex >= filteredOptions.length) {
        return 0;
      }

      return nextIndex;
    });
  }

  function handleTriggerKeyDown(event) {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (!isOpen) {
        openDropdown();
        return;
      }

      const activeOption = filteredOptions[activeIndex];

      if (activeOption) {
        selectOption(activeOption);
      }

      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        openDropdown();
        return;
      }

      moveActiveOption(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        openDropdown();
        return;
      }

      moveActiveOption(-1);
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();

      closeDropdown({
        restoreFocus: true,
      });
    }
  }

  function handleMenuKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();

      closeDropdown({
        restoreFocus: true,
      });

      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveOption(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveOption(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();

      setActiveIndex(Math.max(filteredOptions.length - 1, 0));

      return;
    }

    if (event.key === "Enter" && filteredOptions[activeIndex]) {
      event.preventDefault();

      selectOption(filteredOptions[activeIndex]);
    }
  }

  useEffect(() => {
    function handleOutsidePointerDown(event) {
      const target = event.target;

      const clickedInsideTrigger = containerRef.current?.contains(target);

      const clickedInsideMenu = menuRef.current?.contains(target);

      if (!clickedInsideTrigger && !clickedInsideMenu) {
        closeDropdown();
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      closeDropdown();
    }
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === value,
    );

    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);

    if (!searchable) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [filteredOptions, isOpen, searchable, value]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();
  }, [filteredOptions.length, isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleViewportChange() {
      updateMenuPosition();
    }

    window.addEventListener("resize", handleViewportChange);

    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);

      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [filteredOptions.length, isOpen, searchable]);

  const menu =
    isOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="searchable-select-menu"
            style={menuPosition}
            onKeyDown={handleMenuKeyDown}
          >
            {searchable ? (
              <div className="searchable-select-search">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />

                  <path
                    d="m20 20-4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  onChange={(event) => {
                    setSearchValue(event.target.value);

                    setActiveIndex(0);
                  }}
                />
              </div>
            ) : null}

            <div
              id={`${selectId}-listbox`}
              className="searchable-select-options"
              role="listbox"
              aria-labelledby={selectId}
            >
              {filteredOptions.length === 0 ? (
                <p className="searchable-select-empty">{emptyMessage}</p>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;

                  const isActive = index === activeIndex;

                  return (
                    <button
                      id={`${selectId}-option-${index}`}
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        "searchable-select-option",
                        isSelected ? "searchable-select-option-selected" : "",
                        isActive ? "searchable-select-option-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onPointerMove={() => {
                        setActiveIndex(index);
                      }}
                      onClick={() => {
                        selectOption(option);
                      }}
                    >
                      <span className="searchable-select-option-main">
                        {option.tone ? (
                          <span
                            className={[
                              "searchable-select-tone",
                              `searchable-select-tone-${option.tone}`,
                            ].join(" ")}
                            aria-hidden="true"
                          />
                        ) : null}

                        <span>{option.label}</span>
                      </span>

                      {isSelected ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="m5 12 4 4L19 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={containerRef}
        className={[
          "searchable-select",
          isOpen ? "searchable-select-open" : "",
          disabled ? "searchable-select-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          className="searchable-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${selectId}-listbox`}
          disabled={disabled}
          onClick={toggleDropdown}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="searchable-select-value">
            {selectedOption?.tone ? (
              <span
                className={[
                  "searchable-select-tone",
                  `searchable-select-tone-${selectedOption.tone}`,
                ].join(" ")}
                aria-hidden="true"
              />
            ) : null}

            <span
              className={selectedOption ? "" : "searchable-select-placeholder"}
            >
              {selectedOption?.label || placeholder}
            </span>
          </span>

          <span className="searchable-select-chevron" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>

      {menu}
    </>
  );
}

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default SearchableSelect;
