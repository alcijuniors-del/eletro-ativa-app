const statusLabels = {
  nova: "Nova",
  andamento: "Em andamento",
  resolvida: "Resolvida",
};

const priorityLabels = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const responseDeadlineDays = {
  alta: 2,
  media: 3,
  baixa: 7,
};

const responseDeadlineLabels = {
  alta: "48 horas",
  media: "3 dias",
  baixa: "7 dias",
};

const adminTaskDeadlineDays = {
  alta: 1,
  media: 3,
  baixa: 5,
};

const adminTaskDeadlineLabels = {
  alta: "24 horas",
  media: "72 horas",
  baixa: "5 dias",
};

const materialListDeadlineDays = {
  alta: 3,
  media: 5,
  baixa: 7,
};

const materialListDeadlineLabels = {
  alta: "3 dias",
  media: "5 dias",
  baixa: "7 dias",
};

const roleLabels = {
  admin: "Administrador",
  manager: "Gerente",
  seller: "Vendedor",
  engineer: "Engenheiro",
};

const unitLabels = {
  SPZ: "SPZ",
  CNP: "CNP",
  CORP: "CORP",
};

const meetingStatusLabels = {
  available: "Disponível",
  blocked: "Fechado",
  booked: "Agendada",
};

const meetingStatusClasses = {
  available: "status-andamento",
  blocked: "status-nova",
  booked: "status-resolvida",
};

const crmStatusLabels = {
  novo: "Novo",
  atendimento: "Em atendimento",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const crmStatusClasses = {
  novo: "status-nova",
  atendimento: "status-andamento",
  negociacao: "status-andamento",
  fechado: "status-resolvida",
  perdido: "status-nova",
};

const priorityWeight = {
  alta: 1,
  media: 2,
  baixa: 3,
};

const stateRefreshIntervalMs = 30000;
const maxAttachmentFiles = 12;
const maxPdfAttachmentBytes = 4 * 1024 * 1024;
const maxImageDimension = 1600;
const imageCompressionQuality = 0.84;
const meetingTimeSlots = ["11:00", "17:00", "18:00"];
const meetingTimeLabels = {
  "11:00": "11:00 às 12:00",
  "17:00": "17:00 às 18:00",
  "18:00": "18:00 às 19:00",
};

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayIso = () => toDateInputValue(new Date());

const daysFromToday = (days) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  return toDateInputValue(date);
};

let requests = [];
let users = [];
let personalTasks = [];
let meetings = [];
let crmOpportunities = [];
let signatureRecords = [];
let hiringRequests = [];
let emailMode = null;
let currentUser = null;
let selectedId = null;
let currentStatus = "todas";
let searchTerm = "";
let priorityFilter = "todas";
let managerTab = "minhas";
let managerWorkspace = "requests";
let adminView = "requests";
let personalTaskFilter = "pendentes";
let meetingTab = "reunioes";
let crmFilter = "todos";
let crmUnitFilter = "todas";
let crmOwnerFilter = "todos";
let meetingSelectedDate = todayIso();
let meetingCalendarDate = new Date();
let renderedDetailId = null;
let toastTimeout;
let stateRefreshTimer;
let signaturePadTouched = false;
let signaturePadDrawing = false;

const elements = {
  loginScreen: document.querySelector("#login-screen"),
  appShell: document.querySelector("#app-shell"),
  loginForm: document.querySelector("#login-form"),
  loginUsername: document.querySelector("#login-username"),
  loginPassword: document.querySelector("#login-password"),
  loginError: document.querySelector("#login-error"),
  currentUserName: document.querySelector("#current-user-name"),
  currentUserRole: document.querySelector("#current-user-role"),
  sellerGoalPill: document.querySelector("#seller-goal-pill"),
  logoutButton: document.querySelector("#logout-button"),
  appTitle: document.querySelector("#app-title"),
  appEyebrow: document.querySelector("#app-eyebrow"),
  adminOnly: document.querySelectorAll("[data-admin-only]"),
  requestsAdminView: document.querySelectorAll("[data-requests-admin-view]"),
  requestsViewButton: document.querySelector("#requests-view-button"),
  materialListsButton: document.querySelector("#material-lists-button"),
  performanceViewButton: document.querySelector("#performance-view-button"),
  personalTasksButton: document.querySelector("#personal-tasks-button"),
  meetingsViewButton: document.querySelector("#meetings-view-button"),
  crmViewButton: document.querySelector("#crm-view-button"),
  hiringsViewButton: document.querySelector("#hirings-view-button"),
  signatureViewButton: document.querySelector("#signature-view-button"),
  navItems: document.querySelectorAll(".nav-item"),
  requestList: document.querySelector("#request-list"),
  emptyState: document.querySelector("#empty-state"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  priorityFilter: document.querySelector("#priority-filter"),
  openFormButton: document.querySelector("#open-form-button"),
  exportButton: document.querySelector("#export-button"),
  backupButton: document.querySelector("#backup-button"),
  changePasswordButton: document.querySelector("#change-password-button"),
  usersButton: document.querySelector("#users-button"),
  modal: document.querySelector("#request-modal"),
  form: document.querySelector("#request-form"),
  requestModalTitle: document.querySelector("#request-modal-title"),
  closeFormButton: document.querySelector("#close-form-button"),
  cancelFormButton: document.querySelector("#cancel-form-button"),
  dueInput: document.querySelector("#due-input"),
  priorityInput: document.querySelector("#priority-input"),
  adminRequestType: document.querySelector("#admin-request-type"),
  adminSlaHint: document.querySelector("#admin-sla-hint"),
  managerInput: document.querySelector("#manager-input"),
  departmentInput: document.querySelector("#department-input"),
  assigneeInput: document.querySelector("#assignee-input"),
  managerPanel: document.querySelector("#manager-submit-panel"),
  managerForm: document.querySelector("#manager-request-form"),
  managerRequestType: document.querySelector("#manager-request-type"),
  managerSlaHint: document.querySelector("#manager-sla-hint"),
  managerAccountLabel: document.querySelector("#manager-account-label"),
  managerHistoryPanel: document.querySelector("#manager-history-panel"),
  managerRequestList: document.querySelector("#manager-request-list"),
  managerRequestCount: document.querySelector("#manager-request-count"),
  managerViewTitle: document.querySelector("#manager-view-title"),
  managerEmptyState: document.querySelector("#manager-empty-state"),
  managerRefreshButton: document.querySelector("#manager-refresh-button"),
  managerTabs: document.querySelectorAll("[data-manager-tab]"),
  managerAllCount: document.querySelector("#manager-all-count"),
  managerWaitingCount: document.querySelector("#manager-waiting-count"),
  managerResolvedCount: document.querySelector("#manager-resolved-count"),
  performancePanel: document.querySelector("#performance-panel"),
  performanceSummaryLabel: document.querySelector("#performance-summary-label"),
  performanceAnswered: document.querySelector("#performance-answered"),
  performanceOnTime: document.querySelector("#performance-on-time"),
  performanceAverage: document.querySelector("#performance-average"),
  performanceBest: document.querySelector("#performance-best"),
  performanceList: document.querySelector("#performance-list"),
  performanceEmptyState: document.querySelector("#performance-empty-state"),
  personalTasksPanel: document.querySelector("#personal-tasks-panel"),
  personalTaskForm: document.querySelector("#personal-task-form"),
  personalTaskSummary: document.querySelector("#personal-task-summary"),
  printPersonalTasksButton: document.querySelector("#print-personal-tasks-button"),
  personalTaskList: document.querySelector("#personal-task-list"),
  personalTaskEmptyState: document.querySelector("#personal-task-empty-state"),
  personalTaskTabs: document.querySelectorAll("[data-personal-filter]"),
  personalPendingCount: document.querySelector("#personal-pending-count"),
  personalResolvedCount: document.querySelector("#personal-resolved-count"),
  personalAllCount: document.querySelector("#personal-all-count"),
  meetingsPanel: document.querySelector("#meetings-panel"),
  meetingsEyebrow: document.querySelector("#meetings-eyebrow"),
  meetingsTitle: document.querySelector("#meetings-title"),
  meetingsSummary: document.querySelector("#meetings-summary"),
  meetingTabs: document.querySelectorAll("[data-meeting-tab]"),
  meetingReminder: document.querySelector("#meeting-reminder"),
  meetingAdminPanel: document.querySelector("#meeting-admin-panel"),
  meetingSlotForm: document.querySelector("#meeting-slot-form"),
  meetingBlockPeriodForm: document.querySelector("#meeting-block-period-form"),
  meetingCalendar: document.querySelector("#meeting-calendar"),
  meetingList: document.querySelector("#meeting-list"),
  meetingEmptyState: document.querySelector("#meeting-empty-state"),
  meetingCountOverview: document.querySelector("#meeting-count-overview"),
  meetingCountBooked: document.querySelector("#meeting-count-booked"),
  meetingCountAvailable: document.querySelector("#meeting-count-available"),
  meetingCountCalendar: document.querySelector("#meeting-count-calendar"),
  crmPanel: document.querySelector("#crm-panel"),
  crmForm: document.querySelector("#crm-form"),
  crmOwnerInput: document.querySelector("#crm-owner-input"),
  crmAdminFilters: document.querySelector("#crm-admin-filters"),
  crmUnitFilter: document.querySelector("#crm-unit-filter"),
  crmOwnerFilter: document.querySelector("#crm-owner-filter"),
  crmExportButton: document.querySelector("#crm-export-button"),
  crmTabs: document.querySelectorAll("[data-crm-filter]"),
  crmList: document.querySelector("#crm-list"),
  crmEmptyState: document.querySelector("#crm-empty-state"),
  crmMetricTotal: document.querySelector("#crm-metric-total"),
  crmMetricOpen: document.querySelector("#crm-metric-open"),
  crmMetricNegotiation: document.querySelector("#crm-metric-negotiation"),
  crmMetricWon: document.querySelector("#crm-metric-won"),
  crmMetricAmountCard: document.querySelector("#crm-metric-amount-card"),
  crmMetricAmount: document.querySelector("#crm-metric-amount"),
  crmMetricConversion: document.querySelector("#crm-metric-conversion"),
  sellerRanking: document.querySelector("#seller-ranking"),
  sellerRankingList: document.querySelector("#seller-ranking-list"),
  emailModeStatus: document.querySelector("#email-mode-status"),
  emailModeText: document.querySelector("#email-mode-text"),
  emailModeUrl: document.querySelector("#email-mode-url"),
  signaturePanel: document.querySelector("#signature-panel"),
  signatureForm: document.querySelector("#signature-form"),
  signaturePad: document.querySelector("#signature-pad"),
  clearSignatureButton: document.querySelector("#clear-signature-button"),
  typedSignatureButton: document.querySelector("#typed-signature-button"),
  signatureList: document.querySelector("#signature-list"),
  signatureEmptyState: document.querySelector("#signature-empty-state"),
  signatureCount: document.querySelector("#signature-count"),
  hiringsPanel: document.querySelector("#hirings-panel"),
  hiringForm: document.querySelector("#hiring-form"),
  hiringsTitle: document.querySelector("#hirings-title"),
  hiringsCount: document.querySelector("#hirings-count"),
  hiringsSummary: document.querySelector("#hirings-summary"),
  hiringsList: document.querySelector("#hirings-list"),
  hiringsEmptyState: document.querySelector("#hirings-empty-state"),
  crmCountAll: document.querySelector("#crm-count-all"),
  crmCountNew: document.querySelector("#crm-count-new"),
  crmCountService: document.querySelector("#crm-count-service"),
  crmCountNegotiation: document.querySelector("#crm-count-negotiation"),
  crmCountWon: document.querySelector("#crm-count-won"),
  crmCountLost: document.querySelector("#crm-count-lost"),
  userModal: document.querySelector("#user-modal"),
  userForm: document.querySelector("#user-form"),
  userModalTitle: document.querySelector("#user-modal-title"),
  userSubmitButton: document.querySelector("#user-submit-button"),
  userPasswordLabel: document.querySelector("#user-password-label"),
  closeUserButton: document.querySelector("#close-user-button"),
  cancelUserButton: document.querySelector("#cancel-user-button"),
  userList: document.querySelector("#user-list"),
  detailPlaceholder: document.querySelector("#detail-placeholder"),
  detailContent: document.querySelector("#detail-content"),
  detailStatus: document.querySelector("#detail-status"),
  detailTitle: document.querySelector("#detail-title"),
  detailManagerLabel: document.querySelector("#detail-manager-label"),
  detailManager: document.querySelector("#detail-manager"),
  detailDepartment: document.querySelector("#detail-department"),
  detailPriority: document.querySelector("#detail-priority"),
  detailDue: document.querySelector("#detail-due"),
  detailDescription: document.querySelector("#detail-description"),
  detailAttachmentsSection: document.querySelector("#detail-attachments-section"),
  detailAttachments: document.querySelector("#detail-attachments"),
  responseInput: document.querySelector("#response-input"),
  responseSectionTitle: document.querySelector("#response-section-title"),
  responseAttachmentsBlock: document.querySelector("#response-attachments-block"),
  responseAttachments: document.querySelector("#response-attachments"),
  responseAttachmentsInput: document.querySelector("#response-attachments-input"),
  historyList: document.querySelector("#history-list"),
  startButton: document.querySelector("#start-button"),
  resolveButton: document.querySelector("#resolve-button"),
  printButton: document.querySelector("#print-button"),
  deleteButton: document.querySelector("#delete-button"),
  toast: document.querySelector("#toast"),
  metrics: {
    open: document.querySelector("#metric-open"),
    today: document.querySelector("#metric-today"),
    overdue: document.querySelector("#metric-overdue"),
    done: document.querySelector("#metric-done"),
    high: document.querySelector("#metric-high"),
    attachments: document.querySelector("#metric-attachments"),
    average: document.querySelector("#metric-average"),
    meetings: document.querySelector("#metric-meetings"),
  },
  counts: {
    todas: document.querySelector("#count-todas"),
    nova: document.querySelector("#count-nova"),
    andamento: document.querySelector("#count-andamento"),
    resolvida: document.querySelector("#count-resolvida"),
  },
};

async function init() {
  bindEvents();
  await loadSession();
  renderAuth();
}

async function loadSession() {
  try {
    const payload = await apiFetch("/api/state");
    applyState(payload);
    renderCurrentView();
  } catch {
    currentUser = null;
    requests = [];
    users = [];
    personalTasks = [];
    meetings = [];
    crmOpportunities = [];
    signatureRecords = [];
    hiringRequests = [];
    emailMode = null;
    selectedId = null;
  }
}

function renderCurrentView() {
  if (!currentUser) return;
  if (isAdmin()) {
    renderAdminView();
    renderUsers();
    return;
  }
  renderManagerView();
}

function applyState(payload) {
  currentUser = payload.user ?? currentUser;
  requests = Array.isArray(payload.requests) ? payload.requests : requests;
  users = Array.isArray(payload.users) ? payload.users : users;
  personalTasks = Array.isArray(payload.personalTasks) ? payload.personalTasks : personalTasks;
  meetings = Array.isArray(payload.meetings) ? payload.meetings : meetings;
  crmOpportunities = Array.isArray(payload.crmOpportunities) ? payload.crmOpportunities : crmOpportunities;
  signatureRecords = Array.isArray(payload.signatureRecords) ? payload.signatureRecords : signatureRecords;
  hiringRequests = Array.isArray(payload.hiringRequests) ? payload.hiringRequests : hiringRequests;
  emailMode = payload.emailMode ?? emailMode;

  if (!requests.some((request) => request.id === selectedId)) {
    selectedId = requests[0]?.id ?? null;
  }
}

async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      currentUser = null;
      requests = [];
      users = [];
      personalTasks = [];
      meetings = [];
      crmOpportunities = [];
      signatureRecords = [];
      hiringRequests = [];
      emailMode = null;
      renderAuth();
    }
    throw new Error(payload.error || "Nao foi possivel concluir a acao.");
  }

  return payload;
}

function jsonRequest(method, payload) {
  return {
    method,
    body: JSON.stringify(payload),
  };
}

