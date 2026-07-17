const { Bot } = require("grammy");
const fs = require("fs");

// ========== توکن ربات ==========
const BOT_TOKEN = "7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg";
const bot = new Bot(BOT_TOKEN);

const DATA_FILE = "data.json";

// ========== مدیریت دیتا ==========
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        }
    } catch (e) {
        console.error("خطا در بارگذاری:", e);
    }
    return { bots: [], channels: [], reactions: ["🔥", "⚡", "🕊️", "👌", "🎉"], logs: [] };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ========== توابع ==========
function addBot(token, username) {
    const data = loadData();
    if (data.bots.some(b => b.token === token)) {
        return { success: false, message: "❌ توکن تکراری!" };
    }
    const id = data.bots.length > 0 ? Math.max(...data.bots.map(b => b.id)) + 1 : 1;
    data.bots.push({ id, token, username, is_active: true });
    saveData(data);
    return { success: true, id };
}

function removeBot(id) {
    const data = loadData();
    data.bots = data.bots.filter(b => b.id !== id);
    saveData(data);
    return true;
}

function getBots() {
    const data = loadData();
    return data.bots;
}

function addChannel(channelId) {
    const data = loadData();
    if (data.channels.some(c => c.channel_id === channelId)) {
        return { success: false, message: "❌ کانال تکراری!" };
    }
    data.channels.push({ channel_id: channelId, is_active: true });
    saveData(data);
    return { success: true };
}

function removeChannel(channelId) {
    const data = loadData();
    data.channels = data.channels.filter(c => c.channel_id !== channelId);
    saveData(data);
    return true;
}

function getChannels() {
    const data = loadData();
    return data.channels;
}

function addReaction(emoji) {
    const data = loadData();
    if (data.reactions.includes(emoji)) {
        return { success: false, message: "❌ ایموجی تکراری!" };
    }
    data.reactions.push(emoji);
    saveData(data);
    return { success: true };
}

function removeReaction(emoji) {
    const data = loadData();
    data.reactions = data.reactions.filter(e => e !== emoji);
    saveData(data);
    return true;
}

function getReactions() {
    const data = loadData();
    return data.reactions;
}

function addLog(channelId, postId, emoji, status) {
    const data = loadData();
    data.logs.unshift({ channelId, postId, emoji, status, time: new Date().toISOString() });
    if (data.logs.length > 100) data.logs = data.logs.slice(0, 100);
    saveData(data);
}

function getLogs() {
    const data = loadData();
    return data.logs;
}

function getStats() {
    const data = loadData();
    const successLogs = data.logs.filter(l => l.status === "success").length;
    const failLogs = data.logs.filter(l => l.status === "fail").length;
    return {
        bots: data.bots.length,
        channels: data.channels.length,
        reactions: data.reactions.length,
        total: data.logs.length,
        success: successLogs,
        fail: failLogs
    };
}

// ========== ری‌اکشن ==========
async function reactToPost(ctx) {
    const data = loadData();
    const chatId = ctx.chat.id.toString();
    
    if (!data.channels.some(c => c.channel_id === chatId && c.is_active)) return;
    if (data.reactions.length === 0) return;
    
    const randomEmoji = data.reactions[Math.floor(Math.random() * data.reactions.length)];
    
    try {
        await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, {
            reaction: [{ type: "emoji", emoji: randomEmoji }]
        });
        addLog(chatId, ctx.msg.message_id.toString(), randomEmoji, "success");
        console.log(`✅ ${randomEmoji} به ${chatId} زده شد`);
    } catch (e) {
        addLog(chatId, ctx.msg.message_id.toString(), "❌", "fail");
        console.error(`❌ خطا: ${e.message}`);
    }
}

// ========== گوش دادن ==========
bot.on("channel_post", reactToPost);
bot.on("message", async (ctx) => {
    if (ctx.chat?.type === "channel") await reactToPost(ctx);
});

// ========== دستورات ==========

// دستور start - حتماً جواب میده
bot.command("start", async (ctx) => {
    console.log("📩 پیام /start دریافت شد از:", ctx.from?.id);
    const reactions = getReactions();
    await ctx.reply(
        `👋 سلام! به ربات ری‌اکشن‌گذار خوش اومدی!\n\n` +
        `📡 کانال‌ها:\n` +
        `/addchannel @username\n` +
        `/removechannel @username\n` +
        `/channels\n\n` +
        `😀 ری‌اکشن‌ها:\n` +
        `/addreaction emoji\n` +
        `/removereaction emoji\n` +
        `/reactions\n\n` +
        `🤖 ربات‌های کمکی:\n` +
        `/addbot TOKEN\n` +
        `/removebot ID\n` +
        `/bots\n\n` +
        `📊 /status\n` +
        `📋 /logs\n\n` +
        `🔹 ری‌اکشن‌های فعلی: ${reactions.join(" ")}`
    );
});

