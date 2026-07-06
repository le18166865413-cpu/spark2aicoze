import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 管理员手机号 - 这些号码的验证码可以随便填
const ADMIN_PHONES = ['18166865413', '17390005820'];

// 生成 6 位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: '请输入手机号' }, { status: 400 });
    }

    // 验证手机号格式（中国大陆）
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
    }

    const sb = getSupabaseClient();

    // 频率限制：同一手机号 60 秒内只能发 1 次
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentCodes } = await sb
      .from('email_verification_codes')
      .select('created_at')
      .eq('email', phone)
      .gte('created_at', sixtySecondsAgo)
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

    // 生成验证码
    const code = generateCode();

    // 保存验证码到数据库（使用 email 字段存储手机号）
    const { error: insertError } = await sb
      .from('email_verification_codes')
      .insert({
        email: phone,
        code: code,
        used: false,
        attempts: 0,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 分钟有效
      });

    if (insertError) {
      console.error('保存验证码失败:', insertError);
      return NextResponse.json({ error: '验证码保存失败' }, { status: 500 });
    }

    // 判断是否为管理员手机号
    const isAdmin = ADMIN_PHONES.includes(phone);

    // 如果是管理员手机号，直接返回成功（实际不需要发送短信）
    if (isAdmin) {
      return NextResponse.json({
        message: '验证码发送成功',
        isAdmin: true,
        note: '管理员手机号，验证码可任意输入'
      });
    }

    // TODO: 调用实际短信服务发送验证码
    // 目前由于 Supabase Auth 的短信服务可能未配置，这里仅做演示
    console.log(`向手机号 ${phone} 发送验证码: ${code}`);

    return NextResponse.json({ message: '验证码发送成功' });
  } catch (error) {
    console.error('发送验证码失败:', error);
    return NextResponse.json({ error: '发送失败，请稍后重试' }, { status: 500 });
  }
}
