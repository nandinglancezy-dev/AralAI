
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

let conversations = JSON.parse(
  localStorage.getItem("aralai_chats") || "[]"
);

let currentChatId = null;
let isSending = false;

// SAVE HISTORY
function saveHistory() {
  localStorage.setItem(
    "aralai_chats",
    JSON.stringify(conversations)
  );
}

// CREATE NEW CHAT
function newChat() {
  currentChatId = null;
  messages.innerHTML = "";
  welcome.hidden = false;
  messageInput.value = "";
  messageInput.focus();
  renderHistory();

  sidebar.classList.remove("open");
}

// GET CURRENT CHAT
function getCurrentChat() {
  return conversations.find(
    chat => chat.id === currentChatId
  );
}

// CREATE CHAT
function createChat(firstMessage) {
  const chat = {
    id: Date.now().toString(),
    title: firstMessage.slice(0, 35),
    messages: []
  };

  conversations.unshift(chat);
  currentChatId = chat.id;

  saveHistory();
  renderHistory();

  return chat;
}

// ADD MESSAGE TO CHAT
function addMessage(role, content) {
  const chat = getCurrentChat();

  if (!chat) return;

  chat.messages.push({
    role,
    content
  });

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

  document.querySelector(".chat-container").scrollTop =
    document.querySelector(".chat-container").scrollHeight;
}

// RENDER CHAT HISTORY
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

    title.addEventListener("click", () => {
      openChat(chat.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-chat";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete conversation";

    deleteBtn.addEventListener("click", (event) => {
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

    item.addEventListener("click", () => {
      openChat(chat.id);
    });

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

  const chatContainer = document.querySelector(".chat-container");
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const chat = getCurrentChat();

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: chat.messages.slice(-20)
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

// NEW CHAT BUTTON
newChatBtn.addEventListener("click", newChat);

// SUGGESTION BUTTONS
document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;
    sendMessage(prompt);
  });
});

// MOBILE MENU
menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// AUTO RESIZE INPUT
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

// INITIALIZE
renderHistory();
