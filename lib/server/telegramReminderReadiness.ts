import { rc1Config } from '@/lib/rc1';

export function telegramReminderReadiness() {
  const missing:string[]=[];
  if(!process.env.TELEGRAM_BOT_TOKEN)missing.push('TELEGRAM_BOT_TOKEN');
  if(!process.env.NEXT_PUBLIC_APP_URL)missing.push('NEXT_PUBLIC_APP_URL');
  if((process.env.TELEGRAM_DELIVERY_ENCRYPTION_KEY||'').length<32)missing.push('TELEGRAM_DELIVERY_ENCRYPTION_KEY');
  const enabled=rc1Config.flags.telegram_notifications_enabled;
  return {enabled,configured:missing.length===0,ready:enabled&&missing.length===0,missing};
}
