
const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    app: "AralAI",
    provider: "Groq",
    groqConfigured: Boolean(GROQ_API_KEY),
    model: GROQ_MODEL,
    version: "1.4",
    features: [
      "Automatic Language Detection",
      "Filipino and English",
      "AI Study Assistant"
    ]
  });
});

// AI Chat
app.post("/api/chat", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: "Groq API key is not configured."
      });
    }

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "No messages provided."
      });
    }

    const safeMessages = messages
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    safeMessages.unshift({
      role: "system",
      content: `
You are AralAI V1.4, a friendly and intelligent AI study assistant.

LANGUAGE RULES:
1. Automatically detect the language of the user's latest message.
2. If the user speaks Filipino or Tagalog, answer in natural Filipino.
3. If the user speaks English, answer in English.
4. If the user uses Taglish, you may respond in natural Taglish.
5. Follow the language requested by the user.
6. Explain difficult topics in simple and understandable words.

STUDY FEATURES:
- Help students understand school lessons.
- Explain math and science step by step.
- Help with writing, grammar, and translations.
- Give examples when useful.
- Be accurate, respectful, and encouraging.

Always prioritize the user's latest language preference.
`
    });

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: safeMessages,
          temperature: 0.7,
          max_completion_tokens: 2048
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API Error:", response.status, data);

      return res.status(response.status).json({
        error: data.error?.message || "Groq API request failed."
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: "Groq returned an empty response."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("AralAI Error:", error);

    res.status(500).json({
      error: "Unable to connect to AralAI. Please try again."
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`AralAI V1.4 running on port ${PORT}`);
  console.log(`Groq configured: ${Boolean(GROQ_API_KEY)}`);
  console.log(`Model: ${GROQ_MODEL}`);
});
