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
        console.error("خطا در بارگذاری داده‌ها:", e);
    }
    return { 
        channels: [], 
        reactions: ["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"], 
        logs: [] 
    };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function addChannel(input) {
    const data = loadData();
    const channelId = input.startsWith("-100") ? input : input; // فعلاً مستقیم ذخیره می‌کنیم

    if (data.channels.some(c => c.channel_id === channelId || c.username === input)) {
        return { success: false, message: "❌ این کانال قبلاً اضافه شده است!" };
    }

    data.channels.push({ 
        channel_id: channelId, 
        username: input.startsWith("@") ? input : null,
        is_active: true 
    });
    
    saveData(data);
    return { success: true, message: `✅ کانال ${input} با موفقیت اضافه شد!` };
}

function removeChannel(input) {
    const data = loadData();
    const initialLength = data.channels.length;

    data.channels = data.channels.filter(c => 
        c.channel_id !== input && c.username !== input
    );

    saveData(data);
    return initialLength > data.channels.length 
        ? `🗑️ کانال ${input} حذف شد!` 
        : "❌ کانالی با این شناسه یافت نشد!";
}

function getChannels() {
    return loadData().channels;
}

function addReaction(emoji) {
    const data = loadData();
    if (data.reactions.includes(emoji)) {
        return { success: false, message: "❌ این ایموجی قبلاً اضافه شده است!" };
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
    return existed ? `🗑️ ایموجی ${emoji} حذف شد!` : "❌ ایموجی یافت نشد!";
}

function getReactions() {
    return loadData().reactions;
}

function addLog(channelId, postId, emoji, status) {
    const data = loadData();
    data.logs.unshift({
        channelId,
        postId,
        emoji,
        status,
        time: new Date().toISOString()
    });
    if (data.logs.length > 200) data.logs = data.logs.slice(0, 200);
    saveData(data);
}

function getLogs() {
    return loadData().logs;
}

function getStats() {
    const data = loadData();
    const success = data.logs.filter(l => l.status === "success").length;
    const fail = data.logs.filter(l => l.status === "fail").length;

    return {
        channels: data.channels.length,
        reactions: data.reactions.length,
        total: data.logs.length,
        success,
        fail
    };
}

// ========== تابع اصلی ری‌اکشن ==========
async function reactToPost(ctx) {
    const data = loadData();
    const chatId = ctx.chat.id.toString();

    // پیدا کردن کانال (هم با ID هم با username)
    const channel = data.channels.find(c => 
        c.channel_id === chatId || 
        (c.username && ctx.chat.username && `@${ctx.chat.username}` === c.username)
    );

    if (!channel || !channel.is_active) return;
    if (data.reactions.length === 0) return;

    const randomEmoji = data.reactions[Math.floor(Math.random() * data.reactions.length)];

    try {
        await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, [
            { type: "emoji", emoji: randomEmoji }
        ]);

        addLog(chatId, ctx.msg.message_id.toString(), randomEmoji, "success");
        console.log(`✅ ${randomEmoji} زده شد | پست: ${ctx.msg.message_id} | کانال: ${chatId}`);
    } catch (e) {
        addLog(chatId, ctx.msg.message_id.toString(), randomEmoji, "fail");
        console.error(`❌ خطا در ری‌اکشن: ${e.message}`);
    }
}

// ========== Listenerها ==========
bot.on("channel_post", reactToPost);

// ========== دستورات ==========
bot.command("start", async (ctx) => {
    const reactions = getReactions();
    await ctx.reply(
        `👋 **ربات ری‌اکشن‌گذار خودکار**\n\n` +
        `📡 **مدیریت کانال‌ها:**\n` +
        `/addchannel @username — اضافه کردن\n` +
        `/removechannel @username — حذف\n` +
        `/channels — لیست کانال‌ها\n\n` +
        `😀 **مدیریت ری‌اکشن‌ها:**\n` +
        `/addreaction 😀 — اضافه کردن\n` +
        `/removereaction 😀 — حذف\n` +
        `/reactions — لیست ری‌اکشن‌ها\n\n` +
        `📊 /status — وضعیت\n` +
        `📋 /logs — لاگ‌ها\n\n` +
        `🔹 ری‌اکشن‌های فعلی: ${reactions.join(" ")}`,
        { parse_mode: "Markdown" }
    );
});

