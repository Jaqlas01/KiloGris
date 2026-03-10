const STORAGE_KEY = "kilogris_calorie_state_v1";
const KCAL_PER_KG = 7700;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const KCAL_FORMATTER = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const KG_FORMATTER = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("da-DK", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const flashMessageEl = document.getElementById("flashMessage");

const selectedDateInputEl = document.getElementById("selectedDateInput");
const inputDateTriggerEl = document.getElementById("inputDateTrigger");

const remainingTodayCardEl = document.getElementById("remainingTodayCard");
const remainingTodayValueEl = document.getElementById("remainingTodayValue");
const daysLeftValueEl = document.getElementById("daysLeftValue");
const forecastWeightValueEl = document.getElementById("forecastWeightValue");

const baseTodayValueEl = document.getElementById("baseTodayValue");
const burnedTodayValueEl = document.getElementById("burnedTodayValue");
const totalAvailableValueEl = document.getElementById("totalAvailableValue");
const eatenTodayValueEl = document.getElementById("eatenTodayValue");

const settingsFormEl = document.getElementById("settingsForm");
const dailyBudgetInputEl = document.getElementById("dailyBudgetInput");
const startWeightInputEl = document.getElementById("startWeightInput");
const planStartDateInputEl = document.getElementById("planStartDateInput");
const settingsModalOpenButtonEl = document.getElementById("settingsModalOpenButton");
const settingsModalBackdropEl = document.getElementById("settingsModalBackdrop");
const settingsModalCloseButtonEl = document.getElementById("settingsModalCloseButton");
const settingsModalCancelButtonEl = document.getElementById("settingsModalCancelButton");

const dailyLogFormEl = document.getElementById("dailyLogForm");
const addEatenInputEl = document.getElementById("addEatenInput");
const addBurnedInputEl = document.getElementById("addBurnedInput");
const addWeightInputEl = document.getElementById("addWeightInput");
const resetDayButtonEl = document.getElementById("resetDayButton");

const forecastMessageEl = document.getElementById("forecastMessage");
const predictedLegendTextEl = document.getElementById("predictedLegendText");
const forecastInfoButtonEl = document.getElementById("forecastInfoButton");

const projectionCanvasEl = document.getElementById("projectionCanvas");
const actualWeightCanvasEl = document.getElementById("actualWeightCanvas");
const chartToggleButtonEl = document.getElementById("chartToggleButton");
const chartContentEl = document.getElementById("chartContent");
const actualChartToggleButtonEl = document.getElementById("actualChartToggleButton");
const actualChartContentEl = document.getElementById("actualChartContent");

const exportCsvButtonEl = document.getElementById("exportCsvButton");
const resetAllButtonEl = document.getElementById("resetAllButton");
const historyListEl = document.getElementById("historyList");
const confirmModalBackdropEl = document.getElementById("confirmModalBackdrop");
const confirmModalTitleEl = document.getElementById("confirmModalTitle");
const confirmModalMessageEl = document.getElementById("confirmModalMessage");
const confirmModalCancelButtonEl = document.getElementById("confirmModalCancelButton");
const confirmModalConfirmButtonEl = document.getElementById("confirmModalConfirmButton");
const forecastInfoModalBackdropEl = document.getElementById("forecastInfoModalBackdrop");
const forecastInfoModalCloseButtonEl = document.getElementById("forecastInfoModalCloseButton");
const forecastInfoModalOkButtonEl = document.getElementById("forecastInfoModalOkButton");

let state = loadState();
let flashTimeoutId = null;
let chartResizeTimeout = null;
let chartExpanded = false;
let actualChartExpanded = false;
let settingsModalOpen = false;
let confirmModalOpen = false;
let forecastInfoModalOpen = false;
let confirmModalResolver = null;

init();

function init() {
  attachNumericInputFormatting(dailyBudgetInputEl);
  attachNumericInputFormatting(startWeightInputEl);
  attachNumericInputFormatting(addEatenInputEl);
  attachNumericInputFormatting(addBurnedInputEl);
  attachNumericInputFormatting(addWeightInputEl);

  settingsFormEl.addEventListener("submit", handleSettingsSubmit);
  dailyLogFormEl.addEventListener("submit", handleDailyLogSubmit);
  selectedDateInputEl.addEventListener("change", handleSelectedDateChange);
  historyListEl.addEventListener("click", handleHistoryClick);
  exportCsvButtonEl.addEventListener("click", handleExportCSV);
  resetAllButtonEl.addEventListener("click", handleResetAll);
  resetDayButtonEl.addEventListener("click", handleResetSelectedDay);
  if (chartToggleButtonEl) {
    chartToggleButtonEl.addEventListener("click", handleChartToggleClick);
  }
  if (actualChartToggleButtonEl) {
    actualChartToggleButtonEl.addEventListener("click", handleActualChartToggleClick);
  }
  if (forecastInfoButtonEl) {
    forecastInfoButtonEl.addEventListener("click", openForecastInfoModal);
  }
  settingsModalOpenButtonEl.addEventListener("click", openSettingsModal);
  settingsModalCloseButtonEl.addEventListener("click", () => closeSettingsModal());
  settingsModalCancelButtonEl.addEventListener("click", () => closeSettingsModal());
  settingsModalBackdropEl.addEventListener("click", handleSettingsBackdropClick);
  confirmModalCancelButtonEl.addEventListener("click", () => closeConfirmModal(false));
  confirmModalConfirmButtonEl.addEventListener("click", () => closeConfirmModal(true));
  confirmModalBackdropEl.addEventListener("click", handleConfirmBackdropClick);
  if (forecastInfoModalCloseButtonEl) {
    forecastInfoModalCloseButtonEl.addEventListener("click", () => closeForecastInfoModal());
  }
  if (forecastInfoModalOkButtonEl) {
    forecastInfoModalOkButtonEl.addEventListener("click", () => closeForecastInfoModal());
  }
  if (forecastInfoModalBackdropEl) {
    forecastInfoModalBackdropEl.addEventListener("click", handleForecastInfoBackdropClick);
  }
  document.addEventListener("keydown", handleGlobalKeydown);

  window.addEventListener("resize", () => {
    if (!chartExpanded && !actualChartExpanded) return;
    clearTimeout(chartResizeTimeout);
    chartResizeTimeout = window.setTimeout(() => {
      if (chartExpanded) drawProjectionChart(buildChartModel());
      if (actualChartExpanded) drawActualWeightChart(buildActualWeightChartModel());
    }, 110);
  });

  renderAll();
  registerServiceWorker();
}

function createDefaultState() {
  const todayISO = getTodayISO();
  return {
    selectedDateISO: todayISO,
    settings: {
      dailyBudget: 1850,
      startWeight: 88,
      targetWeight: 78,
      startDateISO: todayISO,
    },
    days: [],
  };
}

function loadState() {
  const fallback = createDefaultState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed, fallback);
  } catch {
    return fallback;
  }
}

