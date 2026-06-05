const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { URL } = require("url");
const { promisify } = require("util");
const { execFile } = require("child_process");
const { PDFDocument, StandardFonts, rgb } = require("./vendor/pdf-lib.min.js");

loadLocalEnv();

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const SESSION_COOKIE = "ea_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const ADMIN_USERNAME = normalizeUsername(process.env.ADMIN_USERNAME || "admin");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || "America/Cuiaba";
const MAX_JSON_BODY_BYTES = 90 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_FIELD = 12;
const MAX_ATTACHMENT_DATA_LENGTH = 6 * 1024 * 1024;
const MAX_PDF_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_FILE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const MAX_LOGIN_ATTEMPTS = 6;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const BACKUP_RETENTION = Number(process.env.BACKUP_RETENTION || 7);
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MEETING_TIME_SLOTS = ["11:00", "17:00", "18:00"];
const MEETING_TIME_SLOT_SET = new Set(MEETING_TIME_SLOTS);
const MEETING_SLOT_HORIZON_DAYS = Math.max(1, Number(process.env.MEETING_SLOT_HORIZON_DAYS || 365) || 365);
const MAX_MEETING_BLOCK_DAYS = 365;
const EMAIL_CRM_WEBHOOK_SECRET = String(process.env.EMAIL_CRM_WEBHOOK_SECRET || "").trim();
const EMAIL_CRM_DEFAULT_UNIT_RAW = String(process.env.EMAIL_CRM_DEFAULT_UNIT || "CORP");
const EMAIL_CRM_DEFAULT_OWNER_USERNAME = normalizeUsername(process.env.EMAIL_CRM_DEFAULT_OWNER_USERNAME || "");

const sessions = new Map();
const loginAttempts = new Map();
const execFileAsync = promisify(execFile);
const gzipAsync = promisify(zlib.gzip);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const priorityLabels = {
  alta: "Alta - 48 horas",
  media: "Media - 3 dias",
  baixa: "Baixa - 7 dias",
};

const unitLabels = {
  SPZ: "SPZ",
  CNP: "CNP",
  CORP: "CORP",
};

const EMAIL_CRM_DEFAULT_UNIT = normalizeUnit(EMAIL_CRM_DEFAULT_UNIT_RAW);

const responseDeadlineDays = {
  alta: 2,
  media: 3,
  baixa: 7,
};

const adminTaskDeadlineDays = {
  alta: 1,
  media: 3,
  baixa: 5,
};

const materialListDeadlineDays = {
  alta: 3,
  media: 5,
  baixa: 7,
};

const priorityWeight = {
  alta: 1,
  media: 2,
  baixa: 3,
};

const crmStatusLabels = {
  novo: "Novo",
  atendimento: "Em atendimento",
  negociacao: "Negociacao",
  fechado: "Fechado",
  perdido: "Perdido",
};

const separationStatusLabels = {
  pdf_recebido: "PDF Recebido",
  ia_processando: "IA Processando",
  aguardando_separacao: "Aguardando Separação",
  em_separacao: "Em Separação",
  separado: "Separado",
  em_conferencia: "Em Conferência",
  conferido: "Conferido",
  embalado: "Embalado",
  lacrado: "Lacrado",
  com_falta: "Com Falta",
  aguardando_transferencia: "Aguardando Transferência",
  material_pronto: "Material Pronto",
  aguardando_nf: "Aguardando NF",
  aguardando_localizacao: "Aguardando Localização",
  entrega_programada: "Entrega Programada",
  em_rota: "Em Rota",
  entregue: "Entregue",
  finalizado: "Finalizado",
};

const separationStatusSet = new Set(Object.keys(separationStatusLabels));

const separationRoleLabels = {
  director: "Diretor",
  manager: "Gerente",
  seller: "Vendedor",
  team_lead: "Líder de Equipe",
  counter_lead: "Líder Balconista",
  separator: "Separador",
  checker: "Conferente",
  deliverer: "Entregador",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveStaticFile(url.pathname, request, response);
      return;
    }

    sendJson(response, 405, { ok: false, error: "Metodo nao permitido" });
  } catch (error) {
    const status = error.status || 500;
    process.stderr.write(`[server] ${error.stack || error.message}\n`);
    sendJson(response, status, {
      ok: false,
      error: status === 500 ? "Erro interno no servidor" : error.message,
    });
  }
});

server.listen(PORT, HOST, () => {
  const localUrl = `http://127.0.0.1:${PORT}/index.html`;
  process.stdout.write(`Servidor Eletro Ativa em ${localUrl}\n`);
  process.stdout.write(`Acesso na rede local habilitado em 0.0.0.0:${PORT}\n`);
});