function formRequest(method, formData) {
  return {
    method,
    body: formData,
  };
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function formatDate(value = "") {
  if (!value.includes("-")) return "Não informado";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatMeetingTime(value = "") {
  return meetingTimeLabels[value] || value || "--:--";
}

function formatDateTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function responseDueDate(priority, deadlineDays = responseDeadlineDays) {
  return daysFromToday(deadlineDays[priority] ?? deadlineDays.media);
}

function responseDeadlineLabel(priority, labels = responseDeadlineLabels) {
  return labels[priority] ?? labels.media;
}

function requestDeadlineLabel(request) {
  if (request.type === "admin_task") return responseDeadlineLabel(request.priority, adminTaskDeadlineLabels);
  if (request.type === "material_list") return responseDeadlineLabel(request.priority, materialListDeadlineLabels);
  return responseDeadlineLabel(request.priority);
}

function applyResponseDeadline(form, hintElement = null, deadlineDays = responseDeadlineDays, labels = responseDeadlineLabels) {
  const priority = form.elements.priority.value;
  const dueDate = responseDueDate(priority, deadlineDays);
  const dueInput = form.elements.dueDate;

  dueInput.value = dueDate;
  dueInput.min = dueDate;
  dueInput.max = dueDate;

  if (hintElement) {
    hintElement.textContent = `Prazo automático: ${responseDeadlineLabel(priority, labels)}`;
  }
}

function isOverdue(request) {
  return request.status !== "resolvida" && request.dueDate < todayIso();
}

function isDueToday(request) {
  return request.status !== "resolvida" && request.dueDate === todayIso();
}

function syncMeetingAdminForms(date = meetingSelectedDate, forceDate = false) {
  if (!isAdmin()) return;

  const minDate = todayIso();
  if (elements.meetingSlotForm) {
    elements.meetingSlotForm.elements.date.min = minDate;
    if (forceDate || !elements.meetingSlotForm.elements.date.value) {
      elements.meetingSlotForm.elements.date.value = date;
    }
  }
  if (elements.meetingBlockPeriodForm) {
    elements.meetingBlockPeriodForm.elements.startDate.min = minDate;
    elements.meetingBlockPeriodForm.elements.endDate.min = minDate;
    if (!elements.meetingBlockPeriodForm.elements.startDate.value) {
      elements.meetingBlockPeriodForm.elements.startDate.value = date;
    }
    if (!elements.meetingBlockPeriodForm.elements.endDate.value) {
      elements.meetingBlockPeriodForm.elements.endDate.value = date;
    }
  }
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeUsername(value) {
  return normalizeText(value.trim()).replace(/\s+/g, ".");
}

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11) return `55${digits}`;
  return digits;
}

function formatPhone(value = "") {
  const digits = normalizePhone(value);
  if (!digits) return "sem WhatsApp";
  if (digits.startsWith("55") && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return `+${digits}`;
}

function filteredRequests() {
  const term = normalizeText(searchTerm.trim());

  return scopedRequests()
    .filter((request) => currentStatus === "todas" || request.status === currentStatus)
    .filter((request) => priorityFilter === "todas" || request.priority === priorityFilter)
    .filter((request) => {
      if (!term) return true;
      return normalizeText(
        `${request.title} ${request.manager} ${request.department} ${request.description}`,
      ).includes(term);
    })
    .sort(compareRequestsByPriorityAndPost);
}

function scopedRequests() {
  if (isAdmin() && adminView === "material") {
    return requests.filter((request) => request.type === "material_list");
  }

  if (isAdmin()) {
    return requests.filter((request) => request.type !== "material_list");
  }

  return requests;
}

function compareRequestsByPriorityAndPost(a, b) {
  const priorityDiff = (priorityWeight[a.priority] || 99) - (priorityWeight[b.priority] || 99);
  if (priorityDiff !== 0) return priorityDiff;

  const createdDiff = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  if (createdDiff !== 0) return createdDiff;

  return String(b.id || "").localeCompare(String(a.id || ""));
}

function renderAuth() {
  const loggedIn = Boolean(currentUser);
  elements.loginScreen.classList.toggle("hidden", loggedIn);
  elements.appShell.classList.toggle("hidden", !loggedIn);

  if (!loggedIn) {
    stopStateRefresh();
    elements.loginUsername.focus();
    return;
  }

  const userIsAdmin = isAdmin();
  startStateRefresh();
  elements.currentUserName.textContent = currentUser.name;
  elements.currentUserRole.textContent = roleLabels[currentUser.role];
  elements.currentUserRole.className = `role-pill role-${currentUser.role}`;
  elements.sellerGoalPill.classList.toggle("hidden", currentUser.role !== "seller");
  elements.sellerGoalPill.textContent = `Meta: ${formatCurrency(currentUser.sellerGoal || 0)}`;
  elements.adminOnly.forEach((element) => element.classList.toggle("hidden", !userIsAdmin));

  if (userIsAdmin) {
    elements.personalTaskForm.elements.dueDate.min = todayIso();
    renderAdminView();
    renderUsers();
    renderAssigneeOptions();
    return;
  }

  applyManagerRequestDeadline();
  renderManagerView();
}

function applyManagerRequestDeadline() {
  const isMaterialList = elements.managerRequestType?.value === "material_list";
  const titleInput = elements.managerForm.elements.title;
  titleInput.placeholder = isMaterialList ? "Solicitação Lista de Material" : "Resumo da solicitação";
  if (isMaterialList && !titleInput.value.trim()) {
    titleInput.value = "Solicitação Lista de Material";
  }
  applyResponseDeadline(
    elements.managerForm,
    elements.managerSlaHint,
    isMaterialList ? materialListDeadlineDays : responseDeadlineDays,
    isMaterialList ? materialListDeadlineLabels : responseDeadlineLabels,
  );
}

function applyAdminRequestDeadline() {
  const isMaterialList = elements.adminRequestType?.value === "material_list";
  const titleInput = elements.form.elements.title;
  elements.requestModalTitle.textContent = isMaterialList ? "Nova lista de material" : "Nova solicitação";
  titleInput.placeholder = isMaterialList ? "Solicitação Lista de Material" : "Resumo da solicitação";
  if (isMaterialList && !titleInput.value.trim()) {
    titleInput.value = "Solicitação Lista de Material";
  } else if (!isMaterialList && titleInput.value.trim() === "Solicitação Lista de Material") {
    titleInput.value = "";
  }
  renderAssigneeOptions();
  applyResponseDeadline(
    elements.form,
    elements.adminSlaHint,
    isMaterialList ? materialListDeadlineDays : adminTaskDeadlineDays,
    isMaterialList ? materialListDeadlineLabels : adminTaskDeadlineLabels,
  );
}

function renderAdminView() {
  if (!isAdmin()) return;

  const showingRequests = adminView === "requests" || adminView === "material";
  const showingMaterialLists = adminView === "material";
  const showingPerformance = adminView === "performance";
  const showingPersonalTasks = adminView === "personal";
  const showingMeetings = adminView === "meetings";
  const showingCrm = adminView === "crm";
  const showingSignatures = adminView === "signatures";
  const showingHirings = adminView === "hirings";
  elements.requestsAdminView.forEach((element) => {
    element.classList.toggle("hidden", !showingRequests);
  });
  elements.managerPanel.classList.add("hidden");
  elements.managerHistoryPanel.classList.add("hidden");
  elements.performancePanel.classList.toggle("hidden", !showingPerformance);
  elements.personalTasksPanel.classList.toggle("hidden", !showingPersonalTasks);
  elements.meetingsPanel.classList.toggle("hidden", !showingMeetings);
  elements.crmPanel.classList.toggle("hidden", !showingCrm);
  elements.signaturePanel.classList.toggle("hidden", !showingSignatures);
  elements.hiringsPanel.classList.toggle("hidden", !showingHirings);
  elements.requestsViewButton.classList.toggle("active-view-button", adminView === "requests");
  elements.materialListsButton.classList.toggle("active-view-button", showingMaterialLists);
  elements.performanceViewButton.classList.toggle("active-view-button", showingPerformance);
  elements.personalTasksButton.classList.toggle("active-view-button", showingPersonalTasks);
  elements.meetingsViewButton.classList.toggle("active-view-button", showingMeetings);
  elements.crmViewButton.classList.remove("hidden");
  elements.crmViewButton.classList.toggle("active-view-button", showingCrm);
  elements.hiringsViewButton.classList.remove("hidden");
  elements.hiringsViewButton.classList.toggle("active-view-button", showingHirings);
  elements.signatureViewButton.classList.toggle("active-view-button", showingSignatures);

  if (showingPersonalTasks) {
    elements.appEyebrow.textContent = "Controle pessoal";
    elements.appTitle.textContent = "Minhas pendências";
    renderPersonalTasks();
    return;
  }

  if (showingMeetings) {
    elements.appEyebrow.textContent = "Agenda Alcir";
    elements.appTitle.textContent = "Reuniões";
    renderMeetings();
    return;
  }

  if (showingCrm) {
    elements.appEyebrow.textContent = "Comercial";
    elements.appTitle.textContent = "CRM de vendas";
    renderCrm();
    return;
  }

  if (showingSignatures) {
    elements.appEyebrow.textContent = "Assinatura eletrônica";
    elements.appTitle.textContent = "Documentos assinados";
    setupSignaturePad();
    renderSignatures();
    return;
  }

  if (showingHirings) {
    elements.appEyebrow.textContent = "Contratações";
    elements.appTitle.textContent = "Autorizações de contratação";
    renderHirings();
    return;
  }

  if (showingPerformance) {
    elements.appEyebrow.textContent = "Indicadores";
    elements.appTitle.textContent = "Desempenho do admin e engenheiro";
    renderPerformance();
    return;
  }

  elements.appEyebrow.textContent = showingMaterialLists ? "Acompanhamento técnico" : "Painel das lojas";
  elements.appTitle.textContent = showingMaterialLists ? "Listas de material" : "Solicitações das lojas";
  elements.openFormButton.innerHTML = showingMaterialLists
    ? '<span aria-hidden="true">+</span> Nova lista'
    : '<span aria-hidden="true">+</span> Nova solicitação';
  render();
}

function renderManagerView() {
  if (isAdmin()) return;
  if (currentUser.role === "seller") {
    managerWorkspace = "crm";
  }

  const showingMeetings = managerWorkspace === "meetings";
  const showingCrm = managerWorkspace === "crm";
  const showingHirings = managerWorkspace === "hirings";
  elements.managerPanel.classList.toggle("hidden", showingMeetings || showingCrm || showingHirings || currentUser.role === "engineer");
  elements.managerHistoryPanel.classList.toggle("hidden", showingMeetings || showingCrm || showingHirings);
  elements.performancePanel.classList.add("hidden");
  elements.personalTasksPanel.classList.add("hidden");
  elements.meetingsPanel.classList.toggle("hidden", !showingMeetings);
  elements.crmPanel.classList.toggle("hidden", !showingCrm);
  elements.signaturePanel.classList.add("hidden");
  elements.hiringsPanel.classList.toggle("hidden", !showingHirings);
  elements.requestsViewButton.classList.toggle("hidden", currentUser.role === "seller");
  elements.meetingsViewButton.classList.toggle("hidden", currentUser.role === "seller");
  elements.crmViewButton.classList.toggle("hidden", currentUser.role !== "seller");
  elements.hiringsViewButton.classList.toggle("hidden", currentUser.role === "seller" || currentUser.role === "engineer");
  elements.requestsViewButton.classList.toggle("active-view-button", !showingMeetings && !showingCrm && !showingHirings);
  elements.meetingsViewButton.classList.toggle("active-view-button", showingMeetings);
  elements.crmViewButton.classList.toggle("active-view-button", showingCrm);
  elements.hiringsViewButton.classList.toggle("active-view-button", showingHirings);

  if (showingMeetings) {
    elements.appEyebrow.textContent = "Agenda Alcir";
    elements.appTitle.textContent = "Reuniões";
    renderMeetings();
    return;
  }

  if (showingCrm) {
    elements.appEyebrow.textContent = "Área do vendedor";
    elements.appTitle.textContent = "Minhas vendas";
    renderCrm();
    return;
  }

  if (showingHirings) {
    elements.appEyebrow.textContent = "Gerente administrativo";
    elements.appTitle.textContent = "Contratações";
    renderHirings();
    return;
  }

  elements.appEyebrow.textContent = "Área da loja";
  elements.appTitle.textContent = "Solicitações da loja";
  elements.managerAccountLabel.textContent = `${currentUser.name} · ${unitLabel(currentUser.unit)} · ${currentUser.department}`;
  renderManagerDashboard();
}

function render() {
  if (!isAdmin()) return;
  renderCounts();
  renderMetrics();
  renderList();
  renderDetail();
}

function renderManagerDashboard() {
  if (isAdmin()) return;

  const allRequests = [...requests].sort(compareRequestsByPriorityAndPost);
  const waitingRequests = requests.filter((request) => request.status !== "resolvida");
  const resolvedRequests = requests.filter((request) => request.status === "resolvida");
  const managerViews = {
    minhas: {
      title: "Minhas solicitações",
      emptyTitle: "Nenhuma solicitação enviada",
      emptyText: "Quando você enviar uma solicitação, ela aparece aqui com status e resposta.",
      requests: allRequests,
    },
    aguardando: {
      title: "Aguardando resolução",
      emptyTitle: "Nenhuma solicitação aguardando resolução",
      emptyText: "As solicitações que ainda não receberam resposta aparecem aqui.",
      requests: [...waitingRequests].sort(compareRequestsByPriorityAndPost),
    },
    resolvidas: {
      title: "Solicitações resolvidas",
      emptyTitle: "Nenhuma solicitação resolvida",
      emptyText: "Quando uma resposta for enviada pela administração, ela aparece nesta aba.",
      requests: [...resolvedRequests].sort(compareRequestsByPriorityAndPost),
    },
  };
  const activeView = managerViews[managerTab] || managerViews.minhas;
  const ownRequests = activeView.requests;

  elements.managerTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.managerTab === managerTab);
  });
  elements.managerAllCount.textContent = requests.length;
  elements.managerWaitingCount.textContent = waitingRequests.length;
  elements.managerResolvedCount.textContent = resolvedRequests.length;
  elements.managerViewTitle.textContent = activeView.title;
  elements.managerRequestList.innerHTML = "";
  elements.managerRequestCount.textContent = `${ownRequests.length} ${
    ownRequests.length === 1 ? "item" : "itens"
  }`;
  elements.managerEmptyState.classList.toggle("hidden", ownRequests.length > 0);
  elements.managerEmptyState.querySelector("strong").textContent = activeView.emptyTitle;
  elements.managerEmptyState.querySelector("span").textContent = activeView.emptyText;

  ownRequests.forEach((request) => {
    const item = document.createElement("article");
    item.className = `manager-request-card priority-${request.priority}`;

    const response = request.response
      ? escapeHtml(request.response)
      : "Ainda sem resposta. Quando a administração responder, a resposta aparece aqui automaticamente.";
    const history = Array.isArray(request.history) ? request.history : [];
    const attachments = Array.isArray(request.attachments) ? request.attachments : [];
    const responseAttachments = Array.isArray(request.responseAttachments)
      ? request.responseAttachments
      : [];
    const assignedToMe = request.assigneeId === currentUser.id && request.status !== "resolvida";
    const requestTypeLabel = request.type === "material_list"
      ? "Lista de Material"
      : request.type === "admin_task"
        ? "Solicitação da Administração"
        : "Solicitação enviada";

    item.innerHTML = `
      <div class="request-title-row">
        <div>
          <strong>${escapeHtml(request.title)}</strong>
          <span class="manager-request-date">Enviada em ${formatDateTime(request.createdAt)}</span>
        </div>
        <span class="status-pill status-${request.status}">${statusLabels[request.status]}</span>
      </div>
      <p class="request-description">${escapeHtml(request.description)}</p>
      <div class="request-meta">
        <span class="chip">${escapeHtml(requestTypeLabel)}</span>
        <span class="chip priority-${request.priority}">${priorityLabels[request.priority]}</span>
        <span class="chip">Prazo: ${formatDate(request.dueDate)}</span>
        <span class="chip">${requestDeadlineLabel(request)}</span>
      </div>
      ${attachmentsMarkup(attachments, "Anexos da solicitação")}
      <section class="manager-response-box">
        <h3>${assignedToMe ? "Sua resposta" : "Resposta"}</h3>
        <p>${response}</p>
        ${attachmentsMarkup(responseAttachments, "Anexos da resposta")}
      </section>
      ${
        assignedToMe
          ? `<form class="assigned-response-form" data-assigned-response-form="${escapeHtml(request.id)}">
              <label>
                Responder e marcar como resolvida
                <textarea name="response" rows="4" required placeholder="Descreva a solução ou a lista de material do projeto."></textarea>
              </label>
              <label class="file-field">
                Anexos da resposta
                <input name="responseAttachments" type="file" accept="image/*,application/pdf" multiple />
                <span class="input-hint">Clique para selecionar ou arraste arquivos aqui. Até 12 arquivos.</span>
              </label>
              <div class="manager-card-actions">
                <button class="primary-button compact-button" type="submit">Enviar resposta</button>
              </div>
            </form>`
          : ""
      }
      <details class="manager-history">
        <summary>Histórico</summary>
        <ol>
          ${history.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
        </ol>
      </details>
      <div class="manager-card-actions">
        <button class="ghost-button compact-button" type="button" data-print-request="${escapeHtml(request.id)}">
          <span aria-hidden="true">▣</span>
          PDF
        </button>
      </div>
    `;

    elements.managerRequestList.append(item);
  });
}

function renderCrm() {
  if (!isAdmin() && currentUser?.role !== "seller") return;

  renderCrmOwnerOptions();
  renderEmailModeStatus();
  renderCrmOwnerFilterOptions();
  const scopedOpportunities = scopedCrmOpportunities();
  const openOpportunities = scopedOpportunities.filter((item) => !["fechado", "perdido"].includes(item.status));
  const negotiationOpportunities = scopedOpportunities.filter((item) => item.status === "negociacao");
  const wonOpportunities = scopedOpportunities.filter((item) => item.status === "fechado");
  const performance = sellerPerformanceFromOpportunities(scopedOpportunities);
  const openAmount = openOpportunities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const visibleOpportunities = filteredCrmOpportunities();

  elements.crmMetricTotal.textContent = performance.total;
  elements.crmMetricOpen.textContent = openOpportunities.length;
  elements.crmMetricNegotiation.textContent = negotiationOpportunities.length;
  elements.crmMetricWon.textContent = wonOpportunities.length;
  elements.crmMetricAmount.textContent = formatCurrency(openAmount);
  elements.crmMetricConversion.textContent = `${performance.conversion}% · ${performance.rating}`;
  elements.crmCountAll.textContent = scopedOpportunities.length;
  elements.crmCountNew.textContent = scopedOpportunities.filter((item) => item.status === "novo").length;
  elements.crmCountService.textContent = scopedOpportunities.filter((item) => item.status === "atendimento").length;
  elements.crmCountNegotiation.textContent = negotiationOpportunities.length;
  elements.crmCountWon.textContent = wonOpportunities.length;
  elements.crmCountLost.textContent = scopedOpportunities.filter((item) => item.status === "perdido").length;
  elements.crmPanel.classList.toggle("seller-crm-panel", currentUser?.role === "seller");
  elements.crmForm.classList.toggle("hidden", !isAdmin());
  elements.emailModeStatus.classList.toggle("hidden", !isAdmin());
  elements.crmExportButton.classList.toggle("hidden", !isAdmin());
  elements.crmAdminFilters.classList.toggle("hidden", !isAdmin());
  elements.sellerRanking.classList.toggle("hidden", !isAdmin());
  renderSellerRanking();

  elements.crmTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.crmFilter === crmFilter);
  });

  elements.crmList.innerHTML = "";
  elements.crmEmptyState.classList.toggle("hidden", visibleOpportunities.length > 0);
  elements.crmEmptyState.querySelector("strong").textContent =
    crmFilter === "todos" ? "Nenhuma oportunidade no CRM" : `Nenhuma oportunidade em ${crmStatusLabels[crmFilter]}`;

  visibleOpportunities.forEach((opportunity) => {
    const card = document.createElement("article");
    card.className = `crm-card crm-${opportunity.status}`;
    card.dataset.crmOpportunityId = opportunity.id;
    const attachments = Array.isArray(opportunity.attachments) ? opportunity.attachments : [];
    const history = Array.isArray(opportunity.history) ? opportunity.history : [];
    const opportunityCode = crmOpportunityCode(opportunity);

    card.innerHTML = `
      <div class="crm-card-summary">
        <div class="crm-card-main">
          <span>Orçamento</span>
          <strong>${escapeHtml(opportunityCode)}</strong>
          <small>${escapeHtml(opportunity.title || opportunity.clientName)}</small>
        </div>
        <div class="crm-card-value">
          <span>Valor</span>
          <strong>${formatCurrency(opportunity.amount)}</strong>
        </div>
        <span class="status-pill ${crmStatusClasses[opportunity.status] || "status-andamento"}">
          ${crmStatusLabels[opportunity.status] || "Novo"}
        </span>
      </div>
      <details class="crm-card-details">
        <summary>Ver informações e rotina</summary>
        <div class="crm-card-grid">
          <div><span>Cliente</span><strong>${escapeHtml(opportunity.clientName)}</strong></div>
          <div><span>Contato</span><strong>${escapeHtml(opportunity.contactName || "Não informado")}</strong></div>
          <div><span>WhatsApp</span><strong>${escapeHtml(formatPhone(opportunity.phone))}</strong></div>
          ${isAdmin() ? `<div><span>Unidade</span><strong>${unitLabel(opportunity.unit)}</strong></div>` : ""}
          ${isAdmin() ? `<div><span>Responsável</span><strong>${escapeHtml(opportunity.ownerName || "Não definido")}</strong></div>` : ""}
        </div>
        ${opportunity.email ? `<p class="request-description">E-mail: ${escapeHtml(opportunity.email)}</p>` : ""}
        ${opportunity.notes ? `<p class="request-description">${escapeHtml(opportunity.notes)}</p>` : ""}
        <div class="request-meta">
          <span class="chip">Origem: ${escapeHtml(opportunity.source || "Cadastro manual")}</span>
          <span class="chip">Criada: ${formatDateTime(opportunity.createdAt)}</span>
          <span class="chip">Atualizado: ${formatDateTime(opportunity.updatedAt || opportunity.createdAt)}</span>
        </div>
        ${attachmentsMarkup(attachments, "Orçamento anexado")}
        <div class="crm-card-actions">
          <label>
            Etapa
            <select data-crm-status="${escapeHtml(opportunity.id)}">
              ${Object.entries(crmStatusLabels)
                .map(([value, label]) => `<option value="${value}" ${opportunity.status === value ? "selected" : ""}>${label}</option>`)
                .join("")}
            </select>
          </label>
          ${isAdmin() ? `<button class="ghost-button compact-button danger-action" type="button" data-delete-crm="${escapeHtml(opportunity.id)}">Excluir</button>` : ""}
        </div>
        ${crmFollowUpFormMarkup(opportunity)}
        ${crmFollowUpsMarkup(opportunity)}
        ${
          history.length
            ? `<details class="manager-history">
                <summary>Histórico</summary>
                <ol>${history.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ol>
              </details>`
            : ""
        }
      </details>
    `;

    elements.crmList.append(card);
  });
}

