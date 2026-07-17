const { Bot } = require("grammy");
const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");

const MAIN_TOKEN = process.env.BOT_TOKEN || "7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg";
const mainBot = new Bot(MAIN_TOKEN);

const DATA_FILE = path.join(__dirname, "data.json");

// ========== داده‌ها ==========
let data = {
    channels: [],
    reactions: new Set(["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]),
    helperBots: []          // {id, token, username}
};

const channelMap = new Map();

// پاکسازی فرآیندهای قبلی
try {
    execSync('pkill -f "node bot.js" || true', { stdio: 'ignore' });
    console.log("🧹 فرآیندهای قبلی پاک شدند");
} catch (e) {}

// ========== لود و سیو ==========
async function loadData() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        const loaded = JSON.parse(raw);
        data.channels = loaded.channels || [];
        data.helperBots = loaded.helperBots || [];
        data.reactions = new Set(loaded.reactions || ["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]);

        data.channels.forEach(c => channelMap.set(c.channel_id, c));
    } catch (e) {
        console.log("📁 فایل داده جدید ایجاد شد.");
    }
}

async function saveData() {
    const toSave = {
        channels: data.channels,
        reactions: Array.from(data.reactions),
        helperBots: data.helperBots.map(b => ({id: b.id, token: b.token, username: b.username}))
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(toSave, null, 2));
}

// ========== هندلر ری‌اکشن ==========
const createReactionHandler = () => async (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (!channelMap.has(chatId)) return;

    const reactionsArr = Array.from(data.reactions);
    const emoji = reactionsArr[Math.floor(Math.random() * reactionsArr.length)];

    try {
        await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, [{ type: "emoji", emoji }]);
    } catch (e) {}
};

// ========== راه‌اندازی ربات کمکی ==========
async function startHelperBot(helper) {
    try {
        const bot = new Bot(helper.token);
        bot.on("channel_post", createReactionHandler());
        await bot.start({ drop_pending_updates: true });
        helper.botInstance = bot;
        console.log(`✅ ${helper.username} فعال شد`);
        return true;
    } catch (e) {
        console.error(`❌ خطا در ${helper.username}:`, e.message);
        return false;
    }
}

async function startAllHelpers() {
    for (const h of data.helperBots) {
        if (!h.botInstance) await startHelperBot(h);
    }
}

// ========== دستورات ==========
mainBot.command("start", async (ctx) => {
    await ctx.reply(
        `👋 **ربات ری‌اکشن‌گذار چندگانه**\n\n` +
        `📡 **کانال‌ها:**\n/addchannel @username\n/removechannel @username\n/channels\n\n` +
        `😀 **ری‌اکشن‌ها:**\n/addreaction 😀\n/removereaction 😀\n/reactions\n\n` +
        `🤖 **ربات‌های کمکی:**\n/addbot <token>\n/bots\n/removebot <id>\n\n` +
        `📊 /status`,
        { parse_mode: "Markdown" }
    );
});

// مدیریت کانال
mainBot.command("addchannel", async (ctx) => {
    const arg = ctx.message.text.trim().split(/\s+/)[1];
    if (!arg) return ctx.reply("📝 `/addchannel @username`");

    let channelId = arg;
    if (arg.startsWith("@")) {
        try {
            const chat = await mainBot.api.getChat(arg);
            channelId = chat.id.toString();
        } catch (e) {
            return ctx.reply("❌ ربات ادمین کانال نیست یا کانال یافت نشد.");
        }
    }

    if (channelMap.has(channelId)) return ctx.reply("❌ قبلاً اضافه شده!");

    const ch = { channel_id: channelId, username: arg.startsWith("@") ? arg : null, is_active: true };
    data.channels.push(ch);
    channelMap.set(channelId, ch);
    await saveData();

    await ctx.reply(`✅ کانال ${arg} اضافه شد!`);
});

mainBot.command("channels", async (ctx) => {
    if (data.channels.length === 0) return ctx.reply("📭 کانالی اضافه نشده.");

    const txt = data.channels.map((c,i) => `${i+1}. ${c.username || c.channel_id}`).join("\n");
    await ctx.reply(`📡 **کانال‌ها:**\n\n${txt}`);
});

mainBot.command("removechannel", async (ctx) => {
    const arg = ctx.message.text.trim().split(/\s+/)[1];
    if (!arg) return ctx.reply("📝 `/removechannel @username`");

    const idx = data.channels.findIndex(c => c.channel_id === arg || c.username === arg);
    if (idx === -1) return ctx.reply("❌ یافت نشد!");

    const removed = data.channels.splice(idx, 1)[0];
    channelMap.delete(removed.channel_id);
    await saveData();
    await ctx.reply(`🗑️ ${removed.username || removed.channel_id} حذف شد!`);
});

// مدیریت ری‌اکشن
mainBot.command("addreaction", async (ctx) => {
    const emoji = ctx.message.text.trim().split(/\s+/)[1];
    if (!emoji) return ctx.reply("📝 `/addreaction 😀`");
    if (data.reactions.has(emoji)) return ctx.reply("❌ قبلاً وجود دارد!");

    data.reactions.add(emoji);
    await saveData();
    await ctx.reply(`✅ ${
