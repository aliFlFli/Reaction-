const { Bot } = require("grammy");
const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");

const MAIN_TOKEN = process.env.BOT_TOKEN || "7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg";
const mainBot = new Bot(MAIN_TOKEN);

const DATA_FILE = path.join(__dirname, "data.json");

let data = {
    channels: [],
    reactions: new Set(["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]),
    helperBots: []
};

const channelMap = new Map();

// ========== پاکسازی فرآیندهای قبلی ==========
function killPreviousInstances() {
    try {
        execSync('pkill -f "node bot.js" || true', { stdio: 'ignore' });
        console.log("🧹 فرآیندهای قبلی پاک شدند.");
    } catch (e) {}
}

killPreviousInstances();

// ========== لود / سیو ==========
async function loadData() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        const loaded = JSON.parse(raw);
        data.channels = loaded.channels || [];
        data.helperBots = loaded.helperBots || [];
        data.reactions = new Set(loaded.reactions || ["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]);

        data.channels.forEach(ch => channelMap.set(ch.channel_id, ch));
    } catch (e) {}
}

async function saveData() {
    const saveObj = {
        channels: data.channels,
        reactions: Array.from(data.reactions),
        helperBots: data.helperBots.map(b => ({ id: b.id, token: b.token, username: b.username }))
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(saveObj, null, 2));
}

// ========== هندلر ری‌اکشن ==========
function createReactionHandler() {
    return async (ctx) => {
        const chatId = ctx.chat.id.toString();
        if (!channelMap.has(chatId)) return;

        const reactionsArray = Array.from(data.reactions);
        const randomEmoji = reactionsArray[Math.floor(Math.random() * reactionsArray.length)];

        try {
            await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, [
                { type: "emoji", emoji: randomEmoji }
            ]);
        } catch (e) {}
    };
}

// ========== راه‌اندازی ربات کمکی ==========
async function startHelperBot(helper) {
    try {
        // توقف قبلی اگر وجود داشته باشه
        if (helper.botInstance) {
            try { helper.botInstance.stop(); } catch(e){}
        }

        const bot = new Bot(helper.token);
        bot.on("channel_post", createReactionHandler());

        // شروع با تنظیمات بهتر
        await bot.start({ 
            drop_pending_updates: true 
        });

        helper.botInstance = bot;
        console.log(`✅ ربات ${helper.username} فعال شد`);
        return true;
    } catch (e) {
        console.error(`❌ خطا در راه‌اندازی ${helper.username}:`, e.message);
        return false;
    }
}

async function startAllHelperBots() {
    console.log(`🔄 در حال راه‌اندازی ${data.helperBots.length} ربات کمکی...`);
    for (const helper of data.helperBots) {
        await startHelperBot(helper);
    }
}

// ========== دستورات (خلاصه برای جلوگیری از طولانی شدن) ==========
mainBot.command("addbot", async (ctx) => {
    const token = ctx.message.text.trim().split(/\s+/)[1];
    if (!token) return ctx.reply("📝 `/addbot <token>`");

    let username = "نامشخص";
    try {
        const temp = new Bot(token);
        const me = await temp.api.getMe();
        username = `@${me.username}`;
    } catch (e) {
        return ctx.reply("❌ توکن نامعتبر است.");
    }

    const id = Date.now().toString().slice(-6);
    const newHelper = { id, token, username, botInstance: null };

    data.helperBots.push(newHelper);
    await saveData();

    await ctx.reply(`✅ ربات ${username} اضافه شد (ID: ${id})`);
    await startHelperBot(newHelper);   // راه‌اندازی فوری
});

mainBot.command("start", async (ctx) => {
    await ctx.reply(
        `👋 **پنل مرکزی ری‌اکشن**\n\n` +
        `📡 /addchannel @username\n` +
        `📋 /channels\n` +
        `🤖 /addbot <token>\n` +
        `📊 /status`,
        { parse_mode: "Markdown" }
    );
});

mainBot.command("status", async (ctx) => {
    await ctx.reply(
        `📊 **وضعیت**\n\n` +
        `📡 کانال‌ها: ${data.channels.length}\n` +
        `🤖 ربات‌های کمکی: ${data.helperBots.length}\n` +
        `😀 ری‌اکشن‌ها: ${data.reactions.size}\n` +
        `🟢 فعال`,
        { parse_mode: "Markdown" }
    );
});

// بقیه دستورات (/channels, /addchannel, /bots و ...) رو مثل پیام قبلی اضافه کن

// ========== اجرا ==========
async function main() {
    await loadData();
    mainBot.on("channel_post", createReactionHandler());

    console.log("🚀 پنل مرکزی شروع شد...");
    await mainBot.start();
    console.log("✅ ربات اصلی فعال شد.");

    await startAllHelperBots();   // بعد از شروع اصلی، ربات‌های کمکی را راه بینداز
}

main().catch(console.error);