function normalizeState(rawState, fallback) {
  const todayISO = getTodayISO();

  const dailyBudget = toPositiveNumber(rawState?.settings?.dailyBudget, fallback.settings.dailyBudget);
  const startWeight = toPositiveNumber(rawState?.settings?.startWeight, fallback.settings.startWeight);
  let targetWeight = toPositiveNumber(rawState?.settings?.targetWeight, fallback.settings.targetWeight);
  if (targetWeight > startWeight) targetWeight = startWeight;

  let startDateISO = String(rawState?.settings?.startDateISO || "");
  if (!DATE_RE.test(startDateISO)) startDateISO = fallback.settings.startDateISO;
  if (startDateISO > todayISO) startDateISO = todayISO;

  let selectedDateISO = String(rawState?.selectedDateISO || todayISO);
  if (!DATE_RE.test(selectedDateISO)) selectedDateISO = todayISO;
  if (selectedDateISO > todayISO) selectedDateISO = todayISO;

  const days = Array.isArray(rawState?.days)
    ? rawState.days.map(normalizeDayRecord).filter(Boolean)
    : [];

  return {
    selectedDateISO,
    settings: {
      dailyBudget: round0(dailyBudget),
      startWeight: round1(startWeight),
      targetWeight: round1(targetWeight),
      startDateISO,
    },
    days: sortDaysAsc(days),
  };
}

