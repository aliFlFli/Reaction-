const { Bot } = require("grammy");

const bot = new Bot("7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg");

// ساده‌ترین دستور
bot.command("start", async (ctx) => {
    await ctx.reply("✅ ربات به درستی کار میکنه!");
    console.log("✅ پیام start دریافت شد!");
});

// هر پیامی رو جواب بده
bot.on("message", async (ctx) => {
    await ctx.reply("📩 پیام شما: " + ctx.message.text);
    console.log("📩 پیام دریافت شد:", ctx.message.text);
});

bot.start();
console.log("🚀 ربات تست اجرا شد!");console.error);
