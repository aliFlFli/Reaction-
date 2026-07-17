const { Bot } = require("grammy");
const fs = require("fs").promises;
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN || "7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg";
const bot = new Bot(BOT_TOKEN);

const DATA_FILE = path.join(__dirname, "data.json");

// ========== متغیرهای در حافظه (In-Memory) ==========
let data = {
    channels: [],           // [{ channel_id, username, is_active }]
    reactions: new Set(["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]),
    logs: []
};

// نقشه برای جستجوی سریع O(1)
const channelMap = new Map(); // channel_id => channel object

// ========== لود و سیو دیتا ==========
async function loadData() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        const loaded = JSON.parse(raw);
        
        data.channels = loaded.channels || [];
        data.logs = loaded.logs || [];
        
        // بازسازی Set و Map
        data.reactions = new Set(loaded.reactions || ["🔥", "⚡", "🕊️", "👌", "🎉", "❤️"]);
        
        data.channels.forEach(ch => {
            if (ch.channel_id) channelMap.set(ch.channel_id, ch);
        });

        console.info("✅ داده‌ها از فایل بارگذاری شد.");
    } catch (e) {
        if (e.code !== "ENOENT") {
            console.error("خطا در خواندن فایل:", e);
        }
        console.info("📁 فایل داده وجود ندارد، داده‌های پیش‌فرض بارگذاری شد.");
    }
}

async function saveData() {
    try {
        const saveObj = {
            channels: data.channels,
            reactions: Array.from(data.reactions),
            logs: data.logs
        };
        await fs.writeFile(DATA_FILE, JSON.stringify(saveObj, null, 2));
    } catch (e) {
        console.error("❌ خطا در ذخیره‌سازی:", e);
    }
}

// ذخیره دوره‌ای هر ۳۰ ثانیه
setInterval(saveData, 30000);

// ذخیره هنگام خروج
process.on("SIGINT", async () => {
    console.info("💾 در حال ذخیره داده‌ها قبل از خروج...");
    await saveData();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    await saveData();
    process.exit(0);
});

// ========== توابع کمکی ==========
function getArg(ctx) {
    return ctx.message.text.trim().split(/\s+/)[1];
}

function addLog(channelId, postId, emoji, status) {
    const log = {
        channelId,
        postId,
        emoji,
        status,
        time: new Date().toISOString()
    };

    data.logs.push(log);
    if (data.logs.length > 300) {
        data.logs.shift(); // حذف قدیمی‌ترین
    }
}

// ========== ری‌اکشن ==========
async function reactToPost(ctx) {
    const chatId = ctx.chat.id.toString();
    
    const channel = channelMap.get(chatId);
    if (!channel || !channel.is_active) return;
    if (data.reactions.size === 0) return;

    // تبدیل Set به آرایه فقط یک بار
    const reactionsArray = Array.from(data.reactions);
    const randomEmoji = reactionsArray[Math.floor(Math.random() * reactionsArray.length)];

    try {
        await ctx.api.setMessageReaction(chatId, ctx.msg.message_id, [
            { type: "emoji", emoji: randomEmoji }
        ]);

        addLog(chatId, ctx.msg.message_id.toString(), randomEmoji, "success");
    } catch (e) {
        addLog(chatId, ctx.msg.message_id.toString(), randomEmoji, "fail");
        console.error(`خطا در ری‌اکشن به ${chatId}:`, e.message);
    }
}

// ========== دستورات ==========
bot.command("start", async (ctx) => {
    await ctx.reply(
        `👋 **ربات ری‌اکشن‌گذار بهینه**\n\n` +
        `📡 /addchannel @username\n` +
        `🗑️ /removechannel @username\n` +
        `📋 /channels\n\n` +
        `😀 /addreaction 😀\n` +
        `🗑️ /removereaction 😀\n` +
        `📋 /reactions\n\n` +
        `📊 /status\n` +
        `📜 /logs`,
        { parse_mode: "Markdown" }
    );
});

