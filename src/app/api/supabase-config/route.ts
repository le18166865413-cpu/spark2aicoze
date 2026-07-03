import { NextResponse } from 'next/server';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseCredentials();

    if (!url || !anonKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url,
      anonKey,
      iconUrl:
        'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-05-01/7634939144061435913_1777649612.png?sign=4905101053-395fbf74d1-0-cf84c40e85c5b1b6c82bd3ffdca1125637e1dde2ce6c932b938e42cc587c1e66',
      name: 'Spark生图源站',
    });
  } catch (error) {
    console.error('Failed to get Supabase config:', error);
    return NextResponse.json(
      { error: 'Failed to get Supabase config' },
      { status: 500 }
    );
  }
}
