/**
 * send_weekly_report.js
 * Called by cron every Sunday at 9:00
 * Runs weekly_report.js then sends Discord message with Notion link
 */

const { run } = require('./weekly_report');

async function main() {
  try {
    console.log('🥬 Running Smart Leket weekly report...');
    const url = await run();
    
    // Output for OpenClaw cron to pick up and send to Discord
    const message = `🥬 **Smart Leket – המלצת הזמנה שבועית**\n\nהרשימה מוכנה לאישורך ב-Notion:\n${url}\n\nענה \`אשר\` / \`ערוך: ...\` / \`בטל השבוע\``;
    
    console.log('\n📨 Discord message:');
    console.log(message);
    
    // Write to file so cron script can read and send
    require('fs').writeFileSync(
      require('path').join(__dirname, 'pending_message.txt'),
      message
    );
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