scheduleAutomaticBackups();

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "eletro-ativa-solicitacoes" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    await handleLogin(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    handleLogout(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/email/crm") {
    await handleEmailCrmWebhook(request, response, url);
    return;
  }

  const data = await readData();
  const currentUser = getCurrentUser(request, data);

  if (!currentUser) {
    sendJson(response, 401, { ok: false, error: "Sessao expirada. Entre novamente." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, buildStatePayload(data, currentUser, request));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/email-mode/status") {
    requireAdmin(currentUser);
    sendJson(response, 200, { ok: true, emailMode: emailModeStatus(request) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/change-password") {
    await handleChangePassword(request, response, data, currentUser);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/backups") {
    requireAdmin(currentUser);
    sendJson(response, 200, { ok: true, backups: await listBackups() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/backups") {
    requireAdmin(currentUser);
    const backup = await createBackupArchive();
    await pruneOldBackups();
    sendJson(response, 201, { ok: true, backup, downloadUrl: `/api/backups/${encodeURIComponent(backup.fileName)}` });
    return;
  }

  const backupMatch = url.pathname.match(/^\/api\/backups\/([^/]+)$/);
  if (backupMatch && request.method === "GET") {
    requireAdmin(currentUser);
    await handleBackupDownload(response, backupMatch[1]);
    return;
  }

  const attachmentMatch = url.pathname.match(/^\/api\/attachments\/([^/]+)$/);
  if (attachmentMatch && request.method === "GET") {
    await handleAttachmentDownload(response, data, currentUser, attachmentMatch[1]);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/requests") {
    requireAdmin(currentUser);
    sendJson(response, 200, { ok: true, requests: sortRequests(data.requests) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/requests") {
    await handleCreateRequest(request, response, data, currentUser);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/separations") {
    sendJson(response, 200, { ok: true, separations: visibleSeparationRequests(data.separationRequests, currentUser) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/separations") {
    await handleCreateSeparationRequest(request, response, data, currentUser);
    return;
  }

  const separationMatch = url.pathname.match(/^\/api\/separations\/([^/]+)$/);
  if (separationMatch && request.method === "PATCH") {
    await handleUpdateSeparationRequest(request, response, data, currentUser, separationMatch[1]);
    return;
  }

  if (separationMatch && request.method === "DELETE") {
    if (!["admin", "director", "manager"].includes(currentUser.role)) {
      sendJson(response, 403, { ok: false, error: "Apenas diretor, gerente ou admin podem excluir separacao." });
      return;
    }
    await handleDeleteSeparationRequest(response, data, separationMatch[1]);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/crm-opportunities") {
    sendJson(response, 200, { ok: true, opportunities: visibleCrmOpportunities(data.crmOpportunities, currentUser) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/crm-opportunities") {
    requireAdmin(currentUser);
    await handleCreateCrmOpportunity(request, response, data, currentUser);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/signatures") {
    requireAdmin(currentUser);
    sendJson(response, 200, { ok: true, signatures: sortSignatureRecords(data.signatureRecords) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/signatures") {
    requireAdmin(currentUser);
    await handleCreateSignature(request, response, data, currentUser);
    return;
  }

  const signatureMatch = url.pathname.match(/^\/api\/signatures\/([^/]+)$/);
  if (signatureMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeleteSignature(response, data, signatureMatch[1]);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/hirings") {
    sendJson(response, 200, { ok: true, hirings: visibleHiringRequests(data.hiringRequests, currentUser) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/hirings") {
    await handleCreateHiringRequest(request, response, data, currentUser);
    return;
  }

  const hiringDecisionMatch = url.pathname.match(/^\/api\/hirings\/([^/]+)\/decision$/);
  if (hiringDecisionMatch && request.method === "PATCH") {
    requireAdmin(currentUser);
    await handleHiringDecision(request, response, data, currentUser, hiringDecisionMatch[1]);
    return;
  }

  const hiringMatch = url.pathname.match(/^\/api\/hirings\/([^/]+)$/);
  if (hiringMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeleteHiringRequest(response, data, hiringMatch[1]);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/dismissals") {
    sendJson(response, 200, { ok: true, dismissals: visibleDismissalRequests(data.dismissalRequests, currentUser) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/dismissals") {
    await handleCreateDismissalRequest(request, response, data, currentUser);
    return;
  }

  const dismissalDecisionMatch = url.pathname.match(/^\/api\/dismissals\/([^/]+)\/decision$/);
  if (dismissalDecisionMatch && request.method === "PATCH") {
    requireAdmin(currentUser);
    await handleDismissalDecision(request, response, data, currentUser, dismissalDecisionMatch[1]);
    return;
  }

  const dismissalMatch = url.pathname.match(/^\/api\/dismissals\/([^/]+)$/);
  if (dismissalMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeleteDismissalRequest(response, data, dismissalMatch[1]);
    return;
  }

  const crmOpportunityMatch = url.pathname.match(/^\/api\/crm-opportunities\/([^/]+)$/);
  if (crmOpportunityMatch && request.method === "PATCH") {
    await handleUpdateCrmOpportunity(request, response, data, currentUser, crmOpportunityMatch[1]);
    return;
  }

  if (crmOpportunityMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeleteCrmOpportunity(response, data, crmOpportunityMatch[1]);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/personal-tasks") {
    requireAdmin(currentUser);
    sendJson(response, 200, { ok: true, personalTasks: sortPersonalTasks(data.personalTasks) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/personal-tasks") {
    requireAdmin(currentUser);
    await handleCreatePersonalTask(request, response, data, currentUser);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/meetings") {
    sendJson(response, 200, { ok: true, meetings: visibleMeetings(data.meetings, currentUser) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/meetings") {
    requireAdmin(currentUser);
    await handleCreateMeetingSlot(request, response, data, currentUser);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/meetings/block-period") {
    requireAdmin(currentUser);
    await handleBlockMeetingPeriod(request, response, data, currentUser);
    return;
  }

  const meetingBookMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/book$/);
  if (meetingBookMatch && request.method === "POST") {
    await handleBookMeeting(request, response, data, currentUser, meetingBookMatch[1]);
    return;
  }

  const meetingMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)$/);
  if (meetingMatch && request.method === "PATCH") {
    requireAdmin(currentUser);
    await handleUpdateMeetingSlot(request, response, data, meetingMatch[1]);
    return;
  }

  if (meetingMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeleteMeetingSlot(response, data, meetingMatch[1]);
    return;
  }

  const personalTaskMatch = url.pathname.match(/^\/api\/personal-tasks\/([^/]+)$/);
  if (personalTaskMatch && request.method === "PATCH") {
    requireAdmin(currentUser);
    await handleUpdatePersonalTask(request, response, data, currentUser, personalTaskMatch[1]);
    return;
  }

  if (personalTaskMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeletePersonalTask(response, data, personalTaskMatch[1]);
    return;
  }

  const requestMatch = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
  if (requestMatch && request.method === "PATCH") {
    await handleUpdateRequest(request, response, data, currentUser, requestMatch[1]);
    return;
  }

  if (requestMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeleteRequest(response, data, requestMatch[1]);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/users") {
    requireAdmin(currentUser);
    sendJson(response, 200, { ok: true, users: publicUsers(data.users) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/users") {
    requireAdmin(currentUser);
    await handleCreateUser(request, response, data);
    return;
  }

  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && request.method === "PATCH") {
    requireAdmin(currentUser);
    await handleUpdateUser(request, response, data, userMatch[1]);
    return;
  }

  if (userMatch && request.method === "DELETE") {
    requireAdmin(currentUser);
    await handleDeleteUser(response, data, userMatch[1]);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/notify-whatsapp") {
    await handleWhatsAppNotification(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/notify-requester-whatsapp") {
    await handleRequesterWhatsAppNotification(request, response);
    return;
  }

  sendJson(response, 404, { ok: false, error: "Rota nao encontrada" });
}

async function handleLogin(request, response) {
  const body = await readRequestBody(request);
  const data = await readData();
  const username = normalizeUsername(body.username);
  const loginKey = loginAttemptKey(request, username);

  if (isLoginLocked(loginKey)) {
    sendJson(response, 429, { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    return;
  }

  const user = data.users.find((item) => normalizeUsername(item.username) === username);

  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    registerFailedLogin(loginKey);
    sendJson(response, 401, { ok: false, error: "Usuario ou senha invalidos." });
    return;
  }

  loginAttempts.delete(loginKey);

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.id,
    createdAt: Date.now(),
  });

  sendJson(
    response,
    200,
    {
      ...buildStatePayload(data, user, request),
      ok: true,
    },
    {
      "Set-Cookie": buildSessionCookie(token),
    },
  );
}

function handleLogout(request, response) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) sessions.delete(token);

  sendJson(
    response,
    200,
    { ok: true },
    {
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    },
  );
}

async function handleChangePassword(request, response, data, currentUser) {
  const body = await readRequestBody(request);
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "").trim();

  if (!verifyPassword(currentPassword, currentUser.passwordHash)) {
    sendJson(response, 400, { ok: false, error: "Senha atual incorreta." });
    return;
  }

  const passwordError = passwordValidationError(newPassword);
  if (passwordError) {
    sendJson(response, 400, { ok: false, error: passwordError });
    return;
  }

  const index = data.users.findIndex((user) => user.id === currentUser.id);
  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Usuario nao encontrado." });
    return;
  }

  data.users[index] = {
    ...data.users[index],
    passwordHash: hashPassword(newPassword),
    passwordUpdatedAt: new Date().toISOString(),
  };
  await writeData(data);
  sendJson(response, 200, { ok: true });
}

async function handleCreateRequest(request, response, data, currentUser) {
  const body = await readRequestBody(request);
  const now = new Date().toISOString();
  const priority = normalizePriority(body.priority);
  const isManager = currentUser.role === "manager";
  const requestType = normalizeRequestType(body.requestType, currentUser);
  const assignee = resolveRequestAssignee(data.users, body.assigneeId, requestType, currentUser);
  const usesAssigneeAsOwner = ["admin_task", "material_list"].includes(requestType);
  const requesterName = currentUser.role === "admin" ? "Administração" : currentUser.name;
  const requesterDepartment = currentUser.role === "admin" ? "Regional Alci Jr." : currentUser.department;

  const taskRequest = {
    id: createId("request"),
    type: requestType,
    manager: usesAssigneeAsOwner && assignee ? assignee.name : isManager ? currentUser.name : cleanText(body.manager, "Gerente nao informado"),
    department:
      usesAssigneeAsOwner && assignee
        ? assignee.department
        : isManager
          ? currentUser.department
          : cleanText(body.department, "Setor nao informado"),
    title: cleanText(body.title, requestType === "material_list" ? "Solicitação Lista de Material" : "Sem titulo"),
    description: cleanText(body.description, "Sem descricao"),
    priority,
    dueDate: requestDueDate(priority, requestType),
    status: "nova",
    response: "",
    attachments: await sanitizeAttachments(body.attachments),
    responseAttachments: [],
    createdBy: currentUser.id,
    createdByName: requesterName,
    createdByDepartment: requesterDepartment,
    assigneeId: assignee?.id || "",
    assigneeName: assignee?.name || "",
    assigneeRole: assignee?.role || "",
    requesterPhone: isManager ? normalizePhone(currentUser.phone) : normalizePhone(body.requesterPhone),
    createdAt: now,
    updatedAt: now,
    history: [`Solicitacao registrada em ${formatDateTime(now)}`],
  };

  if (requestType === "admin_task" && !assignee) {
    sendJson(response, 400, { ok: false, error: "Escolha o gerente responsavel pela solicitacao." });
    return;
  }

  if (requestType === "material_list" && !assignee) {
    sendJson(response, 400, { ok: false, error: "Cadastre ou selecione um engenheiro antes de enviar lista de material." });
    return;
  }

  data.requests = [taskRequest, ...data.requests];
  await writeData(data);

  const shouldNotify = !(currentUser.role === "admin" && isTruthy(body.skipNotification));
  const notification = shouldNotify ? await notifyAdmin(taskRequest) : null;
  sendJson(response, 201, {
    ok: true,
    request: taskRequest,
    requests:
      currentUser.role === "admin"
        ? sortRequests(data.requests)
        : visibleRequestsForUser(data.requests, currentUser),
    notification,
  });
}

async function handleCreatePersonalTask(request, response, data, currentUser) {
  const body = await readRequestBody(request);
  const now = new Date().toISOString();
  const title = cleanText(body.title, "Pendencia sem titulo");
  const dueDate = normalizeDateInput(body.dueDate, todayInBusinessTimezone());

  const personalTask = {
    id: createId("personal"),
    title,
    description: cleanText(body.description, ""),
    dueDate,
    status: "pendente",
    resolution: "",
    createdBy: currentUser.id,
    createdAt: now,
    updatedAt: now,
    resolvedAt: "",
  };

  data.personalTasks = [personalTask, ...data.personalTasks];
  await writeData(data);
  sendJson(response, 201, {
    ok: true,
    personalTask,
    personalTasks: sortPersonalTasks(data.personalTasks),
  });
}

async function handleCreateSeparationRequest(request, response, data, currentUser) {
  if (!["seller", "admin", "manager", "director"].includes(currentUser.role)) {
    sendJson(response, 403, { ok: false, error: "Apenas vendedor, gerente ou diretor podem criar separacao." });
    return;
  }

  const body = await readRequestBody(request);
  const pdfAttachment = Array.isArray(body.separationPdf) ? body.separationPdf[0] : null;
  if (!pdfAttachment || pdfAttachment.type !== "application/pdf") {
    sendJson(response, 400, { ok: false, error: "Anexe o PDF do orcamento." });
    return;
  }

  const now = new Date().toISOString();
  const requestType = normalizeSeparationType(body.requestType);
  const desiredDate = normalizeDateInput(body.desiredDate, "");
  const desiredDeliveryAt = cleanText(body.desiredDeliveryAt, "");
  const urgentJustification = cleanText(body.urgentJustification, "").slice(0, 1200);
  const isLeaderTeamDeadline = requestType === "lider_equipe" && desiredDate && daysBetweenIso(todayInBusinessTimezone(), desiredDate) < 3;

  if (isLeaderTeamDeadline && !urgentJustification) {
    sendJson(response, 400, { ok: false, error: "Prazo menor que 3 dias exige justificativa." });
    return;
  }

  if (requestType === "entrega" && desiredDeliveryAt && !isDeliveryAtLeastThreeHours(now, desiredDeliveryAt)) {
    sendJson(response, 400, { ok: false, error: "Entrega precisa respeitar minimo de 3 horas apos a solicitacao." });
    return;
  }

  const parsedPdf = await extractSeparationPdfData(pdfAttachment);
  const assignedRole = firstSeparationRoleForType(requestType);
  const separation = {
    id: createId("separation"),
    customerName: cleanText(body.customerName, parsedPdf.customerName || "Cliente nao informado").slice(0, 140),
    store: normalizeUnit(body.store || currentUser.unit),
    requestType,
    observation: cleanText(body.observation, parsedPdf.observations || "").slice(0, 3000),
    priority: normalizePriority(body.priority),
    desiredDate,
    desiredDeliveryAt,
    urgentJustification,
    leaderApprovalStatus: isLeaderTeamDeadline ? "pendente" : "nao_necessario",
    status: "aguardando_separacao",
    previousStatus: "ia_processando",
    pdfAttachment,
    invoiceAttachment: null,
    location: "",
    deliveryAt: "",
    assignedRole,
    assignedUserId: "",
    sellerId: currentUser.id,
    sellerName: currentUser.name,
    sellerDepartment: currentUser.department,
    sellerUnit: normalizeUnit(currentUser.unit),
    budgetNumber: parsedPdf.budgetNumber,
    totalValue: parsedPdf.totalValue,
    products: parsedPdf.products,
    aiObservations: parsedPdf.observations,
    createdAt: now,
    updatedAt: now,
    completedAt: "",
    history: [
      separationHistoryEntry(currentUser, now, "Solicitacao criada", "", "pdf_recebido", "PDF recebido pelo sistema."),
      separationHistoryEntry({ name: "IA ATIVA" }, now, "Leitura automatica", "pdf_recebido", "ia_processando", "Extração automática iniciada."),
      separationHistoryEntry({ name: "IA ATIVA" }, now, "Leitura concluida", "ia_processando", "aguardando_separacao", "Dados salvos na solicitação."),
    ],
  };

  data.separationRequests = [separation, ...data.separationRequests];
  addInternalNotification(data, separation, "Solicitação criada", ["seller", assignedRole, "manager", "director"]);
  await writeData(data);
  sendJson(response, 201, {
    ok: true,
    separation,
    separations: visibleSeparationRequests(data.separationRequests, currentUser),
  });
}

async function handleUpdateSeparationRequest(request, response, data, currentUser, separationId) {
  const body = await readRequestBody(request);
  const index = data.separationRequests.findIndex((item) => item.id === separationId);
  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Solicitacao de separacao nao encontrada." });
    return;
  }

  const previous = data.separationRequests[index];
  if (!canEditSeparationRequest(previous, currentUser)) {
    sendJson(response, 403, { ok: false, error: "Esta separacao nao esta atribuida ao seu perfil." });
    return;
  }

  const now = new Date().toISOString();
  const nextStatus = normalizeSeparationStatus(body.status || previous.status);
  const invoiceAttachment = Array.isArray(body.separationInvoice) && body.separationInvoice[0]
    ? body.separationInvoice[0]
    : previous.invoiceAttachment;
  const location = cleanText(body.location, previous.location || "").slice(0, 220);
  const deliveryAt = cleanText(body.deliveryAt, previous.deliveryAt || "");
  const comment = cleanText(body.comment, "").slice(0, 1200);
  const leaderApprovalStatus = body.leaderApprovalStatus
    ? normalizeLeaderApproval(body.leaderApprovalStatus)
    : previous.leaderApprovalStatus;

  const deliveryValidation = validateSeparationDelivery(previous, nextStatus, {
    invoiceAttachment,
    location,
    deliveryAt,
  });
  if (deliveryValidation) {
    sendJson(response, 400, { ok: false, error: deliveryValidation });
    return;
  }

  const updated = {
    ...previous,
    status: nextStatus,
    previousStatus: previous.status,
    assignedRole: nextSeparationAssignedRole(nextStatus, previous.assignedRole),
    leaderApprovalStatus,
    invoiceAttachment,
    location,
    deliveryAt,
    updatedAt: now,
    completedAt: nextStatus === "finalizado" || nextStatus === "entregue" ? now : previous.completedAt,
    history: [
      ...(Array.isArray(previous.history) ? previous.history : []),
      separationHistoryEntry(currentUser, now, "Atualização", previous.status, nextStatus, comment || "Status atualizado."),
    ],
  };

  data.separationRequests[index] = updated;
  addInternalNotification(data, updated, separationNotificationTitle(nextStatus), ["seller", updated.assignedRole, "manager", "director"]);
  await writeData(data);
  sendJson(response, 200, {
    ok: true,
    separation: updated,
    separations: visibleSeparationRequests(data.separationRequests, currentUser),
  });
}

async function handleDeleteSeparationRequest(response, data, separationId) {
  const separationToDelete = data.separationRequests.find((item) => item.id === separationId);
  const before = data.separationRequests.length;
  data.separationRequests = data.separationRequests.filter((item) => item.id !== separationId);
  if (data.separationRequests.length === before) {
    sendJson(response, 404, { ok: false, error: "Separacao nao encontrada." });
    return;
  }
  await deleteStoredAttachments(separationToDelete);
  await writeData(data);
  sendJson(response, 200, { ok: true, separations: sortSeparationRequests(data.separationRequests) });
}

async function handleCreateCrmOpportunity(request, response, data, currentUser) {
  const body = await readRequestBody(request);
  const opportunity = await buildCrmOpportunity(data, body, currentUser);

  if (!opportunity.clientName) {
    sendJson(response, 400, { ok: false, error: "Informe o nome do cliente." });
    return;
  }

  data.crmOpportunities = [opportunity, ...data.crmOpportunities];
  await writeData(data);
  sendJson(response, 201, {
    ok: true,
    opportunity,
    opportunities: sortCrmOpportunities(data.crmOpportunities),
  });
}

async function handleCreateSignature(request, response, data, currentUser) {
  const body = await readRequestBody(request);
  const now = new Date().toISOString();
  const documentAttachment = Array.isArray(body.signatureDocument) ? body.signatureDocument[0] : null;

  if (!documentAttachment) {
    sendJson(response, 400, { ok: false, error: "Anexe o documento que sera assinado." });
    return;
  }

  const signerName = cleanText(body.signerName, "ALCI JR.").slice(0, 80);
  const documentName = cleanText(body.documentName, documentAttachment.name || "Documento assinado").slice(0, 160);
  const signatureDataUrl = sanitizeSignatureDataUrl(body.signatureDataUrl);
  const signedAttachment = await createSignedPdfAttachment(documentAttachment, signatureDataUrl, signerName, documentName);

  const signatureRecord = {
    id: createId("signature"),
    signerName,
    documentName,
    documentAttachment,
    signedAttachment,
    signatureDataUrl,
    signedBy: currentUser.id,
    signedByName: currentUser.name,
    signedAt: now,
    createdAt: now,
  };

  data.signatureRecords = [signatureRecord, ...data.signatureRecords];
  await writeData(data);
  sendJson(response, 201, {
    ok: true,
    signature: signatureRecord,
    signatures: sortSignatureRecords(data.signatureRecords),
  });
}

async function handleDeleteSignature(response, data, signatureId) {
  const signatureToDelete = data.signatureRecords.find((item) => item.id === signatureId);
  const before = data.signatureRecords.length;
  data.signatureRecords = data.signatureRecords.filter((item) => item.id !== signatureId);

  if (data.signatureRecords.length === before) {
    sendJson(response, 404, { ok: false, error: "Assinatura nao encontrada." });
    return;
  }

  await deleteStoredAttachments(signatureToDelete);
  await writeData(data);
  sendJson(response, 200, { ok: true, signatures: sortSignatureRecords(data.signatureRecords) });
}

async function handleCreateHiringRequest(request, response, data, currentUser) {
  if (!["admin", "manager"].includes(currentUser.role)) {
    sendJson(response, 403, { ok: false, error: "Acesso restrito a gerentes administrativos." });
    return;
  }

  const body = await readRequestBody(request);
  const resumeAttachment = Array.isArray(body.hiringResume) ? body.hiringResume[0] : null;

  if (!resumeAttachment || !isPdfOrImageAttachment(resumeAttachment)) {
    sendJson(response, 400, { ok: false, error: "Anexe o curriculo em PDF ou imagem." });
    return;
  }

  const now = new Date().toISOString();
  const relationship = normalizeYesNo(body.relationshipInsideGroup);
  const hiring = {
    id: createId("hiring"),
    candidateName: cleanText(body.candidateName, "Candidato nao informado").slice(0, 120),
    targetRole: cleanText(body.targetRole, "Funcao nao informada").slice(0, 120),
    promisedSalary: cleanText(body.promisedSalary, "Nao informado").slice(0, 80),
    selectionReason: cleanText(body.selectionReason, "").slice(0, 3000),
    experienceSummary: cleanText(body.experienceSummary, "").slice(0, 3000),
    relationshipInsideGroup: relationship,
    relationshipDetails: relationship === "sim" ? cleanText(body.relationshipDetails, "").slice(0, 2000) : "",
    risksAndObservations: cleanText(body.risksAndObservations, "").slice(0, 3000),
    status: "pendente",
    resumeAttachment,
    decisionAttachment: null,
    decisionNote: "",
    decidedBy: "",
    decidedByName: "",
    decidedAt: "",
    createdBy: currentUser.id,
    createdByName: currentUser.name,
    createdByDepartment: currentUser.department,
    createdAt: now,
    updatedAt: now,
    history: [`Solicitacao de contratacao registrada em ${formatDateTime(now)} por ${currentUser.name}`],
  };

  if (!hiring.candidateName || !hiring.targetRole || !hiring.selectionReason || !hiring.experienceSummary) {
    sendJson(response, 400, { ok: false, error: "Preencha candidato, funcao, motivo da selecao e analise do perfil." });
    return;
  }

  data.hiringRequests = [hiring, ...data.hiringRequests];
  await writeData(data);
  sendJson(response, 201, {
    ok: true,
    hiring,
    hirings: visibleHiringRequests(data.hiringRequests, currentUser),
  });
}

async function handleHiringDecision(request, response, data, currentUser, hiringId) {
  const body = await readRequestBody(request);
  const index = data.hiringRequests.findIndex((item) => item.id === hiringId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Solicitacao de contratacao nao encontrada." });
    return;
  }

  const previous = data.hiringRequests[index];
  const decision = normalizeHiringDecision(body.decision);
  if (!decision) {
    sendJson(response, 400, { ok: false, error: "Informe se foi aprovado ou reprovado." });
    return;
  }

  const now = new Date().toISOString();
  const decisionNote = cleanText(body.decisionNote, "").slice(0, 3000);
  const decisionAttachment = await createHiringDecisionPdfAttachment(previous, decision, decisionNote, now);
  const status = decision === "approved" ? "aprovada" : "reprovada";
  const history = Array.isArray(previous.history) ? [...previous.history] : [];
  history.push(`${status === "aprovada" ? "Aprovada" : "Reprovada"} em ${formatDateTime(now)} por ALCI JR.`);

  const hiring = {
    ...previous,
    status,
    decisionAttachment,
    decisionNote,
    decidedBy: currentUser.id,
    decidedByName: "ALCI JR.",
    decidedAt: now,
    updatedAt: now,
    history,
  };

  data.hiringRequests[index] = hiring;
  await writeData(data);
  sendJson(response, 200, {
    ok: true,
    hiring,
    hirings: visibleHiringRequests(data.hiringRequests, currentUser),
  });
}

async function handleDeleteHiringRequest(response, data, hiringId) {
  const hiringToDelete = data.hiringRequests.find((item) => item.id === hiringId);
  const before = data.hiringRequests.length;
  data.hiringRequests = data.hiringRequests.filter((item) => item.id !== hiringId);

  if (data.hiringRequests.length === before) {
    sendJson(response, 404, { ok: false, error: "Solicitacao de contratacao nao encontrada." });
    return;
  }

  await deleteStoredAttachments(hiringToDelete);
  await writeData(data);
  sendJson(response, 200, { ok: true, hirings: sortHiringRequests(data.hiringRequests) });
}

async function handleCreateDismissalRequest(request, response, data, currentUser) {
  if (!["admin", "manager"].includes(currentUser.role)) {
    sendJson(response, 403, { ok: false, error: "Acesso restrito a gerentes administrativos." });
    return;
  }

  const body = await readRequestBody(request);
  const documentAttachment = Array.isArray(body.dismissalDocument) ? body.dismissalDocument[0] : null;

  if (!documentAttachment || !isPdfOrImageAttachment(documentAttachment)) {
    sendJson(response, 400, { ok: false, error: "Anexe documento em PDF ou imagem." });
    return;
  }

  const now = new Date().toISOString();
  const dismissal = {
    id: createId("dismissal"),
    employeeName: cleanText(body.employeeName, "Colaborador nao informado").slice(0, 120),
    currentRole: cleanText(body.currentRole, "Funcao nao informada").slice(0, 120),
    currentSalary: cleanText(body.currentSalary, "Nao informado").slice(0, 80),
    dismissalReason: cleanText(body.dismissalReason, "").slice(0, 3000),
    performanceHistory: cleanText(body.performanceHistory, "").slice(0, 3000),
    warningsAndEvidence: cleanText(body.warningsAndEvidence, "").slice(0, 3000),
    replacementPlan: cleanText(body.replacementPlan, "").slice(0, 3000),
    risksAndObservations: cleanText(body.risksAndObservations, "").slice(0, 3000),
    status: "pendente",
    documentAttachment,
    decisionAttachment: null,
    decisionNote: "",
    decidedBy: "",
    decidedByName: "",
    decidedAt: "",
    createdBy: currentUser.id,
    createdByName: currentUser.name,
    createdByDepartment: currentUser.department,
    createdAt: now,
    updatedAt: now,
    history: [`Solicitacao de demissao registrada em ${formatDateTime(now)} por ${currentUser.name}`],
  };

  if (!dismissal.employeeName || !dismissal.currentRole || !dismissal.dismissalReason || !dismissal.performanceHistory) {
    sendJson(response, 400, { ok: false, error: "Preencha colaborador, funcao, motivo e historico/desempenho." });
    return;
  }

  data.dismissalRequests = [dismissal, ...data.dismissalRequests];
  await writeData(data);
  sendJson(response, 201, {
    ok: true,
    dismissal,
    dismissals: visibleDismissalRequests(data.dismissalRequests, currentUser),
  });
}

async function handleDismissalDecision(request, response, data, currentUser, dismissalId) {
  const body = await readRequestBody(request);
  const index = data.dismissalRequests.findIndex((item) => item.id === dismissalId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Solicitacao de demissao nao encontrada." });
    return;
  }

  const previous = data.dismissalRequests[index];
  const decision = normalizeHiringDecision(body.decision);
  if (!decision) {
    sendJson(response, 400, { ok: false, error: "Informe se foi aprovado ou reprovado." });
    return;
  }

  const now = new Date().toISOString();
  const decisionNote = cleanText(body.decisionNote, "").slice(0, 3000);
  const decisionAttachment = await createDismissalDecisionPdfAttachment(previous, decision, decisionNote, now);
  const status = decision === "approved" ? "aprovada" : "reprovada";
  const history = Array.isArray(previous.history) ? [...previous.history] : [];
  history.push(`${status === "aprovada" ? "Aprovada" : "Reprovada"} em ${formatDateTime(now)} por ALCI JR.`);

  const dismissal = {
    ...previous,
    status,
    decisionAttachment,
    decisionNote,
    decidedBy: currentUser.id,
    decidedByName: "ALCI JR.",
    decidedAt: now,
    updatedAt: now,
    history,
  };

  data.dismissalRequests[index] = dismissal;
  await writeData(data);
  sendJson(response, 200, {
    ok: true,
    dismissal,
    dismissals: visibleDismissalRequests(data.dismissalRequests, currentUser),
  });
}

async function handleDeleteDismissalRequest(response, data, dismissalId) {
  const dismissalToDelete = data.dismissalRequests.find((item) => item.id === dismissalId);
  const before = data.dismissalRequests.length;
  data.dismissalRequests = data.dismissalRequests.filter((item) => item.id !== dismissalId);

  if (data.dismissalRequests.length === before) {
    sendJson(response, 404, { ok: false, error: "Solicitacao de demissao nao encontrada." });
    return;
  }

  await deleteStoredAttachments(dismissalToDelete);
  await writeData(data);
  sendJson(response, 200, { ok: true, dismissals: sortDismissalRequests(data.dismissalRequests) });
}

async function buildCrmOpportunity(data, body, currentUser) {
  const now = new Date().toISOString();
  const clientName = cleanText(body.clientName, "");
  const title = cleanText(body.title, clientName ? `Orcamento - ${clientName}` : "Orcamento sem titulo");
  const ownerId = cleanText(body.ownerId, "");

  return {
    id: createId("crm"),
    title,
    clientName,
    contactName: cleanText(body.contactName, ""),
    phone: normalizePhone(body.phone),
    email: normalizeEmail(body.email),
    unit: normalizeUnit(body.unit),
    ownerId,
    ownerName: crmOwnerName(data.users, ownerId),
    amount: normalizeMoney(body.amount),
    source: cleanText(body.source, "Cadastro manual"),
    status: normalizeCrmStatus(body.status),
    notes: cleanText(body.notes, ""),
    attachments: await sanitizeAttachments(body.crmAttachments),
    followUps: [],
    createdBy: currentUser.id,
    createdByName: currentUser.name,
    createdAt: now,
    updatedAt: now,
    history: [`Oportunidade criada em ${formatDateTime(now)} por ${currentUser.name}`],
  };
}

async function handleEmailCrmWebhook(request, response, url) {
  if (!EMAIL_CRM_WEBHOOK_SECRET) {
    sendJson(response, 503, { ok: false, error: "Modo e-mail do CRM ainda nao configurado." });
    return;
  }

  const body = await readRequestBody(request);
  const providedSecret =
    url.searchParams.get("secret") ||
    String(request.headers["x-email-crm-secret"] || "") ||
    cleanText(body.secret, "");

  if (!timingSafeEqual(String(providedSecret || ""), EMAIL_CRM_WEBHOOK_SECRET)) {
    sendJson(response, 401, { ok: false, error: "Chave secreta invalida." });
    return;
  }

  const data = await readData();
  const messageId = normalizeEmailMessageId(body.messageId || body["message-id"] || body.MessageID || body["Message-Id"]);

  if (messageId && data.crmEmailImports.some((item) => item.messageId === messageId)) {
    const imported = data.crmEmailImports.find((item) => item.messageId === messageId);
    sendJson(response, 200, {
      ok: true,
      duplicate: true,
      opportunityId: imported.opportunityId,
      message: "E-mail ja importado anteriormente.",
    });
    return;
  }

  const opportunity = await buildCrmOpportunity(data, emailBodyToCrmPayload(body, data.users), {
    id: "email-crm",
    name: "Modo e-mail CRM",
  });

  if (!opportunity.clientName) {
    sendJson(response, 400, { ok: false, error: "Nao foi possivel identificar o cliente no e-mail." });
    return;
  }

  opportunity.emailMessageId = messageId;
  opportunity.history.push(`Importada automaticamente por e-mail em ${formatDateTime(opportunity.createdAt)}`);
  data.crmOpportunities = [opportunity, ...data.crmOpportunities];
  if (messageId) {
    data.crmEmailImports = [
      {
        messageId,
        opportunityId: opportunity.id,
        importedAt: opportunity.createdAt,
      },
      ...data.crmEmailImports,
    ].slice(0, 1000);
  }

  await writeData(data);
  sendJson(response, 201, {
    ok: true,
    opportunity,
  });
}

async function handleUpdateCrmOpportunity(request, response, data, currentUser, opportunityId) {
  const body = await readRequestBody(request);
  const index = data.crmOpportunities.findIndex((item) => item.id === opportunityId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Oportunidade nao encontrada." });
    return;
  }

  const previous = data.crmOpportunities[index];
  if (!canEditCrmOpportunity(previous, currentUser)) {
    sendJson(response, 403, { ok: false, error: "Esta venda nao esta atribuida ao seu usuario." });
    return;
  }

  const now = new Date().toISOString();
  const nextStatus = normalizeCrmStatus(body.status || previous.status);
  const newAttachments = Array.isArray(body.crmAttachments) ? await sanitizeAttachments(body.crmAttachments) : [];
  const history = Array.isArray(previous.history) ? [...previous.history] : [];
  const feedback = cleanText(body.feedback, "");
  const nextAction = cleanText(body.nextAction, "");
  const nextActionDate = normalizeDateInput(body.nextActionDate, "");

  if (nextStatus !== previous.status) {
    history.push(`Status alterado para ${crmStatusLabels[nextStatus]} em ${formatDateTime(now)} por ${currentUser.name}`);
  }

  if (newAttachments.length > 0) {
    history.push(`${newAttachments.length} anexo${newAttachments.length === 1 ? "" : "s"} adicionado${newAttachments.length === 1 ? "" : "s"} em ${formatDateTime(now)} por ${currentUser.name}`);
  }

  const followUps = Array.isArray(previous.followUps) ? [...previous.followUps] : [];
  if (feedback || nextAction || nextActionDate) {
    const followUp = {
      id: createId("followup"),
      feedback,
      nextAction,
      nextActionDate,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: now,
    };
    followUps.unshift(followUp);
    history.push(`Feedback registrado em ${formatDateTime(now)} por ${currentUser.name}`);
  }

  const opportunity = {
    ...previous,
    title: currentUser.role !== "admin" || body.title === undefined ? previous.title : cleanText(body.title, previous.title),
    clientName: currentUser.role !== "admin" || body.clientName === undefined ? previous.clientName : cleanText(body.clientName, previous.clientName),
    contactName: currentUser.role !== "admin" || body.contactName === undefined ? previous.contactName : cleanText(body.contactName, ""),
    phone: currentUser.role !== "admin" || body.phone === undefined ? previous.phone : normalizePhone(body.phone),
    email: currentUser.role !== "admin" || body.email === undefined ? previous.email : normalizeEmail(body.email),
    unit: currentUser.role !== "admin" || body.unit === undefined ? previous.unit : normalizeUnit(body.unit),
    ownerId: currentUser.role !== "admin" || body.ownerId === undefined ? previous.ownerId : cleanText(body.ownerId, ""),
    ownerName: currentUser.role !== "admin" || body.ownerId === undefined ? previous.ownerName : crmOwnerName(data.users, body.ownerId),
    amount: currentUser.role !== "admin" || body.amount === undefined ? previous.amount : normalizeMoney(body.amount),
    source: currentUser.role !== "admin" || body.source === undefined ? previous.source : cleanText(body.source, "Cadastro manual"),
    status: nextStatus,
    notes: currentUser.role !== "admin" || body.notes === undefined ? previous.notes : cleanText(body.notes, ""),
    attachments: [...(Array.isArray(previous.attachments) ? previous.attachments : []), ...newAttachments],
    followUps,
    updatedAt: now,
    history,
  };

  data.crmOpportunities[index] = opportunity;
  await writeData(data);
  sendJson(response, 200, {
    ok: true,
    opportunity,
    opportunities: visibleCrmOpportunities(data.crmOpportunities, currentUser),
  });
}

async function handleDeleteCrmOpportunity(response, data, opportunityId) {
  const opportunityToDelete = data.crmOpportunities.find((item) => item.id === opportunityId);
  const before = data.crmOpportunities.length;
  data.crmOpportunities = data.crmOpportunities.filter((item) => item.id !== opportunityId);

  if (data.crmOpportunities.length === before) {
    sendJson(response, 404, { ok: false, error: "Oportunidade nao encontrada." });
    return;
  }

  await deleteStoredAttachments(opportunityToDelete);
  await writeData(data);
  sendJson(response, 200, { ok: true, opportunities: sortCrmOpportunities(data.crmOpportunities) });
}

async function handleUpdatePersonalTask(request, response, data, currentUser, taskId) {
  const body = await readRequestBody(request);
  const index = data.personalTasks.findIndex((item) => item.id === taskId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Pendencia nao encontrada." });
    return;
  }

  const previous = data.personalTasks[index];
  const now = new Date().toISOString();
  const nextStatus = normalizePersonalTaskStatus(body.status || previous.status);
  const resolution =
    body.resolution === undefined ? previous.resolution : cleanText(body.resolution, "");

  if (nextStatus === "resolvida" && !resolution.trim()) {
    sendJson(response, 400, { ok: false, error: "Informe como a pendencia foi resolvida." });
    return;
  }

  const personalTask = {
    ...previous,
    title: body.title === undefined ? previous.title : cleanText(body.title, previous.title),
    description:
      body.description === undefined ? previous.description : cleanText(body.description, ""),
    dueDate:
      body.dueDate === undefined
        ? previous.dueDate
        : normalizeDateInput(body.dueDate, previous.dueDate),
    status: nextStatus,
    resolution: nextStatus === "resolvida" ? resolution : "",
    updatedAt: now,
    resolvedAt: nextStatus === "resolvida" ? previous.resolvedAt || now : "",
    resolvedBy: nextStatus === "resolvida" ? currentUser.id : "",
  };

  data.personalTasks[index] = personalTask;
  await writeData(data);
  sendJson(response, 200, {
    ok: true,
    personalTask,
    personalTasks: sortPersonalTasks(data.personalTasks),
  });
}

async function handleDeletePersonalTask(response, data, taskId) {
  const before = data.personalTasks.length;
  data.personalTasks = data.personalTasks.filter((item) => item.id !== taskId);

  if (data.personalTasks.length === before) {
    sendJson(response, 404, { ok: false, error: "Pendencia nao encontrada." });
    return;
  }

  await writeData(data);
  sendJson(response, 200, { ok: true, personalTasks: sortPersonalTasks(data.personalTasks) });
}

async function handleCreateMeetingSlot(request, response, data, currentUser) {
  const body = await readRequestBody(request);
  const now = new Date().toISOString();
  const status = normalizeMeetingStatus(body.status);

  if (status === "booked") {
    sendJson(response, 400, { ok: false, error: "Crie o horario como disponivel ou fechado." });
    return;
  }

  const meeting = {
    id: createId("meeting"),
    date: normalizeDateInput(body.date, todayInBusinessTimezone()),
    time: normalizeTimeInput(body.time),
    status,
    adminNote: cleanText(body.adminNote, ""),
    topic: "",
    agenda: "",
    bookedBy: "",
    bookedByName: "",
    bookedByDepartment: "",
    bookedByUnit: "",
    createdBy: currentUser.id,
    createdAt: now,
    updatedAt: now,
    bookedAt: "",
  };

  if (!meeting.time) {
    sendJson(response, 400, { ok: false, error: "Informe o horario da reuniao." });
    return;
  }

  if (!isAllowedMeetingTime(meeting.time)) {
    sendJson(response, 400, { ok: false, error: "Use apenas 11:00, 17:00 ou 18:00 para reunioes." });
    return;
  }

  const existingIndex = data.meetings.findIndex((item) => item.date === meeting.date && item.time === meeting.time);
  if (existingIndex !== -1) {
    const existing = data.meetings[existingIndex];
    if (existing.status === "booked") {
      sendJson(response, 409, { ok: false, error: "Este horario ja esta agendado." });
      return;
    }

    const updatedMeeting = {
      ...existing,
      status,
      adminNote: meeting.adminNote || existing.adminNote,
      updatedAt: now,
    };
    data.meetings[existingIndex] = updatedMeeting;
    await writeData(data);
    sendJson(response, 200, { ok: true, meeting: updatedMeeting, meetings: sortMeetings(data.meetings) });
    return;
  }

  data.meetings = [meeting, ...data.meetings];
  await writeData(data);
  sendJson(response, 201, { ok: true, meeting, meetings: sortMeetings(data.meetings) });
}

async function handleUpdateMeetingSlot(request, response, data, meetingId) {
  const body = await readRequestBody(request);
  const index = data.meetings.findIndex((item) => item.id === meetingId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Horario nao encontrado." });
    return;
  }

  const previous = data.meetings[index];
  const status = normalizeMeetingStatus(body.status || previous.status);
  const now = new Date().toISOString();

  const nextMeeting = {
    ...previous,
    date: body.date === undefined ? previous.date : normalizeDateInput(body.date, previous.date),
    time: body.time === undefined ? previous.time : normalizeTimeInput(body.time) || previous.time,
    status,
    adminNote: body.adminNote === undefined ? previous.adminNote : cleanText(body.adminNote, ""),
    updatedAt: now,
  };

  if (!isAllowedMeetingTime(nextMeeting.time)) {
    sendJson(response, 400, { ok: false, error: "Use apenas 11:00, 17:00 ou 18:00 para reunioes." });
    return;
  }

  if (status !== "booked") {
    nextMeeting.topic = "";
    nextMeeting.agenda = "";
    nextMeeting.bookedBy = "";
    nextMeeting.bookedByName = "";
    nextMeeting.bookedByDepartment = "";
    nextMeeting.bookedByUnit = "";
    nextMeeting.bookedAt = "";
  }

  data.meetings[index] = nextMeeting;
  await writeData(data);
  sendJson(response, 200, { ok: true, meeting: nextMeeting, meetings: sortMeetings(data.meetings) });
}

async function handleBlockMeetingPeriod(request, response, data, currentUser) {
  const body = await readRequestBody(request);
  const startDate = normalizeDateInput(body.startDate, "");
  const endDate = normalizeDateInput(body.endDate, "");
  const dates = datesBetween(startDate, endDate);

  if (!startDate || !endDate || dates.length === 0) {
    sendJson(response, 400, { ok: false, error: "Informe inicio e fim do periodo." });
    return;
  }

  if (dates.length > MAX_MEETING_BLOCK_DAYS) {
    sendJson(response, 400, { ok: false, error: `Bloqueie no maximo ${MAX_MEETING_BLOCK_DAYS} dias por vez.` });
    return;
  }

  const now = new Date().toISOString();
  const adminNote = cleanText(body.adminNote, "Periodo bloqueado");
  let blockedCount = 0;
  let bookedCount = 0;

  dates.forEach((date) => {
    MEETING_TIME_SLOTS.forEach((time) => {
      const existingIndex = data.meetings.findIndex((meeting) => meeting.date === date && meeting.time === time);
      if (existingIndex === -1) {
        data.meetings.push({
          id: createId("meeting"),
          date,
          time,
          status: "blocked",
          adminNote,
          topic: "",
          agenda: "",
          bookedBy: "",
          bookedByName: "",
          bookedByDepartment: "",
          bookedByUnit: "",
          createdBy: currentUser.id,
          createdAt: now,
          updatedAt: now,
          bookedAt: "",
        });
        blockedCount += 1;
        return;
      }

      const existing = data.meetings[existingIndex];
      if (existing.status === "booked") {
        bookedCount += 1;
        return;
      }

      data.meetings[existingIndex] = {
        ...existing,
        status: "blocked",
        adminNote,
        topic: "",
        agenda: "",
        bookedBy: "",
        bookedByName: "",
        bookedByDepartment: "",
        bookedByUnit: "",
        bookedAt: "",
        updatedAt: now,
      };
      blockedCount += 1;
    });
  });

  await writeData(data);
  sendJson(response, 200, {
    ok: true,
    blockedCount,
    bookedCount,
    meetings: sortMeetings(data.meetings),
  });
}

async function handleBookMeeting(request, response, data, currentUser, meetingId) {
  if (currentUser.role !== "manager") {
    sendJson(response, 403, { ok: false, error: "Apenas gestores podem agendar reunioes." });
    return;
  }

  const body = await readRequestBody(request);
  const topic = cleanText(body.topic, "");
  const agenda = cleanText(body.agenda, "");
  const index = data.meetings.findIndex((item) => item.id === meetingId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Horario nao encontrado." });
    return;
  }

  if (data.meetings[index].status !== "available") {
    sendJson(response, 409, { ok: false, error: "Este horario nao esta disponivel." });
    return;
  }

  if (!isAllowedMeetingTime(data.meetings[index].time)) {
    sendJson(response, 409, { ok: false, error: "Este horario nao esta liberado para reunioes." });
    return;
  }

  if (!topic || !agenda) {
    sendJson(response, 400, { ok: false, error: "Informe o tema e as pautas da reuniao." });
    return;
  }

  const now = new Date().toISOString();
  const meeting = {
    ...data.meetings[index],
    status: "booked",
    topic,
    agenda,
    bookedBy: currentUser.id,
    bookedByName: currentUser.name,
    bookedByDepartment: currentUser.department,
    bookedByUnit: normalizeUnit(currentUser.unit),
    bookedAt: now,
    updatedAt: now,
  };

  data.meetings[index] = meeting;
  await writeData(data);
  sendJson(response, 200, { ok: true, meeting, meetings: visibleMeetings(data.meetings, currentUser) });
}

async function handleDeleteMeetingSlot(response, data, meetingId) {
  const before = data.meetings.length;
  data.meetings = data.meetings.filter((item) => item.id !== meetingId);

  if (data.meetings.length === before) {
    sendJson(response, 404, { ok: false, error: "Horario nao encontrado." });
    return;
  }

  await writeData(data);
  sendJson(response, 200, { ok: true, meetings: sortMeetings(data.meetings) });
}

async function handleUpdateRequest(request, response, data, currentUser, requestId) {
  const body = await readRequestBody(request);
  const index = data.requests.findIndex((item) => item.id === requestId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Solicitacao nao encontrada" });
    return;
  }

  const previous = data.requests[index];
  const nextStatus = normalizeStatus(body.status || previous.status);
  const isAdminReopening =
    currentUser.role === "admin" &&
    previous.status === "resolvida" &&
    ["andamento", "nova"].includes(nextStatus);

  if (!canRespondToRequest(previous, currentUser) && !isAdminReopening) {
    sendJson(response, 403, { ok: false, error: "Esta solicitacao nao esta atribuida ao seu usuario." });
    return;
  }

  const now = new Date().toISOString();
  const responseText =
    body.response === undefined ? previous.response : cleanText(body.response, previous.response);
  const newResponseAttachments = Array.isArray(body.responseAttachments)
    ? await sanitizeAttachments(body.responseAttachments)
    : [];
  const history = [...previous.history];

  if (nextStatus === "andamento" && previous.status !== "andamento") {
    history.push(
      isAdminReopening
        ? `Solicitacao reaberta como nao resolvida em ${formatDateTime(now)} por ${currentUser.name}`
        : `Marcada como em andamento em ${formatDateTime(now)} por ${currentUser.name}`,
    );
  }

  if (nextStatus === "resolvida") {
    history.push(`Resposta enviada e solicitacao resolvida em ${formatDateTime(now)} por ${currentUser.name}`);
  }

  if (newResponseAttachments.length > 0) {
    history.push(
      `${newResponseAttachments.length} anexo${newResponseAttachments.length === 1 ? "" : "s"} adicionado${
        newResponseAttachments.length === 1 ? "" : "s"
      } a resposta em ${formatDateTime(now)} por ${currentUser.name}`,
    );
  }

  const updatedRequest = {
    ...previous,
    status: nextStatus,
    response: responseText,
    attachments: Array.isArray(previous.attachments) ? previous.attachments : [],
    responseAttachments: [
      ...(Array.isArray(previous.responseAttachments) ? previous.responseAttachments : []),
      ...newResponseAttachments,
    ],
    updatedAt: now,
    responseBy: nextStatus === "resolvida" ? currentUser.id : previous.responseBy || "",
    responseByName: nextStatus === "resolvida" ? currentUser.name : previous.responseByName || "",
    responseByRole: nextStatus === "resolvida" ? currentUser.role : previous.responseByRole || "",
    responseAt: nextStatus === "resolvida" ? now : previous.responseAt || "",
    history,
  };

  data.requests[index] = updatedRequest;
  await writeData(data);

  const notification = nextStatus === "resolvida" ? await notifyRequester(updatedRequest) : null;
  sendJson(response, 200, {
    ok: true,
    request: updatedRequest,
    requests: currentUser.role === "admin" ? sortRequests(data.requests) : visibleRequestsForUser(data.requests, currentUser),
    notification,
  });
}

async function handleDeleteRequest(response, data, requestId) {
  const requestToDelete = data.requests.find((item) => item.id === requestId);
  const before = data.requests.length;
  data.requests = data.requests.filter((item) => item.id !== requestId);

  if (data.requests.length === before) {
    sendJson(response, 404, { ok: false, error: "Solicitacao nao encontrada" });
    return;
  }

  await deleteStoredAttachments(requestToDelete);
  await writeData(data);
  sendJson(response, 200, { ok: true, requests: sortRequests(data.requests) });
}

async function handleAttachmentDownload(response, data, currentUser, attachmentId) {
  const match =
    findAttachmentRecord(data.requests, currentUser, attachmentId) ||
    findVisibleCrmAttachmentRecord(data.crmOpportunities, currentUser, attachmentId) ||
    findSignatureAttachmentRecord(data.signatureRecords, currentUser, attachmentId) ||
    findVisibleHiringAttachmentRecord(data.hiringRequests, currentUser, attachmentId) ||
    findVisibleDismissalAttachmentRecord(data.dismissalRequests, currentUser, attachmentId) ||
    findVisibleSeparationAttachmentRecord(data.separationRequests, currentUser, attachmentId);

  if (!match) {
    sendJson(response, 404, { ok: false, error: "Anexo nao encontrado." });
    return;
  }

  const { attachment } = match;
  const type = String(attachment.type || "application/octet-stream");
  const fileName = cleanText(attachment.name, isPdfMime(type) ? "documento.pdf" : "anexo");

  if (attachment.storagePath) {
    const filePath = path.resolve(DATA_DIR, attachment.storagePath);
    const allowedRoot = path.resolve(UPLOAD_DIR);

    if (filePath !== allowedRoot && !filePath.startsWith(`${allowedRoot}${path.sep}`)) {
      sendJson(response, 400, { ok: false, error: "Caminho do anexo invalido." });
      return;
    }

    const file = await fs.readFile(filePath).catch(() => null);
    if (!file) {
      sendJson(response, 404, { ok: false, error: "Arquivo do anexo nao encontrado." });
      return;
    }

    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${encodeHeaderFileName(fileName)}"`,
    });
    response.end(file);
    return;
  }

  if (attachment.dataUrl) {
    const decoded = decodeDataUrl(attachment.dataUrl);
    if (!decoded) {
      sendJson(response, 400, { ok: false, error: "Anexo invalido." });
      return;
    }

    response.writeHead(200, {
      "Content-Type": decoded.mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${encodeHeaderFileName(fileName)}"`,
    });
    response.end(decoded.buffer);
    return;
  }

  sendJson(response, 404, { ok: false, error: "Arquivo do anexo nao encontrado." });
}

async function handleCreateUser(request, response, data) {
  const body = await readRequestBody(request);
  const username = normalizeUsername(body.username);

  if (!username) {
    sendJson(response, 400, { ok: false, error: "Informe um usuario." });
    return;
  }

  if (data.users.some((user) => normalizeUsername(user.username) === username)) {
    sendJson(response, 409, { ok: false, error: "Este usuario ja existe." });
    return;
  }

  const password = cleanText(body.password, "");
  const passwordError = passwordValidationError(password);
  if (passwordError) {
    sendJson(response, 400, { ok: false, error: passwordError });
    return;
  }

  const user = {
    id: createId("user"),
    name: cleanText(body.name, "Gerente"),
    department: cleanText(body.department, "Loja"),
    unit: normalizeUnit(body.unit),
    username,
    phone: normalizePhone(body.phone),
    passwordHash: hashPassword(password),
    role: normalizeUserRole(body.role),
    sellerGoal: normalizeMoney(body.sellerGoal),
    createdAt: new Date().toISOString(),
  };

  data.users = [...data.users, user];
  await writeData(data);
  sendJson(response, 201, { ok: true, user: publicUser(user), users: publicUsers(data.users) });
}

async function handleUpdateUser(request, response, data, userId) {
  const body = await readRequestBody(request);
  const index = data.users.findIndex((item) => item.id === userId);

  if (index === -1 || data.users[index].role === "admin") {
    sendJson(response, 400, { ok: false, error: "Usuario nao pode ser editado." });
    return;
  }

  const username = normalizeUsername(body.username);

  if (!username) {
    sendJson(response, 400, { ok: false, error: "Informe um usuario." });
    return;
  }

  const duplicate = data.users.some(
    (user) => user.id !== userId && normalizeUsername(user.username) === username,
  );

  if (duplicate) {
    sendJson(response, 409, { ok: false, error: "Este usuario ja existe." });
    return;
  }

  const previous = data.users[index];
  const nextUser = {
    ...previous,
    name: cleanText(body.name, previous.name),
    department: cleanText(body.department, previous.department),
    unit: normalizeUnit(body.unit || previous.unit),
    username,
    phone: normalizePhone(body.phone),
    role: normalizeUserRole(body.role || previous.role),
    sellerGoal: normalizeMoney(body.sellerGoal ?? previous.sellerGoal),
    updatedAt: new Date().toISOString(),
  };

  const nextPassword = String(body.password || "").trim();
  if (nextPassword) {
    const passwordError = passwordValidationError(nextPassword);
    if (passwordError) {
      sendJson(response, 400, { ok: false, error: passwordError });
      return;
    }
    nextUser.passwordHash = hashPassword(nextPassword);
  }

  data.users[index] = nextUser;
  await writeData(data);
  sendJson(response, 200, { ok: true, user: publicUser(nextUser), users: publicUsers(data.users) });
}

async function handleDeleteUser(response, data, userId) {
  const user = data.users.find((item) => item.id === userId);

  if (!user || user.role === "admin") {
    sendJson(response, 400, { ok: false, error: "Usuario nao pode ser excluido." });
    return;
  }

  data.users = data.users.filter((item) => item.id !== userId);
  await writeData(data);
  sendJson(response, 200, { ok: true, users: publicUsers(data.users) });
}

async function handleWhatsAppNotification(request, response) {
  const body = await readRequestBody(request);
  const taskRequest = sanitizeTaskRequest(body.request ?? body);
  const result = await notifyAdmin(taskRequest);
  sendJson(response, result.ok ? 200 : 502, result);
}

async function handleRequesterWhatsAppNotification(request, response) {
  const body = await readRequestBody(request);
  const taskRequest = sanitizeTaskRequest(body.request ?? body);
  const result = await notifyRequester(taskRequest);
  sendJson(response, result.ok ? 200 : 502, result);
}

async function notifyAdmin(taskRequest) {
  const config = readWhatsAppConfig(process.env.WHATSAPP_TO, "WHATSAPP_TO");

  if (!config.ready) {
    return {
      ok: true,
      sent: false,
      configured: false,
      missing: config.missing,
    };
  }

  const result = await sendWhatsAppText(config, buildWhatsAppMessage(taskRequest)).catch((error) => ({
    ok: false,
    sent: false,
    configured: true,
    error: error.message,
  }));

  logWhatsAppResult("admin", result);
  return result;
}

async function notifyRequester(taskRequest) {
  const config = readWhatsAppConfig(taskRequest.requesterPhone, "requesterPhone");

  if (!config.ready) {
    return {
      ok: true,
      sent: false,
      configured: false,
      missing: config.missing,
    };
  }

  const result = await sendWhatsAppText(config, buildRequesterResponseMessage(taskRequest)).catch((error) => ({
    ok: false,
    sent: false,
    configured: true,
    error: error.message,
  }));

  logWhatsAppResult("requester", result);
  return result;
}

function buildStatePayload(data, currentUser, request = null) {
  const user = publicUser(currentUser);
  const isAdmin = currentUser.role === "admin";
  const visibleRequests = isAdmin ? sortRequests(data.requests) : visibleRequestsForUser(data.requests, currentUser);

  return {
    ok: true,
    user,
    requests: visibleRequests,
    users: isAdmin ? publicUsers(data.users) : [],
    personalTasks: isAdmin ? sortPersonalTasks(data.personalTasks) : [],
    meetings: visibleMeetings(data.meetings, currentUser),
    crmOpportunities: visibleCrmOpportunities(data.crmOpportunities, currentUser),
    signatureRecords: isAdmin ? sortSignatureRecords(data.signatureRecords) : [],
    hiringRequests: visibleHiringRequests(data.hiringRequests, currentUser),
    dismissalRequests: visibleDismissalRequests(data.dismissalRequests, currentUser),
    separationRequests: visibleSeparationRequests(data.separationRequests, currentUser),
    notifications: visibleInternalNotifications(data.internalNotifications, currentUser),
    emailMode: isAdmin ? emailModeStatus(request) : null,
  };
}

function emailModeStatus(request = null) {
  return {
    enabled: Boolean(EMAIL_CRM_WEBHOOK_SECRET),
    webhookPath: "/api/email/crm",
    webhookUrl: request ? `${requestOrigin(request)}/api/email/crm` : "/api/email/crm",
    secretConfigured: Boolean(EMAIL_CRM_WEBHOOK_SECRET),
    defaultUnit: EMAIL_CRM_DEFAULT_UNIT,
    defaultOwnerUsername: EMAIL_CRM_DEFAULT_OWNER_USERNAME,
  };
}

function requestOrigin(request) {
  const proto = String(request.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);
  const data = {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    personalTasks: Array.isArray(parsed.personalTasks) ? parsed.personalTasks : [],
    meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
    crmOpportunities: Array.isArray(parsed.crmOpportunities) ? parsed.crmOpportunities : [],
    crmEmailImports: Array.isArray(parsed.crmEmailImports) ? parsed.crmEmailImports : [],
    signatureRecords: Array.isArray(parsed.signatureRecords) ? parsed.signatureRecords : [],
    hiringRequests: Array.isArray(parsed.hiringRequests) ? parsed.hiringRequests : [],
    dismissalRequests: Array.isArray(parsed.dismissalRequests) ? parsed.dismissalRequests : [],
    separationRequests: Array.isArray(parsed.separationRequests) ? parsed.separationRequests : [],
    internalNotifications: Array.isArray(parsed.internalNotifications) ? parsed.internalNotifications : [],
  };
  const migrated = await migrateLegacyAttachments(data.requests);
  const migratedHighPriorityDueDates = migrateHighPriorityDueDates(data.requests);
  const updatedMeetingSchedule = ensureMeetingSchedule(data.meetings);

  if (migrated || migratedHighPriorityDueDates || updatedMeetingSchedule) {
    await writeData(data);
  }

  return data;
}

async function writeData(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${DATA_FILE}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempFile, `${JSON.stringify(data)}\n`);
  await fs.rename(tempFile, DATA_FILE);
}

function scheduleAutomaticBackups() {
  setTimeout(() => createBackupArchive().then(pruneOldBackups).catch(logBackupError), 5000);
  setInterval(() => createBackupArchive().then(pruneOldBackups).catch(logBackupError), BACKUP_INTERVAL_MS);
}

async function createBackupArchive() {
  await ensureDataFile();
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${stamp}.tar.gz`;
  const backupPath = path.join(BACKUP_DIR, fileName);

  try {
    await execFileAsync("tar", ["-czf", backupPath, "-C", DATA_DIR, "app-data.json", "uploads"]);
  } catch {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const fallbackName = `backup-${stamp}.json.gz`;
    const fallbackPath = path.join(BACKUP_DIR, fallbackName);
    await fs.writeFile(fallbackPath, await gzipAsync(raw));
    return backupInfo(fallbackPath);
  }

  return backupInfo(backupPath);
}

async function listBackups() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const entries = await fs.readdir(BACKUP_DIR);
  const backups = await Promise.all(
    entries
      .filter((fileName) => /^backup-[\w.-]+\.(tar\.gz|json\.gz)$/.test(fileName))
      .map((fileName) => backupInfo(path.join(BACKUP_DIR, fileName))),
  );
  return backups.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

async function backupInfo(filePath) {
  const stats = await fs.stat(filePath);
  const fileName = path.basename(filePath);
  return {
    fileName,
    size: stats.size,
    createdAt: stats.mtime.toISOString(),
    downloadUrl: `/api/backups/${encodeURIComponent(fileName)}`,
  };
}

async function pruneOldBackups() {
  const backups = await listBackups();
  await Promise.all(
    backups.slice(BACKUP_RETENTION).map((backup) => fs.unlink(path.join(BACKUP_DIR, backup.fileName)).catch(() => null)),
  );
}

async function handleBackupDownload(response, encodedFileName) {
  const fileName = path.basename(decodeURIComponent(encodedFileName));
  if (!/^backup-[\w.-]+\.(tar\.gz|json\.gz)$/.test(fileName)) {
    sendJson(response, 400, { ok: false, error: "Backup invalido." });
    return;
  }

  const filePath = path.join(BACKUP_DIR, fileName);
  if (!fsSync.existsSync(filePath)) {
    sendJson(response, 404, { ok: false, error: "Backup nao encontrado." });
    return;
  }

  const file = await fs.readFile(filePath);
  response.writeHead(200, {
    "Content-Type": "application/gzip",
    "Content-Disposition": `attachment; filename="${encodeHeaderFileName(fileName)}"`,
    "Cache-Control": "private, no-cache",
  });
  response.end(file);
}

function logBackupError(error) {
  process.stderr.write(`[backup] ${error.stack || error.message}\n`);
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  if (fsSync.existsSync(DATA_FILE)) return;

  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
    process.stderr.write("[server] Defina ADMIN_PASSWORD em producao antes do primeiro acesso.\n");
  }

  const now = new Date().toISOString();
  const initialData = {
    users: [
      {
        id: "user-admin",
        name: "Administrador",
        department: "Gestao",
        unit: "CORP",
        username: ADMIN_USERNAME,
        phone: "",
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: "admin",
        createdAt: now,
      },
    ],
    requests: [],
    personalTasks: [],
    meetings: [],
    crmOpportunities: [],
    crmEmailImports: [],
    signatureRecords: [],
    hiringRequests: [],
    dismissalRequests: [],
    separationRequests: [],
    internalNotifications: [],
  };

  await writeData(initialData);
}

function getCurrentUser(request, data) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  const ageSeconds = (Date.now() - session.createdAt) / 1000;
  if (ageSeconds > SESSION_MAX_AGE_SECONDS) {
    sessions.delete(token);
    return null;
  }

  return data.users.find((user) => user.id === session.userId) ?? null;
}

function requireAdmin(user) {
  if (user.role !== "admin") {
    const error = new Error("Acesso restrito ao administrador.");
    error.status = 403;
    throw error;
  }
}

function buildSessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const match = cookies.find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function publicUsers(users) {
  return users.map(publicUser);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    department: user.department,
    unit: normalizeUnit(user.unit),
    username: user.username,
    phone: user.phone || "",
    role: user.role,
    sellerGoal: normalizeMoney(user.sellerGoal),
    createdAt: user.createdAt,
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2:${iterations}:${salt}:${hash}`;
}

function passwordValidationError(password) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "A senha precisa ter letras e numeros.";
  return "";
}

function verifyPassword(password, storedHash = "") {
  if (storedHash.startsWith("plain:")) {
    return storedHash === `plain:${password}`;
  }

  const [type, iterationsText, salt, expectedHash] = storedHash.split(":");
  if (type !== "pbkdf2" || !iterationsText || !salt || !expectedHash) return false;

  const iterations = Number(iterationsText);
  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, iterations, 32, "sha256")
    .toString("hex");

  return timingSafeEqual(actualHash, expectedHash);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function loginAttemptKey(request, username) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || request.socket.remoteAddress || "local";
  return `${ip}:${username || "anonimo"}`;
}

function isLoginLocked(key) {
  const attempt = loginAttempts.get(key);
  if (!attempt?.lockedUntil) return false;
  if (attempt.lockedUntil > Date.now()) return true;
  loginAttempts.delete(key);
  return false;
}

function registerFailedLogin(key) {
  const attempt = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    attempt.count = 0;
  }
  loginAttempts.set(key, attempt);
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")}`;
}

function normalizeUsername(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
}

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizePriority(value) {
  return ["alta", "media", "baixa"].includes(value) ? value : "media";
}

function normalizeStatus(value) {
  return ["nova", "andamento", "resolvida"].includes(value) ? value : "nova";
}

function normalizePersonalTaskStatus(value) {
  return ["pendente", "resolvida"].includes(value) ? value : "pendente";
}

function normalizeUserRole(value) {
  return [
    "director",
    "manager",
    "seller",
    "engineer",
    "team_lead",
    "counter_lead",
    "separator",
    "checker",
    "deliverer",
  ].includes(value) ? value : "manager";
}

function normalizeRequestType(value, currentUser) {
  if (currentUser.role === "admin") return value === "material_list" ? "material_list" : "admin_task";
  if (value === "material_list") return "material_list";
  return "manager_request";
}

function normalizeMeetingStatus(value) {
  return ["available", "blocked", "booked"].includes(value) ? value : "available";
}

function normalizeCrmStatus(value) {
  return Object.prototype.hasOwnProperty.call(crmStatusLabels, value) ? value : "novo";
}

function normalizeSeparationType(value) {
  return ["balcao", "lider_equipe", "entrega"].includes(value) ? value : "balcao";
}

function normalizeSeparationStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return separationStatusSet.has(normalized) ? normalized : "aguardando_separacao";
}

function normalizeLeaderApproval(value) {
  return ["nao_necessario", "pendente", "aprovado", "reprovado"].includes(value) ? value : "pendente";
}

function normalizeHiringDecision(value) {
  if (["approved", "aprovada", "aprovar"].includes(value)) return "approved";
  if (["rejected", "reprovada", "reprovar"].includes(value)) return "rejected";
  return "";
}

function normalizeYesNo(value) {
  return String(value || "").toLowerCase() === "sim" ? "sim" : "nao";
}

function emailBodyToCrmPayload(body = {}, users = []) {
  const subject = cleanText(body.subject || body.Subject || body.title, "Orcamento recebido por e-mail");
  const from = cleanText(body.from || body.From || body.sender || body.Sender || "", "");
  const replyTo = cleanText(body.replyTo || body["reply-to"] || body.ReplyTo || "", "");
  const text = cleanText(
    body.text || body.TextBody || body["body-plain"] || body["stripped-text"] || stripHtml(body.html || body.HtmlBody || ""),
    "",
  );
  const clientName = cleanText(body.clientName || body.cliente || extractSenderName(from), "");
  const senderEmail = normalizeEmail(body.email || extractEmailAddress(replyTo) || extractEmailAddress(from));
  const owner = defaultCrmEmailOwner(users, body.ownerId);

  return {
    title: subject,
    clientName,
    contactName: cleanText(body.contactName || body.contato || extractSenderName(from), ""),
    phone: normalizePhone(body.phone || body.telefone || body.whatsapp || extractPhone(text)),
    email: senderEmail,
    unit: normalizeUnit(body.unit || body.unidade || EMAIL_CRM_DEFAULT_UNIT),
    ownerId: owner?.id || "",
    amount: body.amount || body.valor || extractMoney(text),
    source: "E-mail automático",
    status: "novo",
    notes: [
      `Assunto: ${subject}`,
      from ? `Remetente: ${from}` : "",
      text ? `Conteudo:\n${text.slice(0, 4000)}` : "",
    ].filter(Boolean).join("\n\n"),
    crmAttachments: Array.isArray(body.crmAttachments)
      ? body.crmAttachments
      : Array.isArray(body.attachments)
        ? body.attachments
        : [],
  };
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractSenderName(value = "") {
  const text = String(value || "").trim();
  const bracketIndex = text.indexOf("<");
  const name = bracketIndex === -1 ? text : text.slice(0, bracketIndex);
  const cleaned = name.replace(/^["']|["']$/g, "").trim();
  if (cleaned && !cleaned.includes("@")) return cleaned;
  const email = extractEmailAddress(text);
  return email ? email.split("@")[0].replace(/[._-]+/g, " ") : "";
}

function extractEmailAddress(value = "") {
  const match = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function extractPhone(value = "") {
  const match = String(value || "").match(/(?:\+?55)?\s?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/);
  return match ? match[0] : "";
}

function extractMoney(value = "") {
  const match = String(value || "").match(/R\$\s?(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?/i);
  return match ? match[0].replace(/^R\$\s?/i, "") : "";
}

function normalizeEmailMessageId(value = "") {
  return String(value || "").trim().replace(/[<>\s]/g, "").slice(0, 240);
}

function defaultCrmEmailOwner(users = [], ownerId = "") {
  const directOwner = users.find((user) => user.id === ownerId);
  if (directOwner) return directOwner;
  if (!EMAIL_CRM_DEFAULT_OWNER_USERNAME) return null;
  return users.find((user) => normalizeUsername(user.username) === EMAIL_CRM_DEFAULT_OWNER_USERNAME) || null;
}

function normalizeUnit(value) {
  const unit = String(value || "")
    .trim()
    .toUpperCase();
  return unitLabels[unit] ? unit : "SPZ";
}

function normalizeEmail(value = "") {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeMoney(value) {
  const text = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

function crmOwnerName(users, ownerId) {
  const user = users.find((item) => item.id === ownerId);
  return user ? cleanText(user.name, "") : "";
}

function normalizeDateInput(value, fallback) {
  const dateText = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : fallback;
}

function normalizeTimeInput(value) {
  const timeText = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(timeText) ? timeText : "";
}

function isTruthy(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

function isAllowedMeetingTime(value) {
  return MEETING_TIME_SLOT_SET.has(value);
}

function dateFromInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function datesBetween(startDate, endDate) {
  const start = dateFromInput(startDate);
  const end = dateFromInput(endDate);
  if (!start || !end || start > end) return [];

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function todayInBusinessTimezone() {
  return toDateInputValue(businessToday());
}

function responseDueDate(priority) {
  return responseDueDateFromDate(priority, businessToday(), responseDeadlineDays);
}

function requestDueDate(priority, requestType) {
  if (requestType === "admin_task") {
    return responseDueDateFromDate(priority, businessToday(), adminTaskDeadlineDays);
  }
  if (requestType === "material_list") {
    return responseDueDateFromDate(priority, businessToday(), materialListDeadlineDays);
  }
  return responseDueDate(priority);
}

function responseDueDateFromDate(priority, baseDate, deadlineDays) {
  const date = new Date(baseDate);
  if (Number.isNaN(date.getTime())) {
    return responseDueDate(priority);
  }
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + (deadlineDays[priority] ?? deadlineDays.media));
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  return toDateInputValue(date);
}

function legacyResponseDueDateFromDate(priority, baseDate) {
  const legacyDays = priority === "alta" ? 1 : responseDeadlineDays[priority] ?? responseDeadlineDays.media;
  const date = businessToday();
  const parsedBaseDate = new Date(baseDate);
  if (!Number.isNaN(parsedBaseDate.getTime())) {
    date.setFullYear(parsedBaseDate.getFullYear(), parsedBaseDate.getMonth(), parsedBaseDate.getDate());
  }
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + legacyDays);
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  return toDateInputValue(date);
}

function businessToday() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12, 0, 0, 0);
  } catch {
    const fallback = new Date();
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  }
}

function sanitizeTaskRequest(request = {}) {
  return {
    title: cleanText(request.title, "Sem titulo"),
    manager: cleanText(request.manager, "Gerente nao informado"),
    department: cleanText(request.department, "Setor nao informado"),
    priority: normalizePriority(request.priority),
    dueDate: cleanText(request.dueDate, ""),
    description: cleanText(request.description, ""),
    response: cleanText(request.response, ""),
    requesterPhone: normalizePhone(request.requesterPhone),
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
    responseAttachments: Array.isArray(request.responseAttachments) ? request.responseAttachments : [],
  };
}

async function sanitizeAttachments(value = []) {
  if (!Array.isArray(value)) return [];

  if (value.length > MAX_ATTACHMENTS_PER_FIELD) {
    const error = new Error(`Envie no maximo ${MAX_ATTACHMENTS_PER_FIELD} anexos por vez.`);
    error.status = 400;
    throw error;
  }

  const attachments = await Promise.all(value.map(async (attachment) => {
    if (attachment?.storagePath && attachment?.url) {
      return {
        id: cleanText(attachment.id, createId("attachment")).replace(/[^a-z0-9_-]/gi, "").slice(0, 80),
        name: cleanText(attachment.name, isPdfMime(attachment.type) ? "documento.pdf" : "imagem").slice(0, 120),
        type: cleanText(attachment.type, "application/octet-stream"),
        size: Number(attachment.size || 0),
        storagePath: cleanText(attachment.storagePath, ""),
        url: cleanText(attachment.url, ""),
        createdAt: cleanText(attachment.createdAt, new Date().toISOString()),
      };
    }

    const dataUrl = String(attachment?.dataUrl || "");
    const type = String(attachment?.type || "");

    if (!dataUrl) {
      return null;
    }

    if (dataUrl.length > MAX_ATTACHMENT_DATA_LENGTH) {
      const error = new Error("Anexo muito grande. Reduza o arquivo e tente novamente.");
      error.status = 400;
      throw error;
    }

    if (!/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,[a-z0-9+/=]+$/i.test(dataUrl)) {
      const error = new Error("Anexo invalido. Envie apenas imagens PNG, JPG, WEBP ou PDF.");
      error.status = 400;
      throw error;
    }

    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) {
      const error = new Error("Anexo invalido. Envie apenas imagens PNG, JPG, WEBP ou PDF.");
      error.status = 400;
      throw error;
    }

    const mimeType = decoded.mimeType;
    const isPdf = mimeType === "application/pdf" || type === "application/pdf";
    const id = cleanText(attachment.id, createId("attachment")).replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
    const extension = attachmentExtension(mimeType);
    const fileName = `${id}.${extension}`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), decoded.buffer);

    return {
      id,
      name: cleanText(attachment.name, isPdf ? "documento.pdf" : "imagem").slice(0, 120),
      type: type.startsWith("image/") || type === "application/pdf" ? type : mimeType,
      size: decoded.buffer.length,
      storagePath: `uploads/${fileName}`,
      url: `/api/attachments/${encodeURIComponent(id)}`,
      createdAt: cleanText(attachment.createdAt, new Date().toISOString()),
    };
  }));

  return attachments.filter(Boolean);
}

function sanitizeSignatureDataUrl(value = "") {
  const dataUrl = String(value || "").trim();
  if (!dataUrl) {
    const error = new Error("Assinatura nao informada.");
    error.status = 400;
    throw error;
  }

  if (dataUrl.length > MAX_ATTACHMENT_DATA_LENGTH) {
    const error = new Error("Assinatura muito grande. Limpe e assine novamente.");
    error.status = 400;
    throw error;
  }

  if (!/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl)) {
    const error = new Error("Assinatura invalida.");
    error.status = 400;
    throw error;
  }

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded || !decoded.mimeType.startsWith("image/")) {
    const error = new Error("Assinatura invalida.");
    error.status = 400;
    throw error;
  }

  return dataUrl;
}

async function createSignedPdfAttachment(documentAttachment, signatureDataUrl, signerName, documentName) {
  const source = await attachmentBuffer(documentAttachment);
  const signature = decodeDataUrl(signatureDataUrl);
  if (!source || !signature) {
    const error = new Error("Nao foi possivel preparar o documento assinado.");
    error.status = 400;
    throw error;
  }

  let pdfDoc;
  const sourceType = String(documentAttachment.type || source.mimeType || "").toLowerCase();
  if (sourceType === "application/pdf") {
    pdfDoc = await PDFDocument.load(source.buffer);
  } else {
    pdfDoc = await imageDocumentToPdf(source.buffer, sourceType);
  }

  const page = pdfDoc.getPages().at(-1);
  const pngSignature = await pdfDoc.embedPng(signature.buffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const stampWidth = Math.min(190, width * 0.34);
  const stampHeight = stampWidth * (pngSignature.height / pngSignature.width);
  const margin = 38;
  const stampX = Math.max(margin, width - stampWidth - margin);
  const stampY = margin + 22;
  const label = `Assinado eletronicamente por ${signerName}`;
  const dateLabel = formatDateTime(new Date().toISOString());

  page.drawText(label, {
    x: stampX,
    y: stampY + stampHeight + 12,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(dateLabel, {
    x: stampX,
    y: stampY + stampHeight,
    size: 8,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawImage(pngSignature, {
    x: stampX,
    y: stampY,
    width: stampWidth,
    height: stampHeight,
  });
  page.drawLine({
    start: { x: stampX, y: stampY - 4 },
    end: { x: stampX + stampWidth, y: stampY - 4 },
    thickness: 0.8,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  return storeGeneratedPdfAttachment(Buffer.from(pdfBytes), signedPdfName(documentName));
}

async function extractSeparationPdfData(pdfAttachment) {
  const source = await attachmentBuffer(pdfAttachment);
  const raw = source?.buffer ? source.buffer.toString("latin1") : "";
  const text = raw
    .replace(/\(([^)]{1,160})\)/g, " $1 ")
    .replace(/\\n|\\r/g, "\n")
    .replace(/[^\x20-\x7EÀ-ÿ\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    customerName: matchPdfField(text, ["cliente", "client", "raz[aã]o social"]),
    budgetNumber: matchPdfField(text, ["or[cç]amento", "orcamento", "pedido", "numero"]),
    totalValue: matchPdfMoney(text),
    products: extractPdfProducts(text),
    observations: matchPdfField(text, ["observa[cç][aã]o", "observacoes", "obs"]),
  };
}

function matchPdfField(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:#-]?\\s*([^|;\\n]{2,90})`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return cleanText(match[1], "").slice(0, 120);
  }
  return "";
}

function matchPdfMoney(text) {
  const matches = String(text || "").match(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})/g);
  return matches?.at(-1) || "";
}

function extractPdfProducts(text) {
  const matches = [...String(text || "").matchAll(/(?:cod(?:igo)?\.?\s*)?([A-Z0-9.-]{3,18})\s+(.{8,80}?)\s+(?:qtd\.?\s*)?(\d{1,5})(?:\s|$)/gi)];
  return matches.slice(0, 80).map((match) => ({
    code: cleanText(match[1], ""),
    description: cleanText(match[2], "").slice(0, 120),
    quantity: cleanText(match[3], "1"),
  }));
}

async function imageDocumentToPdf(buffer, mimeType) {
  const pdfDoc = await PDFDocument.create();
  let image;
  if (mimeType === "image/png") {
    image = await pdfDoc.embedPng(buffer);
  } else if (["image/jpeg", "image/jpg"].includes(mimeType)) {
    image = await pdfDoc.embedJpg(buffer);
  } else {
    const error = new Error("Para assinar imagem, use PNG ou JPG.");
    error.status = 400;
    throw error;
  }

  const maxWidth = 595.28;
  const maxHeight = 841.89;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  const page = pdfDoc.addPage([maxWidth, maxHeight]);
  page.drawImage(image, {
    x: (maxWidth - width) / 2,
    y: (maxHeight - height) / 2,
    width,
    height,
  });
  return pdfDoc;
}

async function attachmentBuffer(attachment) {
  if (attachment?.storagePath) {
    const filePath = path.resolve(DATA_DIR, attachment.storagePath);
    const allowedRoot = path.resolve(UPLOAD_DIR);
    if (filePath !== allowedRoot && !filePath.startsWith(`${allowedRoot}${path.sep}`)) return null;
    const buffer = await fs.readFile(filePath).catch(() => null);
    return buffer ? { buffer, mimeType: attachment.type } : null;
  }

  if (attachment?.dataUrl) {
    return decodeDataUrl(attachment.dataUrl);
  }

  return null;
}

async function storeGeneratedPdfAttachment(buffer, displayName) {
  const id = createId("attachment");
  const fileName = `${id}.pdf`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return {
    id,
    name: displayName,
    type: "application/pdf",
    size: buffer.length,
    storagePath: `uploads/${fileName}`,
    url: `/api/attachments/${encodeURIComponent(id)}`,
    createdAt: new Date().toISOString(),
  };
}

function signedPdfName(documentName) {
  const baseName = cleanText(documentName, "documento").replace(/\.[a-z0-9]+$/i, "").slice(0, 90);
  return `${baseName || "documento"} - assinado.pdf`;
}

async function createHiringDecisionPdfAttachment(hiring, decision, decisionNote, decidedAt) {
  const source = await attachmentBuffer(hiring.resumeAttachment);
  if (!source) {
    const error = new Error("Nao foi possivel ler o curriculo.");
    error.status = 400;
    throw error;
  }

  const sourceType = String(hiring.resumeAttachment.type || source.mimeType || "").toLowerCase();
  const pdfDoc = sourceType === "application/pdf"
    ? await PDFDocument.load(source.buffer)
    : await imageDocumentToPdf(source.buffer, sourceType);
  const page = pdfDoc.getPages().at(-1);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const decisionText = decision === "approved" ? "APROVADO POR ALCI JR." : "REPROVADO POR ALCI JR.";
  const decisionLabel = decision === "approved" ? "Aprovado" : "Reprovado";
  const stampWidth = Math.min(250, width * 0.42);
  const stampX = Math.max(36, width - stampWidth - 36);
  const stampY = 44;

  page.drawRectangle({
    x: stampX - 10,
    y: stampY - 12,
    width: stampWidth + 20,
    height: 92,
    borderWidth: 1.2,
    borderColor: rgb(0, 0, 0),
    color: rgb(1, 1, 1),
    opacity: 0.92,
  });
  page.drawText(decisionText, {
    x: stampX,
    y: stampY + 52,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  page.drawText(`Data: ${formatDateTime(decidedAt)}`, {
    x: stampX,
    y: stampY + 36,
    size: 8.5,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(`Funcao: ${truncateForPdf(hiring.targetRole, 34)}`, {
    x: stampX,
    y: stampY + 22,
    size: 8.5,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(`Salario: ${truncateForPdf(hiring.promisedSalary, 32)}`, {
    x: stampX,
    y: stampY + 8,
    size: 8.5,
    font,
    color: rgb(0, 0, 0),
  });

  if (decisionNote) {
    const notePage = pdfDoc.addPage([595.28, 841.89]);
    drawHiringDecisionSummary(notePage, font, boldFont, hiring, decisionLabel, decisionNote, decidedAt);
  }

  const pdfBytes = await pdfDoc.save();
  return storeGeneratedPdfAttachment(Buffer.from(pdfBytes), hiringDecisionPdfName(hiring.candidateName, decisionLabel));
}

function drawHiringDecisionSummary(page, font, boldFont, hiring, decisionLabel, decisionNote, decidedAt) {
  const left = 52;
  let y = 780;
  page.drawText(`Contratacao ${decisionLabel} por ALCI JR.`, {
    x: left,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 34;

  const rows = [
    ["Candidato", hiring.candidateName],
    ["Funcao", hiring.targetRole],
    ["Salario inicial prometido", hiring.promisedSalary],
    ["Vinculo no grupo", hiring.relationshipInsideGroup === "sim" ? "Sim" : "Nao"],
    ["Data da decisao", formatDateTime(decidedAt)],
  ];

  rows.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: left, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText(truncateForPdf(value, 72), { x: left + 150, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 20;
  });

  y -= 10;
  page.drawText("Observacao da decisao:", { x: left, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  wrapPdfText(decisionNote, 88).slice(0, 22).forEach((line) => {
    page.drawText(line, { x: left, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 15;
  });
}

function hiringDecisionPdfName(candidateName, decisionLabel) {
  const baseName = cleanText(candidateName, "candidato").replace(/\.[a-z0-9]+$/i, "").slice(0, 70);
  return `${baseName || "candidato"} - ${decisionLabel.toLowerCase()} por ALCI JR.pdf`;
}

async function createDismissalDecisionPdfAttachment(dismissal, decision, decisionNote, decidedAt) {
  const source = await attachmentBuffer(dismissal.documentAttachment);
  if (!source) {
    const error = new Error("Nao foi possivel ler o documento da demissao.");
    error.status = 400;
    throw error;
  }

  const sourceType = String(dismissal.documentAttachment.type || source.mimeType || "").toLowerCase();
  const pdfDoc = sourceType === "application/pdf"
    ? await PDFDocument.load(source.buffer)
    : await imageDocumentToPdf(source.buffer, sourceType);
  const page = pdfDoc.getPages().at(-1);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const decisionText = decision === "approved" ? "DEMISSAO APROVADA POR ALCI JR." : "DEMISSAO REPROVADA POR ALCI JR.";
  const decisionLabel = decision === "approved" ? "Aprovada" : "Reprovada";
  const stampWidth = Math.min(275, width * 0.46);
  const stampX = Math.max(36, width - stampWidth - 36);
  const stampY = 44;

  page.drawRectangle({
    x: stampX - 10,
    y: stampY - 12,
    width: stampWidth + 20,
    height: 92,
    borderWidth: 1.2,
    borderColor: rgb(0, 0, 0),
    color: rgb(1, 1, 1),
    opacity: 0.92,
  });
  page.drawText(decisionText, { x: stampX, y: stampY + 52, size: 10.5, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(`Data: ${formatDateTime(decidedAt)}`, { x: stampX, y: stampY + 36, size: 8.5, font, color: rgb(0, 0, 0) });
  page.drawText(`Funcao: ${truncateForPdf(dismissal.currentRole, 34)}`, { x: stampX, y: stampY + 22, size: 8.5, font, color: rgb(0, 0, 0) });
  page.drawText(`Colaborador: ${truncateForPdf(dismissal.employeeName, 30)}`, { x: stampX, y: stampY + 8, size: 8.5, font, color: rgb(0, 0, 0) });

  if (decisionNote) {
    const notePage = pdfDoc.addPage([595.28, 841.89]);
    drawDismissalDecisionSummary(notePage, font, boldFont, dismissal, decisionLabel, decisionNote, decidedAt);
  }

  const pdfBytes = await pdfDoc.save();
  return storeGeneratedPdfAttachment(Buffer.from(pdfBytes), dismissalDecisionPdfName(dismissal.employeeName, decisionLabel));
}

function drawDismissalDecisionSummary(page, font, boldFont, dismissal, decisionLabel, decisionNote, decidedAt) {
  const left = 52;
  let y = 780;
  page.drawText(`Demissao ${decisionLabel} por ALCI JR.`, { x: left, y, size: 18, font: boldFont, color: rgb(0, 0, 0) });
  y -= 34;

  [
    ["Colaborador", dismissal.employeeName],
    ["Funcao", dismissal.currentRole],
    ["Salario atual", dismissal.currentSalary],
    ["Data da decisao", formatDateTime(decidedAt)],
  ].forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: left, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText(truncateForPdf(value, 72), { x: left + 150, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 20;
  });

  y -= 10;
  page.drawText("Observacao da decisao:", { x: left, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  wrapPdfText(decisionNote, 88).slice(0, 22).forEach((line) => {
    page.drawText(line, { x: left, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 15;
  });
}

function dismissalDecisionPdfName(employeeName, decisionLabel) {
  const baseName = cleanText(employeeName, "colaborador").replace(/\.[a-z0-9]+$/i, "").slice(0, 70);
  return `${baseName || "colaborador"} - demissao ${decisionLabel.toLowerCase()} por ALCI JR.pdf`;
}

function truncateForPdf(value = "", maxLength = 72) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function wrapPdfText(value = "", maxLength = 88) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function storeUploadedAttachments(files = []) {
  if (!Array.isArray(files)) return [];
  if (files.length > MAX_ATTACHMENTS_PER_FIELD) {
    const error = new Error(`Envie no maximo ${MAX_ATTACHMENTS_PER_FIELD} anexos por vez.`);
    error.status = 400;
    throw error;
  }

  return Promise.all(files.map(storeUploadedAttachment));
}

async function storeUploadedAttachment(file) {
  const originalName = cleanText(file.fileName, "anexo").slice(0, 120);
  const detectedMimeType = detectAttachmentMimeType(file.buffer, file.contentType, originalName);
  if (!detectedMimeType) {
    const error = new Error("Anexo invalido. Envie apenas imagens PNG, JPG, WEBP ou PDF.");
    error.status = 400;
    throw error;
  }

  const maxBytes = detectedMimeType === "application/pdf" ? MAX_PDF_ATTACHMENT_BYTES : MAX_FILE_ATTACHMENT_BYTES;
  if (file.buffer.length > maxBytes) {
    const sizeMb = Math.floor(maxBytes / 1024 / 1024);
    const error = new Error(`Anexo muito grande. Envie arquivos de ate ${sizeMb} MB.`);
    error.status = 400;
    throw error;
  }

  const id = createId("attachment");
  const extension = attachmentExtension(detectedMimeType);
  const fileName = `${id}.${extension}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), file.buffer);

  return {
    id,
    name: originalName || (detectedMimeType === "application/pdf" ? "documento.pdf" : "imagem"),
    type: detectedMimeType,
    size: file.buffer.length,
    storagePath: `uploads/${fileName}`,
    url: `/api/attachments/${encodeURIComponent(id)}`,
    createdAt: new Date().toISOString(),
  };
}

async function migrateLegacyAttachments(requests) {
  let migrated = false;

  for (const taskRequest of requests) {
    for (const field of ["attachments", "responseAttachments"]) {
      const attachments = Array.isArray(taskRequest[field]) ? taskRequest[field] : [];

      for (const attachment of attachments) {
        if (!attachment?.dataUrl || attachment.storagePath) continue;

        const stored = await storeAttachmentDataUrl(attachment);
        Object.assign(attachment, stored);
        delete attachment.dataUrl;
        migrated = true;
      }
    }
  }

  return migrated;
}

function migrateHighPriorityDueDates(requests) {
  let migrated = false;

  for (const taskRequest of requests) {
    if (taskRequest.priority !== "alta") continue;
    if (taskRequest.type && taskRequest.type !== "manager_request") continue;

    const createdAt = taskRequest.createdAt || taskRequest.updatedAt || new Date().toISOString();
    const legacyDueDate = legacyResponseDueDateFromDate("alta", createdAt);
    const newDueDate = responseDueDateFromDate("alta", createdAt, responseDeadlineDays);

    const shouldUpdate =
      taskRequest.dueDate !== newDueDate &&
      (taskRequest.dueDate === legacyDueDate || String(taskRequest.dueDate || "") < newDueDate);
    if (!shouldUpdate) continue;

    taskRequest.dueDate = newDueDate;
    taskRequest.updatedAt = new Date().toISOString();
    taskRequest.history = Array.isArray(taskRequest.history) ? taskRequest.history : [];
    if (!taskRequest.history.some((entry) => String(entry).includes("Prazo Alta atualizado para 48 horas"))) {
      taskRequest.history.push(`Prazo Alta atualizado para 48 horas em ${formatDateTime(taskRequest.updatedAt)}`);
    }
    migrated = true;
  }

  return migrated;
}

function ensureMeetingSchedule(meetings) {
  const now = new Date().toISOString();
  let updated = false;

  for (const meeting of meetings) {
    if (meeting.status === "available" && !isAllowedMeetingTime(meeting.time)) {
      meeting.status = "blocked";
      meeting.adminNote = meeting.adminNote || "Horario fora da agenda padrao";
      meeting.updatedAt = now;
      updated = true;
    }
  }

  const existingKeys = new Set(meetings.map((meeting) => `${meeting.date}|${meeting.time}`));
  const start = businessToday();
  for (let dayOffset = 0; dayOffset < MEETING_SLOT_HORIZON_DAYS; dayOffset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + dayOffset);
    const dateValue = toDateInputValue(date);

    for (const time of MEETING_TIME_SLOTS) {
      const key = `${dateValue}|${time}`;
      if (existingKeys.has(key)) continue;

      meetings.push({
        id: createId("meeting"),
        date: dateValue,
        time,
        status: "available",
        adminNote: "Horario disponivel",
        topic: "",
        agenda: "",
        bookedBy: "",
        bookedByName: "",
        bookedByDepartment: "",
        bookedByUnit: "",
        createdBy: "system",
        createdAt: now,
        updatedAt: now,
        bookedAt: "",
      });
      existingKeys.add(key);
      updated = true;
    }
  }

  return updated;
}

async function storeAttachmentDataUrl(attachment) {
  const dataUrl = String(attachment?.dataUrl || "");

  if (dataUrl.length > MAX_ATTACHMENT_DATA_LENGTH) {
    const error = new Error("Anexo muito grande. Reduza o arquivo e tente novamente.");
    error.status = 400;
    throw error;
  }

  if (!/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,[a-z0-9+/=]+$/i.test(dataUrl)) {
    const error = new Error("Anexo invalido. Envie apenas imagens PNG, JPG, WEBP ou PDF.");
    error.status = 400;
    throw error;
  }

  const type = String(attachment?.type || "");
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) {
    const error = new Error("Anexo invalido. Envie apenas imagens PNG, JPG, WEBP ou PDF.");
    error.status = 400;
    throw error;
  }

  const mimeType = decoded.mimeType;
  const isPdf = mimeType === "application/pdf" || type === "application/pdf";
  const id = cleanText(attachment.id, createId("attachment")).replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  const extension = attachmentExtension(mimeType);
  const fileName = `${id}.${extension}`;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), decoded.buffer);

  return {
    id,
    name: cleanText(attachment.name, isPdf ? "documento.pdf" : "imagem").slice(0, 120),
    type: type.startsWith("image/") || type === "application/pdf" ? type : mimeType,
    size: decoded.buffer.length,
    storagePath: `uploads/${fileName}`,
    url: `/api/attachments/${encodeURIComponent(id)}`,
    createdAt: cleanText(attachment.createdAt, new Date().toISOString()),
  };
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:(image\/(?:png|jpe?g|webp)|application\/pdf);base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function detectAttachmentMimeType(buffer, contentType = "", fileName = "") {
  const type = String(contentType || "").toLowerCase().split(";")[0].trim();
  const lowerName = String(fileName || "").toLowerCase();

  if (buffer.slice(0, 5).toString("utf8") === "%PDF-") return "application/pdf";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.slice(1, 4).toString("ascii") === "PNG") return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  if (type === "application/pdf" && lowerName.endsWith(".pdf")) return "application/pdf";
  if (["image/png", "image/jpeg", "image/webp"].includes(type)) return type;
  return "";
}

function attachmentExtension(mimeType) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function findAttachmentRecord(requests, currentUser, attachmentId) {
  for (const taskRequest of requests) {
    if (!canViewRequestAttachment(taskRequest, currentUser)) continue;

    const attachments = [
      ...(Array.isArray(taskRequest.attachments) ? taskRequest.attachments : []),
      ...(Array.isArray(taskRequest.responseAttachments) ? taskRequest.responseAttachments : []),
    ];
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { request: taskRequest, attachment };
  }

  return null;
}

function findCrmAttachmentRecord(opportunities, attachmentId) {
  for (const opportunity of opportunities) {
    const attachments = Array.isArray(opportunity.attachments) ? opportunity.attachments : [];
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { opportunity, attachment };
  }

  return null;
}

function findVisibleCrmAttachmentRecord(opportunities, currentUser, attachmentId) {
  for (const opportunity of opportunities) {
    if (!canViewCrmOpportunity(opportunity, currentUser)) continue;
    const attachments = Array.isArray(opportunity.attachments) ? opportunity.attachments : [];
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { opportunity, attachment };
  }

  return null;
}

function findSignatureAttachmentRecord(signatureRecords, currentUser, attachmentId) {
  if (currentUser.role !== "admin") return null;

  for (const signature of signatureRecords) {
    const attachments = [signature.documentAttachment, signature.signedAttachment].filter(Boolean);
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { signature, attachment };
  }

  return null;
}

function findVisibleHiringAttachmentRecord(hiringRequests, currentUser, attachmentId) {
  for (const hiring of hiringRequests) {
    if (!canViewHiringRequest(hiring, currentUser)) continue;
    const attachments = [hiring.resumeAttachment, hiring.decisionAttachment].filter(Boolean);
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { hiring, attachment };
  }

  return null;
}

function findVisibleDismissalAttachmentRecord(dismissalRequests, currentUser, attachmentId) {
  for (const dismissal of dismissalRequests) {
    if (!canViewDismissalRequest(dismissal, currentUser)) continue;
    const attachments = [dismissal.documentAttachment, dismissal.decisionAttachment].filter(Boolean);
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { dismissal, attachment };
  }

  return null;
}

function findVisibleSeparationAttachmentRecord(separationRequests, currentUser, attachmentId) {
  for (const separation of separationRequests) {
    if (!canViewSeparationRequest(separation, currentUser)) continue;
    const attachments = [separation.pdfAttachment, separation.invoiceAttachment].filter(Boolean);
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { separation, attachment };
  }
  return null;
}

function canViewCrmOpportunity(opportunity, currentUser) {
  if (currentUser.role === "admin") return true;
  return currentUser.role === "seller" && opportunity.ownerId === currentUser.id;
}

function canEditCrmOpportunity(opportunity, currentUser) {
  return canViewCrmOpportunity(opportunity, currentUser);
}

function canViewRequestAttachment(taskRequest, currentUser) {
  if (currentUser.role === "admin") return true;
  return taskRequest.createdBy === currentUser.id || taskRequest.assigneeId === currentUser.id;
}

function isPdfMime(type) {
  return String(type || "").toLowerCase() === "application/pdf";
}

function isPdfOrImageAttachment(attachment) {
  const type = String(attachment?.type || "").toLowerCase();
  return type === "application/pdf" || type.startsWith("image/");
}

function encodeHeaderFileName(fileName) {
  return String(fileName).replace(/["\r\n]/g, "_");
}

async function deleteStoredAttachments(taskRequest) {
  const attachments = [
    ...(Array.isArray(taskRequest?.attachments) ? taskRequest.attachments : []),
    ...(Array.isArray(taskRequest?.responseAttachments) ? taskRequest.responseAttachments : []),
    ...(taskRequest?.documentAttachment ? [taskRequest.documentAttachment] : []),
    ...(taskRequest?.signedAttachment ? [taskRequest.signedAttachment] : []),
    ...(taskRequest?.resumeAttachment ? [taskRequest.resumeAttachment] : []),
    ...(taskRequest?.decisionAttachment ? [taskRequest.decisionAttachment] : []),
    ...(taskRequest?.pdfAttachment ? [taskRequest.pdfAttachment] : []),
    ...(taskRequest?.invoiceAttachment ? [taskRequest.invoiceAttachment] : []),
  ];
  const allowedRoot = path.resolve(UPLOAD_DIR);

  await Promise.all(attachments.map(async (attachment) => {
    if (!attachment.storagePath) return;

    const filePath = path.resolve(DATA_DIR, attachment.storagePath);
    if (filePath !== allowedRoot && !filePath.startsWith(`${allowedRoot}${path.sep}`)) return;
    await fs.unlink(filePath).catch(() => null);
  }));
}

function sortRequests(items) {
  return [...items].sort((left, right) => {
    const priorityDiff =
      (priorityWeight[left.priority] || 99) - (priorityWeight[right.priority] || 99);
    if (priorityDiff !== 0) return priorityDiff;

    const createdDiff = new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    if (createdDiff !== 0) return createdDiff;

    return String(right.id || "").localeCompare(String(left.id || ""));
  });
}

function sortSeparationRequests(items = []) {
  return [...items].sort((left, right) => {
    const priorityDiff = (priorityWeight[left.priority] || 99) - (priorityWeight[right.priority] || 99);
    if (priorityDiff !== 0) return priorityDiff;
    const dateDiff = new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    if (dateDiff !== 0) return dateDiff;
    return String(right.id || "").localeCompare(String(left.id || ""));
  });
}

function sortCrmOpportunities(items = []) {
  const statusWeight = {
    novo: 1,
    atendimento: 2,
    negociacao: 3,
    fechado: 4,
    perdido: 5,
  };

  return [...items].sort((left, right) => {
    const statusDiff = (statusWeight[left.status] || 99) - (statusWeight[right.status] || 99);
    if (statusDiff !== 0) return statusDiff;

    const updatedDiff = new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    if (updatedDiff !== 0) return updatedDiff;

    return String(right.id || "").localeCompare(String(left.id || ""));
  });
}

function sortSignatureRecords(items = []) {
  return [...items].sort((left, right) => {
    const dateDiff = new Date(right.signedAt || right.createdAt || 0) - new Date(left.signedAt || left.createdAt || 0);
    if (dateDiff !== 0) return dateDiff;

    return String(right.id || "").localeCompare(String(left.id || ""));
  });
}

function sortHiringRequests(items = []) {
  const statusWeight = {
    pendente: 1,
    aprovada: 2,
    reprovada: 3,
  };

  return [...items].sort((left, right) => {
    const statusDiff = (statusWeight[left.status] || 99) - (statusWeight[right.status] || 99);
    if (statusDiff !== 0) return statusDiff;

    const updatedDiff = new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    if (updatedDiff !== 0) return updatedDiff;

    return String(right.id || "").localeCompare(String(left.id || ""));
  });
}

function visibleCrmOpportunities(items = [], currentUser) {
  return sortCrmOpportunities(items.filter((opportunity) => canViewCrmOpportunity(opportunity, currentUser)));
}

function visibleSeparationRequests(items = [], currentUser) {
  return sortSeparationRequests(items.filter((separation) => canViewSeparationRequest(separation, currentUser)));
}

function canViewSeparationRequest(separation, currentUser) {
  if (["admin", "director", "manager"].includes(currentUser.role)) return true;
  if (separation.sellerId === currentUser.id) return true;
  return separation.assignedUserId === currentUser.id || separation.assignedRole === currentUser.role;
}

function canEditSeparationRequest(separation, currentUser) {
  if (["admin", "director", "manager"].includes(currentUser.role)) return true;
  return separation.assignedUserId === currentUser.id || separation.assignedRole === currentUser.role;
}

function visibleHiringRequests(items = [], currentUser) {
  return sortHiringRequests(items.filter((hiring) => canViewHiringRequest(hiring, currentUser)));
}

function canViewHiringRequest(hiring, currentUser) {
  if (currentUser.role === "admin") return true;
  return hiring.createdBy === currentUser.id;
}

function sortDismissalRequests(items = []) {
  const statusWeight = {
    pendente: 1,
    aprovada: 2,
    reprovada: 3,
  };

  return [...items].sort((left, right) => {
    const statusDiff = (statusWeight[left.status] || 99) - (statusWeight[right.status] || 99);
    if (statusDiff !== 0) return statusDiff;

    const updatedDiff = new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    if (updatedDiff !== 0) return updatedDiff;

    return String(right.id || "").localeCompare(String(left.id || ""));
  });
}

function visibleDismissalRequests(items = [], currentUser) {
  return sortDismissalRequests(items.filter((dismissal) => canViewDismissalRequest(dismissal, currentUser)));
}

function canViewDismissalRequest(dismissal, currentUser) {
  if (currentUser.role === "admin") return true;
  return dismissal.createdBy === currentUser.id;
}

function sortPersonalTasks(items) {
  return [...items].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "pendente" ? -1 : 1;
    }

    if (left.status === "pendente") {
      const dueDiff = String(left.dueDate || "").localeCompare(String(right.dueDate || ""));
      if (dueDiff !== 0) return dueDiff;
    }

    const updatedDiff = new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    if (updatedDiff !== 0) return updatedDiff;

    return String(right.id || "").localeCompare(String(left.id || ""));
  });
}

function visibleMeetings(items, currentUser) {
  const meetings = Array.isArray(items) ? items : [];
  if (currentUser.role === "admin") return sortMeetings(meetings);

  return sortMeetings(
    meetings.filter(
      (meeting) => (meeting.status === "available" && isAllowedMeetingTime(meeting.time)) || meeting.bookedBy === currentUser.id,
    ),
  );
}

function sortMeetings(items) {
  return [...items].sort((left, right) => {
    const dateDiff = String(left.date || "").localeCompare(String(right.date || ""));
    if (dateDiff !== 0) return dateDiff;

    const timeDiff = String(left.time || "").localeCompare(String(right.time || ""));
    if (timeDiff !== 0) return timeDiff;

    return String(left.id || "").localeCompare(String(right.id || ""));
  });
}

function visibleRequestsForUser(items, currentUser) {
  return sortRequests(
    items.filter(
      (request) =>
        request.createdBy === currentUser.id ||
        request.assigneeId === currentUser.id ||
        (!request.assigneeId && currentUser.role === "admin"),
    ),
  );
}

function firstSeparationRoleForType(type) {
  if (type === "balcao") return "counter_lead";
  return "team_lead";
}

function nextSeparationAssignedRole(status, fallbackRole = "team_lead") {
  if (["aguardando_separacao", "em_separacao", "com_falta", "aguardando_transferencia"].includes(status)) return "separator";
  if (["separado", "em_conferencia"].includes(status)) return "checker";
  if (["conferido", "embalado", "lacrado", "material_pronto", "aguardando_nf", "aguardando_localizacao", "entrega_programada"].includes(status)) return "team_lead";
  if (["em_rota", "entregue"].includes(status)) return "deliverer";
  return fallbackRole;
}

function separationHistoryEntry(user, createdAt, action, previousStatus, nextStatus, comment) {
  return {
    id: createId("history"),
    userId: user?.id || "",
    userName: cleanText(user?.name, "Sistema"),
    createdAt,
    action,
    previousStatus,
    nextStatus,
    comment,
  };
}

function separationNotificationTitle(status) {
  return {
    separado: "Material separado",
    conferido: "Material conferido",
    com_falta: "Falta identificada",
    entrega_programada: "Entrega programada",
    entregue: "Entrega concluída",
  }[status] || "Separação atualizada";
}

function validateSeparationDelivery(previous, nextStatus, payload) {
  if (nextStatus !== "entrega_programada" && nextStatus !== "em_rota") return "";
  if (!["conferido", "embalado", "lacrado", "material_pronto", "aguardando_nf", "aguardando_localizacao", "entrega_programada"].includes(previous.status)) {
    return "Para liberar entrega, o material precisa estar conferido.";
  }
  if (!["lacrado", "material_pronto", "aguardando_nf", "aguardando_localizacao", "entrega_programada"].includes(previous.status)) {
    return "Para liberar entrega, o material precisa estar lacrado.";
  }
  if (!payload.invoiceAttachment) return "Anexe a NF antes de programar entrega.";
  if (!payload.location) return "Informe a localização antes de programar entrega.";
  if (!payload.deliveryAt) return "Informe horário válido de entrega.";
  if (!isDeliveryAtLeastThreeHours(previous.createdAt, payload.deliveryAt)) {
    return "Entrega precisa respeitar mínimo de 3 horas após a solicitação.";
  }
  return "";
}

function isDeliveryAtLeastThreeHours(createdAt, deliveryAt) {
  const created = new Date(createdAt);
  const delivery = new Date(deliveryAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(delivery.getTime())) return false;
  return delivery.getTime() - created.getTime() >= 3 * 60 * 60 * 1000;
}

function daysBetweenIso(startIso, endIso) {
  const start = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 999;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function addInternalNotification(data, separation, title, targetRoles = []) {
  data.internalNotifications = Array.isArray(data.internalNotifications) ? data.internalNotifications : [];
  data.internalNotifications.unshift({
    id: createId("notification"),
    title,
    separationId: separation.id,
    targetRoles,
    sellerId: separation.sellerId,
    createdAt: new Date().toISOString(),
    readBy: [],
  });
  data.internalNotifications = data.internalNotifications.slice(0, 500);
}

function visibleInternalNotifications(items = [], currentUser) {
  return items.filter((notification) => {
    if (["admin", "director", "manager"].includes(currentUser.role)) return true;
    if (notification.sellerId === currentUser.id) return true;
    return Array.isArray(notification.targetRoles) && notification.targetRoles.includes(currentUser.role);
  }).slice(0, 80);
}

function canRespondToRequest(request, currentUser) {
  if (currentUser.role === "admin") return !request.assigneeId || request.type === "manager_request";
  return request.assigneeId === currentUser.id;
}

function resolveRequestAssignee(users, assigneeId, requestType, currentUser) {
  if (requestType === "admin_task") {
    return users.find((user) => user.id === assigneeId && user.role === "manager") || null;
  }

  if (requestType === "material_list") {
    const selectedEngineer = users.find((user) => user.id === assigneeId && user.role === "engineer") || null;
    if (currentUser?.role === "admin") {
      return selectedEngineer;
    }

    return (
      selectedEngineer ||
      users.find((user) => user.role === "engineer" && normalizeUsername(user.username) === "paulo") ||
      users.find((user) => user.role === "engineer" && String(user.name || "").toLowerCase().includes("paulo")) ||
      users.find((user) => user.role === "engineer") ||
      null
    );
  }

  return null;
}

function cleanText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function buildWhatsAppMessage(request) {
  const attachmentCount = Array.isArray(request.attachments) ? request.attachments.length : 0;
  return [
    "Nova solicitacao recebida - Eletro Ativa",
    "",
    `Titulo: ${request.title}`,
    `Gerente/Loja: ${request.manager}`,
    `Setor: ${request.department}`,
    `Prioridade: ${priorityLabels[request.priority] || request.priority}`,
    `Prazo de resposta: ${formatDate(request.dueDate)}`,
    "",
    `Descricao: ${request.description}`,
    attachmentCount > 0 ? `Anexos no app: ${attachmentCount} anexo${attachmentCount === 1 ? "" : "s"}` : "",
  ].join("\n");
}

function buildRequesterResponseMessage(request) {
  const attachmentCount = Array.isArray(request.responseAttachments) ? request.responseAttachments.length : 0;
  return [
    "Resposta da sua solicitacao - Eletro Ativa",
    "",
    `Titulo: ${request.title}`,
    "Status: Resolvida",
    "",
    `Resposta: ${request.response}`,
    attachmentCount > 0 ? `Anexos da resposta no app: ${attachmentCount} anexo${attachmentCount === 1 ? "" : "s"}` : "",
  ].join("\n");
}

function formatDate(value) {
  if (!value || !value.includes("-")) return "Nao informado";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readWhatsAppConfig(to, toLabel) {
  const config = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    to: normalizePhone(to),
  };
  const missing = [];

  if (!config.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!config.to) missing.push(toLabel);

  return {
    ...config,
    missing,
    ready: missing.length === 0,
  };
}

function logWhatsAppResult(target, result) {
  const messageId = result.data?.messages?.[0]?.id || "sem-id";
  const status = result.data?.messages?.[0]?.message_status || "sem-status";
  const error =
    result.data?.error?.error_data?.details ||
    result.data?.error?.message ||
    result.error ||
    "";

  process.stdout.write(
    `[whatsapp:${target}] http=${result.status || "erro"} sent=${result.sent} status=${status} id=${messageId}${
      error ? ` erro=${error}` : ""
    }\n`,
  );
}

async function sendWhatsAppText(config, message) {
  if (typeof fetch !== "function") {
    return { ok: false, sent: false, error: "Node.js sem fetch nativo" };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: config.to,
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  };

  const apiResponse = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await apiResponse.json().catch(() => ({}));

  return {
    ok: apiResponse.ok,
    sent: apiResponse.ok,
    configured: true,
    status: apiResponse.status,
    data,
  };
}

async function serveStaticFile(urlPathname, request, response) {
  const safePath = path
    .normalize(decodeURIComponent(urlPathname))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]/, "");
  const requestedPath = safePath || "index.html";

  if (
    requestedPath === "whatsapp.env" ||
    requestedPath === "app-data.json" ||
    requestedPath.startsWith("data/")
  ) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  const filePath = path.join(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  const file = await fs.readFile(filePath).catch(() => null);
  if (!file) {
    response.writeHead(404);
    response.end("Arquivo nao encontrado");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(file);
}

async function readRequestBody(request) {
  const contentType = String(request.headers["content-type"] || "");
  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    return readMultipartBody(request, contentType);
  }
  return readJsonBody(request);
}

async function readJsonBody(request) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > MAX_JSON_BODY_BYTES) {
      const error = new Error("Payload muito grande");
      error.status = 413;
      throw error;
    }
  }

  return raw ? JSON.parse(raw) : {};
}

async function readMultipartBody(request, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) {
    const error = new Error("Formulario invalido.");
    error.status = 400;
    throw error;
  }

  const raw = await readRawBody(request, MAX_JSON_BODY_BYTES);
  const { fields, files } = parseMultipartBuffer(raw, boundary);
  return {
    ...fields,
    attachments: await storeUploadedAttachments(files.attachments || []),
    responseAttachments: await storeUploadedAttachments(files.responseAttachments || []),
    crmAttachments: await storeUploadedAttachments(files.crmAttachments || []),
    signatureDocument: await storeUploadedAttachments(files.signatureDocument || []),
    hiringResume: await storeUploadedAttachments(files.hiringResume || []),
    dismissalDocument: await storeUploadedAttachments(files.dismissalDocument || []),
    separationPdf: await storeUploadedAttachments(files.separationPdf || []),
    separationInvoice: await storeUploadedAttachments(files.separationInvoice || []),
  };
}

async function readRawBody(request, limitBytes) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limitBytes) {
      const error = new Error("Payload muito grande");
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, total);
}

function parseMultipartBuffer(raw, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const fields = {};
  const files = {};
  let position = raw.indexOf(boundaryBuffer);

  while (position !== -1) {
    position += boundaryBuffer.length;
    if (raw.slice(position, position + 2).toString("ascii") === "--") break;
    if (raw[position] === 13 && raw[position + 1] === 10) position += 2;

    const headerEnd = raw.indexOf(headerSeparator, position);
    if (headerEnd === -1) break;

    const headerText = raw.slice(position, headerEnd).toString("utf8");
    const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1] || "";
    const fileName = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
    const contentType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
    const contentStart = headerEnd + headerSeparator.length;
    const nextBoundary = raw.indexOf(boundaryBuffer, contentStart);
    if (nextBoundary === -1) break;

    let contentEnd = nextBoundary;
    if (raw[contentEnd - 2] === 13 && raw[contentEnd - 1] === 10) {
      contentEnd -= 2;
    }
    const content = raw.slice(contentStart, contentEnd);

    if (name && fileName) {
      files[name] = files[name] || [];
      files[name].push({ fieldName: name, fileName, contentType, buffer: content });
    } else if (name) {
      fields[name] = content.toString("utf8");
    }

    position = nextBoundary;
  }

  return { fields, files };
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, "whatsapp.env");
  if (!fsSync.existsSync(envPath)) return;

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;

    const [key, ...valueParts] = trimmed.split("=");
    if (!key || process.env[key]) return;
    process.env[key] = valueParts.join("=").trim();
  });
}
