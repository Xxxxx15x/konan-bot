
const TELEGRAM_API = "https://api.telegram.org";
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "nvidia/nemotron-3.5-super-vl:free";

async function sendMessage(chatId, text, token) {
  const response = await fetch(
    `${TELEGRAM_API}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text).slice(0, 4000)
      })
    }
  );

  const result = await response.text();

  if (!response.ok) {
    console.error(
      "Telegram API error:",
      response.status,
      result
    );
    throw new Error(
      `Telegram send failed: ${response.status}`
    );
  }
}


async function askAI(question, apiKey) {
  const response = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "أنت KONAN AI، مساعد ذكي يجيب بالعربية بوضوح."
        },
        { role: "user", content: question }
      ],
      max_tokens: 800
    })
  });

  if (!response.ok) {
    throw new Error("AI request failed");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content
    || "لم أتمكن من الإجابة الآن.";
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("KONAN AI is running");
    }

    let update;

    try {
      update = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const message = update.message;
    if (!message?.chat?.id || !message?.text) {
      return new Response("OK");
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    try {
      if (text === "/start") {
        await sendMessage(
          chatId,
          "أهلًا بك في KONAN AI 🤖\nأرسل سؤالك وسأحاول مساعدتك.",
          env.TELEGRAM_BOT_TOKEN
        );
      } else {
        const answer = await askAI(
          text,
          env.OPENROUTER_API_KEY
        );

        await sendMessage(
          chatId,
          answer,
          env.TELEGRAM_BOT_TOKEN
        );
      }
    } catch (error) {
      console.error("KONAN AI error:", error.message);

      if (env.TELEGRAM_BOT_TOKEN) {
        try {
          await sendMessage(
            chatId,
            "حدث خطأ مؤقت. حاول مرة أخرى لاحقًا.",
            env.TELEGRAM_BOT_TOKEN
          );
        } catch {}
      }
    }

    return new Response("OK");
  }
};