function sellerPerformanceFromOpportunities(items) {
  const total = items.length;
  const closed = items.filter((item) => item.status === "fechado").length;
  const open = items.filter((item) => !["fechado", "perdido"].includes(item.status)).length;
  const lost = items.filter((item) => item.status === "perdido").length;
  const conversion = total > 0 ? Math.round((closed / total) * 100) : 0;
  return {
    total,
    closed,
    open,
    lost,
    conversion,
    rating: conversionRating(conversion),
  };
}

function crmOpportunityCode(opportunity) {
  const title = String(opportunity.title || "");
  const match = title.match(/\b(?:orc(?:amento)?|orçamento|orcamento)\s*[-#:º]?\s*([a-z0-9-]*\d[a-z0-9-]*)/i);
  if (match?.[1]) return `ORC ${match[1].toUpperCase()}`;
  const idPart = String(opportunity.id || "").split("-").pop()?.slice(0, 6).toUpperCase();
  return idPart ? `ORC ${idPart}` : "ORC";
}

function conversionRating(conversion) {
  if (conversion <= 30) return "Fraco";
  if (conversion <= 50) return "Médio";
  if (conversion < 70) return "Bom";
  return "Excelente";
}

function renderSellerRanking() {
  if (!isAdmin() || !elements.sellerRankingList) return;
  const sellers = users.filter((user) => user.role === "seller");
  const ranking = sellers
    .map((seller) => {
      const opportunities = crmOpportunities.filter((item) => item.ownerId === seller.id);
      const performance = sellerPerformanceFromOpportunities(opportunities);
      const amountWon = opportunities
        .filter((item) => item.status === "fechado")
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return {
        seller,
        opportunities,
        performance,
        amountWon,
      };
    })
    .sort((left, right) => {
      const conversionDiff = right.performance.conversion - left.performance.conversion;
      if (conversionDiff !== 0) return conversionDiff;
      const closedDiff = right.performance.closed - left.performance.closed;
      if (closedDiff !== 0) return closedDiff;
      return right.amountWon - left.amountWon;
    });

  elements.sellerRankingList.innerHTML = ranking.length
    ? ranking.map((item, index) => sellerRankingItemMarkup(item, index)).join("")
    : `<div class="empty-state"><strong>Nenhum vendedor cadastrado</strong><span>Crie usuários com perfil Vendedor para gerar o ranking.</span></div>`;
}

function sellerRankingItemMarkup(item, index) {
  return `<article class="seller-ranking-item">
    <strong>${index + 1}. ${escapeHtml(item.seller.name)}</strong>
    <span>${unitLabel(item.seller.unit)} · Meta ${formatCurrency(item.seller.sellerGoal || 0)}</span>
    <div class="seller-ranking-metrics">
      <span>${item.performance.total} orçamentos</span>
      <span>${item.performance.open} abertos</span>
      <span>${item.performance.closed} fechados</span>
      <span>${item.performance.conversion}% · ${escapeHtml(item.performance.rating)}</span>
    </div>
  </article>`;
}

function crmFollowUpFormMarkup(opportunity) {
  if (opportunity.status === "fechado" || opportunity.status === "perdido") return "";
  return `<form class="crm-feedback-form" data-crm-feedback-form="${escapeHtml(opportunity.id)}">
    <label>
      Feedback da ligação / atendimento
      <textarea name="feedback" rows="3" required placeholder="Ex.: Liguei, cliente pediu revisão de preço, ficou de responder amanhã."></textarea>
    </label>
    <div class="form-grid compact-feedback-grid">
      <label>
        Próxima ação
        <input name="nextAction" type="text" placeholder="Ex.: Retornar ligação" />
      </label>
      <label>
        Data da próxima ação
        <input name="nextActionDate" type="date" />
      </label>
    </div>
    <div class="manager-card-actions">
      <button class="primary-button compact-button" type="submit">Registrar feedback</button>
    </div>
  </form>`;
}

function crmFollowUpsMarkup(opportunity) {
  const followUps = Array.isArray(opportunity.followUps) ? opportunity.followUps : [];
  if (followUps.length === 0) return "";
  return `<section class="manager-response-box">
    <h3>Rotina comercial</h3>
    <ol class="crm-followup-list">
      ${followUps.map((followUp) => `<li>
        <strong>${escapeHtml(followUp.createdByName || "Vendedor")} · ${formatDateTime(followUp.createdAt)}</strong>
        <p>${escapeHtml(followUp.feedback || "Sem feedback informado.")}</p>
        ${
          followUp.nextAction || followUp.nextActionDate
            ? `<span class="manager-request-date">Próxima ação: ${escapeHtml(followUp.nextAction || "Não informada")} ${followUp.nextActionDate ? `em ${formatDate(followUp.nextActionDate)}` : ""}</span>`
            : ""
        }
      </li>`).join("")}
    </ol>
  </section>`;
}

function renderEmailModeStatus() {
  if (!elements.emailModeStatus) return;
  const enabled = Boolean(emailMode?.enabled);
  elements.emailModeStatus.classList.toggle("email-mode-enabled", enabled);
  elements.emailModeStatus.classList.toggle("email-mode-disabled", !enabled);
  elements.emailModeText.textContent = enabled
    ? "Ativo. Encaminhe os e-mails de orçamento para esta rota usando a chave secreta."
    : "Pendente. Configure EMAIL_CRM_WEBHOOK_SECRET no Render para liberar entrada automática.";
  elements.emailModeUrl.textContent = emailMode?.webhookUrl || "/api/email/crm";
}

function renderCrmOwnerOptions() {
  if (!elements.crmOwnerInput) return;
  const selected = elements.crmOwnerInput.value;
  const options = users
    .filter((user) => user.role !== "admin")
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "pt-BR"))
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${unitLabel(user.unit)}</option>`);

  elements.crmOwnerInput.innerHTML = `<option value="">Sem responsável</option>${options.join("")}`;
  if ([...elements.crmOwnerInput.options].some((option) => option.value === selected)) {
    elements.crmOwnerInput.value = selected;
  }
}

function renderCrmOwnerFilterOptions() {
  if (!elements.crmOwnerFilter) return;
  const selected = elements.crmOwnerFilter.value || crmOwnerFilter;
  const sellers = users
    .filter((user) => user.role === "seller")
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "pt-BR"));
  elements.crmOwnerFilter.innerHTML = `<option value="todos">Todos</option>${sellers
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${unitLabel(user.unit)}</option>`)
    .join("")}`;
  elements.crmOwnerFilter.value = [...elements.crmOwnerFilter.options].some((option) => option.value === selected)
    ? selected
    : "todos";
  crmOwnerFilter = elements.crmOwnerFilter.value;
}

function filteredCrmOpportunities() {
  return scopedCrmOpportunities()
    .filter((item) => crmFilter === "todos" || item.status === crmFilter)
    .sort(compareCrmOpportunities);
}

function scopedCrmOpportunities() {
  return crmOpportunities
    .filter((item) => !isAdmin() || crmUnitFilter === "todas" || item.unit === crmUnitFilter)
    .filter((item) => !isAdmin() || crmOwnerFilter === "todos" || item.ownerId === crmOwnerFilter);
}

function compareCrmOpportunities(left, right) {
  const statusWeight = {
    novo: 1,
    atendimento: 2,
    negociacao: 3,
    fechado: 4,
    perdido: 5,
  };
  const statusDiff = (statusWeight[left.status] || 99) - (statusWeight[right.status] || 99);
  if (statusDiff !== 0) return statusDiff;

  const updatedDiff = new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
  if (updatedDiff !== 0) return updatedDiff;

  return String(right.id || "").localeCompare(String(left.id || ""));
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function renderPersonalTasks() {
  if (!isAdmin()) return;

  const pendingTasks = personalTasks.filter((task) => task.status !== "resolvida");
  const resolvedTasks = personalTasks.filter((task) => task.status === "resolvida");
  const visibleTasks = filteredPersonalTasks();

  elements.personalPendingCount.textContent = pendingTasks.length;
  elements.personalResolvedCount.textContent = resolvedTasks.length;
  elements.personalAllCount.textContent = personalTasks.length;
  elements.personalTaskSummary.textContent = `${pendingTasks.length} ${
    pendingTasks.length === 1 ? "pendente" : "pendentes"
  }`;

  elements.personalTaskTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.personalFilter === personalTaskFilter);
  });

  elements.personalTaskList.innerHTML = "";
  elements.personalTaskEmptyState.classList.toggle("hidden", visibleTasks.length > 0);
  elements.personalTaskEmptyState.querySelector("strong").textContent =
    personalTaskFilter === "resolvidas"
      ? "Nenhuma pendência resolvida"
      : "Nenhuma pendência pessoal";
  elements.personalTaskEmptyState.querySelector("span").textContent =
    personalTaskFilter === "resolvidas"
      ? "Quando você marcar uma pendência como resolvida, ela aparece aqui."
      : "Cadastre uma pendência para acompanhar sem misturar com os pedidos dos gerentes.";

  visibleTasks.forEach((task) => {
    const card = document.createElement("article");
    const overdue = isPersonalTaskOverdue(task);
    const statusClass = task.status === "resolvida" ? "status-resolvida" : overdue ? "status-nova" : "status-andamento";
    card.className = `personal-task-card ${task.status === "resolvida" ? "resolved" : ""} ${overdue ? "overdue" : ""}`;
    card.dataset.personalTaskId = task.id;

    card.innerHTML = `
      <div class="request-title-row">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <span class="manager-request-date">Criada em ${formatDateTime(task.createdAt)}</span>
        </div>
        <span class="status-pill ${statusClass}">${task.status === "resolvida" ? "Resolvida" : overdue ? "Atrasada" : "Pendente"}</span>
      </div>
      ${task.description ? `<p class="request-description">${escapeHtml(task.description)}</p>` : ""}
      <div class="request-meta">
        <span class="chip">Prazo: ${formatDate(task.dueDate)}</span>
        ${overdue ? '<span class="chip danger-chip">Atrasada</span>' : ""}
      </div>
      ${
        task.status === "resolvida"
          ? `<section class="manager-response-box">
              <h3>Como foi resolvido</h3>
              <p>${escapeHtml(task.resolution)}</p>
              <span class="manager-request-date">Resolvida em ${formatDateTime(task.resolvedAt || task.updatedAt)}</span>
            </section>`
          : `<label class="response-box personal-resolution-box">
              Como foi resolvido
              <textarea rows="4" data-resolution-input placeholder="Descreva a solução antes de marcar como resolvida."></textarea>
            </label>
            <div class="manager-card-actions">
              <button class="primary-button compact-button" type="button" data-resolve-personal-task="${escapeHtml(task.id)}">
                <span aria-hidden="true">✓</span>
                Marcar resolvida
              </button>
              <button class="ghost-button compact-button" type="button" data-delete-personal-task="${escapeHtml(task.id)}">Excluir</button>
            </div>`
      }
      ${
        task.status === "resolvida"
          ? `<div class="manager-card-actions">
              <button class="ghost-button compact-button" type="button" data-delete-personal-task="${escapeHtml(task.id)}">Excluir</button>
            </div>`
          : ""
      }
    `;

    elements.personalTaskList.append(card);
  });
}

function filteredPersonalTasks() {
  return personalTasks
    .filter((task) => {
      if (personalTaskFilter === "pendentes") return task.status !== "resolvida";
      if (personalTaskFilter === "resolvidas") return task.status === "resolvida";
      return true;
    })
    .sort(comparePersonalTasks);
}

function comparePersonalTasks(left, right) {
  if (left.status !== right.status) {
    return left.status === "pendente" ? -1 : 1;
  }

  if (left.status !== "resolvida") {
    const dueDiff = String(left.dueDate || "").localeCompare(String(right.dueDate || ""));
    if (dueDiff !== 0) return dueDiff;
  }

  const updatedDiff =
    new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
  if (updatedDiff !== 0) return updatedDiff;

  return String(right.id || "").localeCompare(String(left.id || ""));
}

function isPersonalTaskOverdue(task) {
  return task.status !== "resolvida" && task.dueDate < todayIso();
}

function renderMeetings() {
  if (!isAdmin() && meetingTab === "agendar") {
    meetingTab = "calendario";
  }

  const bookedMeetings = meetings.filter((meeting) => meeting.status === "booked");
  const availableMeetings = meetings.filter((meeting) => meeting.status === "available");
  const visibleMeetings = filteredMeetings();
  const upcomingMeeting = nextManagerMeeting();
  const showingCalendar = meetingTab === "calendario";

  elements.meetingsEyebrow.textContent = isAdmin() ? "Agenda Alcir" : "Agenda do Alcir";
  elements.meetingsTitle.textContent = meetingTitle();
  elements.meetingsSummary.textContent = `${bookedMeetings.length} ${
    bookedMeetings.length === 1 ? "agendada" : "agendadas"
  }`;
  elements.meetingCountOverview.textContent = meetings.length;
  elements.meetingCountBooked.textContent = bookedMeetings.length;
  elements.meetingCountAvailable.textContent = availableMeetings.length;
  elements.meetingCountCalendar.textContent = meetings.length;
  elements.meetingAdminPanel.classList.toggle("hidden", !isAdmin());
  elements.meetingCalendar.classList.toggle("hidden", !showingCalendar);
  syncMeetingAdminForms();

  elements.meetingTabs.forEach((button) => {
    button.classList.toggle("hidden", !isAdmin() && button.dataset.meetingTab === "agendar");
    button.classList.toggle("active", button.dataset.meetingTab === meetingTab);
  });

  if (showingCalendar) {
    renderMeetingCalendar();
    if (isAdmin()) {
      syncMeetingAdminForms(meetingSelectedDate, true);
    }
  } else {
    elements.meetingCalendar.innerHTML = "";
  }

  renderMeetingReminder(upcomingMeeting);
  elements.meetingList.innerHTML = "";
  elements.meetingEmptyState.classList.toggle("hidden", visibleMeetings.length > 0);
  elements.meetingEmptyState.querySelector("strong").textContent =
    meetingTab === "agendar"
      ? "Nenhum horário disponível"
      : showingCalendar
        ? "Nenhum horário neste dia"
        : "Nenhuma reunião nesta aba";
  elements.meetingEmptyState.querySelector("span").textContent =
    meetingTab === "agendar"
      ? "Quando a agenda for aberta, os horários disponíveis aparecem aqui."
      : showingCalendar
        ? "Selecione outro dia no calendário ou abra um horário para esta data."
      : "As reuniões e horários criados aparecem aqui.";

  visibleMeetings.forEach((meeting) => {
    const card = document.createElement("article");
    card.className = `meeting-card meeting-${meeting.status}`;
    card.dataset.meetingId = meeting.id;
    const bookedBy = meeting.bookedByName
      ? `${meeting.bookedByName} · ${unitLabel(meeting.bookedByUnit)} · ${meeting.bookedByDepartment || "Loja"}`
      : "";

    card.innerHTML = `
      <div class="request-title-row">
        <div>
          <strong>${formatDate(meeting.date)} · ${escapeHtml(formatMeetingTime(meeting.time))}</strong>
          <span class="manager-request-date">${meetingSubtitle(meeting)}</span>
        </div>
        <span class="status-pill ${meetingStatusClasses[meeting.status] || "status-andamento"}">
          ${meetingStatusLabels[meeting.status] || "Disponível"}
        </span>
      </div>
      ${
        meeting.adminNote
          ? `<p class="request-description">${escapeHtml(meeting.adminNote)}</p>`
          : ""
      }
      ${
        bookedBy
          ? `<div class="request-meta"><span class="chip">${escapeHtml(bookedBy)}</span></div>`
          : ""
      }
      ${
        meeting.status === "booked"
          ? `<section class="manager-response-box meeting-agenda-box">
              <h3>${escapeHtml(meeting.topic || "Tema da reunião")}</h3>
              <p>${escapeHtml(meeting.agenda || "Pautas não informadas.")}</p>
            </section>`
          : ""
      }
      ${meetingActionMarkup(meeting)}
    `;

    elements.meetingList.append(card);
  });
}

function meetingTitle() {
  const titles = {
    reunioes: "Reuniões",
    agendadas: "Agendadas",
    agendar: "Agendar",
    calendario: "Calendário Alcir - Agendar",
  };
  return titles[meetingTab] || titles.reunioes;
}

function filteredMeetings() {
  return [...meetings]
    .filter((meeting) => {
      if (meetingTab === "agendadas") return meeting.status === "booked";
      if (meetingTab === "agendar") return meeting.status === "available";
      if (meetingTab === "calendario") return meeting.date === meetingSelectedDate;
      if (meetingTab === "reunioes") return meeting.status !== "blocked" || isAdmin();
      return true;
    })
    .sort(compareMeetings);
}

