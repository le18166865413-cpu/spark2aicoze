import nodemailer from 'nodemailer';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 从 admin_settings 获取 SMTP 配置（优先于环境变量）
async function getSmtpConfigFromDB() {
  try {
    const sb = getSupabaseClient();
    const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name'];
    const { data } = await sb.from('admin_settings').select('key, value').in('key', keys);

    if (!data || data.length === 0) return null;

    const settings: Record<string, string> = {};
    data.forEach((item: { key: string; value: string }) => {
      settings[item.key] = item.value;
    });

    // 必须有 user 和 pass 才算有效
    if (!settings.smtp_user || !settings.smtp_pass) return null;

    return {
      host: settings.smtp_host || 'smtp.qq.com',
      port: parseInt(settings.smtp_port || '465'),
      secure: true,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
      fromName: settings.smtp_from_name || 'SparkAI',
    };
  } catch {
    return null;
  }
}

// 获取 SMTP 配置（DB 优先，环境变量兜底）
function getSmtpConfigFromEnv() {
  return {
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    fromName: process.env.SMTP_FROM_NAME || 'SparkAI',
  };
}

// 创建 transporter（每次发送都重新创建，因为 DB 配置可能变化）
async function createTransporter(): Promise<{ transporter: nodemailer.Transporter; fromAddress: string }> {
  const dbConfig = await getSmtpConfigFromDB();
  const config = dbConfig || getSmtpConfigFromEnv();

  if (!config.auth.user || !config.auth.pass) {
    throw new Error('SMTP 配置缺失，请在管理后台或环境变量中设置 SMTP_USER 和 SMTP_PASS');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  const fromAddress = `${config.fromName} <${config.auth.user}>`;
  return { transporter, fromAddress };
}

// 发送验证码邮件
export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  try {
    const { transporter, fromAddress } = await createTransporter();

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

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: 'SparkAI 邮箱验证码',
      html,
    });

    console.log(`[Email] Verification code sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Send verification email error:', error);
    return false;
  }
}

// 测试 SMTP 连接
export async function testSmtpConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { transporter } = await createTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP 连接成功' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '连接失败';
    return { success: false, message };
  }
}
