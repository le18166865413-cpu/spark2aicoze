import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { isMainSite, SITE_ID, SITE_TYPE, MAIN_SITE_URL } from '@/lib/multi-site';
import { execSync } from 'child_process';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (!token) return null;

  const supabase = getSupabaseClient();
  const { data: session } = await supabase
    .from('admin_sessions')
    .select('*')
    .eq('id', token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;
  return session;
}

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: process.cwd() }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', cwd: process.cwd() }).trim();
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8', cwd: process.cwd() }).trim();
    const lastUpdate = execSync('git log -1 --format=%cd --date=iso', { encoding: 'utf-8', cwd: process.cwd() }).trim();
    return { commit, branch, remote, lastUpdate };
  } catch {
    return { commit: 'unknown', branch: 'unknown', remote: '', lastUpdate: '' };
  }
}

// GET /api/admin/sites - Get site info and sub-sites list (main site only)
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gitInfo = getGitInfo();

  // Current site info
  const currentSite = {
    id: SITE_ID,
    type: SITE_TYPE,
    isMain: isMainSite(),
    mainSiteUrl: MAIN_SITE_URL,
    gitCommit: gitInfo.commit,
    gitBranch: gitInfo.branch,
    gitRemote: gitInfo.remote,
    lastUpdate: gitInfo.lastUpdate,
    domain: process.env.COZE_PROJECT_DOMAIN_DEFAULT || '',
  };

  // If main site, also return list of registered sub-sites from DB
  let subSites: unknown[] = [];
  if (isMainSite()) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .like('key', 'sub_site_%');
      if (data) {
        subSites = data.map((item) => {
          try {
            return JSON.parse(item.value);
          } catch {
            return { key: item.key, value: item.value };
          }
        });
      }
    } catch (e) {
      console.error('Failed to load sub-sites:', e);
    }
  }

  return NextResponse.json({ currentSite, subSites });
}

// POST /api/admin/sites - Register a new sub-site (main site only)
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isMainSite()) {
    return NextResponse.json({ error: 'Only main site can register sub-sites' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { siteId, siteName, siteUrl, description } = body;

    if (!siteId || !siteUrl) {
      return NextResponse.json({ error: 'siteId and siteUrl are required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const key = `sub_site_${siteId}`;
    const value = JSON.stringify({
      siteId,
      siteName: siteName || siteId,
      siteUrl,
      description: description || '',
      registeredAt: new Date().toISOString(),
      status: 'active',
    });

    const { error } = await supabase.from('admin_settings').upsert({ key, value, category: 'site' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '子站已注册' });
  } catch (error) {
    console.error('Register sub-site error:', error);
    return NextResponse.json({ error: 'Failed to register sub-site' }, { status: 500 });
  }
}

// DELETE /api/admin/sites - Remove a sub-site (main site only)
export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isMainSite()) {
    return NextResponse.json({ error: 'Only main site can manage sub-sites' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('admin_settings').delete().eq('key', `sub_site_${siteId}`);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '子站已删除' });
  } catch (error) {
    console.error('Delete sub-site error:', error);
    return NextResponse.json({ error: 'Failed to delete sub-site' }, { status: 500 });
  }
}