function normalizeDayRecord(record) {
  const dateISO = String(record?.dateISO || "");
  if (!DATE_RE.test(dateISO)) return null;

  const eaten = Number(record?.eaten);
  const burned = Number(record?.burned);
  const weight = record?.weight == null ? null : Number(record.weight);

  if (!Number.isFinite(eaten) || eaten < 0) return null;
  if (!Number.isFinite(burned) || burned < 0) return null;
  if (weight != null && (!Number.isFinite(weight) || weight <= 0)) return null;

  const note = String(record?.note || "").trim().slice(0, 120);

  return {
    id: String(record?.id || createId()),
    dateISO,
    eaten: round0(eaten),
    burned: round0(burned),
    weight: weight == null ? null : round1(weight),
    note,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  syncDateInputs();
  renderSettingsForm();
  renderTopNumbers();
  renderForecastSection();
  renderHistory();
  renderChartSection();
  renderActualChartSection();
}

function renderChartSection() {
  if (!chartToggleButtonEl || !chartContentEl) return;

  chartToggleButtonEl.setAttribute("aria-expanded", chartExpanded ? "true" : "false");
  chartContentEl.classList.toggle("hidden", !chartExpanded);

  if (!chartExpanded) return;
  window.requestAnimationFrame(() => {
    drawProjectionChart(buildChartModel());
  });
}

function handleChartToggleClick() {
  chartExpanded = !chartExpanded;
  renderChartSection();
}

function renderActualChartSection() {
  if (!actualChartToggleButtonEl || !actualChartContentEl) return;

  actualChartToggleButtonEl.setAttribute("aria-expanded", actualChartExpanded ? "true" : "false");
  actualChartContentEl.classList.toggle("hidden", !actualChartExpanded);

  if (!actualChartExpanded) return;
  window.requestAnimationFrame(() => {
    drawActualWeightChart(buildActualWeightChartModel());
  });
}

function handleActualChartToggleClick() {
  actualChartExpanded = !actualChartExpanded;
  renderActualChartSection();
}

function syncDateInputs() {
  const todayISO = getTodayISO();

  selectedDateInputEl.max = todayISO;
  planStartDateInputEl.max = todayISO;

  if (!DATE_RE.test(state.selectedDateISO) || state.selectedDateISO > todayISO) {
    state.selectedDateISO = todayISO;
  }

  selectedDateInputEl.value = state.selectedDateISO;
  syncInputDatePicker();
}

function syncInputDatePicker() {
  if (!selectedDateInputEl || !inputDateTriggerEl) return;
  const displayDate = formatDate(selectedDateInputEl.value);
  inputDateTriggerEl.title = displayDate ? `Dato: ${displayDate}` : "Vælg dato";
  inputDateTriggerEl.setAttribute(
    "aria-label",
    displayDate
      ? `Vælg dato for dagens input. Valgt dato: ${displayDate}`
      : "Vælg dato for dagens input"
  );
}

function renderSettingsForm() {
  dailyBudgetInputEl.value = String(state.settings.dailyBudget);
  startWeightInputEl.value = formatInputNumber(state.settings.startWeight);
  planStartDateInputEl.value = state.settings.startDateISO;
}

function renderTopNumbers() {
  const dayRecord = getDayRecord(state.selectedDateISO);
  const dailyStats = getDailyStats(dayRecord);
  const monthStats = getMonthStats();

  remainingTodayValueEl.textContent = formatKcalSigned(dailyStats.remaining, true);
  if (remainingTodayCardEl) {
    remainingTodayCardEl.classList.toggle("negativ", dailyStats.remaining < 0);
  }
  daysLeftValueEl.textContent = String(dailyStats.daysLeftInMonth);

  if (monthStats.projectedKgChange > 0.04) {
    forecastWeightValueEl.textContent = `-${formatKg(monthStats.projectedKgChange)}`;
  } else if (monthStats.projectedKgChange < -0.04) {
    forecastWeightValueEl.textContent = `+${formatKg(Math.abs(monthStats.projectedKgChange))}`;
  } else {
    forecastWeightValueEl.textContent = "0,0 kg";
  }

  baseTodayValueEl.textContent = formatKcal(dailyStats.baseBudget);
  burnedTodayValueEl.textContent = `+${formatKcal(dailyStats.burned)}`;
  totalAvailableValueEl.textContent = formatKcal(dailyStats.totalAvailable);
  eatenTodayValueEl.textContent = formatKcal(dailyStats.eaten);
}

function renderForecastSection() {
  const monthStats = getMonthStats();
  renderChartLegendText(monthStats);

  forecastMessageEl.classList.remove("loss", "gain", "flat");

  if (monthStats.elapsedPlanDays <= 0) {
    forecastMessageEl.textContent = "Planen er ikke startet i den valgte måned endnu, så prognosen venter på data.";
    forecastMessageEl.classList.add("flat");
    return;
  }

  const kgChange = monthStats.projectedKgChange;

  if (kgChange > 0.04) {
    forecastMessageEl.textContent = `Hvis dette mønster fortsætter, risikerer du at tage ${formatKg(Math.abs(kgChange))} på denne måned.`;
    forecastMessageEl.classList.add("loss");
    return;
  }

  if (kgChange < -0.04) {
    forecastMessageEl.textContent = `Hvis dette mønster fortsætter, vil du tage ca. ${formatKg(Math.abs(kgChange))} på denne måned.`;
    forecastMessageEl.classList.add("gain");
    return;
  }

  forecastMessageEl.textContent = "Hvis dette mønster fortsættes, bevarer du din vægt.";
  forecastMessageEl.classList.add("flat");
}

function renderChartLegendText(monthStats) {
  if (!predictedLegendTextEl) return;
  const isCalorieDeficit = monthStats.projectedMonthSaldo >= 0;
  predictedLegendTextEl.textContent = isCalorieDeficit
    ? "Forventet vægttab"
    : "Forventet vægtforøgelse";
}

function renderHistory() {
  historyListEl.innerHTML = "";

  const records = sortDaysDesc(state.days);
  if (records.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Ingen dage logget endnu.";
    historyListEl.appendChild(empty);
    return;
  }

  records.forEach((record) => {
    historyListEl.appendChild(buildHistoryItem(record));
  });
}

function buildHistoryItem(record) {
  const saldo = getSaldoForRecord(record);

  const item = document.createElement("article");
  item.className = "history-item";

  const top = document.createElement("div");
  top.className = "history-top";

  const date = document.createElement("p");
  date.className = "history-date";
  date.textContent = formatDate(record.dateISO);

  const main = document.createElement("p");
  main.className = "history-main";

  const saldoClass = saldo >= 0 ? "positive" : "negative";
  main.innerHTML = `Saldo: <span class="${saldoClass}">${formatKcalSigned(saldo, true)}</span>`;

  top.appendChild(date);
  top.appendChild(main);

  const extra = document.createElement("p");
  extra.className = "history-extra";

  const extraParts = [
    `Spist ${formatKcal(record.eaten)}`,
    `Motion ${formatKcal(record.burned)}`,
  ];

  if (record.weight != null) {
    extraParts.push(`Vægt ${formatKg(record.weight)}`);
  }

  if (record.note) {
    extraParts.push(`Note: ${record.note}`);
  }

  extra.textContent = extraParts.join(" | ");

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "history-delete";
  delBtn.dataset.recordId = record.id;
  delBtn.textContent = "Slet dag";

  item.appendChild(top);
  item.appendChild(extra);
  item.appendChild(delBtn);
  return item;
}

function handleSettingsSubmit(event) {
  event.preventDefault();

  const dailyBudget = parseLocalizedNumber(dailyBudgetInputEl.value);
  const startWeight = parseLocalizedNumber(startWeightInputEl.value);
  const startDateISO = String(planStartDateInputEl.value || "");

  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    showFlash("Daglig basalforbrænding skal være over 0.", "error");
    return;
  }

  if (!Number.isFinite(startWeight) || startWeight <= 0) {
    showFlash("Startvægt skal være over 0.", "error");
    return;
  }

  if (!DATE_RE.test(startDateISO)) {
    showFlash("Startdato for planen mangler eller er ugyldig.", "error");
    return;
  }

  const todayISO = getTodayISO();
  const targetWeight = Math.min(state.settings.targetWeight, round1(startWeight));

  state.settings.dailyBudget = round0(dailyBudget);
  state.settings.startWeight = round1(startWeight);
  state.settings.targetWeight = round1(targetWeight);
  state.settings.startDateISO = startDateISO > todayISO ? todayISO : startDateISO;

  if (state.selectedDateISO < state.settings.startDateISO) {
    state.selectedDateISO = state.settings.startDateISO;
  }

  saveState();
  renderAll();
  closeSettingsModal({ returnFocus: false });
  showFlash("Indstillinger gemt.", "success");
}

