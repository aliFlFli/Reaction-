const { Bot } = require("grammy");
const fs = require("fs").promises;
const path = require("path");

const MAIN_TOKEN = process.env.BOT_TOKEN || "7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg";
const mainBot = new Bot(MAIN_TOKEN);

const DATA_FILE = path.join(__dirname, "data.json");

let data = {
    channels: [],           // شناسه کانال‌ها (مشترک بین همه ربات‌ها)
    reactions: new Set(["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]),
    helperBots: []          // { id, token, username, botInstance }
};

const channelMap = new Map();
const helperBotsMap = new Map(); // id => botInstance

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
        
        bot.on("channel_post", async (ctx) => {
            const chatId = ctx.chat.id.toString();
            if (!channelMap.has(chatId)) return;

            const reactionsArray = Array.from(data.reactions);
            const randomEmoji = reactionsArray[Math.floor(Math.random() * reactionsArray.length)];

            try {
                await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, [
                    { type: "emoji", emoji: randomEmoji }
                ]);
                console.log(`🤖 ${helper.username} → ${randomEmoji}`);
            } catch (e) {}
        });

        await bot.start();
        helper.botInstance = bot;
        helperBotsMap.set(helper.id, bot);
        console.log(`✅ ربات ${helper.username} فعال شد`);
    } catch (e) {
        console.error(`❌ خطا در راه‌اندازی ${helper.token.slice(0, 10)}...`, e.message);
    }
}

async function startAllHelperBots() {
    for (const helper of data.helperBots) {
        if (!helper.botInstance) await startHelperBot(helper);
    }
}

// ========== دستورات ==========
mainBot.command("start", async (ctx) => {
    await ctx.reply(
        `👋 **پنل مرکزی ری‌اکشن‌گذار**\n\n` +
        `📡 کانال‌ها:\n/addchannel @username\n/channels\n\n` +
        `😀 ری‌اکشن‌ها:\n/addreaction 😀\n/reactions\n\n` +
        `🤖 ربات‌های کمکی:\n/addbot <token>\n/bots\n/removebot <id>\n\n` +
        `📊 /status`,
        { parse_mode: "Markdown" }
    );
});

mainBot.command("addbot", async (ctx) => {
    const token = ctx.message.text.trim().split(/\s+/)[1];
    if (!token || !token.includes(":")) {
        return ctx.reply("📝 استفاده: `/addbot 123456:AAF...`");
    }

    const id = Date.now().toString().slice(-6);
    const newBot = { id, token, username: "در حال بررسی...", botInstance: null };

    try {
        const tempBot = new Bot(token);
        const me = await tempBot.api.getMe();
        newBot.username = `@${me.username}`;
    } catch (e) {
        return ctx.reply("❌ توکن نامعتبر است!");
    }

    data.helperBots.push(newBot);
    await saveData();
    await startHelperBot(newBot);

    await ctx.reply(
        `✅ ربات ${newBot.username} اضافه و فعال شد!\n` +
        `🆔 شناسه: ${newBot.id}`
    );
});

mainBot.command("bots", async (ctx) => {
    if (data.helperBots.length === 0) {
        return ctx.reply("🤖 هنوز هیچ ربات کمکی اضافه نشده.");
    }

    let text = `🤖 **ربات‌های فعال: ${data.helperBots.length + 1}** (شامل اصلی)\n\n`;
    text += `1. ربات اصلی (این ربات)\n`;

    data.helperBots.forEach((b, i) => {
        text += `${i+2}. ${b.username} | ID: ${b.id}\n`;
    });

    await ctx.reply(text);
});

mainBot.command("removebot", async (ctx) => {
    const id = ctx.message.text.trim().split(/\s+/)[1];
    if (!id) return ctx.reply("📝 استفاده: `/removebot <id>`");

    const index = data.helperBots.findIndex(b => b.id === id);
    if (index === -1) return ctx.reply("❌ ربات با این شناسه یافت نشد.");

    const removed = data.helperBots[index];
    data.helperBots.splice(index, 1);
    await saveData();

    await ctx.reply(`🗑️ ربات ${removed.username} حذف شد.`);
});

// بقیه دستورات کانال و ری‌اکشن مثل قبل...

mainBot.command("channels", async (ctx) => { /* ... همان کد قبلی */ });
mainBot.command("addchannel", async (ctx) => { /* ... همان کد قبلی با getChat */ });
mainBot.command("status", async (ctx) => {
    await ctx.reply(
        `📊 **وضعیت پنل**\n\n` +
        `📡 کانال‌ها: ${data.channels.length}\n` +
        `😀 ری‌اکشن‌ها: ${data.reactions.size}\n` +
        `🤖 ربات‌های کمکی: ${data.helperBots.length}\n` +
        `🟢 همه فعال`
    );
});

// ========== اجرا ==========
async function main() {
    await loadData();
    await startAllHelperBots();

    mainBot.on("channel_post", async (ctx) => {
        const chatId = ctx.chat.id.toString();
        if (!channelMap.has(chatId)) return;

        const reactionsArray = Array.from(data.reactions);
        const randomEmoji = reactionsArray[Math.floor(Math.random() * reactionsArray.length)];

        try {
            await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, [{ type: "emoji", emoji: randomEmoji }]);
        } catch (e) {}
    });

    console.log("🚀 پنل مرکزی شروع شد...");
    await mainBot.start();
    console.log("✅ پنل آماده است. ربات‌های کمکی هم فعال شدند.");
}

main().catch(console.error);
