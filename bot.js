const { Bot } = require("grammy");
const fs = require("fs");

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

function addChannel(channelId) {
    const data = loadData();
    if (data.channels.some(c => c.channel_id === channelId)) {
        return { success: false, message: "❌ این کانال قبلاً اضافه شده!" };
    }
    data.channels.push({ channel_id: channelId, is_active: true });
    saveData(data);
    return { success: true, message: `✅ کانال ${channelId} اضافه شد!` };
}

function removeChannel(channelId) {
    const data = loadData();
    const existed = data.channels.some(c => c.channel_id === channelId);
    data.channels = data.channels.filter(c => c.channel_id !== channelId);
    saveData(data);
    return existed ? `🗑️ کانال ${channelId} حذف شد!` : "❌ کانالی با این شناسه یافت نشد";
}

function getChannels() {
    return loadData().channels;
}

function addReaction(emoji) {
    const data = loadData();
    if (data.reactions.includes(emoji)) {
        return { success: false, message: "❌ این ایموجی قبلاً اضافه شده!" };
    }
    data.reactions.push(emoji);
    saveData(data);
    return { success: true, message: `✅ ایموجی ${emoji} اضافه شد!` };
}

function removeReaction(emoji) {
    const data = loadData();
    const existed = data.reactions.includes(emoji);
    data.reactions = data.reactions.filter(e => e !== emoji);
    saveData(data);
    return existed ? `🗑️ ایموجی ${emoji} حذف شد!` : "❌ ایموجی یافت نشد";
}

function getReactions() {
    return loadData().reactions;
}

function addLog(channelId, postId, emoji, status) {
    const data = loadData();
    data.logs.unshift({ channelId, postId, emoji, status, time: new Date().toISOString() });
    if (data.logs.length > 100) data.logs = data.logs.slice(0, 100);
    saveData(data);
}

function getLogs() {
    return loadData().logs;
}

function getStats() {
    const data = loadData();
    const successLogs = data.logs.filter(l => l.status === "success").length;
    const failLogs = data.logs.filter(l => l.status === "fail").length;
    return {
        channels: data.channels.length,
        reactions: data.reactions.length,
        total: data.logs.length,
        success: successLogs,
        fail: failLogs
    };
}

// ========== تابع ری‌اکشن ==========
async function reactToPost(ctx) {
    const data = loadData();
    const chatId = ctx.chat.id.toString();
    
    // بررسی اینکه کانال در لیست هست یا نه
    if (!data.channels.some(c => c.channel_id === chatId && c.is_active)) {
        return;
    }
    
    if (data.reactions.length === 0) return;
    
    // انتخاب تصادفی
    const randomEmoji = data.reactions[Math.floor(Math.random() * data.reactions.length)];
    
    try {
        await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, {
            reaction: [{ type: "emoji", emoji: randomEmoji }]
        });
        addLog(chatId, ctx.msg.message_id.toString(), randomEmoji, "success");
        console.log(`✅ ${randomEmoji} به پست ${ctx.msg.message_id} در ${chatId} زده شد`);
    } catch (e) {
        addLog(chatId, ctx.msg.message_id.toString(), "❌", "fail");
        console.error(`❌ خطا در ری‌اکشن: ${e.message}`);
    }
}

// ========== گوش دادن به پست‌های کانال ==========
bot.on("channel_post", reactToPost);
bot.on("message", async (ctx) => {
    if (ctx.chat?.type === "channel") {
        await reactToPost(ctx);
    }
});

// ========== دستورات ==========

// استارت
bot.command("start", async (ctx) => {
    const reactions = getReactions();
    await ctx.reply(
        `👋 **ربات ری‌اکشن‌گذار چندگانه**\n\n` +
        `📡 **کانال‌ها:**\n` +
        `/addchannel @username - اضافه کردن کانال\n` +
        `/removechannel @username - حذف کانال\n` +
        `/channels - لیست کانال‌ها\n\n` +
        `😀 **ری‌اکشن‌ها:**\n` +
        `/addreaction 😀 - اضافه کردن ری‌اکشن\n` +
        `/removereaction 😀 - حذف ری‌اکشن\n` +
        `/reactions - لیست ری‌اکشن‌ها\n\n` +
        `📊 /status - وضعیت سیستم\n` +
        `📋 /logs - آخرین لاگ‌ها\n\n` +
        `🔹 ری‌اکشن‌های فعلی: ${reactions.join(" ")}`,
        { parse_mode: "Markdown" }
    );
});

