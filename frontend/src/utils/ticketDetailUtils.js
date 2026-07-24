export function createStaffOptions(staffAccounts, currentTechnician) {
  const accounts = Array.isArray(staffAccounts) ? staffAccounts : [];

  const options = accounts
    .filter(
      (staffAccount) =>
        staffAccount?.full_name &&
        staffAccount?.is_active === true &&
        (staffAccount?.role === "technician" || staffAccount?.role === "admin"),
    )
    .map((staffAccount) => ({
      ...staffAccount,
      optionKey: `account-${staffAccount.account_id}`,
      isCurrentOnly: false,
    }));

  const cleanedCurrentTechnician = String(currentTechnician || "").trim();

  const currentTechnicianExists = options.some(
    (staffAccount) =>
      normalizeText(staffAccount.full_name) ===
      normalizeText(cleanedCurrentTechnician),
  );

  if (cleanedCurrentTechnician && !currentTechnicianExists) {
    options.unshift({
      account_id: null,
      full_name: cleanedCurrentTechnician,
      role: null,
      is_active: true,
      isCurrentOnly: true,
      optionKey: `current-${cleanedCurrentTechnician}`,
    });
  }

  return options;
}

export function getStaffRoleLabel(staffAccount) {
  if (staffAccount.isCurrentOnly) {
    return "Mevcut kayıt";
  }

  if (staffAccount.role === "admin") {
    return "Yönetici";
  }

  return "Teknisyen";
}

export function createUniqueOptions(values, currentValue) {
  const options = Array.isArray(values) ? [...values] : [];

  if (
    currentValue &&
    !options.some(
      (value) => normalizeText(value) === normalizeText(currentValue),
    )
  ) {
    options.unshift(currentValue);
  }

  const normalizedValues = new Set();

  return options.filter((value) => {
    const cleanedValue = String(value || "").trim();

    if (!cleanedValue) {
      return false;
    }

    const normalizedValue = normalizeText(cleanedValue);

    if (normalizedValues.has(normalizedValue)) {
      return false;
    }

    normalizedValues.add(normalizedValue);

    return true;
  });
}

export function getAssistantMessage(aiSession) {
  if (!Array.isArray(aiSession?.messages)) {
    return null;
  }

  return (
    aiSession.messages.find((message) => message.sender_type === "assistant") ||
    null
  );
}

export function parseAiSolution(content) {
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
  const definitions = [
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

  for (const definition of definitions) {
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

export function getSourceTicketIds(aiSession, parsedSourceIds) {
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

export function formatSourceTicketId(requestId) {
  const normalizedId = String(requestId || "").replace(/^#/, "");

  return `#${normalizedId}`;
}

export function getConfidenceMeta(value) {
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

export function normalizeConfidence(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(Math.max(numericValue, 0), 1);
}

export function getConfidenceLevel(score) {
  if (score >= 0.8) {
    return "high";
  }

  if (score >= 0.5) {
    return "medium";
  }

  return "low";
}

export function getConfidenceLabel(level) {
  const labels = {
    low: "Düşük güven",
    medium: "Orta güven",
    high: "Yüksek güven",
  };

  return labels[level] || "Bilinmiyor";
}

export function getApiErrorMessage(requestError, fallbackMessage) {
  const detail = requestError?.response?.data?.detail;

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

export function translatePriority(priority) {
  const values = {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  };

  return values[priority] || priority || "Belirtilmemiş";
}

export function translateStatus(status) {
  const values = {
    open: "Açık",
    assigned: "Atandı",
    in_progress: "İşlemde",
    waiting_user: "Kullanıcı Bekleniyor",
    resolved: "Çözüldü",
    closed: "Kapalı",
    cancelled: "İptal",
  };

  return values[status] || status || "Belirtilmemiş";
}

export function translateAiStatus(status) {
  const values = {
    pending: "Bekliyor",
    processing: "İşleniyor",
    completed: "Tamamlandı",
    failed: "Başarısız",
  };

  return values[status] || status || "Bilinmiyor";
}

export function getUserStatusMessage(status) {
  const messages = {
    open: "Talebiniz oluşturuldu ve AI çözümü hazırlandı.",
    assigned: "Talebiniz bir teknik personele atandı.",
    in_progress: "Destek ekibi talebiniz üzerinde çalışıyor.",
    waiting_user: "İşleme devam edilebilmesi için sizden bilgi bekleniyor.",
    resolved: "Talebiniz için çözüm bilgisi oluşturuldu.",
    closed: "Talebiniz kapatıldı.",
    cancelled: "Talebiniz iptal edildi.",
  };

  return (
    messages[status] ||
    "Talebinizin çözüm bilgilerini buradan inceleyebilirsiniz."
  );
}

export function formatDate(value) {
  if (!value) {
    return "Belirtilmemiş";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Belirtilmemiş";
  }

  return date.toLocaleString("tr-TR");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
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
