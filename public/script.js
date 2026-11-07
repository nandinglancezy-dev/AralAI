
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const typing = document.getElementById("typing");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

const STORAGE_KEY = "aralai_chats";
const MAX_CHATS = 50;
const MAX_MESSAGES = 100;

let conversations = loadHistory();
let currentChatId = null;
let isSending = false;

// ==============================
// CONVERSATION MEMORY
// ==============================

function loadHistory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved)
      ? saved.filter(chat =>
          chat &&
          typeof chat.id === "string" &&
          Array.isArray(chat.messages)
        )
      : [];
  } catch (error) {
    console.error("Memory loading error:", error);
    return [];
  }
}

function saveHistory() {
  try {
    conversations = conversations.slice(0, MAX_CHATS);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations)
    );
  } catch (error) {
    console.error("Memory saving error:", error);
    alert("Storage is full. Please delete some old conversations.");
  }
}

function getCurrentChat() {
  return conversations.find(
    chat => chat.id === currentChatId
  );
}

function createChat(firstMessage) {
  const chat = {
    id: Date.now().toString(),
    title: firstMessage.slice(0, 35),
    messages: [],
    updatedAt: new Date().toISOString()
  };

  conversations.unshift(chat);
  currentChatId = chat.id;

  saveHistory();
  renderHistory();

  return chat;
}

function addMessage(role, content) {
  const chat = getCurrentChat();

  if (!chat) return;

  chat.messages.push({
    role,
    content,
    time: new Date().toISOString()
  });

  chat.messages = chat.messages.slice(-MAX_MESSAGES);
  chat.updatedAt = new Date().toISOString();

  saveHistory();
}

// ==============================
// MARKDOWN FORMATTER
// ==============================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatInline(text) {
  let html = escapeHTML(text);

  html = html.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  html = html.replace(
    /__(.+?)__/g,
    "<strong>$1</strong>"
  );

  html = html.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    "<em>$1</em>"
  );

  html = html.replace(
    /~~(.+?)~~/g,
    "<del>$1</del>"
  );

  return html;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(cell => cell.trim());
}

function formatMarkdown(content) {
  const lines = String(content).replace(/\r/g, "").split("\n");
  const output = [];

  let paragraph = [];
  let listType = null;
  let listItems = [];
  let index = 0;

  function flushParagraph() {
    if (!paragraph.length) return;

    output.push(
      "<p>" +
      paragraph.map(formatInline).join("<br>") +
      "</p>"
    );

    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;

    const tag = listType === "ol" ? "ol" : "ul";

    output.push(
      "<" + tag + ">" +
      listItems.map(item =>
        "<li>" + formatInline(item) + "</li>"
      ).join("") +
      "</" + tag + ">"
    );

    listItems = [];
    listType = null;
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    // Empty lines
    if (!trimmed) {
      flushParagraph();
      flushList();
      index++;
      continue;
    }

    // Markdown table
    if (
      trimmed.includes("|") &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      flushParagraph();
      flushList();

      const headers = splitTableRow(line);
      index += 2;

      let rows = "";

      while (
        index < lines.length &&
        lines[index].trim().includes("|")
      ) {
        const cells = splitTableRow(lines[index]);

        rows += "<tr>" + headers.map((_, i) =>
          "<td>" + formatInline(cells[i] || "") + "</td>"
        ).join("") + "</tr>";

        index++;
      }

      output.push(
        '<div class="aralai-table-wrap">' +
        '<table class="aralai-table">' +
        "<thead><tr>" +
        headers.map(header =>
          "<th>" + formatInline(header) + "</th>"
        ).join("") +
        "</tr></thead>" +
        "<tbody>" + rows + "</tbody>" +
        "</table></div>"
      );

      continue;
    }

    // Headings
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();

      const level = heading[1].length;

      output.push(
        "<h" + level + ">" +
        formatInline(heading[2]) +
        "</h" + level + ">"
      );

      index++;
      continue;
    }

    // Horizontal line
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      output.push("<hr>");
      index++;
      continue;
    }

    // Bullet list
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);

    if (bullet) {
      flushParagraph();

      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }

      listItems.push(bullet[1]);
      index++;
      continue;
    }

    // Numbered list
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (numbered) {
      flushParagraph();

      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }

      listItems.push(numbered[1]);
      index++;
      continue;
    }

    flushList();
    paragraph.push(trimmed);
    index++;
  }

  flushParagraph();
  flushList();

  return output.join("");
}

// ==============================
// DISPLAY MESSAGE
// ==============================

