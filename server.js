
require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `
You are AralAI, a friendly Filipino AI study assistant.
Help students understand lessons in Math, Science,
English, Filipino, and other school subjects.
Explain clearly using simple Filipino or English.
Give step-by-step explanations when useful.
Be accurate, patient, respectful, and encouraging.
`;

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    app: "AralAI",
    provider: "Gemini"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is not configured."
      });
    }

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please provide a message."
      });
    }

    const contents = messages
      .slice(-20)
      .filter(message =>
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim()
      )
      .map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content.slice(0, 10000) }]
      }));

    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return res.status(400).json({
        error: "Please send a valid user message."
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data.error?.message || response.status);

      return res.status(response.status).json({
        error: data.error?.message || "Gemini API request failed."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("AralAI server error:", error.message);

    res.status(500).json({
      error: "Unable to connect to Gemini right now. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`AralAI Gemini server running on port ${PORT}`);
});