function renderMeetingCalendar() {
  const year = meetingCalendarDate.getFullYear();
  const month = meetingCalendarDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const firstWeekday = monthStart.getDay();
  const totalDays = monthEnd.getDate();
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<span class="calendar-day empty"></span>');
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateValue = toDateInputValue(new Date(year, month, day));
    const dayMeetings = meetings.filter((meeting) => meeting.date === dateValue);
    const availableCount = dayMeetings.filter((meeting) => meeting.status === "available").length;
    const bookedCount = dayMeetings.filter((meeting) => meeting.status === "booked").length;
    const blockedCount = dayMeetings.filter((meeting) => meeting.status === "blocked").length;
    const label = calendarDayLabel(availableCount, bookedCount, blockedCount);
    const classes = [
      "calendar-day",
      dateValue === meetingSelectedDate ? "selected" : "",
      dateValue === todayIso() ? "today" : "",
      availableCount > 0 ? "has-available" : "",
      bookedCount > 0 ? "has-booked" : "",
      blockedCount > 0 ? "has-blocked" : "",
    ].filter(Boolean).join(" ");

    cells.push(`
      <button class="${classes}" type="button" data-meeting-day="${dateValue}">
        <strong>${day}</strong>
        <span>${label}</span>
      </button>
    `);
  }

  const selectedMeetings = meetings.filter((meeting) => meeting.date === meetingSelectedDate);
  const selectedAvailable = selectedMeetings.filter((meeting) => meeting.status === "available").length;
  const selectedBooked = selectedMeetings.filter((meeting) => meeting.status === "booked").length;
  const selectedBlocked = selectedMeetings.filter((meeting) => meeting.status === "blocked").length;

  elements.meetingCalendar.innerHTML = `
    <div class="calendar-toolbar">
      <button class="ghost-button compact-button" type="button" data-calendar-prev>‹</button>
      <div>
        <strong>${monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
        <span>Selecionado: ${formatDate(meetingSelectedDate)}</span>
      </div>
      <button class="ghost-button compact-button" type="button" data-calendar-next>›</button>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      <span>Dom</span>
      <span>Seg</span>
      <span>Ter</span>
      <span>Qua</span>
      <span>Qui</span>
      <span>Sex</span>
      <span>Sáb</span>
    </div>
    <div class="calendar-grid">
      ${cells.join("")}
    </div>
    <div class="calendar-selected-day">
      <div>
        <strong>${formatDate(meetingSelectedDate)}</strong>
        <span>${selectedAvailable} disponíveis · ${selectedBooked} agendadas · ${selectedBlocked} fechados</span>
      </div>
      ${
        isAdmin()
          ? `<div class="calendar-day-actions">
              <button class="primary-button compact-button" type="button" data-open-meeting-day="${meetingSelectedDate}">Abrir agenda do dia</button>
              <button class="ghost-button compact-button" type="button" data-close-meeting-day="${meetingSelectedDate}">Fechar disponíveis</button>
            </div>`
          : ""
      }
    </div>
    ${meetingTimeGridMarkup(selectedMeetings)}
  `;
}

function meetingTimeGridMarkup(selectedMeetings) {
  const meetingsByTime = new Map(selectedMeetings.map((meeting) => [meeting.time, meeting]));

  return `
    <div class="meeting-time-grid" aria-label="Horários do dia selecionado">
      ${meetingTimeSlots.map((time) => meetingTimeSlotMarkup(time, meetingsByTime.get(time))).join("")}
    </div>
  `;
}

function meetingTimeSlotMarkup(time, meeting) {
  if (!meeting) {
    return `
      <article class="meeting-time-slot unavailable">
        <strong>${escapeHtml(formatMeetingTime(time))}</strong>
        <span>Fechado</span>
        ${
          isAdmin()
            ? `<button class="ghost-button compact-button" type="button" data-create-meeting-slot="${meetingSelectedDate}" data-time="${time}">Abrir</button>`
            : ""
        }
      </article>
    `;
  }

  const statusLabel = meetingStatusLabels[meeting.status] || "Disponível";
  const bookedLabel = meeting.bookedByName ? `${meeting.bookedByName} · ${meeting.topic || "Reunião"}` : "";

  return `
    <article class="meeting-time-slot meeting-${meeting.status}">
      <strong>${escapeHtml(formatMeetingTime(time))}</strong>
      <span>${escapeHtml(statusLabel)}</span>
      ${bookedLabel ? `<small>${escapeHtml(bookedLabel)}</small>` : ""}
      ${meetingSlotActionMarkup(meeting)}
    </article>
  `;
}

function meetingSlotActionMarkup(meeting) {
  if (isAdmin()) {
    if (meeting.status === "booked") {
      return '<small>Horário já agendado</small>';
    }

    return meeting.status === "available"
      ? `<button class="ghost-button compact-button" type="button" data-close-meeting="${escapeHtml(meeting.id)}">Fechar</button>`
      : `<button class="primary-button compact-button" type="button" data-open-meeting="${escapeHtml(meeting.id)}">Abrir</button>`;
  }

  if (meeting.status !== "available") return "";
  if (meetingTab !== "calendario") return "";

  return `
    <form class="meeting-book-form compact-meeting-book-form" data-book-meeting-form="${escapeHtml(meeting.id)}">
      <input name="topic" type="text" required placeholder="Tema" />
      <textarea name="agenda" rows="3" required placeholder="Pautas da reunião"></textarea>
      <button class="primary-button compact-button" type="submit">Agendar</button>
    </form>
  `;
}

function calendarDayLabel(availableCount, bookedCount, blockedCount) {
  if (availableCount > 0) return `${availableCount} disp.`;
  if (bookedCount > 0) return `${bookedCount} agend.`;
  if (blockedCount > 0) return `${blockedCount} fech.`;
  return "sem agenda";
}

function compareMeetings(left, right) {
  const dateDiff = String(left.date || "").localeCompare(String(right.date || ""));
  if (dateDiff !== 0) return dateDiff;

  const timeDiff = String(left.time || "").localeCompare(String(right.time || ""));
  if (timeDiff !== 0) return timeDiff;

  return String(left.id || "").localeCompare(String(right.id || ""));
}

function meetingSubtitle(meeting) {
  if (meeting.status === "available") return "Horário aberto para agendamento";
  if (meeting.status === "blocked") return "Horário fechado na agenda";
  return `Agendada em ${formatDateTime(meeting.bookedAt || meeting.updatedAt)}`;
}

function meetingActionMarkup(meeting) {
  if (isAdmin()) {
    return `
      <div class="manager-card-actions">
        ${
          meeting.status === "available"
            ? `<button class="ghost-button compact-button" type="button" data-close-meeting="${escapeHtml(meeting.id)}">Fechar</button>`
            : `<button class="primary-button compact-button" type="button" data-open-meeting="${escapeHtml(meeting.id)}">Abrir</button>`
        }
        <button class="ghost-button compact-button" type="button" data-delete-meeting="${escapeHtml(meeting.id)}">Excluir</button>
      </div>
    `;
  }

  if (meeting.status !== "available") return "";

  return `
    <form class="meeting-book-form" data-book-meeting-form="${escapeHtml(meeting.id)}">
      <label>
        Tema da reunião
        <input name="topic" type="text" required placeholder="Ex.: alinhamento de vendas" />
      </label>
      <label>
        Pautas a serem abordadas
        <textarea name="agenda" rows="4" required placeholder="Liste os assuntos que precisam entrar na reunião."></textarea>
      </label>
      <div class="manager-card-actions">
        <button class="primary-button compact-button" type="submit">Agendar reunião</button>
      </div>
    </form>
  `;
}

function renderMeetingReminder(upcomingMeeting) {
  if (isAdmin() || !upcomingMeeting) {
    elements.meetingReminder.classList.add("hidden");
    elements.meetingReminder.innerHTML = "";
    return;
  }

  elements.meetingReminder.classList.remove("hidden");
  elements.meetingReminder.innerHTML = `
    <strong>Lembrete de reunião</strong>
    <span>Você tem reunião com Alcir em ${formatDate(upcomingMeeting.date)} · ${escapeHtml(formatMeetingTime(upcomingMeeting.time))}.</span>
    <span>${escapeHtml(upcomingMeeting.topic || "Tema não informado")}</span>
  `;
}

function nextManagerMeeting() {
  if (isAdmin()) return null;
  const now = new Date();
  return meetings
    .filter((meeting) => meeting.status === "booked" && meetingDate(meeting) >= now)
    .sort((left, right) => meetingDate(left) - meetingDate(right))[0] || null;
}

function meetingDate(meeting) {
  return new Date(`${meeting.date || "1970-01-01"}T${meeting.time || "00:00"}:00`);
}

function renderCounts() {
  const scope = scopedRequests();
  elements.counts.todas.textContent = scope.length;
  elements.counts.nova.textContent = scope.filter((item) => item.status === "nova").length;
  elements.counts.andamento.textContent = scope.filter(
    (item) => item.status === "andamento",
  ).length;
  elements.counts.resolvida.textContent = scope.filter(
    (item) => item.status === "resolvida",
  ).length;
}

function renderMetrics() {
  const scope = scopedRequests();
  const openRequests = scope.filter((request) => request.status !== "resolvida");
  const resolvedRequests = scope.filter((request) => request.status === "resolvida");
  const requestsWithAttachments = scope.filter(
    (request) =>
      (Array.isArray(request.attachments) && request.attachments.length > 0) ||
      (Array.isArray(request.responseAttachments) && request.responseAttachments.length > 0),
  );
  const averageResolutionDays = resolvedRequests.length
    ? Math.round(
        resolvedRequests.reduce((total, request) => total + requestResolutionDays(request), 0) /
          resolvedRequests.length,
      )
    : 0;

  elements.metrics.open.textContent = openRequests.length;
  elements.metrics.today.textContent = scope.filter(isDueToday).length;
  elements.metrics.overdue.textContent = scope.filter(isOverdue).length;
  elements.metrics.done.textContent = resolvedRequests.length;
  elements.metrics.high.textContent = openRequests.filter((request) => request.priority === "alta").length;
  elements.metrics.attachments.textContent = requestsWithAttachments.length;
  elements.metrics.average.textContent = `${averageResolutionDays}d`;
  elements.metrics.meetings.textContent = meetings.filter((meeting) => meeting.status === "booked").length;
}

function requestResolutionDays(request) {
  const started = new Date(request.createdAt || request.updatedAt || 0);
  const finished = new Date(request.updatedAt || request.createdAt || 0);
  if (Number.isNaN(started.getTime()) || Number.isNaN(finished.getTime())) return 0;
  return Math.max(0, Math.ceil((finished - started) / (24 * 60 * 60 * 1000)));
}

function renderPerformance() {
  if (!isAdmin()) return;

  const rows = performanceRows();
  const totalAnswered = rows.reduce((total, row) => total + row.total, 0);
  const totalOnTime = rows.reduce((total, row) => total + row.onTime, 0);
  const totalHours = rows.reduce((total, row) => total + row.totalHours, 0);
  const averageHours = totalAnswered ? totalHours / totalAnswered : 0;
  const best = rows[0];

  elements.performanceSummaryLabel.textContent = `${totalAnswered} ${
    totalAnswered === 1 ? "respondida" : "respondidas"
  }`;
  elements.performanceAnswered.textContent = totalAnswered;
  elements.performanceOnTime.textContent = totalAnswered
    ? `${Math.round((totalOnTime / totalAnswered) * 100)}%`
    : "0%";
  elements.performanceAverage.textContent = totalAnswered ? formatDurationHours(averageHours) : "--";
  elements.performanceBest.textContent = best ? `${best.score} pts` : "--";

  elements.performanceList.innerHTML = "";
  elements.performanceEmptyState.classList.toggle("hidden", rows.length > 0);

  rows.forEach((row, index) => {
    const card = document.createElement("article");
    card.className = "performance-card";
    card.innerHTML = `
      <div class="performance-card-head">
        <span class="performance-rank">#${index + 1}</span>
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <span>${escapeHtml(row.roleLabel)}</span>
        </div>
        <span class="performance-score">${row.score} pts</span>
      </div>
      <div class="performance-bar" aria-hidden="true"><span style="width: ${row.score}%"></span></div>
      <div class="performance-stats">
        <span><strong>${row.total}</strong> respondidas</span>
        <span><strong>${row.onTimePercent}%</strong> no prazo</span>
        <span><strong>${escapeHtml(row.averageLabel)}</strong> tempo médio</span>
        <span><strong>${escapeHtml(row.fastestLabel)}</strong> mais rápida</span>
      </div>
      <p class="muted-line">${escapeHtml(row.late)} atrasada${row.late === 1 ? "" : "s"} · ${escapeHtml(row.fastestTitle)}</p>
    `;
    elements.performanceList.append(card);
  });
}

function performanceRows() {
  const responders = new Map();

  requests.forEach((request) => {
    if (request.status !== "resolvida" || !cleanDisplayText(request.response)) return;

    const owner = performanceResponder(request);
    if (!["admin", "engineer"].includes(owner.role)) return;

    const startedAt = requestStartedAt(request);
    const finishedAt = requestFinishedAt(request);
    if (!startedAt || !finishedAt) return;

    const key = owner.id || `${owner.role}:${normalizeText(owner.name)}`;
    const hours = Math.max(0, (finishedAt - startedAt) / (60 * 60 * 1000));
    const allowedHours = requestAllowedHours(request, startedAt);
    const onTime = requestWasAnsweredOnTime(request, finishedAt);
    const current = responders.get(key) || {
      id: key,
      name: owner.name,
      role: owner.role,
      roleLabel: roleLabels[owner.role] || "Responsável",
      total: 0,
      onTime: 0,
      late: 0,
      totalHours: 0,
      totalAllowedHours: 0,
      fastestHours: Number.POSITIVE_INFINITY,
      fastestTitle: "Sem resposta rápida registrada",
    };

    current.total += 1;
    current.onTime += onTime ? 1 : 0;
    current.late += onTime ? 0 : 1;
    current.totalHours += hours;
    current.totalAllowedHours += allowedHours;

    if (hours < current.fastestHours) {
      current.fastestHours = hours;
      current.fastestTitle = request.title || "Solicitação sem título";
    }

    responders.set(key, current);
  });

  return [...responders.values()]
    .map((stats) => {
      const averageHours = stats.total ? stats.totalHours / stats.total : 0;
      const onTimePercent = stats.total ? Math.round((stats.onTime / stats.total) * 100) : 0;
      return {
        ...stats,
        averageHours,
        onTimePercent,
        averageLabel: formatDurationHours(averageHours),
        fastestLabel: Number.isFinite(stats.fastestHours) ? formatDurationHours(stats.fastestHours) : "--",
        score: responderPerformanceScore(stats),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.onTimePercent !== left.onTimePercent) return right.onTimePercent - left.onTimePercent;
      if (left.averageHours !== right.averageHours) return left.averageHours - right.averageHours;
      return right.total - left.total;
    });
}

function performanceResponder(request) {
  const responseName = requestResponseByName(request);
  const cleanResponseName =
    responseName === "Ainda sem resposta" || responseName === "Não informado" ? "" : responseName;
  const name = cleanResponseName || cleanDisplayText(request.assigneeName) || "Responsável";
  const role = cleanDisplayText(request.responseByRole) || inferPerformanceRole(name, request);
  const id =
    cleanDisplayText(request.responseBy) ||
    cleanDisplayText(request.assigneeId) ||
    `${role}-${normalizeText(name).replace(/[^a-z0-9]+/g, "-")}`;

  return {
    id,
    name,
    role,
  };
}

function inferPerformanceRole(name, request) {
  const normalizedName = normalizeText(name);
  if (normalizedName.includes("admin")) return "admin";
  if (normalizedName.includes("engen")) return "engineer";
  if (request.type === "material_list") return "engineer";
  if (request.type === "manager_request") return "admin";
  return cleanDisplayText(request.assigneeRole) || "manager";
}

function responderPerformanceScore(stats) {
  if (!stats.total) return 0;

  const onTimeRate = stats.onTime / stats.total;
  const averageHours = stats.totalHours / stats.total;
  const averageAllowedHours = Math.max(1, stats.totalAllowedHours / stats.total);
  const speedRatio = averageHours / averageAllowedHours;
  const speedRate = Math.max(0, Math.min(1, (1.15 - speedRatio) / 1.15));
  const volumeRate = Math.min(1, stats.total / 10);

  return Math.max(0, Math.min(100, Math.round(onTimeRate * 65 + speedRate * 25 + volumeRate * 10)));
}

function requestStartedAt(request) {
  return validDate(request.createdAt) || validDate(request.updatedAt);
}

function requestFinishedAt(request) {
  return validDate(request.responseAt) || validDate(request.updatedAt) || validDate(request.createdAt);
}

function requestAllowedHours(request, startedAt) {
  const dueDate = requestDueDateEnd(request);
  if (!dueDate || !startedAt) return 24;
  return Math.max(1, (dueDate - startedAt) / (60 * 60 * 1000));
}

function requestWasAnsweredOnTime(request, finishedAt) {
  const dueDate = requestDueDateEnd(request);
  if (!dueDate || !finishedAt) return true;
  return finishedAt <= dueDate;
}

function requestDueDateEnd(request) {
  if (!request.dueDate) return null;
  return validDate(`${request.dueDate}T23:59:59`);
}

function validDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDurationHours(hours) {
  if (!Number.isFinite(hours)) return "--";
  if (hours < 1) return "menos de 1h";
  if (hours < 24) return `${Math.round(hours)}h`;

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}

function renderList() {
  const visibleRequests = filteredRequests();
  const showingMaterialLists = isAdmin() && adminView === "material";
  if (!visibleRequests.some((request) => request.id === selectedId)) {
    selectedId = visibleRequests[0]?.id ?? null;
  }

  elements.requestList.innerHTML = "";
  elements.resultCount.textContent = `${visibleRequests.length} ${
    visibleRequests.length === 1 ? "item" : "itens"
  }`;

  elements.emptyState.classList.toggle("hidden", visibleRequests.length > 0);
  elements.emptyState.querySelector("strong").textContent = showingMaterialLists
    ? "Nenhuma lista de material encontrada"
    : "Nenhuma solicitação encontrada";
  elements.emptyState.querySelector("span").textContent = showingMaterialLists
    ? "Quando uma lista de material for criada, ela aparece aqui para acompanhamento."
    : "Ajuste os filtros ou registre uma nova demanda.";

  visibleRequests.forEach((request) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `request-card priority-${request.priority}`;
    button.classList.toggle("selected", request.id === selectedId);
    button.dataset.id = request.id;

    const dueChipClass = isOverdue(request) ? "chip priority-alta" : "chip";
    const dueLabel = isOverdue(request)
      ? `Atrasada: ${formatDate(request.dueDate)}`
      : `${formatDate(request.dueDate)} · ${requestDeadlineLabel(request)}`;
    const attachmentCount =
      (Array.isArray(request.attachments) ? request.attachments.length : 0) +
      (Array.isArray(request.responseAttachments) ? request.responseAttachments.length : 0);

    button.innerHTML = `
      <div class="request-title-row">
        <strong>${escapeHtml(request.title)}</strong>
        <span class="status-pill status-${request.status}">${statusLabels[request.status]}</span>
      </div>
      <p class="request-description">${escapeHtml(request.description)}</p>
      <div class="request-meta">
        <span class="chip">${escapeHtml(request.manager)}</span>
        <span class="chip">${escapeHtml(request.department)}</span>
        <span class="chip priority-${request.priority}">${priorityLabels[request.priority]}</span>
        <span class="${dueChipClass}">${dueLabel}</span>
        ${attachmentCount ? `<span class="chip">${attachmentCount} anexo${attachmentCount === 1 ? "" : "s"}</span>` : ""}
      </div>
    `;

    button.addEventListener("click", () => {
      selectedId = request.id;
      renderedDetailId = null;
      render();
    });

    elements.requestList.append(button);
  });
}