function syncModalBodyLock() {
  const shouldLock = settingsModalOpen || confirmModalOpen || forecastInfoModalOpen;
  document.body.classList.toggle("modal-open", shouldLock);
}

function openSettingsModal() {
  if (settingsModalOpen) return;
  renderSettingsForm();
  settingsModalOpen = true;
  settingsModalBackdropEl.classList.remove("hidden");
  settingsModalOpenButtonEl.setAttribute("aria-expanded", "true");
  syncModalBodyLock();

  window.requestAnimationFrame(() => {
    dailyBudgetInputEl.focus();
    dailyBudgetInputEl.select();
  });
}

function closeSettingsModal({ returnFocus = true } = {}) {
  if (!settingsModalOpen) return;
  settingsModalOpen = false;
  settingsModalBackdropEl.classList.add("hidden");
  settingsModalOpenButtonEl.setAttribute("aria-expanded", "false");
  syncModalBodyLock();

  if (returnFocus) {
    window.requestAnimationFrame(() => settingsModalOpenButtonEl.focus());
  }
}

function handleSettingsBackdropClick(event) {
  if (event.target !== settingsModalBackdropEl) return;
  closeSettingsModal();
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") return;
  if (confirmModalOpen) {
    closeConfirmModal(false);
    return;
  }
  if (forecastInfoModalOpen) {
    closeForecastInfoModal();
    return;
  }
  closeSettingsModal();
}

function openForecastInfoModal() {
  if (!forecastInfoModalBackdropEl || !forecastInfoButtonEl) return;
  if (forecastInfoModalOpen) return;

  forecastInfoModalOpen = true;
  forecastInfoModalBackdropEl.classList.remove("hidden");
  forecastInfoButtonEl.setAttribute("aria-expanded", "true");
  syncModalBodyLock();

  if (forecastInfoModalOkButtonEl) {
    window.requestAnimationFrame(() => forecastInfoModalOkButtonEl.focus());
  }
}

function closeForecastInfoModal({ returnFocus = true } = {}) {
  if (!forecastInfoModalBackdropEl || !forecastInfoModalOpen) return;

  forecastInfoModalOpen = false;
  forecastInfoModalBackdropEl.classList.add("hidden");
  if (forecastInfoButtonEl) {
    forecastInfoButtonEl.setAttribute("aria-expanded", "false");
  }
  syncModalBodyLock();

  if (returnFocus && forecastInfoButtonEl) {
    window.requestAnimationFrame(() => forecastInfoButtonEl.focus());
  }
}

function handleForecastInfoBackdropClick(event) {
  if (event.target !== forecastInfoModalBackdropEl) return;
  closeForecastInfoModal();
}

function openConfirmModal({ title, message, confirmText = "OK", cancelText = "Fortryd" } = {}) {
  if (confirmModalOpen) return Promise.resolve(false);

  confirmModalOpen = true;
  confirmModalTitleEl.textContent = title || "Bekræft";
  confirmModalMessageEl.textContent = message || "";
  confirmModalConfirmButtonEl.textContent = confirmText;
  confirmModalCancelButtonEl.textContent = cancelText;
  confirmModalBackdropEl.classList.remove("hidden");
  syncModalBodyLock();

  return new Promise((resolve) => {
    confirmModalResolver = resolve;
  });
}

function closeConfirmModal(result) {
  if (!confirmModalOpen) return;
  confirmModalOpen = false;
  confirmModalBackdropEl.classList.add("hidden");
  syncModalBodyLock();

  const resolver = confirmModalResolver;
  confirmModalResolver = null;
  if (resolver) resolver(Boolean(result));
}

