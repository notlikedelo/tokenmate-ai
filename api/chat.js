export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, history } = req.body;

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-12) // keep last 12 messages for memory
      : [];

    const system = {
      role: "system",
      content:
        "You are TokenMate AI, a crypto education assistant. Be clear and helpful. Never give financial advice. Always include a brief reminder: 'This is educational, not financial advice.' If the user asks what to buy/sell, provide general factors to consider and risk management instead of telling them what to do.",
    };

    const messages = [system, ...safeHistory, { role: "user", content: message }];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.5,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data?.error?.message || "OpenAI request failed",
      });
    }

    return res.status(200).json({
      reply: data.choices?.[0]?.message?.content || "No reply",
    });
  } catch (err) {
    return res.status(500).json({ error: "AI failed to respond" });
  }
}
