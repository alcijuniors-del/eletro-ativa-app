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
  alta: 1,
  media: 3,
  baixa: 7,
};

const responseDeadlineLabels = {
  alta: "24 horas",
  media: "3 dias",
  baixa: "7 dias",
};

const roleLabels = {
  admin: "Administrador",
  manager: "Gerente",
};

const priorityWeight = {
  alta: 1,
  media: 2,
  baixa: 3,
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const daysFromToday = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

let requests = [];
let users = [];
let currentUser = null;
let selectedId = null;
let currentStatus = "todas";
let searchTerm = "";
let priorityFilter = "todas";
let sortMode = "prazo";
let toastTimeout;

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
  navItems: document.querySelectorAll(".nav-item"),
  requestList: document.querySelector("#request-list"),
  emptyState: document.querySelector("#empty-state"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  priorityFilter: document.querySelector("#priority-filter"),
  sortSelect: document.querySelector("#sort-select"),
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
  userModal: document.querySelector("#user-modal"),
  userForm: document.querySelector("#user-form"),
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
  responseInput: document.querySelector("#response-input"),
  historyList: document.querySelector("#history-list"),
  startButton: document.querySelector("#start-button"),
  resolveButton: document.querySelector("#resolve-button"),
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
  } catch {
    currentUser = null;
    requests = [];
    users = [];
    selectedId = null;
  }
}

function applyState(payload) {
  currentUser = payload.user ?? currentUser;
  requests = Array.isArray(payload.requests) ? payload.requests : requests;
  users = Array.isArray(payload.users) ? payload.users : users;

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
    .sort((a, b) => {
      if (sortMode === "prioridade") {
        return priorityWeight[a.priority] - priorityWeight[b.priority];
      }

      if (sortMode === "recente") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }

      return a.dueDate.localeCompare(b.dueDate);
    });
}

function renderAuth() {
  const loggedIn = Boolean(currentUser);
  elements.loginScreen.classList.toggle("hidden", loggedIn);
  elements.appShell.classList.toggle("hidden", !loggedIn);

  if (!loggedIn) {
    elements.loginUsername.focus();
    return;
  }

  const userIsAdmin = isAdmin();
  elements.currentUserName.textContent = currentUser.name;
  elements.currentUserRole.textContent = roleLabels[currentUser.role];
  elements.currentUserRole.className = `role-pill role-${currentUser.role}`;
  elements.adminOnly.forEach((element) => element.classList.toggle("hidden", !userIsAdmin));
  elements.managerPanel.classList.toggle("hidden", userIsAdmin);

  if (userIsAdmin) {
    elements.appEyebrow.textContent = "Painel das lojas";
    elements.appTitle.textContent = "Solicitações das lojas";
    render();
    renderUsers();
    return;
  }

  elements.appEyebrow.textContent = "Área da loja";
  elements.appTitle.textContent = "Criar solicitação";
  elements.managerAccountLabel.textContent = `${currentUser.name} · ${currentUser.department}`;
  elements.managerForm.reset();
  applyResponseDeadline(elements.managerForm, elements.managerSlaHint);
}

function render() {
  if (!isAdmin()) return;
  renderCounts();
  renderMetrics();
  renderList();
  renderDetail();
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
      </div>
    `;

    button.addEventListener("click", () => {
      selectedId = request.id;
      render();
    });

    elements.requestList.append(button);
  });
}

function renderDetail() {
  const request = requests.find((item) => item.id === selectedId);

  elements.detailPlaceholder.classList.toggle("hidden", Boolean(request));
  elements.detailContent.classList.toggle("hidden", !request);

  if (!request) return;

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
  elements.responseInput.value = request.response;
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

function renderUsers() {
  if (!isAdmin()) return;

  elements.userList.innerHTML = "";
  users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "user-row";

    const canDelete = user.role !== "admin";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.username)} · ${escapeHtml(user.department)} · ${escapeHtml(formatPhone(user.phone))} · ${roleLabels[user.role]}</span>
      </div>
      <button class="ghost-button compact-button" type="button" data-delete-user="${escapeHtml(user.id)}" ${
        canDelete ? "" : "disabled"
      }>Excluir</button>
    `;
    elements.userList.append(row);
  });
}

async function addRequest(formData) {
  const payload = {
    manager: formData.get("manager")?.trim() ?? "",
    department: formData.get("department")?.trim() ?? "",
    title: formData.get("title").trim(),
    description: formData.get("description").trim(),
    priority: formData.get("priority"),
  };

  showToast("Salvando solicitação no servidor...");

  try {
    const result = await apiFetch("/api/requests", jsonRequest("POST", payload));
    requests = isAdmin() ? result.requests : requests;
    selectedId = isAdmin() ? result.request.id : selectedId;
    renderAuth();
    showNotificationResult(result.notification, "Solicitação registrada.");
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
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

  await updateSelected(
    {
      status: "resolvida",
      response,
    },
    "Resposta salva.",
  );
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
  selectedId = null;
  renderAuth();
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

  elements.userForm.reset();
  renderUsers();
  elements.userModal.showModal();
  elements.userForm.elements.name.focus();
}

function closeUserModal() {
  elements.userModal.close();
}

async function createManagerUser(formData) {
  if (!isAdmin()) return;

  const username = normalizeUsername(formData.get("username"));
  const duplicate = users.some((user) => normalizeUsername(user.username) === username);

  if (duplicate) {
    showToast("Este usuário já existe.");
    elements.userForm.elements.username.focus();
    return;
  }

  try {
    const result = await apiFetch(
      "/api/users",
      jsonRequest("POST", {
        name: formData.get("name").trim(),
        department: formData.get("department").trim(),
        username,
        phone: formData.get("phone"),
        password: formData.get("password"),
      }),
    );

    users = result.users;
    elements.userForm.reset();
    renderUsers();
    showToast("Usuário da loja criado.");
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

  elements.sortSelect.addEventListener("change", (event) => {
    sortMode = event.target.value;
    render();
  });

  elements.priorityInput.addEventListener("change", () => {
    applyResponseDeadline(elements.form, elements.adminSlaHint);
  });

  elements.managerForm.elements.priority.addEventListener("change", () => {
    applyResponseDeadline(elements.managerForm, elements.managerSlaHint);
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
  elements.deleteButton.addEventListener("click", deleteSelected);
  elements.managerForm.addEventListener("submit", submitManagerRequest);

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saved = await addRequest(new FormData(elements.form));
    if (saved) closeForm();
  });

  elements.userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createManagerUser(new FormData(elements.userForm));
  });

  elements.userList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-user]");
    if (!button) return;
    deleteUser(button.dataset.deleteUser);
  });
}

init();