function handleConfirmBackdropClick(event) {
  if (event.target !== confirmModalBackdropEl) return;
  closeConfirmModal(false);
}

function handleDailyLogSubmit(event) {
  event.preventDefault();

  const addEaten = parseLocalizedNumber(addEatenInputEl.value);
  const addBurned = parseLocalizedNumber(addBurnedInputEl.value);
  const addWeight = parseLocalizedNumber(addWeightInputEl.value);

  const hasEaten = Number.isFinite(addEaten) && addEaten > 0;
  const hasBurned = Number.isFinite(addBurned) && addBurned > 0;
  const hasWeight = Number.isFinite(addWeight) && addWeight > 0;

  if (!hasEaten && !hasBurned && !hasWeight) {
    showFlash("Udfyld mindst et felt i dagens input.", "error");
    return;
  }

  if (Number.isFinite(addEaten) && addEaten < 0) {
    showFlash("Spist kalorier skal være et positivt tal.", "error");
    return;
  }

  if (Number.isFinite(addBurned) && addBurned < 0) {
    showFlash("Forbrændte kalorier skal være et positivt tal.", "error");
    return;
  }

  if (Number.isFinite(addWeight) && addWeight <= 0) {
    showFlash("Vægt skal være over 0.", "error");
    return;
  }

  const record = getOrCreateDayRecord(state.selectedDateISO);

  if (hasEaten) record.eaten = round0(record.eaten + addEaten);
  if (hasBurned) record.burned = round0(record.burned + addBurned);
  if (hasWeight) record.weight = round1(addWeight);

  cleanupEmptyRecords();
  state.days = sortDaysAsc(state.days);

  saveState();
  renderAll();

  addEatenInputEl.value = "";
  addBurnedInputEl.value = "";
  addWeightInputEl.value = "";

  showFlash("Dagens data gemt.", "success");
}

async function handleResetSelectedDay() {
  const hasSelectedDayHistory = state.days.some((record) => record.dateISO === state.selectedDateISO);
  if (!hasSelectedDayHistory) {
    showFlash("Ingen data at nulstille for valgt dato.", "info");
    return;
  }

  const confirmed = await openConfirmModal({
    title: "Nulstil dagens data?",
    message: "Dette sletter al historik for valgte dato. Det kan ikke fortrydes.",
    confirmText: "Nulstil",
    cancelText: "Fortryd",
  });

  if (!confirmed) return;

  state.days = state.days.filter((record) => record.dateISO !== state.selectedDateISO);
  saveState();
  renderAll();
  showFlash("Dagens data er nulstillet.", "info");
}

function handleSelectedDateChange() {
  const candidate = String(selectedDateInputEl.value || "");
  const todayISO = getTodayISO();

  if (!DATE_RE.test(candidate)) {
    showFlash("Datoen er ugyldig.", "error");
    renderAll();
    return;
  }

  state.selectedDateISO = candidate > todayISO ? todayISO : candidate;
  saveState();
  renderAll();
}

async function handleHistoryClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest(".history-delete");
  if (!button) return;

  const recordId = String(button.dataset.recordId || "");
  if (!recordId) return;

  const confirmed = await openConfirmModal({
    title: "Slet dag?",
    message: "Dette sletter al historik for valgte dato. Det kan ikke fortrydes.",
    confirmText: "Slet",
    cancelText: "Fortryd",
  });
  if (!confirmed) return;

  const before = state.days.length;
  state.days = state.days.filter((record) => record.id !== recordId);
  if (state.days.length === before) return;

  saveState();
  renderAll();
  showFlash("Dag slettet.", "info");
}

