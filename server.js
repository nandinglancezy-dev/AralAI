
require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const SYSTEM_PROMPT = `
You are AralAI, a friendly Filipino AI study assistant.
Help students with Mathematics, Science, English,
Filipino, History, Technology, and other school subjects.
Explain clearly using simple Filipino or English.
Give step-by-step explanations and examples when useful.
Be accurate, patient, respectful, and encouraging.
`;

const wait = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function askGemini(contents) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;
    let data;

    try {
      response = await fetch(
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
              maxOutputTokens: 2048
            }
          })
        }
      );

      data = await response.json();

    } catch (error) {
      console.error("Gemini network error:", error.message);
      throw new Error("Hindi makakonekta sa Gemini server.");
    }

    if (response.ok) return data;

    const status = response.status;
    const message = data.error?.message || "Unknown Gemini API error";

    console.error("Gemini API error:", {
      status,
      message,
      model: GEMINI_MODEL,
      attempt
    });

    if (status === 400 || status === 401 || status === 403) {
      throw new Error(
        `Gemini API error ${status}: ${message}`
      );
    }

    if (attempt === maxAttempts) {
      if (status === 429) {
        throw new Error(
          "Gemini quota limit o mataas ang demand. Subukan mamaya."
        );
      }

      throw new Error(
        `Gemini server error ${status}: ${message}`
      );
    }

    await wait(2000 * attempt);
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    app: "AralAI",
    provider: "Gemini",
    geminiConfigured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
    version: "1.2"
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

    if (
      !contents.length ||
      contents[contents.length - 1].role !== "user"
    ) {
      return res.status(400).json({
        error: "Please send a valid user message."
      });
    }

    const data = await askGemini(contents);

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned an empty response."
      });
    }

    return res.json({ reply });

  } catch (error) {
    console.error("AralAI error:", error.message);

    return res.status(502).json({
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`AralAI V1.2 running on port ${PORT}`);
});
