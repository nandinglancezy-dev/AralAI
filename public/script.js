
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

let conversations = loadHistory();
let currentChatId = null;
let isSending = false;

// SAVE MEMORY
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

// CURRENT CHAT
function getCurrentChat() {
  return conversations.find(
    chat => chat.id === currentChatId
  );
}

// CREATE NEW CHAT
function newChat() {
  currentChatId = null;
  messages.innerHTML = "";
  welcome.hidden = false;
  messageInput.value = "";
  renderHistory();

  sidebar.classList.remove("open");
}

// CREATE CHAT
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

// ADD MESSAGE
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

// DISPLAY MESSAGE
function displayMessage(role, content) {
  welcome.hidden = true;

  const message = document.createElement("div");
  message.className = `message ${role}`;

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
  text.textContent = content;

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
  container.scrollTop = container.scrollHeight;
}

// RENDER HISTORY
function renderHistory() {
  historyList.innerHTML = "";

  if (conversations.length === 0) {
    historyList.innerHTML =
      '<p class="empty-history">No conversations yet</p>';
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

    title.addEventListener("click", () => openChat(chat.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-chat";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete conversation";

    deleteBtn.addEventListener("click", event => {
      event.stopPropagation();

      if (!confirm("Delete this conversation?")) return;

      conversations = conversations.filter(
        chatItem => chatItem.id !== chat.id
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

// OPEN OLD CHAT
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

// SEND MESSAGE
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
  container.scrollTop = container.scrollHeight;

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

// FORM SUBMIT
chatForm.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

// NEW CHAT
newChatBtn.addEventListener("click", newChat);

// SUGGESTIONS
document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    sendMessage(button.dataset.prompt);
  });
});

// MOBILE MENU
menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// AUTO RESIZE
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height =
    Math.min(messageInput.scrollHeight, 130) + "px";
});

// ENTER TO SEND
messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

// RESTORE LAST CONVERSATION
function initializeApp() {
  renderHistory();

  if (conversations.length > 0) {
    openChat(conversations[0].id);
  }
}

// START
initializeApp();
    