function handleExportCSV() {
  if (state.days.length === 0) {
    showFlash("Ingen historik at eksportere.", "info");
    return;
  }

  const rows = [
    ["Dato", "SpistKcal", "ForbrændtKcal", "SaldoKcal", "VægtKg", "Note"],
    ...sortDaysAsc(state.days).map((record) => [
      record.dateISO,
      String(record.eaten),
      String(record.burned),
      String(getSaldoForRecord(record)),
      record.weight == null ? "" : String(record.weight),
      record.note,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCSV).join(";")).join("\n");
  const filename = `kilogris-kalorier-${getTodayISO()}.csv`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showFlash("CSV hentet.", "success");
}

async function handleResetAll() {
  const confirmed = await openConfirmModal({
    title: "Nulstil alt?",
    message: "Dette sletter alle data i appen. Det kan ikke fortrydes.",
    confirmText: "Nulstil",
    cancelText: "Fortryd",
  });
  if (!confirmed) return;

  state = createDefaultState();
  saveState();
  renderAll();
  showFlash("Alle data er nulstillet.", "info");
}

function getDayRecord(dateISO) {
  return state.days.find((record) => record.dateISO === dateISO) || null;
}

function getOrCreateDayRecord(dateISO) {
  let record = getDayRecord(dateISO);
  if (record) return record;

  record = {
    id: createId(),
    dateISO,
    eaten: 0,
    burned: 0,
    weight: null,
    note: "",
  };

  state.days.push(record);
  return record;
}

function cleanupEmptyRecords() {
  state.days = state.days.filter((record) => {
    const hasData = record.eaten > 0 || record.burned > 0 || record.weight != null || Boolean(record.note);
    return hasData;
  });
}

function getDailyStats(dayRecord) {
  const selected = dateFromISO(state.selectedDateISO);
  const day = selected.getDate();
  const daysInMonth = getDaysInMonth(selected.getFullYear(), selected.getMonth());

  const eaten = dayRecord ? dayRecord.eaten : 0;
  const burned = dayRecord ? dayRecord.burned : 0;
  const baseBudget = state.settings.dailyBudget;
  const totalAvailable = baseBudget + burned;
  const remaining = totalAvailable - eaten;

  return {
    baseBudget,
    eaten,
    burned,
    totalAvailable,
    remaining,
    daysLeftInMonth: Math.max(daysInMonth - day, 0),
  };
}

function getMonthStats() {
  const selectedDate = dateFromISO(state.selectedDateISO);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const dayOfMonth = selectedDate.getDate();
  const daysInMonth = getDaysInMonth(year, month);

  const monthStartISO = toISODate(new Date(year, month, 1));
  const monthEndISO = toISODate(new Date(year, month, daysInMonth));
  const analysisStartISO = maxISO(monthStartISO, state.settings.startDateISO);

  let elapsedPlanDays = 0;
  if (analysisStartISO <= state.selectedDateISO) {
    elapsedPlanDays = diffDaysInclusive(analysisStartISO, state.selectedDateISO);
  }

  let accumulatedSaldo = 0;
  state.days.forEach((record) => {
    if (record.dateISO < analysisStartISO) return;
    if (record.dateISO > state.selectedDateISO) return;
    if (!isSameYearMonth(record.dateISO, year, month)) return;
    accumulatedSaldo += getSaldoForRecord(record);
  });

  const daysLeft = Math.max(daysInMonth - dayOfMonth, 0);
  const averagePerDay = elapsedPlanDays > 0 ? accumulatedSaldo / elapsedPlanDays : 0;
  const projectedMonthSaldo = accumulatedSaldo + averagePerDay * daysLeft;
  const projectedKgChange = projectedMonthSaldo / KCAL_PER_KG;

  const currentEstimatedWeight = estimateWeightAtEndOfDate(state.selectedDateISO);
  const projectedEndWeight = round1(currentEstimatedWeight - (averagePerDay * daysLeft) / KCAL_PER_KG);

  return {
    year,
    month,
    monthStartISO,
    monthEndISO,
    analysisStartISO,
    elapsedPlanDays,
    daysInMonth,
    daysLeft,
    accumulatedSaldo,
    averagePerDay,
    projectedMonthSaldo,
    projectedKgChange,
    currentEstimatedWeight,
    projectedEndWeight,
  };
}

function getSaldoForRecord(record) {
  if (record.eaten <= 0 && record.burned <= 0) return 0;
  return state.settings.dailyBudget + record.burned - record.eaten;
}

function estimateWeightAtEndOfDate(dateISO) {
  if (dateISO < state.settings.startDateISO) return state.settings.startWeight;

  let saldo = 0;
  state.days.forEach((record) => {
    if (record.dateISO < state.settings.startDateISO) return;
    if (record.dateISO > dateISO) return;
    saldo += getSaldoForRecord(record);
  });

  return round1(state.settings.startWeight - saldo / KCAL_PER_KG);
}

function buildChartModel() {
  const monthStats = getMonthStats();

  const year = monthStats.year;
  const month = monthStats.month;
  const daysInMonth = monthStats.daysInMonth;

  const monthStartWeight = estimateWeightAtEndOfDate(addDaysISO(monthStats.monthStartISO, -1));
  const currentWeight = monthStats.currentEstimatedWeight;

  const predicted = [];
  const reference = [];

  const avgDailySaldo = monthStats.averagePerDay;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayISO = toISODate(new Date(year, month, day));

    let projectedWeight = 0;
    if (dayISO <= state.selectedDateISO) {
      projectedWeight = estimateWeightAtEndOfDate(dayISO);
    } else {
      const futureDays = diffDaysExclusive(state.selectedDateISO, dayISO);
      projectedWeight = currentWeight - (avgDailySaldo * futureDays) / KCAL_PER_KG;
    }

    predicted.push({ day, weight: round1(projectedWeight - monthStartWeight) });
    reference.push({ day, weight: 0 });
  }

  return {
    year,
    month,
    daysInMonth,
    selectedDay: dateFromISO(state.selectedDateISO).getDate(),
    predicted,
    reference,
  };
}

function buildActualWeightChartModel() {
  const selectedDate = dateFromISO(state.selectedDateISO);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  const weightedRecords = sortDaysAsc(
    state.days.filter((record) => {
      if (record.weight == null) return false;
      if (record.dateISO > state.selectedDateISO) return false;
      return isSameYearMonth(record.dateISO, year, month);
    })
  );

  const predicted = [];
  const reference = [];

  let baselineWeight = null;
  if (weightedRecords.length > 0) {
    baselineWeight = weightedRecords[0].weight;
  }

  weightedRecords.forEach((record) => {
    if (baselineWeight == null) return;
    const day = dateFromISO(record.dateISO).getDate();
    predicted.push({ day, weight: round1(baselineWeight - record.weight) });
  });

  for (let day = 1; day <= daysInMonth; day += 1) {
    reference.push({ day, weight: 0 });
  }

  return {
    year,
    month,
    daysInMonth,
    selectedDay: selectedDate.getDate(),
    predicted,
    reference,
  };
}

