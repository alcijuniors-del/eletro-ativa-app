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

const roleLabels = {
  admin: "Administrador",
  manager: "Gerente",
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

const priorityWeight = {
  alta: 1,
  media: 2,
  baixa: 3,
};

const stateRefreshIntervalMs = 30000;
const maxAttachmentFiles = 5;
const maxPdfAttachmentBytes = 4 * 1024 * 1024;
const maxImageDimension = 1600;
const imageCompressionQuality = 0.84;

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
let meetingSelectedDate = todayIso();
let meetingCalendarDate = new Date();
let renderedDetailId = null;
let toastTimeout;
let stateRefreshTimer;

const elements = {
  loginScreen: document.querySelector("#login-screen"),
  appShell: document.querySelector("#app-shell"),
  loginForm: document.querySelector("#login-form"),
  loginUsername: document.querySelector("#login-username"),
  loginPassword: document.querySelector("#login-password"),
  loginError: document.querySelector("#login-error"),
  currentUserName: document.querySelector("#current-user-name"),
  currentUserRole: document.querySelector("#current-user-role"),
  logoutButton: document.querySelector("#logout-button"),
  appTitle: document.querySelector("#app-title"),
  appEyebrow: document.querySelector("#app-eyebrow"),
  adminOnly: document.querySelectorAll("[data-admin-only]"),
  requestsAdminView: document.querySelectorAll("[data-requests-admin-view]"),
  requestsViewButton: document.querySelector("#requests-view-button"),
  personalTasksButton: document.querySelector("#personal-tasks-button"),
  meetingsViewButton: document.querySelector("#meetings-view-button"),
  navItems: document.querySelectorAll(".nav-item"),
  requestList: document.querySelector("#request-list"),
  emptyState: document.querySelector("#empty-state"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  priorityFilter: document.querySelector("#priority-filter"),
  openFormButton: document.querySelector("#open-form-button"),
  exportButton: document.querySelector("#export-button"),
  usersButton: document.querySelector("#users-button"),
  modal: document.querySelector("#request-modal"),
  form: document.querySelector("#request-form"),
  closeFormButton: document.querySelector("#close-form-button"),
  cancelFormButton: document.querySelector("#cancel-form-button"),
  dueInput: document.querySelector("#due-input"),
  priorityInput: document.querySelector("#priority-input"),
  adminSlaHint: document.querySelector("#admin-sla-hint"),
  managerInput: document.querySelector("#manager-input"),
  departmentInput: document.querySelector("#department-input"),
  managerPanel: document.querySelector("#manager-submit-panel"),
  managerForm: document.querySelector("#manager-request-form"),
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
  meetingCalendar: document.querySelector("#meeting-calendar"),
  meetingList: document.querySelector("#meeting-list"),
  meetingEmptyState: document.querySelector("#meeting-empty-state"),
  meetingCountOverview: document.querySelector("#meeting-count-overview"),
  meetingCountBooked: document.querySelector("#meeting-count-booked"),
  meetingCountAvailable: document.querySelector("#meeting-count-available"),
  meetingCountCalendar: document.querySelector("#meeting-count-calendar"),
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
  detailManager: document.querySelector("#detail-manager"),
  detailDepartment: document.querySelector("#detail-department"),
  detailPriority: document.querySelector("#detail-priority"),
  detailDue: document.querySelector("#detail-due"),
  detailDescription: document.querySelector("#detail-description"),
  detailAttachmentsSection: document.querySelector("#detail-attachments-section"),
  detailAttachments: document.querySelector("#detail-attachments"),
  responseInput: document.querySelector("#response-input"),
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

  if (!requests.some((request) => request.id === selectedId)) {
    selectedId = requests[0]?.id ?? null;
  }
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

function isAdmin() {
  return currentUser?.role === "admin";
}

function formatDate(value = "") {
  if (!value.includes("-")) return "Não informado";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function responseDueDate(priority) {
  return daysFromToday(responseDeadlineDays[priority] ?? responseDeadlineDays.media);
}

function responseDeadlineLabel(priority) {
  return responseDeadlineLabels[priority] ?? responseDeadlineLabels.media;
}

function applyResponseDeadline(form, hintElement = null) {
  const priority = form.elements.priority.value;
  const dueDate = responseDueDate(priority);
  const dueInput = form.elements.dueDate;

  dueInput.value = dueDate;
  dueInput.min = dueDate;
  dueInput.max = dueDate;

  if (hintElement) {
    hintElement.textContent = `Prazo automático: ${responseDeadlineLabel(priority)}`;
  }
}

function isOverdue(request) {
  return request.status !== "resolvida" && request.dueDate < todayIso();
}

function isDueToday(request) {
  return request.status !== "resolvida" && request.dueDate === todayIso();
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

  return requests
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
  elements.adminOnly.forEach((element) => element.classList.toggle("hidden", !userIsAdmin));

  if (userIsAdmin) {
    elements.personalTaskForm.elements.dueDate.min = todayIso();
    renderAdminView();
    renderUsers();
    return;
  }

  applyResponseDeadline(elements.managerForm, elements.managerSlaHint);
  renderManagerView();
}

function renderAdminView() {
  if (!isAdmin()) return;

  const showingRequests = adminView === "requests";
  const showingPersonalTasks = adminView === "personal";
  const showingMeetings = adminView === "meetings";
  elements.requestsAdminView.forEach((element) => {
    element.classList.toggle("hidden", !showingRequests);
  });
  elements.managerPanel.classList.add("hidden");
  elements.managerHistoryPanel.classList.add("hidden");
  elements.personalTasksPanel.classList.toggle("hidden", !showingPersonalTasks);
  elements.meetingsPanel.classList.toggle("hidden", !showingMeetings);
  elements.requestsViewButton.classList.toggle("active-view-button", showingRequests);
  elements.personalTasksButton.classList.toggle("active-view-button", showingPersonalTasks);
  elements.meetingsViewButton.classList.toggle("active-view-button", showingMeetings);

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

  elements.appEyebrow.textContent = "Painel das lojas";
  elements.appTitle.textContent = "Solicitações das lojas";
  render();
}

function renderManagerView() {
  if (isAdmin()) return;

  const showingMeetings = managerWorkspace === "meetings";
  elements.managerPanel.classList.toggle("hidden", showingMeetings);
  elements.managerHistoryPanel.classList.toggle("hidden", showingMeetings);
  elements.personalTasksPanel.classList.add("hidden");
  elements.meetingsPanel.classList.toggle("hidden", !showingMeetings);
  elements.requestsViewButton.classList.toggle("active-view-button", !showingMeetings);
  elements.meetingsViewButton.classList.toggle("active-view-button", showingMeetings);

  if (showingMeetings) {
    elements.appEyebrow.textContent = "Agenda Alcir";
    elements.appTitle.textContent = "Reuniões";
    renderMeetings();
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
        <span class="chip priority-${request.priority}">${priorityLabels[request.priority]}</span>
        <span class="chip">Prazo: ${formatDate(request.dueDate)}</span>
        <span class="chip">${responseDeadlineLabel(request.priority)}</span>
      </div>
      ${attachmentsMarkup(attachments, "Anexos da solicitação")}
      <section class="manager-response-box">
        <h3>Resposta</h3>
        <p>${response}</p>
        ${attachmentsMarkup(responseAttachments, "Anexos da resposta")}
      </section>
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

  elements.meetingTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.meetingTab === meetingTab);
  });

  if (showingCalendar) {
    renderMeetingCalendar();
    if (isAdmin()) {
      elements.meetingSlotForm.elements.date.value = meetingSelectedDate;
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
          <strong>${formatDate(meeting.date)} às ${escapeHtml(meeting.time || "--:--")}</strong>
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
    calendario: "Calendário Alcir",
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
              <button class="ghost-button compact-button" type="button" data-open-meeting-day="${meetingSelectedDate}">Abrir horários fechados</button>
              <button class="ghost-button compact-button" type="button" data-close-meeting-day="${meetingSelectedDate}">Fechar disponíveis</button>
            </div>`
          : ""
      }
    </div>
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
    <span>Você tem reunião com Alcir em ${formatDate(upcomingMeeting.date)} às ${escapeHtml(upcomingMeeting.time)}.</span>
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
  elements.counts.todas.textContent = requests.length;
  elements.counts.nova.textContent = requests.filter((item) => item.status === "nova").length;
  elements.counts.andamento.textContent = requests.filter(
    (item) => item.status === "andamento",
  ).length;
  elements.counts.resolvida.textContent = requests.filter(
    (item) => item.status === "resolvida",
  ).length;
}

function renderMetrics() {
  elements.metrics.open.textContent = requests.filter(
    (request) => request.status !== "resolvida",
  ).length;
  elements.metrics.today.textContent = requests.filter(isDueToday).length;
  elements.metrics.overdue.textContent = requests.filter(isOverdue).length;
  elements.metrics.done.textContent = requests.filter(
    (request) => request.status === "resolvida",
  ).length;
}

function renderList() {
  const visibleRequests = filteredRequests();
  if (!visibleRequests.some((request) => request.id === selectedId)) {
    selectedId = visibleRequests[0]?.id ?? null;
  }

  elements.requestList.innerHTML = "";
  elements.resultCount.textContent = `${visibleRequests.length} ${
    visibleRequests.length === 1 ? "item" : "itens"
  }`;

  elements.emptyState.classList.toggle("hidden", visibleRequests.length > 0);

  visibleRequests.forEach((request) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `request-card priority-${request.priority}`;
    button.classList.toggle("selected", request.id === selectedId);
    button.dataset.id = request.id;

    const dueChipClass = isOverdue(request) ? "chip priority-alta" : "chip";
    const dueLabel = isOverdue(request)
      ? `Atrasada: ${formatDate(request.dueDate)}`
      : `${formatDate(request.dueDate)} · ${responseDeadlineLabel(request.priority)}`;
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
  elements.detailManager.textContent = request.manager;
  elements.detailDepartment.textContent = request.department;
  elements.detailPriority.textContent = priorityLabels[request.priority];
  elements.detailDue.textContent = `${formatDate(request.dueDate)}${
    isOverdue(request) ? " · atrasada" : ` · ${responseDeadlineLabel(request.priority)}`
  }`;
  elements.detailDescription.textContent = request.description;
  renderAttachmentGrid(elements.detailAttachments, request.attachments);
  elements.detailAttachmentsSection.classList.toggle(
    "hidden",
    !Array.isArray(request.attachments) || request.attachments.length === 0,
  );
  renderAttachmentGrid(elements.responseAttachments, request.responseAttachments);
  elements.responseAttachmentsBlock.classList.toggle(
    "has-attachments",
    Array.isArray(request.responseAttachments) && request.responseAttachments.length > 0,
  );
  if (!keepResponseDraft) {
    elements.responseAttachmentsInput.value = "";
    elements.responseInput.value = request.response;
  }
  elements.startButton.disabled = request.status === "andamento";
  elements.startButton.innerHTML =
    request.status === "resolvida"
      ? '<span aria-hidden="true">↻</span> Reabrir'
      : '<span aria-hidden="true">↻</span> Em andamento';
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
        <span>${escapeHtml(user.username)} · Unidade ${escapeHtml(unit)} · ${escapeHtml(user.department)} · ${escapeHtml(formatPhone(user.phone))} · ${roleLabels[user.role]}</span>
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
  return String(attachment?.url || attachment?.dataUrl || "");
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

async function attachmentsFromInput(input) {
  const files = Array.from(input?.files || []);

  if (files.length > maxAttachmentFiles) {
    throw new Error(`Envie no máximo ${maxAttachmentFiles} anexos por vez.`);
  }

  return Promise.all(files.map(fileToAttachment));
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

function createClientId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function addRequest(formData) {
  try {
    const attachments = await attachmentsFromForm(formData);
    const payload = {
      manager: formData.get("manager")?.trim() ?? "",
      department: formData.get("department")?.trim() ?? "",
      title: formData.get("title").trim(),
      description: formData.get("description").trim(),
      priority: formData.get("priority"),
      attachments,
    };

    showToast("Salvando solicitação no servidor...");
    const result = await apiFetch("/api/requests", jsonRequest("POST", payload));
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

  const payload = {
    date: formData.get("date"),
    time: formData.get("time"),
    status: formData.get("status"),
    adminNote: formData.get("adminNote")?.trim() ?? "",
  };

  try {
    const result = await apiFetch("/api/meetings", jsonRequest("POST", payload));
    meetings = result.meetings;
    meetingSelectedDate = payload.date;
    const [year, month] = meetingSelectedDate.split("-").map(Number);
    meetingCalendarDate = new Date(year, month - 1, 1);
    elements.meetingSlotForm.reset();
    elements.meetingSlotForm.elements.date.min = todayIso();
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

async function deleteMeeting(meetingId) {
  if (!isAdmin()) return;

  const meeting = meetings.find((item) => item.id === meetingId);
  if (!meeting) return;

  const confirmed = window.confirm(`Excluir o horário de ${formatDate(meeting.date)} às ${meeting.time}?`);
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
  await updateSelected({ status: "andamento" }, "Solicitação marcada como em andamento.");
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
    const responseAttachments = await attachmentsFromInput(elements.responseAttachmentsInput);

    const updated = await updateSelected(
      {
        status: "resolvida",
        response,
        responseAttachments,
      },
      "Resposta salva.",
    );
    if (updated) {
      elements.responseInput.value = updated.response || "";
      elements.responseAttachmentsInput.value = "";
    }
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

  const rows = requests.map((request) => [
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
  applyResponseDeadline(elements.form, elements.adminSlaHint);
  elements.modal.showModal();
  elements.managerInput.focus();
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
  elements.userPasswordLabel.firstChild.textContent = "Senha";
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
  };

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
    applyResponseDeadline(elements.managerForm, elements.managerSlaHint);
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
      renderAdminView();
      return;
    }
    managerWorkspace = "requests";
    renderManagerView();
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
      elements.meetingSlotForm.elements.date.min = todayIso();
      if (!elements.meetingSlotForm.elements.date.value) {
        elements.meetingSlotForm.elements.date.value = todayIso();
      }
      renderAdminView();
      return;
    }
    managerWorkspace = "meetings";
    renderManagerView();
  });

  elements.priorityInput.addEventListener("change", () => {
    applyResponseDeadline(elements.form, elements.adminSlaHint);
  });

  elements.managerForm.elements.priority.addEventListener("change", () => {
    applyResponseDeadline(elements.managerForm, elements.managerSlaHint);
  });
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
