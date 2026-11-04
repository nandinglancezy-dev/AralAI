
require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// Serve AralAI frontend
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    app: "AralAI",
    version: "1.0"
  });
});

// AI CHAT API
app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-5.5";

    if (!apiKey || apiKey === "YOUR_SECRET_API_KEY") {
      return res.status(500).json({
        error: "OpenAI API key is not configured."
      });
    }

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please send a message."
      });
    }

    const validMessages = messages
      .filter(message =>
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
      )
      .slice(-20);

    if (validMessages.length === 0) {
      return res.status(400).json({
        error: "No valid messages found."
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          instructions:
            "You are AralAI, a friendly and helpful study assistant. " +
            "Help students understand school subjects clearly. " +
            "You can answer in Filipino or English depending on the user. " +
            "Explain lessons step by step, encourage learning, " +
            "and use simple examples. Do not simply do all schoolwork " +
            "without helping the student understand it.",
          input: validMessages.map(message => ({
            role: message.role,
            content: message.content
          }))
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        error:
          data.error?.message ||
          "OpenAI API request failed."
      });
    }

    const reply = data.output_text;

    if (!reply) {
      return res.status(500).json({
        error: "The AI returned an empty response."
      });
    }

    res.json({
      reply: reply
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      error: "Unable to connect to the AI server."
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`AralAI running on port ${PORT}`);
});
