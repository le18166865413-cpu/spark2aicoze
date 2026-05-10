'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plug,
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  User,
  FileCode,
  Globe,
  Server,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface ApiToken {
  id: string;
  name: string;
  token?: string;
  permissions: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  users: { nickname: string } | null;
}

export default function IntegrationPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenDays, setNewTokenDays] = useState('0');
  const [createdToken, setCreatedToken] = useState<ApiToken | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const [docExpanded, setDocExpanded] = useState(false);
  const [deployExpanded, setDeployExpanded] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/api-tokens', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
      }
    } catch {
      toast.error('获取 Token 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async () => {
    if (!newTokenName.trim()) {
      toast.error('请输入 Token 名称');
      return;
    }
    try {
      const res = await fetch('/api/admin/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newTokenName.trim(),
          permissions: ['read'],
          expiresDays: parseInt(newTokenDays) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedToken(data.token);
        setNewTokenName('');
        setNewTokenDays('0');
        fetchTokens();
        toast.success('Token 创建成功');
      } else {
        toast.error(data.error || '创建失败');
      }
    } catch {
      toast.error('创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此 Token 吗？使用此 Token 的第三方系统将立即失效。')) return;
    try {
      const res = await fetch(`/api/admin/api-tokens?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchTokens();
        toast.success('Token 已删除');
      } else {
        toast.error('删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const toggleReveal = (id: string) => {
    setRevealedTokens(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskToken = (t: string) => t.slice(0, 8) + '...' + t.slice(-4);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Plug className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">第三方对接</h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{tokens.length}</div>
              <div className="text-sm text-muted-foreground">已创建 Token</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">2</div>
              <div className="text-sm text-muted-foreground">开放接口</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">多站</div>
              <div className="text-sm text-muted-foreground">数据共享</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Token Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API 令牌管理
          </CardTitle>
          <Button size="sm" onClick={() => { setShowCreateDialog(true); setCreatedToken(null); }}>
            <Plus className="w-4 h-4 mr-1.5" />
            新建 Token
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>暂无 API Token</p>
              <p className="text-xs mt-1">创建 Token 后，第三方系统可通过 Bearer Token 访问开放接口</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map(token => {
                const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
                const isRevealed = revealedTokens.has(token.id);
                const displayToken = token.token || '';

                return (
                  <div key={token.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{token.name}</span>
                        {token.permissions.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] h-4 px-1">{p}</Badge>
                        ))}
                        {isExpired && <Badge variant="destructive" className="text-[10px] h-4 px-1">已过期</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                          {isRevealed ? displayToken : maskToken(displayToken)}
                        </code>
                        <button onClick={() => toggleReveal(token.id)} className="hover:text-foreground transition-colors" title={isRevealed ? '隐藏' : '显示'}>
                          {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={() => copyToClipboard(displayToken)} className="hover:text-foreground transition-colors" title="复制">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{token.users?.nickname || '管理员'}</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />创建于 {new Date(token.created_at).toLocaleDateString()}</span>
                        {token.last_used_at && <span>最近使用 {new Date(token.last_used_at).toLocaleDateString()}</span>}
                        {token.expires_at && <span>过期于 {new Date(token.expires_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 h-8 px-2" onClick={() => handleDelete(token.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setDocExpanded(!docExpanded)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5" />
              开放接口文档
            </div>
            {docExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {docExpanded && (
          <CardContent className="space-y-5 text-sm">
            <div>
              <h3 className="font-semibold mb-2">认证方式</h3>
              <p className="text-muted-foreground mb-2">所有开放接口需在请求头中携带 Bearer Token：</p>
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">{`Authorization: Bearer sk_xxxxxxxxxxxxxxxx`}</pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">1. 获取海报列表</h3>
              <p className="text-muted-foreground mb-1"><code className="text-xs bg-muted px-1 rounded">GET {baseUrl}/api/v1/images</code></p>
              <p className="text-muted-foreground mb-2">查询参数：</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground text-xs mb-2">
                <span><code>search</code> - 按提示词搜索</span>
                <span><code>sortBy</code> - created_at / views / likes</span>
                <span><code>sortOrder</code> - asc / desc</span>
                <span><code>period</code> - day / week / month / all</span>
                <span><code>userId</code> - 按用户过滤</span>
                <span><code>page</code> - 页码，默认 1</span>
                <span><code>pageSize</code> - 每页数量，最大 100</span>
              </div>
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">{`{
  "data": [{ "id": "...", "prompt": "...", "url": "...", ... }],
  "pagination": { "page": 1, "pageSize": 50, "total": 100, "totalPages": 2 }
}`}</pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. 获取单张海报详情</h3>
              <p className="text-muted-foreground mb-1"><code className="text-xs bg-muted px-1 rounded">GET {baseUrl}/api/v1/images/{'{id}'}</code></p>
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">{`{
  "data": { "id": "...", "prompt": "...", "url": "...", ... }
}`}</pre>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Multi-site Deployment */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setDeployExpanded(!deployExpanded)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              多站数据共享方案
            </div>
            {deployExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {deployExpanded && (
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              如需复制部署多个网站并实现数据共享，只需让所有站点共用同一套数据源：
            </p>
            <div className="space-y-2">
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="font-medium mb-1">1. 共享数据库（Supabase）</div>
                <p className="text-xs text-muted-foreground">所有站点的环境变量配置相同的 Supabase 连接信息：</p>
                <pre className="bg-muted p-2 rounded mt-1 text-xs">{`SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx`}</pre>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="font-medium mb-1">2. 共享对象存储（S3）</div>
                <p className="text-xs text-muted-foreground">所有站点配置相同的存储桶信息：</p>
                <pre className="bg-muted p-2 rounded mt-1 text-xs">{`COZE_BUCKET_ENDPOINT_URL=xxx
COZE_BUCKET_NAME=xxx
COZE_WORKLOAD_IDENTITY_API_KEY=xxx`}</pre>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="font-medium mb-1">3. 效果</div>
                <p className="text-xs text-muted-foreground">
                  多个前端站点读写同一个 PostgreSQL 数据库和同一个 S3 存储桶。海报广场、用户数据、设置等全部实时互通。
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Create Token Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 API Token</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {createdToken ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                  Token 创建成功！请立即复制保存，关闭后将无法再次查看完整 Token。
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded-lg font-mono text-sm break-all">{createdToken.token}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(createdToken.token || '')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button className="w-full" onClick={() => { setShowCreateDialog(false); setCreatedToken(null); }}>
                  完成
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">Token 名称</label>
                  <Input value={newTokenName} onChange={e => setNewTokenName(e.target.value)} placeholder="例如：第三方小程序对接" />
                </div>
                <div>
                  <label className="text-sm font-medium">有效期</label>
                  <Select value={newTokenDays} onValueChange={setNewTokenDays}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">永不过期</SelectItem>
                      <SelectItem value="7">7 天</SelectItem>
                      <SelectItem value="30">30 天</SelectItem>
                      <SelectItem value="90">90 天</SelectItem>
                      <SelectItem value="365">1 年</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={!newTokenName.trim()}>
                  创建 Token
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
