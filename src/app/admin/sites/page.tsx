'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Server,
  GitBranch,
  Clock,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  Monitor,
} from 'lucide-react';

interface SiteInfo {
  id: string;
  type: string;
  isMain: boolean;
  mainSiteUrl: string;
  gitCommit: string;
  gitBranch: string;
  gitRemote: string;
  lastUpdate: string;
  domain: string;
}

interface SubSite {
  siteId: string;
  siteName: string;
  siteUrl: string;
  description: string;
  registeredAt: string;
  status: string;
}

export default function SitesPage() {
  const [loading, setLoading] = useState(true);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [subSites, setSubSites] = useState<SubSite[]>([]);
  const [copied, setCopied] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSiteId, setNewSiteId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteDesc, setNewSiteDesc] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/sites');
      const data = await res.json();
      if (data.currentSite) setSiteInfo(data.currentSite);
      if (data.subSites) setSubSites(data.subSites);
    } catch (e) {
      console.error('Failed to load sites:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const handleAddSubSite = async () => {
    if (!newSiteId || !newSiteUrl) {
      setMessage({ type: 'error', text: '站点 ID 和访问地址为必填项' });
      return;
    }
    setAddLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: newSiteId,
          siteName: newSiteName || newSiteId,
          siteUrl: newSiteUrl,
          description: newSiteDesc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '子站注册成功' });
        setShowAddForm(false);
        setNewSiteId('');
        setNewSiteName('');
        setNewSiteUrl('');
        setNewSiteDesc('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || '注册失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteSubSite = async (siteId: string) => {
    if (!confirm(`确定要删除子站 "${siteId}" 吗？`)) return;
    try {
      const res = await fetch(`/api/admin/sites?siteId=${encodeURIComponent(siteId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '子站已删除' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || '删除失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  const isMain = siteInfo?.isMain ?? true;

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-primary/10 text-primary'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current Site Info Card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Monitor className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            当前站点 {isMain ? '(主站)' : '(子站)'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">站点 ID</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{siteInfo?.id || 'main'}</span>
              {siteInfo?.id && (
                <button
                  onClick={() => handleCopy(siteInfo.id, 'siteId')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === 'siteId' ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">站点类型</label>
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm">{isMain ? '主站' : '子站'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">访问域名</label>
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-mono">{siteInfo?.domain || '未配置'}</span>
              {siteInfo?.domain && (
                <a
                  href={`https://${siteInfo.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Git 分支</label>
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-mono">{siteInfo?.gitBranch || 'unknown'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">代码版本</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{siteInfo?.gitCommit || 'unknown'}</span>
              {siteInfo?.gitCommit && siteInfo.gitCommit !== 'unknown' && (
                <button
                  onClick={() => handleCopy(siteInfo.gitCommit, 'commit')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === 'commit' ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">最后更新</label>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">{siteInfo?.lastUpdate || 'unknown'}</span>
            </div>
          </div>
        </div>

        {!isMain && siteInfo?.mainSiteUrl && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <ChevronRight className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">关联主站：</span>
              <a href={siteInfo.mainSiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {siteInfo.mainSiteUrl}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Sub-sites Management (Main site only) */}
      {isMain && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">子站管理</h3>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              注册子站
            </button>
          </div>

          {showAddForm && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">站点 ID <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    value={newSiteId}
                    onChange={(e) => setNewSiteId(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="site-01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">站点名称</label>
                  <input
                    type="text"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="子站 01"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-muted-foreground">访问地址 <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    value={newSiteUrl}
                    onChange={(e) => setNewSiteUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="https://subsite.dev.coze.site"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-muted-foreground">描述</label>
                  <input
                    type="text"
                    value={newSiteDesc}
                    onChange={(e) => setNewSiteDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="子站用途描述"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddSubSite}
                  disabled={addLoading}
                  className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {addLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  确认注册
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold h-8 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {subSites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>暂无注册的子站</p>
              <p className="text-xs mt-1">点击上方「注册子站」添加子站信息</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subSites.map((site) => (
                <div
                  key={site.siteId}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 rounded-lg p-2 shrink-0">
                      <Server className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{site.siteName}</span>
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{site.siteId}</span>
                        {site.status === 'active' && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">运行中</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <a
                          href={site.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        >
                          {site.siteUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {site.description && (
                          <span className="text-xs text-muted-foreground truncate">· {site.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSubSite(site.siteId)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10 shrink-0"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync Guide Card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">代码同步指南</h3>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">1. 推送代码到 GitHub</p>
            <p>在主站执行以下命令，将代码推送到 GitHub 仓库：</p>
            <pre className="mt-1.5 bg-background border border-border rounded-md p-2.5 text-xs font-mono overflow-x-auto">
{`git remote add origin https://github.com/你的用户名/你的仓库.git
git add .
git commit -m "update"
git push -u origin main`}
            </pre>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">2. 子站拉取更新</p>
            <p>在子站的 Coze 沙箱中，执行以下命令同步主站代码：</p>
            <pre className="mt-1.5 bg-background border border-border rounded-md p-2.5 text-xs font-mono overflow-x-auto">
{`cd /workspace/projects
git pull origin main
pnpm install
pnpm build`}
            </pre>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">3. 子站环境变量配置</p>
            <p>子站需要配置以下环境变量以区分身份：</p>
            <pre className="mt-1.5 bg-background border border-border rounded-md p-2.5 text-xs font-mono overflow-x-auto">
{`SITE_ID=site-01
SITE_TYPE=sub
MAIN_SITE_URL=https://你的主站域名`}
            </pre>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">4. 数据隔离方案（可选）</p>
            <p>如需数据隔离，在 Supabase 中为 gallery_images 表添加 site_id 字段：</p>
            <pre className="mt-1.5 bg-background border border-border rounded-md p-2.5 text-xs font-mono overflow-x-auto">
{`ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
