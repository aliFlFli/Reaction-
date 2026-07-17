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
const botInstances = new Map(); // برای نگهداری نمونه‌های ربات

// پاکسازی
try {
    execSync('pkill -f "node bot.js" || true', { stdio: 'ignore' });
    console.log("🧹 فرآیندهای قبلی پاک شدند");
} catch (e) {}

// لود و سیو
async function loadData() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        const loaded = JSON.parse(raw);
        data.channels = loaded.channels || [];
        data.helperBots = loaded.helperBots || [];
        data.reactions = new Set(loaded.reactions || ["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]);

        data.channels.forEach(c => channelMap.set(c.channel_id, c));
    } catch (e) {
        console.log("📁 داده‌های پیش‌فرض لود شد.");
    }
}

async function saveData() {
    const toSave = {
        channels: data.channels,
        reactions: Array.from(data.reactions),
        helperBots: data.helperBots.map(b => ({ id: b.id, token: b.token, username: b.username }))
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(toSave, null, 2));
}

// هندلر ری‌اکشن - یکبار تعریف می‌شود
const createReactionHandler = () => async (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (!channelMap.has(chatId)) return;

    const reactionsArr = Array.from(data.reactions);
    const emoji = reactionsArr[Math.floor(Math.random() * reactionsArr.length)];

    try {
        await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, [{ type: "emoji", emoji }]);
    } catch (e) {
        console.log(`خطا در ارسال ری‌اکشن: ${e.message}`);
    }
};

// راه‌اندازی ربات کمکی با مدیریت خطا
async function startHelperBot(helper) {
    // اگر قبلاً راه‌اندازی شده، متوقفش کن
    if (botInstances.has(helper.id)) {
        const oldBot = botInstances.get(helper.id);
        try {
            await oldBot.stop();
        } catch (e) {}
        botInstances.delete(helper.id);
    }

    try {
        const bot = new Bot(helper.token);
        
        // تنظیم handler برای channel_post
        bot.on("channel_post", createReactionHandler());
        
        // تنظیم handler برای خطاها
        bot.catch((err) => {
            console.error(`❌ خطا در ربات ${helper.username}:`, err);
        });
        
        // شروع با تنظیمات مناسب
        await bot.start({
            drop_pending_updates: true,
            onStart: (botInfo) => {
                console.log(`✅ ${helper.username} (${botInfo.username}) فعال شد`);
            }
        });
        
        // ذخیره نمونه ربات
        botInstances.set(helper.id, bot);
        helper.botInstance = bot;
        
        return true;
    } catch (e) {
        console.error(`❌ خطا در راه‌اندازی ${helper.username}:`, e.message);
        return false;
    }
}

async function startAllHelpers() {
    const results = [];
    for (const h of data.helperBots) {
        const success = await startHelperBot(h);
        results.push({ username: h.username, success });
    }
    return results;
}

// متوقف کردن همه ربات‌های کمکی
async function stopAllHelpers() {
    for (const [id, bot] of botInstances) {
        try {
            await bot.stop();
            console.log(`🛑 ربات ${id} متوقف شد`);
        } catch (e) {
            console.error(`خطا در توقف ربات ${id}:`, e.message);
        }
    }
    botInstances.clear();
}

// دستورات
mainBot.command("start", async (ctx) => {
    await ctx.reply(
        `👋 **ربات ری‌اکشن‌گذار چندگانه**\n\n` +
        `📡 کانال‌ها:\n/addchannel @username\n/channels\n/removechannel @username\n\n` +
        `😀 ری‌اکشن‌ها:\n/addreaction 😀\n/removereaction 😀\n/reactions\n\n` +
        `🤖 ربات‌های کمکی:\n/addbot <token>\n/bots\n/removebot <id>\n\n` +
        `📊 /status\n` +
        `🔄 /restart (راه‌اندازی مجدد ربات‌های کمکی)`,
        { parse_mode: "Markdown" }
    );
});