bot.command("addchannel", async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    if (args.length < 2) {
        return ctx.reply("📝 استفاده صحیح:\n`/addchannel @username`\nیا\n`/addchannel -1001234567890`", 
            { parse_mode: "Markdown" });
    }
    const result = addChannel(args[1]);
    await ctx.reply(result.message);
});

bot.command("removechannel", async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    if (args.length < 2) {
        return ctx.reply("📝 استفاده: `/removechannel @username`", { parse_mode: "Markdown" });
    }
    const result = removeChannel(args[1]);
    await ctx.reply(result);
});

bot.command("channels", async (ctx) => {
    const channels = getChannels();
    if (channels.length === 0) {
        return ctx.reply("📭 هنوز هیچ کانالی اضافه نشده است.");
    }

    let text = "📡 **لیست کانال‌ها:**\n\n";
    channels.forEach((c, i) => {
        const status = c.is_active ? "✅ فعال" : "❌ غیرفعال";
        text += `${i + 1}. ${c.username || c.channel_id} — ${status}\n`;
    });

    await ctx.reply(text, { parse_mode: "Markdown" });
});

bot.command("addreaction", async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    if (args.length < 2) {
        return ctx.reply("📝 استفاده: `/addreaction 😀`", { parse_mode: "Markdown" });
    }
    const result = addReaction(args[1]);
    await ctx.reply(result.message);
});

bot.command("removereaction", async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    if (args.length < 2) {
        return ctx.reply("📝 استفاده: `/removereaction 😀`", { parse_mode: "Markdown" });
    }
    const result = removeReaction(args[1]);
    await ctx.reply(result);
});

bot.command("reactions", async (ctx) => {
    const reactions = getReactions();
    if (reactions.length === 0) {
        return ctx.reply("📭 هیچ ری‌اکشنی تعریف نشده است.");
    }
    await ctx.reply(`📋 **ری‌اکشن‌های فعلی (\( {reactions.length}):**\n\n \){reactions.join("  ")}`, 
        { parse_mode: "Markdown" });
});

bot.command("logs", async (ctx) => {
    const logs = getLogs();
    if (logs.length === 0) {
        return ctx.reply("📭 هنوز هیچ لاگی ثبت نشده است.");
    }

    let text = "📋 **آخرین لاگ‌ها:**\n\n";
    logs.slice(0, 15).forEach(log => {
        const status = log.status === "success" ? "✅" : "❌";
        text += `${status} \( {log.channelId} — # \){log.postId} — ${log.emoji}\n`;
    });

    await ctx.reply(text, { parse_mode: "Markdown" });
});

bot.command("status", async (ctx) => {
    const stats = getStats();
    await ctx.reply(
        `📊 **وضعیت ربات**\n\n` +
        `📡 کانال‌های اضافه شده: ${stats.channels}\n` +
        `😀 تعداد ری‌اکشن‌ها: ${stats.reactions}\n` +
        `📈 کل عملیات: ${stats.total}\n` +
        `✅ موفق: ${stats.success}\n` +
        `❌ ناموفق: ${stats.fail}\n\n` +
        `🟢 ربات فعال و در حال اجراست`,
        { parse_mode: "Markdown" }
    );
});

bot.command("help", async (ctx) => {
    await ctx.reply(
        `📚 **راهنمای ربات ری‌اکشن‌گذار**\n\n` +
        `ربات باید ادمین کانال باشد.\n\n` +
        `برای اطلاعات بیشتر دستور /start را بزنید.`,
        { parse_mode: "Markdown" }
    );
});

// ========== اجرا ==========
console.log("🚀 ربات در حال شروع...");
bot.start();
console.log("✅ ربات با موفقیت اجرا شد!");
console.log("📺 در حال نظارت بر کانال‌ها...");
