const profileText = document.getElementById("discordUserText");
const profileId = document.getElementById("discordUserId");
const profileAvatar = document.getElementById("discordAvatar");
const loginLink = document.getElementById("discordLoginLink");
const recordsList = document.getElementById("recordsList");
const apiIndicator = document.getElementById("apiIndicator");
const statusMessage = document.getElementById("statusMessage");
const recordForm = document.getElementById("recordForm");
const recordInput = document.getElementById("recordInput");
const sendButton = document.getElementById("sendBtn");

let sessionUser = null;
let d1Connected = false;

function setProfile(user) {
  sessionUser = user && user.userId && user.username ? user : null;
  if (sessionUser) {
    profileText.textContent = `Conectado como ${sessionUser.username}`;
    profileId.textContent = sessionUser.userId;
    if (sessionUser.avatar) {
      profileAvatar.src = sessionUser.avatar;
      profileAvatar.hidden = false;
    } else {
      profileAvatar.removeAttribute("src");
      profileAvatar.hidden = true;
    }
    loginLink.hidden = true;
  } else {
    profileText.textContent = "Você não está conectado";
    profileId.textContent = "";
    profileAvatar.removeAttribute("src");
    profileAvatar.hidden = true;
    loginLink.hidden = false;
  }
}

function setApiStatus(message, state) {
  apiIndicator.textContent = message;
  apiIndicator.dataset.state = state;
}

function setListMessage(message, className = "empty-state") {
  const item = document.createElement("li");
  item.className = className;
  item.textContent = message;
  recordsList.replaceChildren(item);
}

function describeHttpFailure(response, data) {
  if (response.status === 401) {
    return "HTTP 401: sua sessão não está autenticada ou expirou. Entre com Discord para continuar.";
  }
  if (response.status === 503) {
    return "HTTP 503: serviço temporariamente indisponível; o banco D1 não pode atender à solicitação.";
  }
  const detail = data && typeof data.error === "string" ? ` ${data.error}` : "";
  return `A API retornou HTTP ${response.status}.${detail}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function renderRecords(data) {
  const records = Array.isArray(data.ultimosRegistros) ? data.ultimosRegistros : [];
  recordsList.replaceChildren();

  if (records.length === 0) {
    setListMessage(
      d1Connected
        ? "Nenhum registro gravado ainda."
        : "Nenhum registro disponível. O banco D1 está indisponível.",
    );
    return;
  }

  records.forEach((record) => {
    const item = document.createElement("li");
    const date = record.created_at || "Data não informada";
    const username = record.username || "Usuário";
    const userId = record.user_id ? ` (${record.user_id})` : "";
    const content = record.conteudo || "";
    item.textContent = `[${date}] ${username}${userId}: ${content}`;
    recordsList.appendChild(item);
  });
}

async function carregarStatus() {
  recordsList.setAttribute("aria-busy", "true");
  setApiStatus("Verificando API…", "loading");

  try {
    const response = await fetch("/api/status", {
      headers: { Accept: "application/json" },
    });
    const data = await readJson(response);
    if (!response.ok) {
      if (response.status === 401) setProfile(null);
      throw new Error(describeHttpFailure(response, data));
    }
    if (!data || data.ok === false) {
      throw new Error(
        data && typeof data.error === "string"
          ? `A API informou uma falha: ${data.error}`
          : "A API retornou uma resposta inválida.",
      );
    }

    setProfile(data.sessionUser);
    d1Connected = data.d1Connected === true;
    setApiStatus(
      d1Connected ? "API e D1 conectados" : "API conectada · D1 indisponível",
      d1Connected ? "success" : "warning",
    );
    renderRecords(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada ao consultar a API.";
    setApiStatus("Falha ao consultar API", "error");
    setListMessage(message, "error-state");
  } finally {
    recordsList.setAttribute("aria-busy", "false");
  }
}

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const conteudo = recordInput.value.trim();

  if (!conteudo) {
    statusMessage.textContent = "Digite uma mensagem antes de registrar.";
    recordInput.setAttribute("aria-invalid", "true");
    recordInput.focus();
    return;
  }
  recordInput.removeAttribute("aria-invalid");

  if (!sessionUser) {
    statusMessage.textContent = "Entre com Discord para registrar um diagnóstico.";
    loginLink.focus();
    return;
  }

  sendButton.disabled = true;
  statusMessage.textContent = "Enviando registro…";

  try {
    const response = await fetch("/api/status", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conteudo }),
    });
    const data = await readJson(response);

    if (!response.ok) {
      if (response.status === 401) {
        setProfile(null);
        statusMessage.textContent = describeHttpFailure(response, data);
        loginLink.focus();
        return;
      }
      statusMessage.textContent = describeHttpFailure(response, data);
      return;
    }
    if (!data || data.ok === false) {
      const detail = data && typeof data.error === "string" ? ` ${data.error}` : "";
      statusMessage.textContent = `A API não confirmou o registro.${detail}`;
      return;
    }

    if (data.saved === false) {
      statusMessage.textContent =
        "A API recebeu o registro, mas o D1 está indisponível; ele não foi persistido.";
    } else {
      statusMessage.textContent = "Registro salvo com sucesso.";
      recordInput.value = "";
    }
    await carregarStatus();
  } catch {
    statusMessage.textContent =
      "Não foi possível alcançar a API. Verifique a conexão e tente novamente.";
  } finally {
    sendButton.disabled = false;
  }
});

recordInput.addEventListener("input", () => {
  if (recordInput.value.trim()) recordInput.removeAttribute("aria-invalid");
});

carregarStatus();