function drawProjectionChart(model) {
  const canvas = projectionCanvasEl;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cssWidth = Math.max(canvas.clientWidth || 320, 280);
  const cssHeight = 260;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { top: 18, right: 18, bottom: 34, left: 52 };
  const plotW = cssWidth - pad.left - pad.right;
  const plotH = cssHeight - pad.top - pad.bottom;

  if (plotW <= 30 || plotH <= 30) return;

  const allWeights = [...model.predicted, ...model.reference].map((point) => point.weight);
  let minW = Math.min(...allWeights);
  let maxW = Math.max(...allWeights);

  if (!Number.isFinite(minW) || !Number.isFinite(maxW)) return;

  if (Math.abs(maxW - minW) < 0.6) {
    maxW += 0.3;
    minW -= 0.3;
  }

  const margin = Math.max((maxW - minW) * 0.14, 0.4);
  minW -= margin;
  maxW += margin;

  const xForDay = (day) => {
    const ratio = (day - 1) / Math.max(model.daysInMonth - 1, 1);
    return pad.left + ratio * plotW;
  };

  const yForWeight = (weight) => {
    const ratio = (maxW - weight) / (maxW - minW);
    return pad.top + ratio * plotH;
  };

  drawGrid(ctx, pad, plotW, plotH);
  drawYAxisLabels(ctx, minW, maxW, yForWeight, pad.left);

  drawLine(ctx, model.reference, xForDay, yForWeight, "#7a7e8b", true, 2.2);
  drawLine(ctx, model.predicted, xForDay, yForWeight, "#3f4454", false, 3.8);

  drawSelectedMarker(ctx, model.selectedDay, model.predicted, xForDay, yForWeight);
  drawXAxisLabels(ctx, model, xForDay, cssHeight, pad.bottom);
}

function drawActualWeightChart(model) {
  const canvas = actualWeightCanvasEl;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cssWidth = Math.max(canvas.clientWidth || 320, 280);
  const cssHeight = 260;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { top: 18, right: 18, bottom: 34, left: 52 };
  const plotW = cssWidth - pad.left - pad.right;
  const plotH = cssHeight - pad.top - pad.bottom;

  if (plotW <= 30 || plotH <= 30) return;

  const fallbackSeries = model.predicted.length > 0
    ? model.predicted
    : [{ day: 1, weight: 0 }, { day: model.daysInMonth, weight: 0 }];

  const allWeights = [...fallbackSeries, ...model.reference].map((point) => point.weight);
  let minW = Math.min(...allWeights);
  let maxW = Math.max(...allWeights);

  if (!Number.isFinite(minW) || !Number.isFinite(maxW)) return;

  if (Math.abs(maxW - minW) < 0.6) {
    maxW += 0.3;
    minW -= 0.3;
  }

  const margin = Math.max((maxW - minW) * 0.14, 0.4);
  minW -= margin;
  maxW += margin;

  const xForDay = (day) => {
    const ratio = (day - 1) / Math.max(model.daysInMonth - 1, 1);
    return pad.left + ratio * plotW;
  };

  const yForWeight = (weight) => {
    const ratio = (maxW - weight) / (maxW - minW);
    return pad.top + ratio * plotH;
  };

  drawGrid(ctx, pad, plotW, plotH);
  drawYAxisLabels(ctx, minW, maxW, yForWeight, pad.left);

  drawLine(ctx, model.reference, xForDay, yForWeight, "#7a7e8b", true, 2.2);
  if (model.predicted.length > 1) {
    drawLine(ctx, model.predicted, xForDay, yForWeight, "#3f4454", false, 3.8);
  }
  drawSeriesDots(ctx, model.predicted, xForDay, yForWeight, "#3f4454", 3.2);

  drawSelectedMarker(ctx, model.selectedDay, model.predicted, xForDay, yForWeight);
  drawXAxisLabels(ctx, model, xForDay, cssHeight, pad.bottom);

  if (model.predicted.length === 0) {
    drawNoDataText(ctx, cssWidth, cssHeight, "Tilføj vægtmålinger for at se grafen.");
  }
}

function drawGrid(ctx, pad, plotW, plotH) {
  ctx.save();
  ctx.strokeStyle = "#e5ebe7";
  ctx.lineWidth = 1;

  const rows = 4;
  for (let i = 0; i <= rows; i += 1) {
    const y = pad.top + (plotH / rows) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH);
  ctx.lineTo(pad.left + plotW, pad.top + plotH);
  ctx.strokeStyle = "#cfd9d4";
  ctx.stroke();

  ctx.restore();
}

function drawYAxisLabels(ctx, minW, maxW, yForWeight, leftX) {
  ctx.save();
  ctx.fillStyle = "#66746e";
  ctx.font = "12px Manrope";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const value = maxW - ((maxW - minW) / ticks) * i;
    const y = yForWeight(value);
    ctx.fillText(`${KG_FORMATTER.format(value)} kg`, leftX - 8, y);
  }

  ctx.restore();
}

