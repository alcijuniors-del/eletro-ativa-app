const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

loadLocalEnv();

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const SESSION_COOKIE = "ea_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const ADMIN_USERNAME = normalizeUsername(process.env.ADMIN_USERNAME || "admin");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || "America/Cuiaba";
const MAX_JSON_BODY_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_FIELD = 5;
const MAX_ATTACHMENT_DATA_LENGTH = 6 * 1024 * 1024;

const sessions = new Map();

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
  alta: "Alta - 24 horas",
  media: "Media - 3 dias",
  baixa: "Baixa - 7 dias",
};

const unitLabels = {
  SPZ: "SPZ",
  CNP: "CNP",
  CORP: "CORP",
};

const responseDeadlineDays = {
  alta: 1,
  media: 3,
  baixa: 7,
};

const priorityWeight = {
  alta: 1,
  media: 2,
  baixa: 3,
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

  const data = await readData();
  const currentUser = getCurrentUser(request, data);

  if (!currentUser) {
    sendJson(response, 401, { ok: false, error: "Sessao expirada. Entre novamente." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, buildStatePayload(data, currentUser));
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
    requireAdmin(currentUser);
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
  const body = await readJsonBody(request);
  const data = await readData();
  const username = normalizeUsername(body.username);
  const user = data.users.find((item) => normalizeUsername(item.username) === username);

  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    sendJson(response, 401, { ok: false, error: "Usuario ou senha invalidos." });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.id,
    createdAt: Date.now(),
  });

  sendJson(
    response,
    200,
    {
      ...buildStatePayload(data, user),
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

async function handleCreateRequest(request, response, data, currentUser) {
  const body = await readJsonBody(request);
  const now = new Date().toISOString();
  const priority = normalizePriority(body.priority);
  const isManager = currentUser.role === "manager";

  const taskRequest = {
    id: createId("request"),
    manager: isManager ? currentUser.name : cleanText(body.manager, "Gerente nao informado"),
    department: isManager ? currentUser.department : cleanText(body.department, "Setor nao informado"),
    title: cleanText(body.title, "Sem titulo"),
    description: cleanText(body.description, "Sem descricao"),
    priority,
    dueDate: responseDueDate(priority),
    status: "nova",
    response: "",
    attachments: await sanitizeAttachments(body.attachments),
    responseAttachments: [],
    createdBy: currentUser.id,
    requesterPhone: isManager ? normalizePhone(currentUser.phone) : normalizePhone(body.requesterPhone),
    createdAt: now,
    updatedAt: now,
    history: [`Solicitacao registrada em ${formatDateTime(now)}`],
  };

  data.requests = [taskRequest, ...data.requests];
  await writeData(data);

  const shouldNotify = !(currentUser.role === "admin" && body.skipNotification === true);
  const notification = shouldNotify ? await notifyAdmin(taskRequest) : null;
  sendJson(response, 201, {
    ok: true,
    request: taskRequest,
    requests:
      currentUser.role === "admin"
        ? sortRequests(data.requests)
        : data.requests.filter((item) => item.createdBy === currentUser.id),
    notification,
  });
}

async function handleCreatePersonalTask(request, response, data, currentUser) {
  const body = await readJsonBody(request);
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

async function handleUpdatePersonalTask(request, response, data, currentUser, taskId) {
  const body = await readJsonBody(request);
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
  const body = await readJsonBody(request);
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

  data.meetings = [meeting, ...data.meetings];
  await writeData(data);
  sendJson(response, 201, { ok: true, meeting, meetings: sortMeetings(data.meetings) });
}

async function handleUpdateMeetingSlot(request, response, data, meetingId) {
  const body = await readJsonBody(request);
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

async function handleBookMeeting(request, response, data, currentUser, meetingId) {
  if (currentUser.role !== "manager") {
    sendJson(response, 403, { ok: false, error: "Apenas gestores podem agendar reunioes." });
    return;
  }

  const body = await readJsonBody(request);
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
  const body = await readJsonBody(request);
  const index = data.requests.findIndex((item) => item.id === requestId);

  if (index === -1) {
    sendJson(response, 404, { ok: false, error: "Solicitacao nao encontrada" });
    return;
  }

  const previous = data.requests[index];
  const now = new Date().toISOString();
  const nextStatus = normalizeStatus(body.status || previous.status);
  const responseText =
    body.response === undefined ? previous.response : cleanText(body.response, previous.response);
  const newResponseAttachments = Array.isArray(body.responseAttachments)
    ? await sanitizeAttachments(body.responseAttachments)
    : [];
  const history = [...previous.history];

  if (nextStatus === "andamento" && previous.status !== "andamento") {
    history.push(`Marcada como em andamento em ${formatDateTime(now)} por ${currentUser.name}`);
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
    history,
  };

  data.requests[index] = updatedRequest;
  await writeData(data);

  const notification = nextStatus === "resolvida" ? await notifyRequester(updatedRequest) : null;
  sendJson(response, 200, {
    ok: true,
    request: updatedRequest,
    requests: sortRequests(data.requests),
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
  const match = findAttachmentRecord(data.requests, currentUser, attachmentId);

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
  const body = await readJsonBody(request);
  const username = normalizeUsername(body.username);

  if (!username) {
    sendJson(response, 400, { ok: false, error: "Informe um usuario." });
    return;
  }

  if (data.users.some((user) => normalizeUsername(user.username) === username)) {
    sendJson(response, 409, { ok: false, error: "Este usuario ja existe." });
    return;
  }

  const user = {
    id: createId("user"),
    name: cleanText(body.name, "Gerente"),
    department: cleanText(body.department, "Loja"),
    unit: normalizeUnit(body.unit),
    username,
    phone: normalizePhone(body.phone),
    passwordHash: hashPassword(cleanText(body.password, "1234")),
    role: "manager",
    createdAt: new Date().toISOString(),
  };

  data.users = [...data.users, user];
  await writeData(data);
  sendJson(response, 201, { ok: true, user: publicUser(user), users: publicUsers(data.users) });
}

async function handleUpdateUser(request, response, data, userId) {
  const body = await readJsonBody(request);
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
    updatedAt: new Date().toISOString(),
  };

  if (String(body.password || "").trim()) {
    nextUser.passwordHash = hashPassword(String(body.password).trim());
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
  const body = await readJsonBody(request);
  const taskRequest = sanitizeTaskRequest(body.request ?? body);
  const result = await notifyAdmin(taskRequest);
  sendJson(response, result.ok ? 200 : 502, result);
}

async function handleRequesterWhatsAppNotification(request, response) {
  const body = await readJsonBody(request);
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

function buildStatePayload(data, currentUser) {
  const user = publicUser(currentUser);
  const isAdmin = currentUser.role === "admin";
  const visibleRequests = isAdmin
    ? sortRequests(data.requests)
    : data.requests.filter((request) => request.createdBy === currentUser.id);

  return {
    ok: true,
    user,
    requests: visibleRequests,
    users: isAdmin ? publicUsers(data.users) : [],
    personalTasks: isAdmin ? sortPersonalTasks(data.personalTasks) : [],
    meetings: visibleMeetings(data.meetings, currentUser),
  };
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
  };
  const migrated = await migrateLegacyAttachments(data.requests);

  if (migrated) {
    await writeData(data);
  }

  return data;
}

async function writeData(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify(data)}\n`);
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
    createdAt: user.createdAt,
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2:${iterations}:${salt}:${hash}`;
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

function normalizeMeetingStatus(value) {
  return ["available", "blocked", "booked"].includes(value) ? value : "available";
}

function normalizeUnit(value) {
  const unit = String(value || "")
    .trim()
    .toUpperCase();
  return unitLabels[unit] ? unit : "SPZ";
}

function normalizeDateInput(value, fallback) {
  const dateText = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : fallback;
}

function normalizeTimeInput(value) {
  const timeText = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(timeText) ? timeText : "";
}

function todayInBusinessTimezone() {
  return toDateInputValue(businessToday());
}

function responseDueDate(priority) {
  const date = businessToday();
  date.setDate(date.getDate() + (responseDeadlineDays[priority] ?? responseDeadlineDays.media));
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

  const attachments = await Promise.all(value.slice(0, MAX_ATTACHMENTS_PER_FIELD).map(async (attachment) => {
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

function attachmentExtension(mimeType) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function findAttachmentRecord(requests, currentUser, attachmentId) {
  for (const taskRequest of requests) {
    if (currentUser.role !== "admin" && taskRequest.createdBy !== currentUser.id) continue;

    const attachments = [
      ...(Array.isArray(taskRequest.attachments) ? taskRequest.attachments : []),
      ...(Array.isArray(taskRequest.responseAttachments) ? taskRequest.responseAttachments : []),
    ];
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { request: taskRequest, attachment };
  }

  return null;
}

function isPdfMime(type) {
  return String(type || "").toLowerCase() === "application/pdf";
}

function encodeHeaderFileName(fileName) {
  return String(fileName).replace(/["\r\n]/g, "_");
}

async function deleteStoredAttachments(taskRequest) {
  const attachments = [
    ...(Array.isArray(taskRequest?.attachments) ? taskRequest.attachments : []),
    ...(Array.isArray(taskRequest?.responseAttachments) ? taskRequest.responseAttachments : []),
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
    meetings.filter((meeting) => meeting.status === "available" || meeting.bookedBy === currentUser.id),
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