bot.command("help", async (ctx) => {
    await ctx.reply(
        `📚 راهنمای کامل:\n\n` +
        `🤖 ربات‌ها:\n` +
        `/addbot TOKEN - اضافه کردن ربات کمکی\n` +
        `/removebot ID - حذف ربات کمکی\n` +
        `/bots - لیست ربات‌ها\n\n` +
        `📡 کانال‌ها:\n` +
        `/addchannel @username - اضافه کردن کانال\n` +
        `/removechannel @username - حذف کانال\n` +
        `/channels - لیست کانال‌ها\n\n` +
        `😀 ری‌اکشن‌ها:\n` +
        `/addreaction 😀 - اضافه کردن ری‌اکشن\n` +
        `/removereaction 😀 - حذف ری‌اکشن\n` +
        `/reactions - لیست ری‌اکشن‌ها\n\n` +
        `📊 /status - وضعیت سیستم\n` +
        `📋 /logs - آخرین لاگ‌ها`
    );
});

bot.command("addbot", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("⚠️ توکن را وارد کنید: `/addbot TOKEN`");
        return;
    }
    try {
        const testBot = new Bot(args[1]);
        const info = await testBot.api.getMe();
        const result = addBot(args[1], info.username);
        if (result.success) {
            await ctx.reply(`✅ ربات @${info.username} اضافه شد! شناسه: ${result.id}`);
        } else {
            await ctx.reply(result.message);
        }
    } catch {
        await ctx.reply("❌ توکن نامعتبر!");
    }
});

bot.command("removebot", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removebot ID`");
        return;
    }
    const id = parseInt(args[1]);
    if (isNaN(id)) {
        await ctx.reply("❌ شناسه باید عدد باشد!");
        return;
    }
    removeBot(id);
    await ctx.reply("🗑️ ربات حذف شد!");
});

bot.command("bots", async (ctx) => {
    const bots = getBots();
    if (bots.length === 0) {
        await ctx.reply("📭 هیچ رباتی وجود ندارد.");
        return;
    }
    let msg = "🤖 ربات‌های کمکی:\n\n";
    for (const b of bots) {
        msg += `🟢 @${b.username} - شناسه: ${b.id} | حذف: /removebot ${b.id}\n`;
    }
    await ctx.reply(msg);
});

bot.command("addchannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/addchannel @username`");
        return;
    }
    const result = addChannel(args[1]);
    await ctx.reply(result.success ? `✅ کانال ${args[1]} اضافه شد!` : result.message);
});

bot.command("removechannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removechannel @username`");
        return;
    }
    removeChannel(args[1]);
    await ctx.reply("🗑️ کانال حذف شد!");
});

bot.command("channels", async (ctx) => {
    const channels = getChannels();
    if (channels.length === 0) {
        await ctx.reply("📭 هیچ کانالی وجود ندارد.");
        return;
    }
    let msg = "📡 کانال‌ها:\n\n";
    for (let i = 0; i < channels.length; i++) {
        const c = channels[i];
        const status = c.is_active ? "✅ فعال" : "❌ غیرفعال";
        msg += `${i + 1}. ${c.channel_id} - ${status}\n`;
    }
    await ctx.reply(msg);
});

bot.command("addreaction", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/addreaction 😀`");
        return;
    }
    const result = addReaction(args[1]);
    await ctx.reply(result.success ? `✅ ${args[1]} اضافه شد!` : result.message);
});

bot.command("removereaction", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removereaction 😀`");
        return;
    }
    removeReaction(args[1]);
    await ctx.reply(`🗑️ ${args[1]} حذف شد!`);
});

bot.command("reactions", async (ctx) => {
    const reactions = getReactions();
    if (reactions.length === 0) {
        await ctx.reply("📭 هیچ ری‌اکشنی وجود ندارد.");
        return;
    }
    await ctx.reply(`📋 ری‌اکشن‌ها (${reactions.length}):\n\n${reactions.join("  ")}`);
});

bot.command("logs", async (ctx) => {
    const logs = getLogs();
    if (logs.length === 0) {
        await ctx.reply("📭 لاگی وجود ندارد.");
        return;
    }
    let msg = "📋 آخرین لاگ‌ها:\n\n";
    for (const log of logs.slice(0, 10)) {
        const status = log.status === "success" ? "✅" : "❌";
        msg += `${status} ${log.channelId} — #${log.postId} — ${log.emoji}\n`;
    }
    await ctx.reply(msg);
});

bot.command("status", async (ctx) => {
    const stats = getStats();
    await ctx.reply(
        `📊 وضعیت سیستم\n\n` +
        `🤖 ربات‌های فعال: ${stats.bots + 1} (۱ اصلی + ${stats.bots} کمکی)\n` +
        `📡 کانال‌های فعال: ${stats.channels}\n` +
        `😀 ری‌اکشن‌ها: ${stats.reactions}\n\n` +
        `📈 آخرین عملیات:\n` +
        `✅ موفق: ${stats.success}\n` +
        `❌ ناموفق: ${stats.fail}\n\n` +
        `🟢 سیستم فعال است`
    );
});

// ========== اجرا ==========

async function main() {
    console.log("🚀 در حال اجرای ربات...");
    bot.start();
    console.log("✅ ربات با موفقیت اجرا شد!");
    console.log("📺 منتظر پیام‌ها هستم...");
}

main().catch(console.error);