function displayMessage(role, content) {
  welcome.hidden = true;

  const message = document.createElement("div");
  message.className = "message " + role;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "S" : "A";

  const messageContent = document.createElement("div");
  messageContent.className = "message-content";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? "You" : "AralAI";

  const text = document.createElement("div");
  text.className = "message-text";

  if (role === "assistant") {
    text.innerHTML = formatMarkdown(content);
  } else {
    text.textContent = content;
  }

  messageContent.appendChild(name);
  messageContent.appendChild(text);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy response";

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        copyBtn.textContent = "Copied!";

        setTimeout(() => {
          copyBtn.textContent = "Copy response";
        }, 1500);
      } catch {
        copyBtn.textContent = "Copy unavailable";
      }
    });

    actions.appendChild(copyBtn);
    messageContent.appendChild(actions);
  }

  message.appendChild(avatar);
  message.appendChild(messageContent);
  messages.appendChild(message);

  const container = document.querySelector(".chat-container");

  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ==============================
// CHAT HISTORY
// ==============================

function renderHistory() {
  historyList.innerHTML = "";

  if (conversations.length === 0) {
    historyList.textContent = "No conversations yet";
    return;
  }

  conversations.forEach(chat => {
    const item = document.createElement("div");
    item.className = "history-item";

    if (chat.id === currentChatId) {
      item.classList.add("active");
    }

    const title = document.createElement("span");
    title.className = "history-name";
    title.textContent = chat.title;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-chat";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete conversation";

    title.addEventListener("click", () => openChat(chat.id));

    deleteBtn.addEventListener("click", event => {
      event.stopPropagation();

      if (!confirm("Delete this conversation?")) return;

      conversations = conversations.filter(
        item => item.id !== chat.id
      );

      if (currentChatId === chat.id) {
        currentChatId = null;
        messages.innerHTML = "";
        welcome.hidden = false;
      }

      saveHistory();
      renderHistory();
    });

    item.appendChild(title);
    item.appendChild(deleteBtn);

    item.addEventListener("click", () => openChat(chat.id));

    historyList.appendChild(item);
  });
}

function openChat(id) {
  const chat = conversations.find(item => item.id === id);

  if (!chat) return;

  currentChatId = id;
  messages.innerHTML = "";
  welcome.hidden = true;

  chat.messages.forEach(message => {
    displayMessage(message.role, message.content);
  });

  renderHistory();
  sidebar.classList.remove("open");
}

function newChat() {
  currentChatId = null;
  messages.innerHTML = "";
  welcome.hidden = false;
  messageInput.value = "";

  renderHistory();
  sidebar.classList.remove("open");
}

// ==============================
// SEND MESSAGE
// ==============================

async function sendMessage(text) {
  if (isSending) return;

  text = text.trim();

  if (!text) return;

  if (!currentChatId) {
    createChat(text);
  }

  isSending = true;
  sendBtn.disabled = true;

  displayMessage("user", text);
  addMessage("user", text);

  messageInput.value = "";
  messageInput.style.height = "auto";
  typing.hidden = false;

  const container = document.querySelector(".chat-container");

  if (container) {
    container.scrollTop = container.scrollHeight;
  }

  try {
    const chat = getCurrentChat();

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: chat.messages
          .filter(m =>
            ["user", "assistant"].includes(m.role)
          )
          .slice(-20)
          .map(m => ({
            role: m.role,
            content: m.content
          }))
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    if (!data.reply) {
      throw new Error("No response received from AralAI.");
    }

    displayMessage("assistant", data.reply);
    addMessage("assistant", data.reply);

  } catch (error) {
    const errorMessage =
      "Sorry, hindi ako makakonekta ngayon. " +
      error.message +
      "\n\nPlease check your backend connection and try again.";

    displayMessage("assistant", errorMessage);
    addMessage("assistant", errorMessage);

  } finally {
    typing.hidden = true;
    isSending = false;
    sendBtn.disabled = false;
    messageInput.focus();
    renderHistory();
  }
}

// ==============================
// EVENT LISTENERS
// ==============================

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

newChatBtn.addEventListener("click", newChat);

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    sendMessage(button.dataset.prompt);
  });
});

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";

  messageInput.style.height =
    Math.min(messageInput.scrollHeight, 130) + "px";
});

messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

// ==============================
// INITIALIZE
// ==============================

function initializeApp() {
  renderHistory();

  if (conversations.length > 0) {
    openChat(conversations[0].id);
  }
}

initializeApp();
        