function renderDetail() {
  const request = requests.find((item) => item.id === selectedId);
  const isMaterialList = request?.type === "material_list";

  elements.detailPlaceholder.classList.toggle("hidden", Boolean(request));
  elements.detailContent.classList.toggle("hidden", !request);

  if (!request) {
    renderedDetailId = null;
    return;
  }

  const keepResponseDraft = renderedDetailId === request.id && isResponseEditorActive(request);
  renderedDetailId = request.id;
  elements.detailStatus.textContent = statusLabels[request.status];
  elements.detailStatus.className = `status-pill status-${request.status}`;
  elements.detailTitle.textContent = request.title;
  elements.detailManagerLabel.textContent = isMaterialList ? "Responsável" : "Gerente";
  elements.detailManager.textContent = request.manager;
  elements.detailDepartment.textContent = request.department;
  elements.detailPriority.textContent = priorityLabels[request.priority];
  elements.detailDue.textContent = `${formatDate(request.dueDate)}${
    isOverdue(request) ? " · atrasada" : ` · ${requestDeadlineLabel(request)}`
  }`;
  elements.detailDescription.textContent = request.description;
  renderAttachmentGrid(elements.detailAttachments, request.attachments);
  elements.detailAttachmentsSection.classList.toggle(
    "hidden",
    !Array.isArray(request.attachments) || request.attachments.length === 0,
  );
  renderAttachmentGrid(elements.responseAttachments, request.responseAttachments);
  elements.responseSectionTitle.textContent = isMaterialList ? "Resposta do engenheiro" : "Resposta ao gerente";
  elements.responseAttachmentsBlock.classList.toggle(
    "has-attachments",
    Array.isArray(request.responseAttachments) && request.responseAttachments.length > 0,
  );
  if (!keepResponseDraft) {
    elements.responseAttachmentsInput.value = "";
    elements.responseInput.value = request.response;
  }
  const adminCanRespond = !request.assigneeId || request.type === "manager_request";
  const adminCanReopen = isAdmin() && request.status === "resolvida";
  elements.responseInput.disabled = !adminCanRespond;
  elements.responseAttachmentsInput.disabled = !adminCanRespond;
  elements.startButton.disabled = (request.status === "andamento" && !adminCanReopen) || (!adminCanRespond && !adminCanReopen);
  elements.startButton.innerHTML =
    request.status === "resolvida"
      ? '<span aria-hidden="true">↻</span> Voltar para não resolvida'
      : '<span aria-hidden="true">↻</span> Em andamento';
  elements.resolveButton.disabled = !adminCanRespond;
  elements.resolveButton.innerHTML =
    request.status === "resolvida"
      ? '<span aria-hidden="true">✓</span> Atualizar resposta'
      : '<span aria-hidden="true">✓</span> Enviar resposta';

  elements.historyList.innerHTML = "";
  request.history.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    elements.historyList.append(item);
  });
}

function isResponseEditorActive(request) {
  const focusedElement = document.activeElement;
  const responseHasFocus =
    focusedElement === elements.responseInput || focusedElement === elements.responseAttachmentsInput;
  const responseChanged = elements.responseInput.value !== (request.response || "");
  const hasPendingAttachments = elements.responseAttachmentsInput.files.length > 0;
  return responseHasFocus || responseChanged || hasPendingAttachments;
}

function renderUsers() {
  if (!isAdmin()) return;

  elements.userList.innerHTML = "";
  users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "user-row";

    const canDelete = user.role !== "admin";
    const unit = unitLabel(user.unit);
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.username)} · Unidade ${escapeHtml(unit)} · ${escapeHtml(user.department)} · ${escapeHtml(formatPhone(user.phone))} · ${roleLabels[user.role]}${user.role === "seller" ? ` · Meta ${formatCurrency(user.sellerGoal || 0)}` : ""}</span>
      </div>
      <div class="user-row-actions">
        <button class="ghost-button compact-button" type="button" data-edit-user="${escapeHtml(user.id)}" ${
          canDelete ? "" : "disabled"
        }>Editar</button>
        <button class="ghost-button compact-button" type="button" data-delete-user="${escapeHtml(user.id)}" ${
          canDelete ? "" : "disabled"
        }>Excluir</button>
      </div>
    `;
    elements.userList.append(row);
  });

  renderAssigneeOptions();
}

function renderAssigneeOptions() {
  if (!elements.assigneeInput) return;

  const isMaterialList = elements.adminRequestType?.value === "material_list";
  const candidates = users.filter((user) => user.role === (isMaterialList ? "engineer" : "manager"));
  elements.assigneeInput.innerHTML = candidates.length
    ? candidates
        .map(
          (user) =>
            `<option value="${escapeHtml(user.id)}" data-name="${escapeHtml(user.name)}" data-department="${escapeHtml(user.department)}">${escapeHtml(user.name)} · ${escapeHtml(unitLabel(user.unit))}</option>`,
        )
        .join("")
    : `<option value="">Cadastre um ${isMaterialList ? "engenheiro" : "gerente"} primeiro</option>`;

  syncAdminAssigneeFields();
}

function syncAdminAssigneeFields() {
  const option = elements.assigneeInput?.selectedOptions?.[0];
  elements.managerInput.value = option?.dataset.name || "";
  elements.departmentInput.value = option?.dataset.department || "";
}

function unitLabel(unit) {
  return unitLabels[String(unit || "").toUpperCase()] || "SPZ";
}

function attachmentsMarkup(attachments = [], title = "Anexos") {
  if (!Array.isArray(attachments) || attachments.length === 0) return "";

  return `
    <div class="attachment-block">
      <h4>${escapeHtml(title)}</h4>
      <div class="attachment-grid">
        ${attachments.map(attachmentMarkup).join("")}
      </div>
    </div>
  `;
}

function attachmentMarkup(attachment) {
  const name = attachment.name || (isPdfAttachment(attachment) ? "PDF anexado" : "Imagem anexada");
  const attachmentId = escapeHtml(attachment.id || "");
  const source = attachmentSource(attachment);

  if (isPdfAttachment(attachment)) {
    return `
      <article class="attachment-thumb attachment-file">
        <span class="attachment-file-icon" aria-hidden="true">PDF</span>
        <span>${escapeHtml(name)}</span>
        <div class="attachment-actions">
          <button class="ghost-button compact-button" type="button" data-open-attachment="${attachmentId}">Abrir</button>
          <button class="ghost-button compact-button" type="button" data-download-attachment="${attachmentId}">Baixar</button>
        </div>
      </article>
    `;
  }

  return `
    <article class="attachment-thumb">
      <img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" />
      <span>${escapeHtml(name)}</span>
      <div class="attachment-actions">
        <button class="ghost-button compact-button" type="button" data-open-attachment="${attachmentId}">Abrir</button>
        <button class="ghost-button compact-button" type="button" data-download-attachment="${attachmentId}">Baixar</button>
      </div>
    </article>
  `;
}

function isPdfAttachment(attachment) {
  const type = String(attachment?.type || "").toLowerCase();
  const dataUrl = String(attachment?.dataUrl || "").toLowerCase();
  return type === "application/pdf" || dataUrl.startsWith("data:application/pdf;");
}

function attachmentSource(attachment) {
  return normalizedAttachmentSource(attachment?.url || attachment?.dataUrl || "");
}

function normalizedAttachmentSource(value) {
  const source = String(value || "");
  if (!source || source.startsWith("data:") || source.startsWith("blob:") || /^[a-z][a-z0-9+.-]*:/i.test(source)) {
    return source;
  }

  if (source.startsWith("/") && window.location.protocol === "file:") {
    return `https://eletro-ativa-app.onrender.com${source}`;
  }

  return new URL(source, window.location.origin).href;
}

function renderAttachmentGrid(container, attachments = []) {
  const items = Array.isArray(attachments) ? attachments : [];
  container.innerHTML = items.length
    ? items.map(attachmentMarkup).join("")
    : '<p class="muted-line">Nenhum anexo.</p>';
}

function findAttachment(attachmentId) {
  for (const request of requests) {
    const attachments = [
      ...(Array.isArray(request.attachments) ? request.attachments : []),
      ...(Array.isArray(request.responseAttachments) ? request.responseAttachments : []),
    ];
    const match = attachments.find((attachment) => attachment.id === attachmentId);
    if (match) return match;
  }

  for (const signature of signatureRecords) {
    if (signature.documentAttachment?.id === attachmentId) return signature.documentAttachment;
    if (signature.signedAttachment?.id === attachmentId) return signature.signedAttachment;
  }

  for (const hiring of hiringRequests) {
    if (hiring.resumeAttachment?.id === attachmentId) return hiring.resumeAttachment;
    if (hiring.decisionAttachment?.id === attachmentId) return hiring.decisionAttachment;
  }

  return null;
}

function openAttachment(attachmentId) {
  const attachment = findAttachment(attachmentId);
  const source = attachmentSource(attachment);
  if (!source) {
    showToast("Anexo não encontrado.");
    return;
  }

  const objectUrl = source.startsWith("data:") ? objectUrlFromDataUrl(source) : source;
  const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    showToast("Permita pop-ups para abrir o anexo.");
    return;
  }

  if (objectUrl.startsWith("blob:")) {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}