function drawLine(ctx, series, xFn, yFn, color, dashed, lineWidth = 2.2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([6, 5]);

  ctx.beginPath();
  series.forEach((point, index) => {
    const x = xFn(point.day);
    const y = yFn(point.weight);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.restore();
}

function drawSeriesDots(ctx, series, xFn, yFn, color, radius = 3) {
  if (!Array.isArray(series) || series.length === 0) return;

  ctx.save();
  ctx.fillStyle = color;
  series.forEach((point) => {
    const x = xFn(point.day);
    const y = yFn(point.weight);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawSelectedMarker(ctx, selectedDay, series, xFn, yFn) {
  const point = series.find((entry) => entry.day === selectedDay);
  if (!point) return;

  const x = xFn(point.day);
  const y = yFn(point.weight);

  ctx.save();

  ctx.strokeStyle = "rgba(63, 68, 84, 0.24)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, 16);
  ctx.lineTo(x, 226);
  ctx.stroke();

  ctx.fillStyle = "#3f4454";
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawXAxisLabels(ctx, model, xForDay, cssHeight, bottomPad) {
  const monthName = new Date(model.year, model.month, 1).toLocaleDateString("da-DK", { month: "short" });

  ctx.save();
  ctx.fillStyle = "#66746e";
  ctx.font = "12px Manrope";
  ctx.textBaseline = "middle";

  const y = cssHeight - bottomPad + 16;

  ctx.textAlign = "left";
  ctx.fillText(`1 ${monthName}`, xForDay(1), y);

  ctx.textAlign = "center";
  const mid = Math.ceil(model.daysInMonth / 2);
  ctx.fillText(String(mid), xForDay(mid), y);

  ctx.textAlign = "right";
  ctx.fillText(String(model.daysInMonth), xForDay(model.daysInMonth), y);

  ctx.restore();
}

function drawNoDataText(ctx, cssWidth, cssHeight, message) {
  ctx.save();
  ctx.fillStyle = "#7a7e8b";
  ctx.font = "13px Manrope";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, cssWidth / 2, cssHeight / 2);
  ctx.restore();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function attachNumericInputFormatting(input) {
  input.addEventListener("input", () => {
    const cleaned = sanitizeNumericInput(input.value);
    if (cleaned !== input.value) input.value = cleaned;
  });
}

function sanitizeNumericInput(value) {
  let v = String(value || "");
  v = v.replace(/[^0-9.,]/g, "");
  v = v.replace(/\./g, ",");

  const firstComma = v.indexOf(",");
  if (firstComma === -1) return v;

  return `${v.slice(0, firstComma + 1)}${v.slice(firstComma + 1).replace(/,/g, "")}`;
}

function parseLocalizedNumber(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalized) return NaN;

  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : NaN;
}

function formatInputNumber(value) {
  return KG_FORMATTER.format(value);
}

function formatKcal(value) {
  return `${KCAL_FORMATTER.format(round0(value))} kcal`;
}

function formatKcalSigned(value, withPlus) {
  const n = round0(value);
  if (n > 0 && withPlus) return `+${KCAL_FORMATTER.format(n)} kcal`;
  if (n < 0) return `-${KCAL_FORMATTER.format(Math.abs(n))} kcal`;
  return `${KCAL_FORMATTER.format(0)} kcal`;
}

function formatKg(value) {
  return `${KG_FORMATTER.format(round1(value))} kg`;
}

function formatDate(iso) {
  return DATE_FORMATTER.format(dateFromISO(iso));
}

function dateFromISO(iso) {
  return new Date(`${iso}T12:00:00`);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayISO(now = new Date()) {
  return toISODate(now);
}

function sortDaysAsc(days) {
  return [...days].sort((a, b) => {
    const byDate = a.dateISO.localeCompare(b.dateISO);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
}

function sortDaysDesc(days) {
  return sortDaysAsc(days).reverse();
}

function createId() {
  if (globalThis.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function diffDaysInclusive(fromISO, toISO) {
  return diffDaysExclusive(fromISO, toISO) + 1;
}

function diffDaysExclusive(fromISO, toISO) {
  const from = dateFromISO(fromISO);
  const to = dateFromISO(toISO);
  return Math.max(Math.round((to - from) / 86400000), 0);
}

function addDaysISO(iso, days) {
  const dt = dateFromISO(iso);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

function isSameYearMonth(iso, year, monthIndex) {
  const d = dateFromISO(iso);
  return d.getFullYear() === year && d.getMonth() === monthIndex;
}

function maxISO(a, b) {
  return a >= b ? a : b;
}

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function round0(value) {
  return Math.round(value);
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function escapeCSV(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function showFlash(message, type = "info") {
  if (flashTimeoutId) {
    clearTimeout(flashTimeoutId);
    flashTimeoutId = null;
  }

  flashMessageEl.textContent = message;
  flashMessageEl.classList.remove("hidden", "info", "success", "error");
  flashMessageEl.classList.add(type);

  flashTimeoutId = window.setTimeout(() => {
    flashMessageEl.classList.add("hidden");
  }, 3600);
}
