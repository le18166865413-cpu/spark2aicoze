import nodemailer from 'nodemailer';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface SmtpChannel {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  fromName: string;
}

// 从 admin_settings 获取双 SMTP 配置
async function getSmtpConfigsFromDB(): Promise<{ primary: SmtpChannel | null; secondary: SmtpChannel | null }> {
  try {
    const sb = getSupabaseClient();
    const keys = [
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name',
      'smtp2_host', 'smtp2_port', 'smtp2_user', 'smtp2_pass', 'smtp2_from_name',
    ];
    const { data } = await sb.from('admin_settings').select('key, value').in('key', keys);

    if (!data) return { primary: null, secondary: null };

    const settings: Record<string, string> = {};
    data.forEach((item: { key: string; value: string }) => {
      settings[item.key] = item.value;
    });

    // 主通道
    let primary: SmtpChannel | null = null;
    if (settings.smtp_user && settings.smtp_pass) {
      primary = {
        host: settings.smtp_host || 'smtp.qq.com',
        port: parseInt(settings.smtp_port || '465'),
        secure: true,
        auth: { user: settings.smtp_user, pass: settings.smtp_pass },
        fromName: settings.smtp_from_name || 'SparkAI',
      };
    }

    // 备用通道
    let secondary: SmtpChannel | null = null;
    if (settings.smtp2_user && settings.smtp2_pass) {
      secondary = {
        host: settings.smtp2_host || 'smtp.163.com',
        port: parseInt(settings.smtp2_port || '465'),
        secure: true,
        auth: { user: settings.smtp2_user, pass: settings.smtp2_pass },
        fromName: settings.smtp2_from_name || 'SparkAI',
      };
    }

    return { primary, secondary };
  } catch {
    return { primary: null, secondary: null };
  }
}

// 从环境变量获取 SMTP 配置（兜底）
function getSmtpConfigFromEnv(): SmtpChannel | null {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  if (!user || !pass) return null;

  return {
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user, pass },
    fromName: process.env.SMTP_FROM_NAME || 'SparkAI',
  };
}

// 用指定通道发送邮件
async function sendWithChannel(
  channel: SmtpChannel,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: channel.host,
      port: channel.port,
      secure: channel.secure,
      auth: channel.auth,
    });

    const fromAddress = `${channel.fromName} <${channel.auth.user}>`;

    await transporter.sendMail({ from: fromAddress, to, subject, html });
    return true;
  } catch (error) {
    console.error(`[Email] Send via ${channel.auth.user} failed:`, error);
    return false;
  }
}

// 发送验证码邮件（主通道优先，失败自动切换备用通道）
export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const { primary, secondary } = await getSmtpConfigsFromDB();
  const envChannel = getSmtpConfigFromEnv();

  // 收集所有可用通道：主通道 → 备用通道 → 环境变量
  const channels: SmtpChannel[] = [];
  if (primary) channels.push(primary);
  if (secondary) channels.push(secondary);
  if (envChannel && !channels.some(c => c.auth.user === envChannel.auth.user)) {
    channels.push(envChannel);
  }

  if (channels.length === 0) {
    throw new Error('SMTP 配置缺失，请在管理后台配置邮件服务');
  }

  const html = `
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="margin:0;font-size:24px;color:#111;">SparkAI</h1>
        <p style="margin:8px 0 0;color:#666;font-size:14px;">邮箱验证码</p>
      </div>
      <div style="background:#f8f9fa;border-radius:12px;padding:32px;text-align:center;">
        <p style="margin:0 0 16px;color:#333;font-size:14px;">你的验证码是</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111;margin-bottom:16px;">
          ${code}
        </div>
        <p style="margin:0;color:#999;font-size:12px;">验证码 5 分钟内有效，请勿泄露给他人</p>
      </div>
      <div style="margin-top:24px;text-align:center;color:#999;font-size:12px;">
        <p style="margin:0;">如果这不是你的操作，请忽略此邮件</p>
      </div>
    </div>
  `;

  // 依次尝试每个通道
  for (const channel of channels) {
    const success = await sendWithChannel(channel, email, 'SparkAI 邮箱验证码', html);
    if (success) {
      console.log(`[Email] Verification code sent to ${email} via ${channel.auth.user}`);
      return true;
    }
    console.log(`[Email] Channel ${channel.auth.user} failed, trying next...`);
  }

  console.error('[Email] All SMTP channels failed');
  return false;
}

// 测试 SMTP 连接（测试所有通道）
export async function testSmtpConnection(): Promise<{
  success: boolean;
  message: string;
  channels: { label: string; success: boolean; message: string }[];
}> {
  const { primary, secondary } = await getSmtpConfigsFromDB();
  const envChannel = getSmtpConfigFromEnv();

  const channels: SmtpChannel[] = [];
  if (primary) channels.push(primary);
  if (secondary) channels.push(secondary);
  if (envChannel && !channels.some(c => c.auth.user === envChannel.auth.user)) {
    channels.push(envChannel);
  }

  if (channels.length === 0) {
    return {
      success: false,
      message: '未配置 SMTP，请在管理后台配置邮件服务',
      channels: [],
    };
  }

  const results: { label: string; success: boolean; message: string }[] = [];
  let anySuccess = false;

  for (const channel of channels) {
    const label = channel.auth.user;
    try {
      const transporter = nodemailer.createTransport({
        host: channel.host,
        port: channel.port,
        secure: channel.secure,
        auth: channel.auth,
      });
      await transporter.verify();
      results.push({ label, success: true, message: '连接成功' });
      anySuccess = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '连接失败';
      results.push({ label, success: false, message: msg });
    }
  }

  return {
    success: anySuccess,
    message: anySuccess ? '至少一个通道连接成功' : '所有通道连接失败',
    channels: results,
  };
}
