// ========== نسخه بدون دیتابیس (فقط با فایل JSON) ==========

const { Bot } = require("grammy");
const fs = require("fs");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN || "توکن_ربات_اینجا";
const bot = new Bot(BOT_TOKEN);

const DATA_FILE = "data.json";

// ========== مدیریت دیتا با فایل JSON ==========

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

function addLog(channelId, postId, emoji, status) {
    const data = loadData();
    data.logs.unshift({ channelId, postId, emoji, status, time: new Date().toISOString() });
    if (data.logs.length > 100) data.logs = data.logs.slice(0, 100);
    saveData(data);
}

// ========== ری‌اکشن ==========

async function reactToPost(ctx) {
    const data = loadData();
    const chatId = ctx.chat.id.toString();
    
    // بررسی مجاز بودن کانال
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
    const data = loadData();
    if (data.bots.length === 0) {
        await ctx.reply("📭 هیچ رباتی وجود ندارد.");
        return;
    }
    let msg = "🤖 ربات‌های کمکی:\n\n";
    for (const b of data.bots) {
        msg += `🟢 @${b.username} - شناسه: ${b.id}\n`;
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
    const data = loadData();
    if (data.channels.length === 0) {
        await ctx.reply("📭 هیچ کانالی وجود ندارد.");
        return;
    }
    let msg = "📡 کانال‌ها:\n\n";
    for (const c of data.channels) {
        msg += `• ${c.channel_id} ${c.is_active ? "✅" : "❌"}\n`;
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
    const data = loadData();
    await ctx.reply(`📋 ری‌اکشن‌ها:\n\n${data.reactions.join("  ")}`);
});

bot.command("logs", async (ctx) => {
    const data = loadData();
    if (data.logs.length === 0) {
        await ctx.reply("📭 لاگی وجود ندارد.");
        return;
    }
    let msg = "📋 آخرین لاگ‌ها:\n\n";
    for (const log of data.logs.slice(0, 10)) {
        const status = log.status === "success" ? "✅" : "❌";
        msg += `${status} ${log.channelId} - ${log.emoji}\n`;
    }
    await ctx.reply(msg);
});

bot.command("status", async (ctx) => {
    const data = loadData();
    await ctx.reply(
        `📊 وضعیت:\n\n` +
        `🤖 ربات‌ها: ${data.bots.length}\n` +
        `📡 کانال‌ها: ${data.channels.length}\n` +
        `😀 ری‌اکشن‌ها: ${data.reactions.length}\n` +
        `📋 لاگ‌ها: ${data.logs.length}\n\n` +
        `🟢 سیستم فعال است`
    );
});

bot.command("start", async (ctx) => {
    await ctx.reply(
        `👋 ربات ری‌اکشن‌گذار\n\n` +
        `/addchannel @username - اضافه کردن کانال\n` +
        `/removechannel @username - حذف کانال\n` +
        `/channels - لیست کانال‌ها\n\n` +
        `/addreaction 😀 - اضافه کردن ری‌اکشن\n` +
        `/removereaction 😀 - حذف ری‌اکشن\n` +
        `/reactions - لیست ری‌اکشن‌ها\n\n` +
        `/addbot TOKEN - اضافه کردن ربات کمکی\n` +
        `/removebot ID - حذف ربات کمکی\n` +
        `/bots - لیست ربات‌ها\n\n` +
        `/status - وضعیت سیستم\n` +
        `/logs - آخرین لاگ‌ها`
    );
});

// ========== اجرا ==========

bot.start();
console.log(`🚀 ربات ${bot.botInfo.username} اجرا شد!`);
