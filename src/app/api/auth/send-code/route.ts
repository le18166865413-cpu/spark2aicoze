import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendVerificationEmail } from '@/utils/email';

// 生成 6 位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: '请输入邮箱地址' }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    const sb = getSupabaseClient();

    // 频率限制：同一邮箱 60 秒内只能发 1 次
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentCodes } = await sb
      .from('email_verification_codes')
      .select('created_at')
      .eq('email', email)
      .gte('created_at', oneMinuteAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentCodes && recentCodes.length > 0) {
      const elapsed = Date.now() - new Date(recentCodes[0].created_at).getTime();
      const remaining = Math.ceil((60 - elapsed / 1000));
      return NextResponse.json(
        { error: `发送太频繁，请 ${remaining} 秒后重试` },
        { status: 429 }
      );
    }

    // 每小时最多 10 次
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from('email_verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', oneHourAgo);

    if (count && count >= 10) {
      return NextResponse.json(
        { error: '发送次数过多，请 1 小时后重试' },
        { status: 429 }
      );
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 分钟过期

    // 保存验证码
    const { error: insertError } = await sb
      .from('email_verification_codes')
      .insert({
        email,
        code,
        used: false,
        attempts: 0,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[SendCode] Insert error:', insertError);
      return NextResponse.json({ error: '发送失败，请重试' }, { status: 500 });
    }

    // 发送邮件
    let sent = false;
    try {
      sent = await sendVerificationEmail(email, code);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('SMTP 配置缺失')) {
        return NextResponse.json({ error: '邮件服务未配置，请联系管理员' }, { status: 503 });
      }
      console.error('[SendCode] Email error:', e);
    }
    if (!sent) {
      // 删除已插入但未发送的验证码
      await sb.from('email_verification_codes').delete().eq('email', email).eq('code', code);
      return NextResponse.json({ error: '邮件发送失败，请检查邮箱地址或稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ message: '验证码已发送', email });
  } catch (error) {
    console.error('[SendCode] Error:', error);
    return NextResponse.json({ error: '发送失败，请重试' }, { status: 500 });
  }
}