function downloadAttachment(attachmentId) {
  const attachment = findAttachment(attachmentId);
  const source = attachmentSource(attachment);
  if (!source) {
    showToast("Anexo não encontrado.");
    return;
  }

  const objectUrl = source.startsWith("data:") ? objectUrlFromDataUrl(source) : source;
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = attachment.name || (isPdfAttachment(attachment) ? "documento.pdf" : "anexo");
  document.body.append(link);
  link.click();
  link.remove();
  if (objectUrl.startsWith("blob:")) {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

function objectUrlFromDataUrl(dataUrl) {
  const [header, base64Data = ""] = String(dataUrl).split(",");
  const mimeType = header.match(/^data:([^;]+);base64$/)?.[1] || "application/octet-stream";
  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

async function attachmentsFromForm(formData, fieldName = "attachments") {
  const files = formData
    .getAll(fieldName)
    .filter((file) => file instanceof File && file.size > 0);

  if (files.length > maxAttachmentFiles) {
    throw new Error(`Envie no máximo ${maxAttachmentFiles} anexos por vez.`);
  }

  return Promise.all(files.map(fileToAttachment));
}

async function appendAttachmentsToPayload(payload, files, fieldName = "attachments") {
  const cleanFiles = files.filter((file) => file instanceof File && file.size > 0);

  if (cleanFiles.length > maxAttachmentFiles) {
    throw new Error(`Envie no máximo ${maxAttachmentFiles} anexos por vez.`);
  }

  for (const file of cleanFiles) {
    const prepared = await prepareFileForUpload(file);
    payload.append(fieldName, prepared.blob, prepared.name);
  }
}

async function attachmentsFromInput(input) {
  const files = Array.from(input?.files || []);

  if (files.length > maxAttachmentFiles) {
    throw new Error(`Envie no máximo ${maxAttachmentFiles} anexos por vez.`);
  }

  return Promise.all(files.map(fileToAttachment));
}

function bindFileUploadEvents() {
  document.addEventListener("change", (event) => {
    const input = uploadInputFromTarget(event.target);
    if (!input) return;
    updateFileFieldState(input);
  });

  document.addEventListener("dragenter", handleUploadDrag);
  document.addEventListener("dragover", handleUploadDrag);
  document.addEventListener("dragleave", handleUploadDragLeave);
  document.addEventListener("drop", handleUploadDrop);
}

function uploadInputFromTarget(target) {
  if (!(target instanceof Element)) return null;
  const input = target.matches('.file-field input[type="file"]')
    ? target
    : target.closest?.('.file-field input[type="file"]');
  return input instanceof HTMLInputElement ? input : null;
}

function uploadFieldFromTarget(target) {
  if (!(target instanceof Element)) return null;
  return target.closest(".file-field");
}

function hasFileDragData(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function handleUploadDrag(event) {
  if (!hasFileDragData(event)) return;

  const field = uploadFieldFromTarget(event.target);
  if (!field) return;

  event.preventDefault();
  event.stopPropagation();
  field.classList.add("drag-over");
}

function handleUploadDragLeave(event) {
  const field = uploadFieldFromTarget(event.target);
  if (!field || field.contains(event.relatedTarget)) return;
  field.classList.remove("drag-over");
}

function handleUploadDrop(event) {
  if (!hasFileDragData(event)) return;

  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll(".file-field.drag-over").forEach((field) => field.classList.remove("drag-over"));

  const field = uploadFieldFromTarget(event.target);
  if (!field) return;

  const input = field.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) return;

  const droppedFileList = event.dataTransfer?.files || null;
  const droppedFiles = Array.from(droppedFileList || []);
  if (!droppedFiles.length) return;

  const validFiles = droppedFiles.filter(isAcceptedUploadFile);
  if (validFiles.length !== droppedFiles.length) {
    showToast("Anexe apenas imagens ou PDFs.");
    return;
  }

  if (validFiles.length > maxAttachmentFiles) {
    showToast(`Envie no máximo ${maxAttachmentFiles} anexos por vez.`);
    return;
  }

  if (setUploadInputFiles(input, input.multiple ? validFiles : validFiles.slice(0, 1), droppedFileList)) {
    showToast(`${validFiles.length} arquivo${validFiles.length === 1 ? "" : "s"} selecionado${validFiles.length === 1 ? "" : "s"}.`);
  }
}

function isAcceptedUploadFile(file) {
  const name = String(file?.name || "").toLowerCase();
  return file?.type?.startsWith("image/") || file?.type === "application/pdf" || name.endsWith(".pdf");
}

function setUploadInputFiles(input, files, sourceFileList = null) {
  if (typeof DataTransfer === "undefined") {
    if (sourceFileList && sourceFileList.length === files.length) {
      try {
        input.files = sourceFileList;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      } catch {
        // Continua para o aviso abaixo quando o navegador bloquear a atribuicao.
      }
    }
    showToast("Este navegador não permitiu arrastar arquivos. Use selecionar arquivo.");
    return false;
  }

  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function updateFileFieldState(input) {
  const field = input.closest(".file-field");
  const hint = field?.querySelector(".input-hint");
  if (!field || !hint) return;

  if (!hint.dataset.defaultText) {
    hint.dataset.defaultText = hint.textContent;
  }

  const count = input.files?.length || 0;
  field.classList.toggle("has-files", count > 0);
  hint.textContent = count
    ? `${count} arquivo${count === 1 ? "" : "s"} selecionado${count === 1 ? "" : "s"}. Clique para trocar ou arraste novos arquivos aqui.`
    : hint.dataset.defaultText;
}

function resetFileFieldStates(scope = document) {
  scope.querySelectorAll('.file-field input[type="file"]').forEach(updateFileFieldState);
}

async function prepareFileForUpload(file) {
  const fileName = file.name || "";
  const isPdfFile = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (isPdfFile) {
    if (file.size > maxPdfAttachmentBytes) {
      throw new Error("PDF muito grande. Envie arquivos de até 4 MB.");
    }
    return { blob: file, name: fileName || "documento.pdf" };
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Anexe apenas imagens ou PDFs.");
  }

  const compressed = await compressImage(file);
  return {
    blob: dataUrlToBlob(compressed.dataUrl),
    name: file.name || "imagem.jpg",
  };
}

async function fileToAttachment(file) {
  const fileName = file.name || "";
  const isPdfFile = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (isPdfFile) {
    if (file.size > maxPdfAttachmentBytes) {
      throw new Error("PDF muito grande. Envie arquivos de até 4 MB.");
    }

    return {
      id: createClientId("attachment"),
      name: fileName || "documento.pdf",
      type: "application/pdf",
      size: file.size,
      dataUrl: await blobToDataUrl(file),
      createdAt: new Date().toISOString(),
    };
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Anexe apenas imagens ou PDFs.");
  }

  const compressed = await compressImage(file);
  return {
    id: createClientId("attachment"),
    name: file.name || "imagem.jpg",
    type: compressed.type,
    size: compressed.size,
    dataUrl: compressed.dataUrl,
    createdAt: new Date().toISOString(),
  };
}

async function compressImage(file) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxImageDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", imageCompressionQuality);
  });

  if (!blob) {
    throw new Error("Não foi possível preparar a imagem.");
  }

  return {
    type: "image/jpeg",
    size: blob.size,
    dataUrl: await blobToDataUrl(blob),
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler uma das imagens."));
    };
    image.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível anexar o arquivo."));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [metadata, encoded] = String(dataUrl).split(",");
  const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1] || "application/octet-stream";
  const binary = atob(encoded || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function createClientId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function requestFormPayload(source) {
  const payload = new FormData();
  payload.set("requestType", source.get("requestType") || (isAdmin() ? "admin_task" : "manager_request"));
  payload.set("assigneeId", source.get("assigneeId") || "");
  payload.set("manager", source.get("manager")?.trim() ?? "");
  payload.set("department", source.get("department")?.trim() ?? "");
  payload.set("title", source.get("title").trim());
  payload.set("description", source.get("description").trim());
  payload.set("priority", source.get("priority"));
  await appendAttachmentsToPayload(payload, source.getAll("attachments"), "attachments");
  return payload;
}

async function responseFormPayload(response, files) {
  const payload = new FormData();
  payload.set("status", "resolvida");
  payload.set("response", response);
  await appendAttachmentsToPayload(payload, files, "responseAttachments");
  return payload;
}

async function addRequest(formData) {
  try {
    const payload = await requestFormPayload(formData);

    showToast("Salvando solicitação no servidor...");
    const result = await apiFetch("/api/requests", formRequest("POST", payload));
    requests = result.requests;
    selectedId = isAdmin() ? result.request.id : selectedId;
    renderCurrentView();
    showNotificationResult(result.notification, "Solicitação registrada.");
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

async function createPersonalTask(formData) {
  if (!isAdmin()) return false;

  const payload = {
    title: formData.get("title").trim(),
    dueDate: formData.get("dueDate"),
    description: formData.get("description")?.trim() ?? "",
  };

  try {
    const result = await apiFetch("/api/personal-tasks", jsonRequest("POST", payload));
    personalTasks = result.personalTasks;
    elements.personalTaskForm.reset();
    elements.personalTaskForm.elements.dueDate.min = todayIso();
    renderAdminView();
    showToast("Pendência lançada.");
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

async function createCrmOpportunity(formData) {
  if (!isAdmin()) return false;

  const payload = new FormData();
  ["clientName", "contactName", "phone", "email", "unit", "ownerId", "amount", "status", "title", "source", "notes"].forEach((field) => {
    payload.set(field, formData.get(field)?.trim?.() ?? formData.get(field) ?? "");
  });
  await appendAttachmentsToPayload(payload, formData.getAll("crmAttachments"), "crmAttachments");

  try {
    showToast("Salvando oportunidade no CRM...");
    const result = await apiFetch("/api/crm-opportunities", formRequest("POST", payload));
    crmOpportunities = result.opportunities;
    elements.crmForm.reset();
    elements.crmForm.elements.source.value = "Cadastro manual";
    renderAdminView();
    showToast("Oportunidade criada no CRM.");
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

async function updateCrmOpportunityStatus(opportunityId, status) {
  if (!isAdmin() && currentUser?.role !== "seller") return;

  try {
    const result = await apiFetch(
      `/api/crm-opportunities/${encodeURIComponent(opportunityId)}`,
      jsonRequest("PATCH", { status }),
    );
    crmOpportunities = result.opportunities;
    renderCrmWorkspace();
    showToast("Etapa do CRM atualizada.");
  } catch (error) {
    showToast(error.message);
  }
}

async function submitCrmFeedback(form) {
  const opportunityId = form.dataset.crmFeedbackForm;
  const payload = {
    feedback: form.elements.feedback.value.trim(),
    nextAction: form.elements.nextAction.value.trim(),
    nextActionDate: form.elements.nextActionDate.value,
  };

  if (!payload.feedback) {
    showToast("Informe o feedback antes de registrar.");
    return;
  }

  try {
    const result = await apiFetch(
      `/api/crm-opportunities/${encodeURIComponent(opportunityId)}`,
      jsonRequest("PATCH", payload),
    );
    crmOpportunities = result.opportunities;
    form.reset();
    renderCrm();
    showToast("Feedback registrado no orçamento.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderCrmWorkspace() {
  if (isAdmin()) renderAdminView();
  else renderManagerView();
}

async function deleteCrmOpportunity(opportunityId) {
  if (!isAdmin()) return;
  const opportunity = crmOpportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return;

  const confirmed = window.confirm(`Excluir a oportunidade "${opportunity.title || opportunity.clientName}"?`);
  if (!confirmed) return;

  try {
    const result = await apiFetch(`/api/crm-opportunities/${encodeURIComponent(opportunityId)}`, {
      method: "DELETE",
    });
    crmOpportunities = result.opportunities;
    renderCrmWorkspace();
    showToast("Oportunidade excluída.");
  } catch (error) {
    showToast(error.message);
  }
}

function exportCrmCsv() {
  if (!isAdmin()) return;

  const header = [
    "Cliente",
    "Contato",
    "WhatsApp",
    "Email",
    "Unidade",
    "Responsavel",
    "Valor",
    "Status",
    "Origem",
    "Observacoes",
  ];

  const rows = filteredCrmOpportunities().map((opportunity) => [
    opportunity.clientName,
    opportunity.contactName,
    opportunity.phone,
    opportunity.email,
    unitLabel(opportunity.unit),
    opportunity.ownerName,
    String(opportunity.amount || 0).replace(".", ","),
    crmStatusLabels[opportunity.status],
    opportunity.source,
    opportunity.notes,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `crm-vendas-${todayIso()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("CRM exportado.");
}

async function resolvePersonalTask(taskId, resolution) {
  if (!isAdmin()) return;

  if (!resolution.trim()) {
    showToast("Descreva como foi resolvido antes de concluir.");
    return;
  }

  try {
    const result = await apiFetch(
      `/api/personal-tasks/${encodeURIComponent(taskId)}`,
      jsonRequest("PATCH", {
        status: "resolvida",
        resolution,
      }),
    );
    personalTasks = result.personalTasks;
    personalTaskFilter = "resolvidas";
    renderAdminView();
    showToast("Pendência marcada como resolvida.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePersonalTask(taskId) {
  if (!isAdmin()) return;

  const task = personalTasks.find((item) => item.id === taskId);
  if (!task) return;

  const confirmed = window.confirm(`Excluir a pendência "${task.title}"?`);
  if (!confirmed) return;

  try {
    const result = await apiFetch(`/api/personal-tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
    personalTasks = result.personalTasks;
    renderAdminView();
    showToast("Pendência excluída.");
  } catch (error) {
    showToast(error.message);
  }
}

async function createMeetingSlot(formData) {
  if (!isAdmin()) return false;

  return createMeetingSlotFromPayload({
    date: formData.get("date"),
    time: formData.get("time"),
    status: formData.get("status"),
    adminNote: formData.get("adminNote")?.trim() ?? "",
  });
}

async function createMeetingSlotFromPayload(payload) {
  if (!isAdmin()) return false;
  try {
    const result = await apiFetch("/api/meetings", jsonRequest("POST", payload));
    meetings = result.meetings;
    meetingSelectedDate = payload.date;
    const [year, month] = meetingSelectedDate.split("-").map(Number);
    meetingCalendarDate = new Date(year, month - 1, 1);
    if (elements.meetingSlotForm) {
      elements.meetingSlotForm.reset();
      elements.meetingSlotForm.elements.date.min = todayIso();
    }
    renderAdminView();
    showToast("Horário adicionado à agenda.");
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

async function updateMeeting(meetingId, payload, successMessage) {
  if (!isAdmin()) return;

  try {
    const result = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}`, jsonRequest("PATCH", payload));
    meetings = result.meetings;
    renderAdminView();
    showToast(successMessage);
  } catch (error) {
    showToast(error.message);
  }
}

async function updateMeetingDay(date, status) {
  if (!isAdmin()) return;

  if (status === "available") {
    await openMeetingDay(date);
    return;
  }

  const targetMeetings = meetings.filter((meeting) => {
    if (meeting.date !== date) return false;
    if (status === "available") return meeting.status === "blocked";
    if (status === "blocked") return meeting.status === "available";
    return false;
  });

  if (targetMeetings.length === 0) {
    showToast(status === "available" ? "Nenhum horário fechado neste dia." : "Nenhum horário disponível neste dia.");
    return;
  }

  try {
    const results = await Promise.all(
      targetMeetings.map((meeting) =>
        apiFetch(`/api/meetings/${encodeURIComponent(meeting.id)}`, jsonRequest("PATCH", { status })),
      ),
    );
    meetings = results[results.length - 1].meetings;
    renderAdminView();
    showToast(status === "available" ? "Horários do dia abertos." : "Horários disponíveis do dia fechados.");
  } catch (error) {
    showToast(error.message);
  }
}

async function blockMeetingPeriod(formData) {
  if (!isAdmin()) return false;

  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const adminNote = formData.get("adminNote")?.trim() || "Período bloqueado";

  if (endDate < startDate) {
    showToast("A data final precisa ser depois da data inicial.");
    return false;
  }

  const confirmed = window.confirm(`Bloquear reuniões de ${formatDate(startDate)} até ${formatDate(endDate)}?`);
  if (!confirmed) return false;

  try {
    const result = await apiFetch(
      "/api/meetings/block-period",
      jsonRequest("POST", {
        startDate,
        endDate,
        adminNote,
      }),
    );
    meetings = result.meetings;
    meetingSelectedDate = startDate;
    const [year, month] = meetingSelectedDate.split("-").map(Number);
    meetingCalendarDate = new Date(year, month - 1, 1);
    elements.meetingBlockPeriodForm.reset();
    syncMeetingAdminForms(startDate, true);
    renderAdminView();
    const keptText = result.bookedCount > 0 ? ` ${result.bookedCount} já agendada(s) foram mantidas.` : "";
    showToast(`Período bloqueado.${keptText}`);
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

async function openMeetingDay(date) {
  const selectedMeetings = meetings.filter((meeting) => meeting.date === date);
  const meetingsByTime = new Map(selectedMeetings.map((meeting) => [meeting.time, meeting]));
  const operations = meetingTimeSlots.map((time) => {
    const meeting = meetingsByTime.get(time);
    if (!meeting) {
      return apiFetch(
        "/api/meetings",
        jsonRequest("POST", {
          date,
          time,
          status: "available",
          adminNote: "Horário disponível",
        }),
      );
    }
    if (meeting.status === "blocked") {
      return apiFetch(`/api/meetings/${encodeURIComponent(meeting.id)}`, jsonRequest("PATCH", { status: "available" }));
    }
    return null;
  }).filter(Boolean);

  if (operations.length === 0) {
    showToast("Agenda do dia já está aberta.");
    return;
  }

  try {
    const results = await Promise.all(operations);
    meetings = results[results.length - 1].meetings;
    renderAdminView();
    showToast("Agenda do dia aberta nos horários padrão.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteMeeting(meetingId) {
  if (!isAdmin()) return;

  const meeting = meetings.find((item) => item.id === meetingId);
  if (!meeting) return;

  const confirmed = window.confirm(`Excluir o horário de ${formatDate(meeting.date)} · ${formatMeetingTime(meeting.time)}?`);
  if (!confirmed) return;

  try {
    const result = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
    });
    meetings = result.meetings;
    renderAdminView();
    showToast("Horário excluído.");
  } catch (error) {
    showToast(error.message);
  }
}

async function bookMeeting(meetingId, form) {
  if (isAdmin()) return;

  const payload = {
    topic: form.elements.topic.value.trim(),
    agenda: form.elements.agenda.value.trim(),
  };

  try {
    const result = await apiFetch(
      `/api/meetings/${encodeURIComponent(meetingId)}/book`,
      jsonRequest("POST", payload),
    );
    meetings = result.meetings;
    meetingTab = "agendadas";
    renderManagerView();
    showToast("Reunião agendada com Alcir.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateSelected(payload, successMessage) {
  if (!isAdmin()) {
    showToast("Seu perfil permite apenas criar solicitações.");
    return null;
  }

  if (!selectedId) return null;

  try {
    const result = await apiFetch(`/api/requests/${encodeURIComponent(selectedId)}`, jsonRequest("PATCH", payload));
    requests = result.requests;
    selectedId = result.request.id;
    render();
    showNotificationResult(result.notification, successMessage);
    return result.request;
  } catch (error) {
    showToast(error.message);
    return null;
  }
}

async function setStatusInProgress() {
  const request = requests.find((item) => item.id === selectedId);
  const message =
    request?.status === "resolvida"
      ? "Solicitação reaberta como não resolvida."
      : "Solicitação marcada como em andamento.";
  await updateSelected({ status: "andamento" }, message);
}

async function resolveSelected() {
  if (!isAdmin()) {
    showToast("Seu perfil permite apenas criar solicitações.");
    return;
  }

  const response = elements.responseInput.value.trim();

  if (!response) {
    elements.responseInput.focus();
    showToast("Escreva a resposta antes de enviar.");
    return;
  }

  try {
    const payload = await responseFormPayload(response, Array.from(elements.responseAttachmentsInput.files || []));
    const result = await apiFetch(`/api/requests/${encodeURIComponent(selectedId)}`, formRequest("PATCH", payload));
    requests = result.requests;
    selectedId = result.request.id;
    render();
    showNotificationResult(result.notification, "Resposta salva.");
    elements.responseInput.value = result.request.response || "";
    elements.responseAttachmentsInput.value = "";
    updateFileFieldState(elements.responseAttachmentsInput);
  } catch (error) {
    showToast(error.message);
  }
}

async function submitAssignedResponse(form) {
  const requestId = form.dataset.assignedResponseForm;
  const response = form.elements.response.value.trim();

  if (!response) {
    showToast("Informe a resposta antes de concluir.");
    form.elements.response.focus();
    return;
  }

  try {
    const payload = await responseFormPayload(response, Array.from(form.elements.responseAttachments.files || []));
    const result = await apiFetch(
      `/api/requests/${encodeURIComponent(requestId)}`,
      formRequest("PATCH", payload),
    );
    applyState(result);
    renderManagerView();
    showToast("Resposta enviada e solicitação resolvida.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteSelected() {
  if (!isAdmin()) {
    showToast("Seu perfil permite apenas criar solicitações.");
    return;
  }

  const request = requests.find((item) => item.id === selectedId);
  if (!request) return;

  const confirmed = window.confirm(`Excluir a solicitação "${request.title}"?`);
  if (!confirmed) return;

  try {
    const result = await apiFetch(`/api/requests/${encodeURIComponent(selectedId)}`, {
      method: "DELETE",
    });
    requests = result.requests;
    selectedId = requests[0]?.id ?? null;
    render();
    showToast("Solicitação excluída.");
  } catch (error) {
    showToast(error.message);
  }
}

function exportCsv() {
  if (!isAdmin()) return;

  const header = [
    "Titulo",
    "Gerente",
    "Setor",
    "Prioridade",
    "Prazo",
    "Status",
    "Resposta",
  ];

  const rows = filteredRequests().map((request) => [
    request.title,
    request.manager,
    request.department,
    priorityLabels[request.priority],
    formatDate(request.dueDate),
    statusLabels[request.status],
    request.response,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `solicitacoes-${todayIso()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("CSV exportado.");
}

async function createBackupDownload() {
  if (!isAdmin()) return;

  try {
    showToast("Gerando backup...");
    const result = await apiFetch("/api/backups", jsonRequest("POST", {}));
    const link = document.createElement("a");
    link.href = result.downloadUrl;
    link.download = result.backup?.fileName || `backup-${todayIso()}.tar.gz`;
    link.click();
    showToast("Backup gerado.");
  } catch (error) {
    showToast(error.message);
  }
}

async function changeOwnPassword() {
  const currentPassword = window.prompt("Senha atual");
  if (currentPassword === null) return;

  const newPassword = window.prompt("Nova senha com pelo menos 8 caracteres, letras e números");
  if (newPassword === null) return;

  const confirmation = window.prompt("Confirme a nova senha");
  if (confirmation === null) return;

  if (newPassword !== confirmation) {
    showToast("As senhas não conferem.");
    return;
  }

  try {
    await apiFetch(
      "/api/change-password",
      jsonRequest("POST", {
        currentPassword,
        newPassword,
      }),
    );
    showToast("Senha alterada.");
  } catch (error) {
    showToast(error.message);
  }
}

function setupSignaturePad() {
  const canvas = elements.signaturePad;
  if (!canvas || canvas.dataset.ready === "true") return;

  canvas.dataset.ready = "true";
  const context = canvas.getContext("2d");
  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#000000";
  drawTypedSignature();

  const start = (event) => {
    signaturePadDrawing = true;
    signaturePadTouched = true;
    context.beginPath();
    const point = signaturePadPoint(event, canvas);
    context.moveTo(point.x, point.y);
    event.preventDefault();
  };

  const move = (event) => {
    if (!signaturePadDrawing) return;
    const point = signaturePadPoint(event, canvas);
    context.lineTo(point.x, point.y);
    context.stroke();
    event.preventDefault();
  };

  const stop = () => {
    signaturePadDrawing = false;
  };

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);
  canvas.addEventListener("pointercancel", stop);
}

function signaturePadPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function clearSignaturePad() {
  const canvas = elements.signaturePad;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  signaturePadTouched = false;
}

function drawTypedSignature() {
  const canvas = elements.signaturePad;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  context.font = "700 76px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("ALCI JR.", canvas.width / 2, canvas.height / 2 + 2);
  context.strokeStyle = "#000000";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(170, 170);
  context.lineTo(590, 170);
  context.stroke();
  signaturePadTouched = true;
}

function signatureDataUrl() {
  if (!signaturePadTouched) drawTypedSignature();
  return elements.signaturePad.toDataURL("image/png");
}

async function createSignatureRecord(formData) {
  if (!isAdmin()) return;

  try {
    const payload = new FormData();
    payload.set("signerName", formData.get("signerName")?.trim() || "ALCI JR.");
    payload.set("documentName", formData.get("documentName")?.trim() || "Documento assinado");
    payload.set("signatureDataUrl", signatureDataUrl());
    await appendAttachmentsToPayload(payload, formData.getAll("signatureDocument"), "signatureDocument");

    const result = await apiFetch("/api/signatures", formRequest("POST", payload));
    signatureRecords = result.signatures;
    elements.signatureForm.reset();
    elements.signatureForm.elements.signerName.value = "ALCI JR.";
    resetFileFieldStates(elements.signatureForm);
    drawTypedSignature();
    renderSignatures();
    showToast("Documento assinado e registrado.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderSignatures() {
  if (!isAdmin()) return;

  const records = Array.isArray(signatureRecords) ? signatureRecords : [];
  elements.signatureCount.textContent = `${records.length} documento${records.length === 1 ? "" : "s"}`;
  elements.signatureList.innerHTML = "";
  elements.signatureEmptyState.classList.toggle("hidden", records.length > 0);

  records.forEach((record) => {
    const card = document.createElement("article");
    card.className = "signature-card";
    card.innerHTML = `
      <div class="request-title-row">
        <div>
          <strong>${escapeHtml(record.documentName)}</strong>
          <span class="manager-request-date">Assinado em ${formatDateTime(record.signedAt)} por ${escapeHtml(record.signerName)}</span>
        </div>
        <span class="status-pill status-resolvida">Assinado</span>
      </div>
      <div class="signature-preview-row">
        <img class="signature-preview" src="${escapeHtml(record.signatureDataUrl)}" alt="Assinatura ${escapeHtml(record.signerName)}" />
        <div>
          ${attachmentsMarkup(record.signedAttachment ? [record.signedAttachment] : [], "Documento assinado")}
          ${attachmentsMarkup(record.documentAttachment ? [record.documentAttachment] : [], "Documento original")}
        </div>
      </div>
      <div class="manager-card-actions">
        <button class="ghost-button compact-button danger-action" type="button" data-delete-signature="${escapeHtml(record.id)}">Excluir</button>
      </div>
    `;
    elements.signatureList.append(card);
  });
}

function printSignatureCertificate(signatureId) {
  const record = signatureRecords.find((item) => item.id === signatureId);
  if (!record) {
    showToast("Assinatura não encontrada.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=920,height=720");
  if (!printWindow) {
    showToast("Permita pop-ups para gerar o comprovante.");
    return;
  }

  printWindow.document.write(printableSignatureHtml(record));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 500);
}

function printableSignatureHtml(record) {
  const generatedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const attachment = record.documentAttachment || {};

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Comprovante de assinatura - ${escapeHtml(record.documentName)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #f4f1f8; color: #1f1728; font-family: Arial, Helvetica, sans-serif; line-height: 1.45; }
          main { width: min(860px, calc(100vw - 32px)); margin: 24px auto; background: #fff; border: 1px solid #ddd4e8; border-radius: 8px; padding: 28px; }
          header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 3px solid #6d28d9; padding-bottom: 18px; }
          h1, h2, p { margin-top: 0; }
          h1 { margin-bottom: 6px; font-size: 26px; }
          h2 { margin: 22px 0 10px; font-size: 18px; color: #4c1d95; }
          .brand { color: #4c1d95; font-weight: 900; text-align: right; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
          .box { border: 1px solid #ddd4e8; border-radius: 8px; background: #faf8fd; padding: 12px; }
          .box span { display: block; color: #6d6476; font-size: 11px; font-weight: 900; text-transform: uppercase; }
          .box strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
          .signature { display: grid; place-items: center; min-height: 180px; margin-top: 14px; border: 1px solid #ddd4e8; border-radius: 8px; background: #1d122b; }
          .signature img { max-width: 90%; max-height: 160px; }
          footer { margin-top: 24px; border-top: 1px solid #ddd4e8; padding-top: 12px; color: #6d6476; font-size: 12px; }
          @media print { body { background: #fff; } main { width: 100%; margin: 0; border: 0; } }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <p>Comprovante de assinatura eletrônica interna</p>
              <h1>${escapeHtml(record.documentName)}</h1>
            </div>
            <div class="brand">Eletro Ativa<br />Regional Alci Jr.</div>
          </header>
          <section class="meta">
            <div class="box"><span>Assinante</span><strong>${escapeHtml(record.signerName)}</strong></div>
            <div class="box"><span>Data da assinatura</span><strong>${formatDateTime(record.signedAt)}</strong></div>
            <div class="box"><span>Documento</span><strong>${escapeHtml(attachment.name || record.documentName)}</strong></div>
            <div class="box"><span>ID da assinatura</span><strong>${escapeHtml(record.id)}</strong></div>
          </section>
          <h2>Assinatura</h2>
          <div class="signature">
            <img src="${escapeHtml(record.signatureDataUrl)}" alt="Assinatura ${escapeHtml(record.signerName)}" />
          </div>
          <footer>
            Documento registrado no aplicativo Eletro Ativa em ${escapeHtml(generatedAt)}. Este comprovante identifica o anexo original e a assinatura eletrônica interna realizada pelo usuário administrativo.
          </footer>
        </main>
      </body>
    </html>`;
}

async function deleteSignatureRecord(signatureId) {
  if (!isAdmin()) return;

  const record = signatureRecords.find((item) => item.id === signatureId);
  const confirmed = window.confirm(`Excluir a assinatura "${record?.documentName || "documento"}"?`);
  if (!confirmed) return;

  try {
    const result = await apiFetch(`/api/signatures/${encodeURIComponent(signatureId)}`, { method: "DELETE" });
    signatureRecords = result.signatures;
    renderSignatures();
    showToast("Assinatura excluída.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderHirings() {
  const records = Array.isArray(hiringRequests) ? hiringRequests : [];
  const pendingCount = records.filter((item) => item.status === "pendente").length;
  elements.hiringsTitle.textContent = isAdmin() ? "Autorizações de contratação" : "Solicitar autorização de contratação";
  elements.hiringsSummary.textContent = isAdmin()
    ? `${pendingCount} aguardando decisão`
    : "Envie o currículo e a análise criteriosa para aprovação.";
  elements.hiringsCount.textContent = `${records.length} solicitaç${records.length === 1 ? "ão" : "ões"}`;
  elements.hiringForm.classList.toggle("hidden", isAdmin());
  elements.hiringsList.innerHTML = "";
  elements.hiringsEmptyState.classList.toggle("hidden", records.length > 0);

  records.forEach((hiring) => {
    const card = document.createElement("article");
    card.className = `hiring-card hiring-${hiring.status || "pendente"}`;
    card.innerHTML = hiringCardMarkup(hiring);
    elements.hiringsList.append(card);
  });
}

function hiringCardMarkup(hiring) {
  const statusLabel = hiringStatusLabel(hiring.status);
  const relationship = hiring.relationshipInsideGroup === "sim" ? "Sim" : "Não";
  const decisionDone = hiring.status !== "pendente";
  const adminDecisionForm = isAdmin() && !decisionDone
    ? `
      <form class="hiring-decision-form" data-hiring-decision-form="${escapeHtml(hiring.id)}">
        <label>
          Observação da decisão
          <textarea name="decisionNote" rows="3" placeholder="Explique o motivo da aprovação ou reprovação."></textarea>
        </label>
        <div class="manager-card-actions">
          <button class="primary-button" type="submit" name="decision" value="approved">Aprovar</button>
          <button class="ghost-button danger-action" type="submit" name="decision" value="rejected">Reprovar</button>
        </div>
      </form>
    `
    : "";

  return `
    <div class="request-title-row">
      <div>
        <strong>${escapeHtml(hiring.candidateName)}</strong>
        <span class="manager-request-date">Solicitada em ${formatDateTime(hiring.createdAt)} por ${escapeHtml(hiring.createdByName || "")}</span>
      </div>
      <span class="status-pill ${hiringStatusClass(hiring.status)}">${escapeHtml(statusLabel)}</span>
    </div>
    <div class="hiring-meta-grid">
      <div><span>Função</span><strong>${escapeHtml(hiring.targetRole)}</strong></div>
      <div><span>Salário prometido</span><strong>${escapeHtml(hiring.promisedSalary)}</strong></div>
      <div><span>Vínculo no grupo</span><strong>${escapeHtml(relationship)}</strong></div>
      <div><span>Loja/setor</span><strong>${escapeHtml(hiring.createdByDepartment || "Não informado")}</strong></div>
    </div>
    ${hiring.relationshipInsideGroup === "sim" ? `<p class="request-description"><strong>Vínculo:</strong> ${escapeHtml(hiring.relationshipDetails)}</p>` : ""}
    <p class="request-description"><strong>Motivo da seleção:</strong> ${escapeHtml(hiring.selectionReason)}</p>
    <p class="request-description"><strong>Análise do perfil:</strong> ${escapeHtml(hiring.experienceSummary)}</p>
    ${hiring.risksAndObservations ? `<p class="request-description"><strong>Riscos/observações:</strong> ${escapeHtml(hiring.risksAndObservations)}</p>` : ""}
    ${hiring.decisionNote ? `<p class="request-description"><strong>Decisão:</strong> ${escapeHtml(hiring.decisionNote)}</p>` : ""}
    <div class="hiring-attachments">
      ${attachmentsMarkup(hiring.resumeAttachment ? [hiring.resumeAttachment] : [], "Currículo original")}
      ${attachmentsMarkup(hiring.decisionAttachment ? [hiring.decisionAttachment] : [], "PDF assinado da decisão")}
    </div>
    ${adminDecisionForm}
    ${
      isAdmin()
        ? `<div class="manager-card-actions"><button class="ghost-button compact-button danger-action" type="button" data-delete-hiring="${escapeHtml(hiring.id)}">Excluir</button></div>`
        : ""
    }
  `;
}

function hiringStatusLabel(status) {
  return {
    pendente: "Pendente",
    aprovada: "Aprovada",
    reprovada: "Reprovada",
  }[status] || "Pendente";
}

function hiringStatusClass(status) {
  if (status === "aprovada") return "status-resolvida";
  if (status === "reprovada") return "status-nova";
  return "status-andamento";
}

async function createHiringRequest(formData) {
  try {
    const payload = new FormData();
    [
      "candidateName",
      "targetRole",
      "promisedSalary",
      "relationshipInsideGroup",
      "relationshipDetails",
      "selectionReason",
      "experienceSummary",
      "risksAndObservations",
    ].forEach((field) => payload.set(field, formData.get(field)?.trim() || ""));
    await appendAttachmentsToPayload(payload, formData.getAll("hiringResume"), "hiringResume");

    const result = await apiFetch("/api/hirings", formRequest("POST", payload));
    hiringRequests = result.hirings;
    elements.hiringForm.reset();
    resetFileFieldStates(elements.hiringForm);
    renderHirings();
    showToast("Solicitação de contratação enviada.");
  } catch (error) {
    showToast(error.message);
  }
}

async function decideHiringRequest(hiringId, decision, decisionNote) {
  try {
    const result = await apiFetch(
      `/api/hirings/${encodeURIComponent(hiringId)}/decision`,
      jsonRequest("PATCH", { decision, decisionNote }),
    );
    hiringRequests = result.hirings;
    renderHirings();
    showToast(decision === "approved" ? "Contratação aprovada e PDF assinado." : "Contratação reprovada e PDF assinado.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteHiringRequest(hiringId) {
  if (!isAdmin()) return;
  const hiring = hiringRequests.find((item) => item.id === hiringId);
  const confirmed = window.confirm(`Excluir a contratação de "${hiring?.candidateName || "candidato"}"?`);
  if (!confirmed) return;

  try {
    const result = await apiFetch(`/api/hirings/${encodeURIComponent(hiringId)}`, { method: "DELETE" });
    hiringRequests = result.hirings;
    renderHirings();
    showToast("Contratação excluída.");
  } catch (error) {
    showToast(error.message);
  }
}

function printSelectedRequest() {
  if (!selectedId) return;
  printRequestPdf(selectedId);
}

function printRequestPdf(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request) {
    showToast("Solicitação não encontrada para impressão.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=920,height=720");
  if (!printWindow) {
    showToast("Permita pop-ups para gerar a impressão em PDF.");
    return;
  }

  printWindow.document.write(printableRequestHtml(request));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 500);
}

function printPersonalTasksPdf() {
  const tasks = filteredPersonalTasks();
  const printWindow = window.open("", "_blank", "width=920,height=720");

  if (!printWindow) {
    showToast("Permita pop-ups para gerar a impressão em PDF.");
    return;
  }

  printWindow.document.write(printablePersonalTasksHtml(tasks));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 500);
}

function printableRequestHtml(request) {
  const attachments = Array.isArray(request.attachments) ? request.attachments : [];
  const responseAttachments = Array.isArray(request.responseAttachments) ? request.responseAttachments : [];
  const requesterName = requestCreatedByName(request);
  const responseAuthor = requestResponseByName(request);
  const generatedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Solicitação - ${escapeHtml(request.title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f4f1f8;
            color: #1f1728;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.45;
          }
          main {
            width: min(860px, calc(100vw - 32px));
            margin: 24px auto;
            background: #fff;
            border: 1px solid #ddd4e8;
            border-radius: 8px;
            padding: 28px;
          }
          header {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            border-bottom: 3px solid #6d28d9;
            padding-bottom: 18px;
          }
          h1, h2, h3, p { margin-top: 0; }
          h1 { margin-bottom: 6px; font-size: 26px; }
          h2 { margin: 22px 0 10px; font-size: 18px; color: #4c1d95; }
          .brand { color: #4c1d95; font-weight: 900; text-align: right; }
          .meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 20px;
          }
          .box {
            border: 1px solid #e5dff0;
            border-radius: 8px;
            padding: 10px 12px;
          }
          .box span {
            display: block;
            color: #64566f;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .box strong { display: block; margin-top: 4px; }
          .text-box {
            white-space: pre-wrap;
            border: 1px solid #e5dff0;
            border-radius: 8px;
            padding: 12px;
          }
          .images {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .documents {
            display: grid;
            gap: 8px;
            margin-top: 10px;
          }
          .documents a {
            display: block;
            border: 1px solid #e5dff0;
            border-radius: 8px;
            color: #4c1d95;
            font-weight: 800;
            padding: 10px 12px;
            text-decoration: none;
            word-break: break-word;
          }
          figure {
            margin: 0;
            break-inside: avoid;
          }
          img {
            width: 100%;
            max-height: 300px;
            object-fit: contain;
            border: 1px solid #e5dff0;
            border-radius: 8px;
            background: #faf8ff;
          }
          figcaption {
            margin-top: 5px;
            color: #64566f;
            font-size: 12px;
          }
          footer {
            margin-top: 24px;
            border-top: 1px solid #e5dff0;
            padding-top: 12px;
            color: #64566f;
            font-size: 12px;
          }
          @media print {
            body { background: #fff; }
            main { width: 100%; margin: 0; border: 0; }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <h1>${escapeHtml(request.title)}</h1>
              <p>Solicitação registrada em ${escapeHtml(formatDateTime(request.createdAt))}</p>
            </div>
            <div class="brand">Eletro Ativa<br />Materiais Elétricos</div>
          </header>

          <section class="meta">
            <div class="box"><span>Gerente/Loja</span><strong>${escapeHtml(request.manager)}</strong></div>
            <div class="box"><span>Quem solicitou</span><strong>${escapeHtml(requesterName)}</strong></div>
            <div class="box"><span>Quem respondeu</span><strong>${escapeHtml(responseAuthor)}</strong></div>
            <div class="box"><span>Setor</span><strong>${escapeHtml(request.department)}</strong></div>
            <div class="box"><span>Prioridade</span><strong>${escapeHtml(priorityLabels[request.priority])}</strong></div>
            <div class="box"><span>Prazo</span><strong>${escapeHtml(formatDate(request.dueDate))}</strong></div>
            <div class="box"><span>Status</span><strong>${escapeHtml(statusLabels[request.status])}</strong></div>
            <div class="box"><span>Emitido em</span><strong>${escapeHtml(generatedAt)}</strong></div>
          </section>

          <h2>Descrição</h2>
          <div class="text-box">${escapeHtml(request.description)}</div>

          ${printableAttachments(attachments, "Anexos da solicitação")}

          <h2>Resposta</h2>
          <div class="text-box">${escapeHtml(request.response || "Ainda sem resposta.")}</div>

          ${printableAttachments(responseAttachments, "Anexos da resposta")}

          <footer>Documento gerado pelo app de solicitações Eletro Ativa.</footer>
        </main>
      </body>
    </html>`;
}

function printableAttachments(attachments, title) {
  if (!attachments.length) return "";
  const images = attachments.filter((attachment) => !isPdfAttachment(attachment));
  const documents = attachments.filter(isPdfAttachment);

  return `
    <h2>${escapeHtml(title)}</h2>
    ${
      images.length
        ? `<div class="images">
            ${images
              .map(
                (attachment) => `
                  <figure>
                    <img src="${escapeHtml(attachmentSource(attachment))}" alt="${escapeHtml(attachment.name || "Imagem anexada")}" />
                    <figcaption>${escapeHtml(attachment.name || "Imagem")}</figcaption>
                  </figure>
                `,
              )
              .join("")}
          </div>`
        : ""
    }
    ${
      documents.length
        ? `<div class="documents">
            ${documents
              .map(
                (attachment) => `
                  <a href="${escapeHtml(attachmentSource(attachment))}" target="_blank" rel="noreferrer">
                    PDF - ${escapeHtml(attachment.name || "Documento anexado")}
                  </a>
                `,
              )
              .join("")}
          </div>`
        : ""
    }
	  `;
}

function requestCreatedByName(request) {
  return cleanDisplayText(request?.createdByName) || cleanDisplayText(request?.manager) || "Não informado";
}

function requestResponseByName(request) {
  if (!cleanDisplayText(request?.response)) return "Ainda sem resposta";
  return (
    cleanDisplayText(request?.responseByName) ||
    cleanDisplayText(request?.respondedByName) ||
    cleanDisplayText(request?.resolvedByName) ||
    inferResponseAuthorFromHistory(request?.history) ||
    cleanDisplayText(request?.assigneeName) ||
    "Não informado"
  );
}

function inferResponseAuthorFromHistory(history = []) {
  if (!Array.isArray(history)) return "";
  for (const entry of [...history].reverse()) {
    const match = String(entry || "").match(/por\s+(.+)$/i);
    if (match?.[1]) return cleanDisplayText(match[1]);
  }
  return "";
}

function cleanDisplayText(value) {
  return String(value || "").trim();
}

function printablePersonalTasksHtml(tasks) {
  const generatedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const title = personalTaskFilter === "pendentes"
    ? "Pendências pendentes"
    : personalTaskFilter === "resolvidas"
      ? "Pendências resolvidas"
      : "Todas as pendências";

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Minhas pendências</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f4f1f8;
            color: #1f1728;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.45;
          }
          main {
            width: min(860px, calc(100vw - 32px));
            margin: 24px auto;
            background: #fff;
            border: 1px solid #ddd4e8;
            border-radius: 8px;
            padding: 28px;
          }
          header {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            border-bottom: 3px solid #6d28d9;
            padding-bottom: 18px;
          }
          h1, h2, h3, p { margin-top: 0; }
          h1 { margin-bottom: 6px; font-size: 26px; }
          .brand { color: #4c1d95; font-weight: 900; text-align: right; }
          .task {
            margin-top: 16px;
            border: 1px solid #e5dff0;
            border-left: 5px solid #f97316;
            border-radius: 8px;
            padding: 14px;
            break-inside: avoid;
          }
          .task.resolved { border-left-color: #16a34a; }
          .task.overdue { border-left-color: #dc2626; }
          .task-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }
          .pill {
            display: inline-flex;
            border-radius: 999px;
            background: #ede7f7;
            color: #4c1d95;
            font-size: 12px;
            font-weight: 800;
            padding: 4px 9px;
          }
          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 10px 0;
            color: #64566f;
            font-size: 12px;
            font-weight: 800;
          }
          .text-box {
            white-space: pre-wrap;
            border: 1px solid #e5dff0;
            border-radius: 8px;
            padding: 10px;
          }
          footer {
            margin-top: 24px;
            border-top: 1px solid #e5dff0;
            padding-top: 12px;
            color: #64566f;
            font-size: 12px;
          }
          @media print {
            body { background: #fff; }
            main { width: 100%; margin: 0; border: 0; }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <h1>Minhas pendências</h1>
              <p>${escapeHtml(title)} · Emitido em ${escapeHtml(generatedAt)}</p>
            </div>
            <div class="brand">Eletro Ativa<br />Materiais Elétricos</div>
          </header>

          ${
            tasks.length
              ? tasks.map(printablePersonalTask).join("")
              : '<p class="text-box">Nenhuma pendência encontrada para este filtro.</p>'
          }

          <footer>Documento gerado pelo app de solicitações Eletro Ativa.</footer>
        </main>
      </body>
    </html>`;
}

function printablePersonalTask(task) {
  const overdue = isPersonalTaskOverdue(task);
  const status = task.status === "resolvida" ? "Resolvida" : overdue ? "Atrasada" : "Pendente";
  return `
    <section class="task ${task.status === "resolvida" ? "resolved" : ""} ${overdue ? "overdue" : ""}">
      <div class="task-header">
        <h2>${escapeHtml(task.title)}</h2>
        <span class="pill">${escapeHtml(status)}</span>
      </div>
      <div class="meta">
        <span>Prazo: ${escapeHtml(formatDate(task.dueDate))}</span>
        <span>Criada em: ${escapeHtml(formatDateTime(task.createdAt))}</span>
        ${task.resolvedAt ? `<span>Resolvida em: ${escapeHtml(formatDateTime(task.resolvedAt))}</span>` : ""}
      </div>
      ${task.description ? `<h3>Observações</h3><div class="text-box">${escapeHtml(task.description)}</div>` : ""}
      ${
        task.status === "resolvida"
          ? `<h3>Como foi resolvido</h3><div class="text-box">${escapeHtml(task.resolution || "Não informado.")}</div>`
          : ""
      }
    </section>
  `;
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    const result = await apiFetch(
      "/api/login",
      jsonRequest("POST", {
        username: elements.loginUsername.value,
        password: elements.loginPassword.value,
      }),
    );
    applyState(result);
    elements.loginForm.reset();
    elements.loginError.classList.add("hidden");
    renderAuth();
    showToast(`Bem-vindo, ${currentUser.name}.`);
  } catch {
    elements.loginError.classList.remove("hidden");
    elements.loginPassword.select();
  }
}

async function logout() {
  await apiFetch("/api/logout", { method: "POST" }).catch(() => null);
  currentUser = null;
  requests = [];
  users = [];
  personalTasks = [];
  meetings = [];
  crmOpportunities = [];
  signatureRecords = [];
  hiringRequests = [];
  emailMode = null;
  selectedId = null;
  adminView = "requests";
  managerWorkspace = "requests";
  stopStateRefresh();
  renderAuth();
}

function startStateRefresh() {
  if (stateRefreshTimer) return;
  stateRefreshTimer = window.setInterval(refreshStateFromServer, stateRefreshIntervalMs);
}

function stopStateRefresh() {
  if (!stateRefreshTimer) return;
  window.clearInterval(stateRefreshTimer);
  stateRefreshTimer = null;
}

async function refreshStateFromServer({ notify = false } = {}) {
  if (!currentUser) return;
  if (!notify && document.hidden) return;

  try {
    const payload = await apiFetch("/api/state");
    applyState(payload);
    renderCurrentView();
    if (notify) showToast("Painel atualizado.");
  } catch (error) {
    if (notify) showToast(error.message);
  }
}

function openForm() {
  if (!isAdmin()) return;

  elements.form.reset();
  resetFileFieldStates(elements.form);
  elements.adminRequestType.value = adminView === "material" ? "material_list" : "admin_task";
  elements.requestModalTitle.textContent = adminView === "material" ? "Nova lista de material" : "Nova solicitação";
  renderAssigneeOptions();
  applyAdminRequestDeadline();
  elements.modal.showModal();
  elements.assigneeInput.focus();
}

function closeForm() {
  elements.modal.close();
}

function openUserModal() {
  if (!isAdmin()) return;

  resetUserFormMode();
  renderUsers();
  elements.userModal.showModal();
  elements.userForm.elements.name.focus();
}

function closeUserModal() {
  elements.userModal.close();
  resetUserFormMode();
}

function resetUserFormMode() {
  elements.userForm.reset();
  elements.userForm.dataset.editingUserId = "";
  elements.userForm.elements.password.required = true;
  elements.userForm.elements.password.placeholder = "";
  elements.userForm.elements.password.minLength = 8;
  elements.userPasswordLabel.firstChild.textContent = "Senha";
  elements.userForm.elements.role.value = "manager";
  elements.userModalTitle.textContent = "Usuários das lojas";
  elements.userSubmitButton.textContent = "Criar usuário";
}

function editUser(userId) {
  if (!isAdmin()) return;

  const user = users.find((item) => item.id === userId);
  if (!user || user.role === "admin") return;

  elements.userForm.dataset.editingUserId = user.id;
  elements.userForm.elements.name.value = user.name;
  elements.userForm.elements.department.value = user.department;
  elements.userForm.elements.unit.value = unitLabel(user.unit);
  elements.userForm.elements.username.value = user.username;
  elements.userForm.elements.phone.value = user.phone || "";
  elements.userForm.elements.sellerGoal.value = user.sellerGoal ? String(user.sellerGoal).replace(".", ",") : "";
  elements.userForm.elements.role.value = ["engineer", "seller"].includes(user.role) ? user.role : "manager";
  elements.userForm.elements.password.value = "";
  elements.userForm.elements.password.required = false;
  elements.userForm.elements.password.placeholder = "Deixe em branco para manter";
  elements.userPasswordLabel.firstChild.textContent = "Nova senha";
  elements.userModalTitle.textContent = "Editar usuário";
  elements.userSubmitButton.textContent = "Salvar alterações";
  elements.userForm.elements.name.focus();
}

async function saveManagerUser(formData) {
  if (!isAdmin()) return;

  const editingUserId = elements.userForm.dataset.editingUserId || "";
  const username = normalizeUsername(formData.get("username"));
  const duplicate = users.some(
    (user) => user.id !== editingUserId && normalizeUsername(user.username) === username,
  );

  if (duplicate) {
    showToast("Este usuário já existe.");
    elements.userForm.elements.username.focus();
    return;
  }

  const payload = {
    name: formData.get("name").trim(),
    department: formData.get("department").trim(),
    unit: formData.get("unit"),
    username,
    phone: formData.get("phone"),
    password: formData.get("password"),
    role: formData.get("role"),
    sellerGoal: formData.get("sellerGoal"),
  };

  if (payload.password && payload.password.length < 8) {
    showToast("A senha precisa ter pelo menos 8 caracteres.");
    elements.userForm.elements.password.focus();
    return;
  }

  try {
    const result = editingUserId
      ? await apiFetch(`/api/users/${encodeURIComponent(editingUserId)}`, jsonRequest("PATCH", payload))
      : await apiFetch("/api/users", jsonRequest("POST", payload));

    users = result.users;
    resetUserFormMode();
    renderUsers();
    showToast(editingUserId ? "Usuário atualizado." : "Usuário da loja criado.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteUser(userId) {
  if (!isAdmin()) return;

  const user = users.find((item) => item.id === userId);
  if (!user || user.role === "admin") return;

  const confirmed = window.confirm(`Excluir o usuário "${user.name}"?`);
  if (!confirmed) return;

  try {
    const result = await apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    users = result.users;
    renderUsers();
    showToast("Usuário excluído.");
  } catch (error) {
    showToast(error.message);
  }
}

async function submitManagerRequest(event) {
  event.preventDefault();

  if (currentUser?.role !== "manager") {
    showToast("Apenas gerentes usam este formulário.");
    return;
  }

  const saved = await addRequest(new FormData(elements.managerForm));
  if (saved) {
    elements.managerForm.reset();
    resetFileFieldStates(elements.managerForm);
    applyManagerRequestDeadline();
  }
}

function showNotificationResult(notification, successMessage) {
  if (!notification) {
    showToast(successMessage);
    return;
  }

  if (notification.sent) {
    showToast(`${successMessage} WhatsApp aceito pela Meta.`);
    return;
  }

  if (notification.configured === false) {
    showToast(`${successMessage} WhatsApp ainda não configurado.`);
    return;
  }

  showToast(`${successMessage} WhatsApp não enviado: ${whatsappErrorMessage(notification)}.`);
}

function whatsappErrorMessage(notification) {
  const message = String(
    notification?.data?.error?.error_data?.details ??
      notification?.data?.error?.message ??
      notification?.error ??
      "",
  );

  if (message.includes("lista de permissão") || message.includes("allowed list")) {
    return "número fora da lista de teste da Meta";
  }

  if (message.includes("24 hours") || message.includes("Re-engagement")) {
    return "precisa de modelo aprovado para iniciar conversa";
  }

  if (message.includes("restricted from messaging users in this country")) {
    return "número da Meta bloqueado para enviar ao Brasil";
  }

  return "verifique a configuração da Meta";
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimeout = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", logout);
  bindFileUploadEvents();

  elements.navItems.forEach((button) => {
    button.addEventListener("click", () => {
      currentStatus = button.dataset.status;
      elements.navItems.forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  elements.searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    render();
  });

  elements.priorityFilter.addEventListener("change", (event) => {
    priorityFilter = event.target.value;
    render();
  });

  elements.requestsViewButton.addEventListener("click", () => {
    if (isAdmin()) {
      adminView = "requests";
      currentStatus = "todas";
      priorityFilter = "todas";
      searchTerm = "";
      elements.searchInput.value = "";
      elements.priorityFilter.value = "todas";
      elements.navItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.status === "todas");
      });
      renderAdminView();
      return;
    }
    managerWorkspace = "requests";
    renderManagerView();
  });

  elements.materialListsButton.addEventListener("click", () => {
    adminView = "material";
    renderAdminView();
  });

  elements.performanceViewButton.addEventListener("click", () => {
    adminView = "performance";
    renderAdminView();
  });

  elements.personalTasksButton.addEventListener("click", () => {
    adminView = "personal";
    elements.personalTaskForm.elements.dueDate.min = todayIso();
    if (!elements.personalTaskForm.elements.dueDate.value) {
      elements.personalTaskForm.elements.dueDate.value = todayIso();
    }
    renderAdminView();
  });
  elements.printPersonalTasksButton.addEventListener("click", printPersonalTasksPdf);

  elements.meetingsViewButton.addEventListener("click", () => {
    if (isAdmin()) {
      adminView = "meetings";
      syncMeetingAdminForms(todayIso(), true);
      renderAdminView();
      return;
    }
    managerWorkspace = "meetings";
    renderManagerView();
  });

  elements.crmViewButton.addEventListener("click", () => {
    if (isAdmin()) {
      adminView = "crm";
      renderAdminView();
      return;
    }
    managerWorkspace = "crm";
    renderManagerView();
  });

  elements.hiringsViewButton.addEventListener("click", () => {
    if (isAdmin()) {
      adminView = "hirings";
      renderAdminView();
      return;
    }
    managerWorkspace = "hirings";
    renderManagerView();
  });

  elements.signatureViewButton.addEventListener("click", () => {
    adminView = "signatures";
    renderAdminView();
  });

  elements.priorityInput.addEventListener("change", () => {
    applyAdminRequestDeadline();
  });

  elements.adminRequestType.addEventListener("change", applyAdminRequestDeadline);
  elements.managerForm.elements.priority.addEventListener("change", () => {
    applyManagerRequestDeadline();
  });
  elements.managerRequestType.addEventListener("change", applyManagerRequestDeadline);
  elements.assigneeInput.addEventListener("change", syncAdminAssigneeFields);
  elements.managerRefreshButton.addEventListener("click", () => refreshStateFromServer({ notify: true }));
  elements.managerTabs.forEach((button) => {
    button.addEventListener("click", () => {
      managerTab = button.dataset.managerTab;
      renderManagerDashboard();
    });
  });
  elements.managerRequestList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-print-request]");
    if (!button) return;
    printRequestPdf(button.dataset.printRequest);
  });
  elements.managerRequestList.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-assigned-response-form]");
    if (!form) return;
    event.preventDefault();
    submitAssignedResponse(form);
  });
  elements.appShell.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-attachment]");
    if (openButton) {
      openAttachment(openButton.dataset.openAttachment);
      return;
    }

    const downloadButton = event.target.closest("[data-download-attachment]");
    if (!downloadButton) return;
    downloadAttachment(downloadButton.dataset.downloadAttachment);
  });

  elements.openFormButton.addEventListener("click", openForm);
  elements.closeFormButton.addEventListener("click", closeForm);
  elements.cancelFormButton.addEventListener("click", closeForm);
  elements.exportButton.addEventListener("click", exportCsv);
  elements.backupButton.addEventListener("click", createBackupDownload);
  elements.changePasswordButton.addEventListener("click", changeOwnPassword);
  elements.usersButton.addEventListener("click", openUserModal);
  elements.closeUserButton.addEventListener("click", closeUserModal);
  elements.cancelUserButton.addEventListener("click", closeUserModal);
  elements.startButton.addEventListener("click", setStatusInProgress);
  elements.resolveButton.addEventListener("click", resolveSelected);
  elements.printButton.addEventListener("click", printSelectedRequest);
  elements.deleteButton.addEventListener("click", deleteSelected);
  elements.managerForm.addEventListener("submit", submitManagerRequest);

  elements.personalTaskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createPersonalTask(new FormData(elements.personalTaskForm));
  });

  elements.crmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createCrmOpportunity(new FormData(elements.crmForm));
  });

  elements.signatureForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createSignatureRecord(new FormData(elements.signatureForm));
  });
  elements.hiringForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createHiringRequest(new FormData(elements.hiringForm));
  });
  elements.hiringsList.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-hiring-decision-form]");
    if (!form) return;
    event.preventDefault();
    const submitter = event.submitter;
    decideHiringRequest(form.dataset.hiringDecisionForm, submitter?.value || "", form.elements.decisionNote?.value || "");
  });
  elements.hiringsList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-hiring]");
    if (!deleteButton) return;
    deleteHiringRequest(deleteButton.dataset.deleteHiring);
  });
  elements.clearSignatureButton.addEventListener("click", clearSignaturePad);
  elements.typedSignatureButton.addEventListener("click", drawTypedSignature);
  elements.signatureList.addEventListener("click", (event) => {
    const printButton = event.target.closest("[data-print-signature]");
    if (printButton) {
      printSignatureCertificate(printButton.dataset.printSignature);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-signature]");
    if (!deleteButton) return;
    deleteSignatureRecord(deleteButton.dataset.deleteSignature);
  });

  elements.crmExportButton.addEventListener("click", exportCrmCsv);
  elements.crmUnitFilter.addEventListener("change", (event) => {
    crmUnitFilter = event.target.value;
    renderCrm();
  });
  elements.crmOwnerFilter.addEventListener("change", (event) => {
    crmOwnerFilter = event.target.value;
    renderCrm();
  });

  elements.crmTabs.forEach((button) => {
    button.addEventListener("click", () => {
      crmFilter = button.dataset.crmFilter;
      renderCrm();
    });
  });

  elements.crmList.addEventListener("change", (event) => {
    const statusSelect = event.target.closest("[data-crm-status]");
    if (!statusSelect) return;
    updateCrmOpportunityStatus(statusSelect.dataset.crmStatus, statusSelect.value);
  });

  elements.crmList.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-crm-feedback-form]");
    if (!form) return;
    event.preventDefault();
    submitCrmFeedback(form);
  });

  elements.crmList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-crm]");
    if (!deleteButton) return;
    deleteCrmOpportunity(deleteButton.dataset.deleteCrm);
  });

  elements.personalTaskTabs.forEach((button) => {
    button.addEventListener("click", () => {
      personalTaskFilter = button.dataset.personalFilter;
      renderPersonalTasks();
    });
  });

  elements.personalTaskList.addEventListener("click", (event) => {
    const resolveButton = event.target.closest("[data-resolve-personal-task]");
    if (resolveButton) {
      const card = resolveButton.closest("[data-personal-task-id]");
      const resolutionInput = card?.querySelector("[data-resolution-input]");
      resolvePersonalTask(resolveButton.dataset.resolvePersonalTask, resolutionInput?.value ?? "");
      return;
    }

    const deleteButton = event.target.closest("[data-delete-personal-task]");
    if (!deleteButton) return;
    deletePersonalTask(deleteButton.dataset.deletePersonalTask);
  });

  elements.meetingTabs.forEach((button) => {
    button.addEventListener("click", () => {
      meetingTab = button.dataset.meetingTab;
      if (meetingTab === "calendario") {
        const [year, month] = meetingSelectedDate.split("-").map(Number);
        meetingCalendarDate = new Date(year, month - 1, 1);
      }
      if (isAdmin()) renderAdminView();
      else renderManagerView();
    });
  });

  elements.meetingSlotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createMeetingSlot(new FormData(elements.meetingSlotForm));
  });

  elements.meetingBlockPeriodForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await blockMeetingPeriod(new FormData(elements.meetingBlockPeriodForm));
  });

  elements.meetingList.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-book-meeting-form]");
    if (!form) return;
    event.preventDefault();
    bookMeeting(form.dataset.bookMeetingForm, form);
  });

  elements.meetingList.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-meeting]");
    if (openButton) {
      updateMeeting(openButton.dataset.openMeeting, { status: "available" }, "Horário aberto.");
      return;
    }

    const closeButton = event.target.closest("[data-close-meeting]");
    if (closeButton) {
      updateMeeting(closeButton.dataset.closeMeeting, { status: "blocked" }, "Horário fechado.");
      return;
    }

    const deleteButton = event.target.closest("[data-delete-meeting]");
    if (!deleteButton) return;
    deleteMeeting(deleteButton.dataset.deleteMeeting);
  });

  elements.meetingCalendar.addEventListener("click", (event) => {
    const createSlotButton = event.target.closest("[data-create-meeting-slot]");
    if (createSlotButton) {
      createMeetingSlotFromPayload({
        date: createSlotButton.dataset.createMeetingSlot,
        time: createSlotButton.dataset.time,
        status: "available",
        adminNote: "Horário disponível",
      });
      return;
    }

    const openButton = event.target.closest("[data-open-meeting]");
    if (openButton) {
      updateMeeting(openButton.dataset.openMeeting, { status: "available" }, "Horário aberto.");
      return;
    }

    const closeButton = event.target.closest("[data-close-meeting]");
    if (closeButton) {
      updateMeeting(closeButton.dataset.closeMeeting, { status: "blocked" }, "Horário fechado.");
      return;
    }

    const dayButton = event.target.closest("[data-meeting-day]");
    if (dayButton) {
      meetingSelectedDate = dayButton.dataset.meetingDay;
      if (isAdmin()) {
        elements.meetingSlotForm.elements.date.value = meetingSelectedDate;
      }
      if (isAdmin()) renderAdminView();
      else renderManagerView();
      return;
    }

    const prevButton = event.target.closest("[data-calendar-prev]");
    if (prevButton) {
      meetingCalendarDate = new Date(meetingCalendarDate.getFullYear(), meetingCalendarDate.getMonth() - 1, 1);
      if (isAdmin()) renderAdminView();
      else renderManagerView();
      return;
    }

    const nextButton = event.target.closest("[data-calendar-next]");
    if (nextButton) {
      meetingCalendarDate = new Date(meetingCalendarDate.getFullYear(), meetingCalendarDate.getMonth() + 1, 1);
      if (isAdmin()) renderAdminView();
      else renderManagerView();
      return;
    }

    const openDayButton = event.target.closest("[data-open-meeting-day]");
    if (openDayButton) {
      updateMeetingDay(openDayButton.dataset.openMeetingDay, "available");
      return;
    }

    const closeDayButton = event.target.closest("[data-close-meeting-day]");
    if (!closeDayButton) return;
    updateMeetingDay(closeDayButton.dataset.closeMeetingDay, "blocked");
  });

  elements.meetingCalendar.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-book-meeting-form]");
    if (!form) return;
    event.preventDefault();
    bookMeeting(form.dataset.bookMeetingForm, form);
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saved = await addRequest(new FormData(elements.form));
    if (saved) closeForm();
  });

  elements.userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveManagerUser(new FormData(elements.userForm));
  });

  elements.userList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-user]");
    if (editButton) {
      editUser(editButton.dataset.editUser);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-user]");
    if (!deleteButton) return;
    deleteUser(deleteButton.dataset.deleteUser);
  });
}

init();
