import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Registration is now email-only via the verification code login flow.
// This endpoint is kept for backward compatibility but redirects to email login.
export async function POST() {
  return NextResponse.json(
    { error: '请使用邮箱验证码注册，输入新邮箱即可自动注册' },
    { status: 400 }
  );
}