bot.command("addchannel", async (ctx) => {
    const input = getArg(ctx);
    if (!input) return ctx.reply("📝 استفاده: `/addchannel @username`", { parse_mode: "Markdown" });

    const channelId = input;
    if (channelMap.has(channelId)) {
        return ctx.reply("❌ این کانال قبلاً اضافه شده است!");
    }

    const newChannel = { channel_id: channelId, username: input.startsWith("@") ? input : null, is_active: true };
    data.channels.push(newChannel);
    channelMap.set(channelId, newChannel);

    await ctx.reply(`✅ کانال ${input} اضافه شد!`);
    await saveData(); // ذخیره فوری بعد از تغییر مهم
});

bot.command("removechannel", async (ctx) => {
    const input = getArg(ctx);
    if (!input) return ctx.reply("📝 استفاده: `/removechannel @username`");

    const index = data.channels.findIndex(c => c.channel_id === input || c.username === input);
    if (index === -1) return ctx.reply("❌ کانال یافت نشد!");

    const removed = data.channels[index];
    data.channels.splice(index, 1);
    channelMap.delete(removed.channel_id);

    await ctx.reply(`🗑️ کانال ${input} حذف شد!`);
    await saveData();
});

bot.command("channels", async (ctx) => {
    if (data.channels.length === 0) {
        return ctx.reply("📭 هنوز کانالی اضافه نشده است.");
    }

    const text = data.channels
        .map((c, i) => `${i + 1}. ${c.username || c.channel_id} — ${c.is_active ? "✅" : "❌"}`)
        .join("\n");

    await ctx.reply(`📡 **لیست کانال‌ها:**\n\n${text}`, { parse_mode: "Markdown" });
});

bot.command("addreaction", async (ctx) => {
    const emoji = getArg(ctx);
    if (!emoji) return ctx.reply("📝 استفاده: `/addreaction 😀`");

    if (data.reactions.has(emoji)) {
        return ctx.reply("❌ این ایموجی قبلاً وجود دارد!");
    }

    data.reactions.add(emoji);
    await ctx.reply(`✅ ایموجی ${emoji} اضافه شد!`);
    await saveData();
});

bot.command("removereaction", async (ctx) => {
    const emoji = getArg(ctx);
    if (!emoji) return ctx.reply("📝 استفاده: `/removereaction 😀`");

    if (data.reactions.delete(emoji)) {
        await ctx.reply(`🗑️ ایموجی ${emoji} حذف شد!`);
        await saveData();
    } else {
        await ctx.reply("❌ ایموجی یافت نشد!");
    }
});

bot.command("reactions", async (ctx) => {
    const reactions = Array.from(data.reactions);
    if (reactions.length === 0) return ctx.reply("📭 هیچ ری‌اکشنی وجود ندارد.");

    await ctx.reply(
        `📋 **ری‌اکشن‌های فعلی (\( {reactions.length}):**\n\n \){reactions.join("  ")}`,
        { parse_mode: "Markdown" }
    );
});

bot.command("logs", async (ctx) => {
    if (data.logs.length === 0) return ctx.reply("📭 هنوز لاگی ثبت نشده.");

    const text = data.logs.slice(0, 20)
        .map(log => {
            const status = log.status === "success" ? "✅" : "❌";
            return `${status} \( {log.channelId} — # \){log.postId} — ${log.emoji}`;
        })
        .join("\n");

    await ctx.reply(`📜 **آخرین لاگ‌ها:**\n\n${text}`);
});

bot.command("status", async (ctx) => {
    await ctx.reply(
        `📊 **وضعیت ربات**\n\n` +
        `📡 کانال‌ها: ${data.channels.length}\n` +
        `😀 ری‌اکشن‌ها: ${data.reactions.size}\n` +
        `📈 کل لاگ‌ها: ${data.logs.length}\n` +
        `🟢 فعال`,
        { parse_mode: "Markdown" }
    );
});

// ========== اجرا ==========
async function main() {
    await loadData();
    
    bot.on("channel_post", reactToPost);

    console.log("🚀 ربات شروع شد...");
    await bot.start();
    console.log("✅ ربات با موفقیت اجرا شد و آماده دریافت پست است.");
}

main().catch(console.error);
