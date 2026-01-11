const COINGECKO_MAP = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  xrp: "ripple",
  ripple: "ripple",
  ada: "cardano",
  cardano: "cardano",
  doge: "dogecoin",
  dogecoin: "dogecoin",
  bnb: "binancecoin",
  "binance coin": "binancecoin",
};

function pickCoinId(text = "") {
  const t = text.toLowerCase();
  // Find first matching key in map
  for (const key of Object.keys(COINGECKO_MAP)) {
    if (t.includes(key)) return COINGECKO_MAP[key];
  }
  return null;
}

async function getPriceUSD(coinId) {
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      coinId
    )}&vs_currencies=usd&include_24hr_change=true`;
  const r = await fetch(url, { headers: { "accept": "application/json" } });
  const data = await r.json();
  const price = data?.[coinId]?.usd;
  const change24h = data?.[coinId]?.usd_24h_change;
  return { price, change24h };
}

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
          .slice(-12)
      : [];

    // If user asked about a coin price, fetch it
    const coinId = pickCoinId(message);
    let marketContext = "";
    if (coinId) {
      try {
        const { price, change24h } = await getPriceUSD(coinId);
        if (typeof price === "number") {
          const changeText =
            typeof change24h === "number"
              ? ` (24h: ${change24h.toFixed(2)}%)`
              : "";
          marketContext = `Live price (USD) for ${coinId}: $${price.toLocaleString()}${changeText}.`;
        }
      } catch (e) {
        // If CoinGecko fails, we just proceed without market context
      }
    }

    const system = {
      role: "system",
      content:
        "You are TokenMate AI, a crypto education assistant. Be clear and helpful. Never give financial advice. Always include a brief reminder: 'This is educational, not financial advice.' If the user asks what to buy/sell, provide general factors to consider and risk management instead of telling them what to do.",
    };

    const extra = marketContext
      ? {
          role: "system",
          content:
            `Market data (use in your answer): ${marketContext} ` +
            "If user asked for price, lead with the live price. Keep it concise.",
        }
      : null;

    const messages = [
      system,
      ...(extra ? [extra] : []),
      ...safeHistory,
      { role: "user", content: message },
    ];

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
