
const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const OWNER_ID = String(process.env.OWNER_TELEGRAM_ID || "");
const SITE_NAME = process.env.SITE_NAME || "The Atlantis Blog";
const SERVER_IP = process.env.MINECRAFT_SERVER_IP || "play.atlantisrp.it";
const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL || "https://t.me/TheAtlantisBlog";
const OWNER_USERNAME = (process.env.OWNER_TELEGRAM_USERNAME || "bluepixel89").replace(/^@/, "");

if (!TOKEN) {
  console.error("Manca la variabile TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}

if (!SECRET || SECRET.length < 16) {
  console.error("TELEGRAM_WEBHOOK_SECRET deve contenere almeno 16 caratteri.");
  process.exit(1);
}

async function telegram(method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!data.ok) {
    console.error(`Errore Telegram: ${data.description}`);
  }

  return data;
}

async function send(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra
  });
}

const keyboard = {
  keyboard: [
    [{ text: "🛍 Servizi" }, { text: "📢 Annunci" }],
    [{ text: "🆘 Assistenza" }, { text: "🌊 Server Minecraft" }]
  ],
  resize_keyboard: true
};

async function handleMessage(message) {
  if (!message || !message.chat || !message.from) return;

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const raw = (message.text || "").trim();
  const text = raw.toLowerCase();

  if (text === "/start") {
    return send(
      chatId,
      `🌊 Benvenuto su ${SITE_NAME}!\n\nScegli una funzione dal menu qui sotto.`,
      { reply_markup: keyboard }
    );
  }

  if (text === "/servizi" || text === "🛍 servizi") {
    return send(
      chatId,
      `🛍 SERVIZI — ${SITE_NAME}\n\nConsulta il canale ufficiale: ${CHANNEL_URL}\n\nPer informazioni, contatta @${OWNER_USERNAME}.`
    );
  }

  if (text === "/annunci" || text === "📢 annunci") {
    return send(
      chatId,
      `📢 ANNUNCI UFFICIALI\n\nSegui gli aggiornamenti qui: ${CHANNEL_URL}`
    );
  }

  if (text === "/supporto" || text === "🆘 assistenza") {
    return send(
      chatId,
      `🆘 ASSISTENZA\n\nContatta @${OWNER_USERNAME} su Telegram.\nNon inviare password o token segreti.`
    );
  }

  if (text === "/server" || text === "🌊 server minecraft") {
    return send(
      chatId,
      `🌊 SERVER MINECRAFT\n\nIndirizzo: ${SERVER_IP}`
    );
  }

  if (text === "/id") {
    return send(chatId, `Il tuo ID Telegram numerico è: ${userId}`);
  }

  if (text.startsWith("/annuncio")) {
    if (!OWNER_ID || userId !== OWNER_ID) {
      return send(chatId, "⛔ Comando riservato al proprietario del bot.");
    }

    const announcement = raw.replace(/^\/annuncio(@\w+)?\s*/i, "").trim();

    if (!announcement) {
      return send(chatId, "Uso: /annuncio testo");
    }

    return send(chatId, `📢 ANNUNCIO DI ${SITE_NAME}\n\n${announcement}`);
  }

  if (text === "/help" || text === "/aiuto") {
    return send(
      chatId,
      "/start — Menu\n/servizi — Servizi\n/annunci — Annunci\n/supporto — Assistenza\n/server — Server Minecraft\n/id — Il tuo ID Telegram",
      { reply_markup: keyboard }
    );
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    return res.end(`${SITE_NAME} bot is running.`);
  }

  if (req.method === "POST" && req.url === `/telegram-webhook/${SECRET}`) {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });

    req.on("end", async () => {
      try {
        const update = JSON.parse(body || "{}");

        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");

        if (update.message) {
          await handleMessage(update.message);
        }
      } catch (error) {
        console.error("Errore webhook:", error.message);

        if (!res.headersSent) {
          res.writeHead(400);
          res.end("bad request");
        }
      }
    });

    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, async () => {
  console.log(`${SITE_NAME} avviato sulla porta ${PORT}`);

  if (process.env.RENDER_EXTERNAL_URL) {
    const webhookUrl =
      `${process.env.RENDER_EXTERNAL_URL}/telegram-webhook/${SECRET}`;

    try {
      const result = await telegram("setWebhook", {
        url: webhookUrl,
        secret_token: SECRET
      });

      if (result.ok) {
        console.log("Webhook Telegram configurato.");
      }
    } catch (error) {
      console.error("Configurazione webhook fallita:", error.message);
    }
  }
});
