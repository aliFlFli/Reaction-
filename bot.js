const { Bot } = require("grammy");
const fs = require("fs").promises;
const path = require("path");

const MAIN_TOKEN = process.env.BOT_TOKEN || "7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg";
const mainBot = new Bot(MAIN_TOKEN);

const DATA_FILE = path.join(__dirname, "data.json");

let data = {
    channels: [],
    reactions: new Set(["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]),
    helperBots: []
};

const channelMap = new Map();

// ========== لود / سیو ==========
async function loadData() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        const loaded = JSON.parse(raw);
        data.channels = loaded.channels || [];
        data.helperBots = loaded.helperBots || [];
        data.reactions = new Set(loaded.reactions || ["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]);

        data.channels.forEach(ch => channelMap.set(ch.channel_id, ch));
        console.log(`📁 ${data.channels.length} کانال و ${data.helperBots.length} ربات کمکی لود شد`);
    } catch (e) {
        console.log("📁 فایل داده وجود ندارد، از تنظیمات پیش‌فرض استفاده شد.");
    }
}

async function saveData() {
    const saveObj = {
        channels: data.channels,
        reactions: Array.from(data.reactions),
        helperBots: data.helperBots.map(b => ({
            id: b.id,
            token: b.token,
            username: b.username
        }))
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(saveObj, null, 2));
}

// ========== راه‌اندازی ربات‌های کمکی ==========
async function startHelperBot(helper) {
    try {
        const bot = new Bot(helper.token);
        bot.on("channel_post", createReactionHandler());
        await bot.start();
        helper.botInstance = bot;
        console.log(`✅ ربات ${helper.username} فعال شد`);
    } catch (e) {
        console.error(`❌ خطا در راه‌اندازی ${helper.username}:`, e.message);
    }
}

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

async function startAllHelperBots() {
    for (const helper of data.helperBots) {
        if (!helper.botInstance) await startHelperBot(helper);
    }
}

// ========== دستورات اصلی ==========
mainBot.command("start", async (ctx) => {
    await ctx.reply(
        `👋 **پنل مرکزی ری‌اکشن‌گذار**\n\n` +
        `📡 **کانال‌ها:**\n` +
        `/addchannel @username\n` +
        `/channels\n` +
        `/removechannel @username\n\n` +
        `😀 **ری‌اکشن‌ها:**\n` +
        `/addreaction 😀\n` +
        `/removereaction 😀\n` +
        `/reactions\n\n` +
        `🤖 **ربات‌های کمکی:**\n` +
        `/addbot <token>\n` +
        `/bots\n` +
        `/removebot <id>\n\n` +
        `📊 /status`,
        { parse_mode: "Markdown" }
    );
});

// --- مدیریت کانال ---
mainBot.command("addchannel", async (ctx) => {
    const input = ctx.message.text.trim().split(/\s+/)[1];
    if (!input) return ctx.reply("📝 استفاده: `/addchannel @username`", { parse_mode: "Markdown" });

    let channelId = input;

    if (input.startsWith("@")) {
        try {
            const chat = await ctx.api.getChat(input);
            channelId = chat.id.toString();
            console.log(`🔄 @${input} → ${channelId}`);
        } catch (e) {
            return ctx.reply("❌ نتوانستم کانال را پیدا کنم. مطمئن شو ربات ادمین کانال است.");
        }
    }

    if (channelMap.has(channelId)) {
        return ctx.reply("❌ این کانال قبلاً اضافه شده است!");
    }

    const newChannel = { channel_id: channelId, username: input.startsWith("@") ? input : null, is_active: true };
    data.channels.push(newChannel);
    channelMap.set(channelId, newChannel);

    await saveData();
    await ctx.reply(`✅ کانال \( {input} (\` \){channelId}\`) اضافه شد!`, { parse_mode: "Markdown" });
});

mainBot.command("channels", async (ctx) => {
    if (data.channels.length === 0) {
        return ctx.reply("📭 هنوز هیچ کانالی اضافه نشده است.");
    }

    const text = data.channels
        .map((c, i) => `${i+1}. \( {c.username || c.channel_id} (\` \){c.channel_id}\`)`)
        .join("\n");

    await ctx.reply(`📡 **لیست کانال‌ها:**\n\n${text}`, { parse_mode: "Markdown" });
});

mainBot.command("removechannel", async (ctx) => {
    const input = ctx.message.text.trim().split(/\s+/)[1];
    if (!input) return ctx.reply("📝 استفاده: `/removechannel @username`");

    const index = data.channels.findIndex(c => 
        c.channel_id === input || (c.username && c.username === input)
    );

    if (index === -1) return ctx.reply("❌ کانال یافت نشد!");

    const removed = data.channels[index];
    data.channels.splice(index, 1);
    channelMap.delete(removed.channel_id);
    await saveData();

    await ctx.reply(`🗑️ کانال ${removed.username || removed.channel_id} حذف شد!`);
});

// --- مدیریت ری‌اکشن ---
mainBot.command("addreaction", async (ctx) => {
    const emoji = ctx.message.text.trim().split(/\s+/)[1];
    if (!emoji) return ctx.reply("📝 استفاده: `/addreaction 😀`");

    if (data.reactions.has(emoji)) return ctx.reply("❌ این ایموجی قبلاً وجود دارد!");

    data.reactions.add(emoji);
    await saveData();
    await ctx.reply(`✅ ایموجی ${emoji} اضافه شد!`);
});

mainBot.command("removereaction", async (ctx) => {
    const emoji = ctx.message.text.trim().split(/\s+/)[1];
    if (!emoji) return ctx.reply("📝 استفاده: `/removereaction 😀`");

    if (data.reactions.delete(emoji)) {
        await saveData();
        await ctx.reply(`🗑️ ایموجی ${emoji} حذف شد!`);
    } else {
        await ctx.reply("❌ ایموجی یافت نشد!");
    }
});

mainBot.command("reactions", async (ctx) => {
    const list = Array.from(data.reactions).join("  ");
    await ctx.reply(`📋 **ری‌اکشن‌ها:**\n\n${list || "هیچ"}`, { parse_mode: "Markdown" });
});

// --- مدیریت ربات‌های کمکی ---
mainBot.command("addbot", async (ctx) => {
    const token = ctx.message.text.trim().split(/\s+/)[1];
    if (!token) return ctx.reply("📝 استفاده: `/addbot 123456:AAF...`");

    const id = Date.now().toString().slice(-6);

    let username = "نامشخص";
    try {
        const tempBot = new Bot(token);
        const me = await tempBot.api.getMe();
        username = `@${me.username}`;
    } catch (e) {
        return ctx.reply("❌ توکن نامعتبر یا ربات در دسترس نیست.");
    }

    const newHelper = { id, token, username, botInstance: null };
    data.helperBots.push(newHelper);
    await saveData();
    await startHelperBot(newHelper);

    await ctx.reply(`✅ ربات \( {username} با شناسه \` \){id}\` اضافه و فعال شد!`, { parse_mode: "Markdown" });
});

mainBot.command("bots", async (ctx) => {
    let text = `🤖 **ربات‌های فعال: ${data.helperBots.length + 1}**\n\n`;
    text += `• ربات اصلی (این ربات)\n`;

    data.helperBots.forEach((b, i) => {
        text += `• ${b.username} | ID: ${b.id}\n`;
    });

    await ctx.reply(text);
});

mainBot.command("removebot", async (ctx) => {
    const id = ctx.message.text.trim().split(/\s+/)[1];
    if (!id) return ctx.reply("📝 استفاده: `/removebot <id>`");

    const index = data.helperBots.findIndex(b => b.id === id);
    if (index === -1) return ctx.reply("❌ ربات یافت نشد.");

    data.helperBots.splice(index, 1);
    await saveData();
    await ctx.reply(`🗑️ ربات با شناسه ${id} حذف شد.`);
});

mainBot.command("status", async (ctx) => {
    await ctx.reply(
        `📊 **وضعیت پنل**\n\n` +
        `📡 کانال‌ها: ${data.channels.length}\n` +
        `😀 ری‌اکشن‌ها: ${data.reactions.size}\n` +
        `🤖 ربات‌های کمکی: ${data.helperBots.length}\n` +
        `🟢 سیستم فعال`,
        { parse_mode: "Markdown" }
    );
});

// ========== اجرا ==========
async function main() {
    await loadData();
    await startAllHelperBots();

    mainBot.on("channel_post", createReactionHandler());

    console.log("🚀 پنل مرکزی در حال اجرا...");
    await mainBot.start();
    console.log("✅ پنل با موفقیت راه‌اندازی شد!");
}

main().catch(console.error);
