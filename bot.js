const { Bot } = require("grammy");

const bot = new Bot("7866512180:AAG5p9E-GjufNb4c10oJuL2rq6lBUCoclNg");

bot.command("start", async (ctx) => {
    await ctx.reply("✅ ربات کار میکنه!");
});

bot.on("message", async (ctx) => {
    await ctx.reply("📩 پیامت رو دریافت کردم: " + ctx.message.text);
});

bot.start();
console.log("ربات تست اجرا شد!");