mainBot.command("addchannel", async (ctx) => {
    const arg = ctx.message.text.trim().split(/\s+/)[1];
    if (!arg) return ctx.reply("📝 استفاده: `/addchannel @username`");

    let channelId = arg;
    let username = arg;
    
    if (arg.startsWith("@")) {
        try {
            const chat = await mainBot.api.getChat(arg);
            channelId = chat.id.toString();
        } catch (e) {
            return ctx.reply("❌ ربات ادمین کانال نیست.");
        }
    }

    if (channelMap.has(channelId)) return ctx.reply("❌ قبلاً اضافه شده!");

    const ch = { 
        channel_id: channelId, 
        username: username, 
        is_active: true 
    };
    
    data.channels.push(ch);
    channelMap.set(channelId, ch);
    await saveData();
    await ctx.reply(`✅ کانال ${username} اضافه شد!`);
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

mainBot.command("addreaction", async (ctx) => {
    const emoji = ctx.message.text.trim().split(/\s+/)[1];
    if (!emoji) return ctx.reply("📝 `/addreaction 😀`");
    if (data.reactions.has(emoji)) return ctx.reply("❌ قبلاً وجود دارد!");

    data.reactions.add(emoji);
    await saveData();
    await ctx.reply(`✅ ${emoji} اضافه شد!`);
});

mainBot.command("removereaction", async (ctx) => {
    const emoji = ctx.message.text.trim().split(/\s+/)[1];
    if (!emoji) return ctx.reply("📝 `/removereaction 😀`");
    if (data.reactions.delete(emoji)) {
        await saveData();
        await ctx.reply(`🗑️ ${emoji} حذف شد!`);
    } else {
        await ctx.reply("❌ یافت نشد!");
    }
});

mainBot.command("reactions", async (ctx) => {
    const list = Array.from(data.reactions).join(" ");
    await ctx.reply(`📋 **ری‌اکشن‌ها:**\n\n${list || "هیچ"}`);
});

mainBot.command("addbot", async (ctx) => {
    const token = ctx.message.text.trim().split(/\s+/)[1];
    if (!token) return ctx.reply("📝 `/addbot <token>`");

    let username = "نامشخص";
    try {
        const temp = new Bot(token);
        const me = await temp.api.getMe();
        username = `@${me.username}`;
    } catch (e) {
        return ctx.reply("❌ توکن اشتباه است!");
    }

    const id = Date.now().toString().slice(-6);
    const helper = { id, token, username, botInstance: null };

    data.helperBots.push(helper);
    await saveData();
    
    const success = await startHelperBot(helper);
    await ctx.reply(success ? 
        `✅ ${username} اضافه شد (ID: ${id})` : 
        `⚠️ ${username} اضافه شد اما راه‌اندازی نشد! (ID: ${id})`
    );
});

mainBot.command("bots", async (ctx) => {
    let str = `🤖 ربات‌های فعال: ${data.helperBots.length}\n\n`;
    data.helperBots.forEach((b,i) => {
        const status = botInstances.has(b.id) ? "🟢 فعال" : "🔴 غیرفعال";
        str += `${i+1}. ${b.username} | ${b.id} | ${status}\n`;
    });
    await ctx.reply(str);
});

mainBot.command("removebot", async (ctx) => {
    const id = ctx.message.text.trim().split(/\s+/)[1];
    if (!id) return ctx.reply("📝 `/removebot <id>`");

    const idx = data.helperBots.findIndex(b => b.id === id);
    if (idx === -1) return ctx.reply("❌ یافت نشد!");

    const removed = data.helperBots.splice(idx, 1)[0];
    
    // متوقف کردن ربات
    if (botInstances.has(id)) {
        try {
            await botInstances.get(id).stop();
            botInstances.delete(id);
        } catch (e) {}
    }
    
    await saveData();
    await ctx.reply(`🗑️ ربات ${removed.username} (${id}) حذف شد!`);
});

mainBot.command("restart", async (ctx) => {
    await ctx.reply("🔄 در حال راه‌اندازی مجدد ربات‌های کمکی...");
    await stopAllHelpers();
    const results = await startAllHelpers();
    const successCount = results.filter(r => r.success).length;
    await ctx.reply(`✅ ${successCount}/${results.length} ربات با موفقیت راه‌اندازی شدند.`);
});

mainBot.command("status", async (ctx) => {
    const activeHelpers = Array.from(botInstances.keys()).length;
    await ctx.reply(
        `📊 **وضعیت**\n\n` +
        `📡 کانال: ${data.channels.length}\n` +
        `😀 ری‌اکشن: ${data.reactions.size}\n` +
        `🤖 ربات کمکی: ${data.helperBots.length} (${activeHelpers} فعال)\n` +
        `🟢 ربات اصلی: فعال`,
        { parse_mode: "Markdown" }
    );
});

// اجرا
async function main() {
    try {
        await loadData();
        
        // تنظیم handler برای ربات اصلی
        mainBot.on("channel_post", createReactionHandler());
        
        // تنظیم مدیریت خطا برای ربات اصلی
        mainBot.catch((err) => {
            console.error("❌ خطا در ربات اصلی:", err);
        });

        console.log("🚀 پنل مرکزی شروع شد...");
        await mainBot.start();
        console.log("✅ ربات اصلی فعال شد.");

        await startAllHelpers();

        // مدیریت خروج برنامه
        process.on('SIGINT', async () => {
            console.log("\n🛑 در حال توقف...");
            await stopAllHelpers();
            await mainBot.stop();
            process.exit(0);
        });

    } catch (e) {
        console.error("خطای کلی:", e);
        process.exit(1);
    }
}

main();