// راهنما
bot.command("help", async (ctx) => {
    await ctx.reply(
        `📚 **راهنمای کامل:**\n\n` +
        `📡 **کانال‌ها:**\n` +
        `/addchannel @username - اضافه کردن کانال\n` +
        `/removechannel @username - حذف کانال\n` +
        `/channels - لیست کانال‌ها\n\n` +
        `😀 **ری‌اکشن‌ها:**\n` +
        `/addreaction 😀 - اضافه کردن ری‌اکشن\n` +
        `/removereaction 😀 - حذف ری‌اکشن\n` +
        `/reactions - لیست ری‌اکشن‌ها\n\n` +
        `📊 /status - وضعیت سیستم\n` +
        `📋 /logs - آخرین لاگ‌ها`,
        { parse_mode: "Markdown" }
    );
});

// افزودن کانال
bot.command("addchannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/addchannel @channel_username`\n\n⚠️ ربات باید ادمین کانال باشد!", { parse_mode: "Markdown" });
        return;
    }
    const result = addChannel(args[1]);
    await ctx.reply(result.message);
});

// حذف کانال
bot.command("removechannel", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removechannel @channel_username`", { parse_mode: "Markdown" });
        return;
    }
    const result = removeChannel(args[1]);
    await ctx.reply(result);
});

// لیست کانال‌ها
bot.command("channels", async (ctx) => {
    const channels = getChannels();
    if (channels.length === 0) {
        await ctx.reply("📭 هنوز هیچ کانالی اضافه نشده است.");
        return;
    }
    let msg = "📡 **لیست کانال‌ها:**\n\n";
    for (let i = 0; i < channels.length; i++) {
        const c = channels[i];
        const status = c.is_active ? "✅ فعال" : "❌ غیرفعال";
        msg += `${i + 1}. ${c.channel_id} — ${status}\n`;
    }
    await ctx.reply(msg, { parse_mode: "Markdown" });
});

// افزودن ری‌اکشن
bot.command("addreaction", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/addreaction 😀`", { parse_mode: "Markdown" });
        return;
    }
    const result = addReaction(args[1]);
    await ctx.reply(result.message);
});

// حذف ری‌اکشن
bot.command("removereaction", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removereaction 😀`", { parse_mode: "Markdown" });
        return;
    }
    const result = removeReaction(args[1]);
    await ctx.reply(result);
});

// لیست ری‌اکشن‌ها
bot.command("reactions", async (ctx) => {
    const reactions = getReactions();
    if (reactions.length === 0) {
        await ctx.reply("📭 هیچ ری‌اکشنی تعریف نشده است.");
        return;
    }
    await ctx.reply(`📋 **ری‌اکشن‌ها (${reactions.length}):**\n\n${reactions.join("  ")}`, { parse_mode: "Markdown" });
});

// لاگ‌ها
bot.command("logs", async (ctx) => {
    const logs = getLogs();
    if (logs.length === 0) {
        await ctx.reply("📭 هیچ لاگی وجود ندارد.");
        return;
    }
    let msg = "📋 **آخرین لاگ‌ها:**\n\n";
    for (const log of logs.slice(0, 10)) {
        const status = log.status === "success" ? "✅" : "❌";
        msg += `${status} ${log.channelId} — #${log.postId} — ${log.emoji}\n`;
    }
    await ctx.reply(msg, { parse_mode: "Markdown" });
});

// وضعیت
bot.command("status", async (ctx) => {
    const stats = getStats();
    await ctx.reply(
        `📊 **وضعیت سیستم**\n\n` +
        `📡 کانال‌های فعال: ${stats.channels}\n` +
        `😀 ری‌اکشن‌ها: ${stats.reactions}\n` +
        `📈 کل عملیات: ${stats.total}\n` +
        `✅ موفق: ${stats.success}\n` +
        `❌ ناموفق: ${stats.fail}\n\n` +
        `🟢 سیستم فعال است`,
        { parse_mode: "Markdown" }
    );
});

// ========== اجرا ==========
console.log("🚀 در حال اجرای ربات...");
bot.start();
console.log("✅ ربات با موفقیت اجرا شد!");
console.log("📺 منتظر پیام‌ها هستم...");
