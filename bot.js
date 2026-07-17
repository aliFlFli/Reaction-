// ========== نسخه کامل با ربات‌های کمکی فعال ==========

const { Bot, session } = require("grammy");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const path = require("path");
require("dotenv").config();

// ========== تنظیمات ==========
const BOT_TOKEN = process.env.BOT_TOKEN || "توکن_ربات_اصلی_اینجا";
const mainBot = new Bot(BOT_TOKEN);

// ========== دیتابیس ==========
let db;

async function initDatabase() {
    db = await open({
        filename: path.join(__dirname, "reaction_bot.db"),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS bots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE NOT NULL,
            username TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT UNIQUE NOT NULL,
            channel_name TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emoji TEXT UNIQUE NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_id INTEGER,
            channel_id TEXT,
            post_id TEXT,
            emoji TEXT,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ری‌اکشن‌های پیش‌فرض
    const defaultEmojis = ["🔥", "⚡", "🕊️", "👌", "🎉"];
    for (const emoji of defaultEmojis) {
        await db.run(
            "INSERT OR IGNORE INTO reactions (emoji) VALUES (?)",
            emoji
        );
    }

    console.log("✅ دیتابیس راه‌اندازی شد");
}

// ========== توابع دیتابیس ==========

async function getBots() {
    return await db.all("SELECT * FROM bots WHERE is_active = 1");
}

async function getChannels() {
    return await db.all("SELECT * FROM channels WHERE is_active = 1");
}

async function getReactions() {
    return await db.all("SELECT * FROM reactions");
}

async function addLog(botId, channelId, postId, emoji, status) {
    await db.run(
        "INSERT INTO logs (bot_id, channel_id, post_id, emoji, status) VALUES (?, ?, ?, ?, ?)",
        botId, channelId, postId, emoji, status
    );
}

// ========== تابع ری‌اکشن برای هر ربات ==========

function createReactionHandler(botId, botUsername) {
    return async (ctx) => {
        try {
            const chatId = ctx.chat.id.toString();
            const messageId = ctx.msg.message_id;

            // بررسی مجاز بودن کانال برای این ربات
            const channels = await getChannels();
            const isAllowed = channels.some(ch => ch.channel_id === chatId);
            
            if (!isAllowed) return;

            // دریافت ری‌اکشن‌ها
            const reactions = await getReactions();
            if (reactions.length === 0) return;

            // انتخاب تصادفی
            const randomEmoji = reactions[Math.floor(Math.random() * reactions.length)].emoji;

            // زدن ری‌اکشن
            await ctx.api.setMessageReaction(chatId, messageId, {
                reaction: [{ type: "emoji", emoji: randomEmoji }]
            });

            // ذخیره لاگ
            await addLog(botId, chatId, messageId.toString(), randomEmoji, "success");
            console.log(`✅ [@${botUsername}] ${randomEmoji} به پست ${messageId} در ${chatId} زده شد`);

        } catch (error) {
            console.error(`❌ [@${botUsername}] خطا: ${error.message}`);
            await addLog(botId, ctx.chat?.id?.toString() || "unknown", ctx.msg?.message_id?.toString() || "0", "❌", "fail");
        }
    };
}

// ========== اجرای ربات‌های کمکی ==========

const runningBots = new Map(); // ذخیره ربات‌های در حال اجرا

async function startBot(token, botId, username) {
    try {
        const bot = new Bot(token);
        
        // گوش دادن به پست‌های کانال
        bot.on("channel_post", createReactionHandler(botId, username));
        bot.on("message", async (ctx) => {
            if (ctx.chat?.type === "channel") {
                const handler = createReactionHandler(botId, username);
                await handler(ctx);
            }
        });

        // شروع ربات
        bot.start();
        runningBots.set(botId, bot);
        
        console.log(`✅ ربات کمکی @${username} (ID: ${botId}) اجرا شد!`);
        return true;
    } catch (error) {
        console.error(`❌ خطا در اجرای ربات ${username}: ${error.message}`);
        return false;
    }
}

async function startAllBots() {
    const bots = await getBots();
    console.log(`🤖 در حال اجرای ${bots.length} ربات کمکی...`);
    
    for (const bot of bots) {
        await startBot(bot.token, bot.id, bot.username);
    }
}

// ========== ربات اصلی ==========

// دستورات مدیریت برای ربات اصلی (همون دستورات قبلی)
mainBot.command("addbot", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("⚠️ توکن ربات را وارد کنید: `/addbot 1234567890:ABCdef...`");
        return;
    }

    const token = args[1];
    
    try {
        const testBot = new Bot(token);
        const info = await testBot.api.getMe();
        
        // ذخیره در دیتابیس
        const result = await db.run(
            "INSERT INTO bots (token, username) VALUES (?, ?)",
            token, info.username
        );
        
        // اجرای ربات جدید
        await startBot(token, result.lastID, info.username);
        
        await ctx.reply(
            `✅ ربات @${info.username} اضافه شد و در حال اجراست.\n\n` +
            `🆔 شناسه: ${result.lastID}`
        );
    } catch (error) {
        await ctx.reply("❌ توکن نامعتبر است!");
    }
});

mainBot.command("removebot", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("📝 استفاده: `/removebot شناسه`");
        return;
    }

    const id = parseInt(args[1]);
    if (isNaN(id)) {
        await ctx.reply("❌ شناسه باید عدد باشد!");
        return;
    }

    // متوقف کردن ربات
    if (runningBots.has(id)) {
        const bot = runningBots.get(id);
        await bot.stop();
        runningBots.delete(id);
    }

    // حذف از دیتابیس
    await db.run("DELETE FROM bots WHERE id = ?", id);
    await ctx.reply("🗑️ ربات با موفقیت حذف و متوقف شد!");
});

mainBot.command("bots", async (ctx) => {
    const bots = await getBots();
    if (bots.length === 0) {
        await ctx.reply("📭 هیچ ربات کمکی اضافه نشده است.");
        return;
    }

    let msg = `🤖 ربات‌های کمکی: ${bots.length}\n`;
    msg += `🟢 در حال اجرا: ${runningBots.size}\n\n`;

    for (const bot of bots) {
        const status = runningBots.has(bot.id) ? "🟢" : "🔴";
        msg += `${status} @${bot.username}\n`;
        msg += `شناسه: ${bot.id} | حذف: /removebot ${bot.id}\n\n`;
    }

    await ctx.reply(msg);
});

// سایر دستورات (addchannel, removechannel, channels, reactions, status, logs) مثل قبل

mainBot.command("start", async (ctx) => {
    const reactions = await getReactions();
    const reactionList = reactions.map(r => r.emoji).join(" ");
    
    await ctx.reply(
        `👋 ربات ری‌اکشن‌گذار چندگانه\n\n` +
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
        `🔹 ری‌اکشن‌های فعلی: ${reactionList}`
    );
});

// ========== اجرا ==========

async function main() {
    await initDatabase();
    
    // اجرای ربات‌های کمکی ذخیره شده
    await startAllBots();
    
    // شروع ربات اصلی
    mainBot.start();
    console.log(`🚀 ربات اصلی ${mainBot.botInfo.username} اجرا شد!`);
}

main().catch(console.error);
