'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Upload } from 'lucide-react';

interface User {
  id: string;
  username: string;
  password: string;
  plain_password?: string;
  nickname: string | null;
  role: string;
  status: string;
  email?: string;
  phone?: string;
  avatar?: string;
  can_generate?: boolean;
  created_at: string;
  updated_at: string;
  work_count?: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', nickname: '', role: 'user' });
  const [editForm, setEditForm] = useState({ nickname: '', role: '' });
  const [newPassword, setNewPassword] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchPreview, setBatchPreview] = useState<{username:string;password:string;nickname:string;role:string;valid:boolean;isHash:boolean}[]>([]);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const [restorePreview, setRestorePreview] = useState<{username:string;password:string;nickname:string;role:string;valid:boolean;isHash:boolean}[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'admin' | 'user' | 'approved' | 'pending' | 'rejected'>('all');
  const [anonymousGenerate, setAnonymousGenerate] = useState(false);
  const [savingAnonymous, setSavingAnonymous] = useState(false);

  const fetchAnonymousSetting = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/anonymous-generate', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAnonymousGenerate(data.enabled === true);
      }
    } catch (e) {
      console.error('Failed to fetch anonymous setting:', e);
    }
  }, []);

  const handleToggleAnonymousGenerate = async (checked: boolean) => {
    setSavingAnonymous(true);
    try {
      const res = await fetch('/api/admin/anonymous-generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: checked }),
      });
      if (res.ok) {
        setAnonymousGenerate(checked);
      } else {
        const text = await res.text().catch(() => '');
        let errMsg = res.statusText || '未知错误';
        try { const j = JSON.parse(text); errMsg = j.error || errMsg; } catch {}
        console.error('Save anonymous_generate failed:', res.status, text);
        alert('保存失败: ' + errMsg);
      }
    } catch (e) {
      console.error('Save anonymous_generate error:', e);
      alert('保存失败: 网络错误');
    } finally {
      setSavingAnonymous(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAnonymousSetting();
  }, [fetchUsers, fetchAnonymousSetting]);

  const handleAddUser = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        setShowAddDialog(false);
        setNewUser({ username: '', password: '', nickname: '', role: 'user' });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || '添加失败');
      }
    } catch {
      alert('添加失败');
    }
  };

  const isBcryptHash = (pwd: string) => /^\$2[aby]\$\d+\$/.test(pwd) && pwd.length >= 59;

  const parseBatchText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map(line => {
      const parts = line.split('--').map(p => p.trim());
      const [username = '', password = '', nickname = '', roleText = ''] = parts;
      const role = roleText.includes('管理') ? 'admin' : 'user';
      const valid = username.length > 0 && password.length > 0;
      return { username, password, nickname: nickname || username, role, valid, isHash: isBcryptHash(password) };
    });
    setBatchPreview(parsed);
    return parsed;
  };

  const parseRestoreCSV = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    // Skip header if first line contains Chinese or "username"
    const startIndex = lines.length > 0 && (/用户名|username|密码|password/i.test(lines[0])) ? 1 : 0;
    const parsed = lines.slice(startIndex).map(line => {
      const parts = line.split(',').map(p => p.trim());
      // Format: username, password, nickname, role, status, created_at, updated_at
      const [username = '', password = '', nickname = '', roleText = ''] = parts;
      const role = roleText.includes('管理') || roleText === 'admin' ? 'admin' : 'user';
      const valid = username.length > 0 && password.length > 0;
      return { username, password, nickname: nickname || username, role, valid, isHash: isBcryptHash(password) };
    });
    setRestorePreview(parsed);
    return parsed;
  };

  const handleBatchAdd = async () => {
    const users = parseBatchText(batchText).filter(u => u.valid);
    if (users.length === 0) {
      alert('没有有效的用户数据，请检查格式：用户名--密码--昵称--角色');
      return;
    }
    let success = 0;
    let failed = 0;
    for (const user of users) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(user),
        });
        if (res.ok) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    alert(`批量添加完成：成功 ${success} 条，失败 ${failed} 条`);
    if (success > 0) {
      setShowAddDialog(false);
      setBatchText('');
      setBatchPreview([]);
      fetchUsers();
    }
  };

  const handleRestoreUsers = async () => {
    const users = parseRestoreCSV(restoreText).filter(u => u.valid);
    if (users.length === 0) {
      alert('没有有效的用户数据，请粘贴导出的 CSV 内容');
      return;
    }
    let success = 0;
    let failed = 0;
    let hashCount = 0;
    for (const user of users) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(user),
        });
        if (res.ok) {
          success++;
          if (user.isHash) hashCount++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    alert(`批量还原完成：成功 ${success} 条（含 ${hashCount} 条哈希密码），失败 ${failed} 条`);
    if (success > 0) {
      setShowRestoreDialog(false);
      setRestoreText('');
      setRestorePreview([]);
      fetchUsers();
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: editingUser.id, nickname: editForm.nickname, role: editForm.role }),
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || '更新失败');
      }
    } catch {
      alert('更新失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdUser || !newPassword) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: resetPwdUser.id, password: newPassword }),
      });
      if (res.ok) {
        setResetPwdUser(null);
        setNewPassword('');
        alert('密码重置成功');
      } else {
        const data = await res.json();
        alert(data.error || '重置失败');
      }
    } catch {
      alert('重置失败');
    }
  };

  const handleApprove = async (userId: string, status: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: userId, status }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || '操作失败');
      }
    } catch {
      alert('操作失败');
    }
  };

  const handleToggleGenerate = async (userId: string, canGenerate: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: userId, can_generate: !canGenerate }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || '操作失败');
      }
    } catch {
      alert('操作失败');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可恢复。')) return;
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch {
      alert('删除失败');
    }
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');
  const rejectedUsers = users.filter(u => u.status === 'rejected');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500/15 text-green-500 border-green-500/30">已通过</Badge>;
      case 'pending': return <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30">待审批</Badge>;
      case 'rejected': return <Badge className="bg-red-500/15 text-red-500 border-red-500/30">已拒绝</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <Badge className="bg-primary/15 text-primary border-primary/30">管理员</Badge>;
      default: return <Badge variant="secondary">普通用户</Badge>;
    }
  };

  const filteredUsers = users.filter(u => {
    switch (activeFilter) {
      case 'admin': return u.role === 'admin';
      case 'user': return u.role === 'user';
      case 'approved': return u.status === 'approved';
      case 'pending': return u.status === 'pending';
      case 'rejected': return u.status === 'rejected';
      default: return true;
    }
  });

  const handleExportUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) {
        alert('获取用户数据失败');
        return;
      }
      const data = await res.json();
      const list: User[] = data.users || [];
      if (list.length === 0) {
        alert('暂无用户数据可导出');
        return;
      }
      const headers = ['用户名', '密码', '昵称', '角色', '状态', '创建时间', '更新时间'];
      const rows = list.map((u: User) => [
        u.username,
        u.plain_password || '已加密（无法还原）',
        u.nickname,
        u.role === 'admin' ? '管理员' : '普通用户',
        u.status === 'approved' ? '已通过' : u.status === 'pending' ? '待审批' : '已拒绝',
        new Date(u.created_at).toLocaleString(),
        new Date(u.updated_at).toLocaleString(),
      ]);
      const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('导出失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm text-muted-foreground">总用户数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{approvedUsers.length}</div>
            <div className="text-sm text-muted-foreground">已通过</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-500">{pendingUsers.length}</div>
            <div className="text-sm text-muted-foreground">待审批</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">{rejectedUsers.length}</div>
            <div className="text-sm text-muted-foreground">已拒绝</div>
          </CardContent>
        </Card>
      </div>

      {/* Anonymous Generate Switch */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="font-medium">免登录生图</div>
            <div className="text-sm text-muted-foreground">开启后，未登录用户也可以生成图片。其他操作（删除、收藏等）仍需登录。</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={anonymousGenerate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleToggleAnonymousGenerate(e.target.checked)}
              disabled={savingAnonymous}
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all', label: '全部', count: users.length },
          { key: 'admin', label: '管理员', count: users.filter(u => u.role === 'admin').length },
          { key: 'user', label: '普通用户', count: users.filter(u => u.role === 'user').length },
          { key: 'approved', label: '已通过', count: approvedUsers.length },
          { key: 'pending', label: '待审核', count: pendingUsers.length },
          { key: 'rejected', label: '已拒绝', count: rejectedUsers.length },
        ] as { key: typeof activeFilter; label: string; count: number }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              activeFilter === tab.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Pending Approval Section */}
      {(activeFilter === 'all' || activeFilter === 'pending') && pendingUsers.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              待审批用户 ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center font-bold text-yellow-600 text-sm">
                      {user.nickname?.[0] || user.email?.[0] || user.username[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{user.nickname || user.email || user.username}</p>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          作品 {user.work_count || 0}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">@{user.username} · {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => handleApprove(user.id, 'approved')}>
                      通过
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleApprove(user.id, 'rejected')}>
                      拒绝
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>用户管理</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportUsers}>
              <Download className="w-4 h-4 mr-1" />批量导出
            </Button>
            <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Upload className="w-4 h-4 mr-1" />批量还原
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量还原用户</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground">粘贴导出的 CSV 内容，系统会自动识别 bcrypt 哈希密码并直接还原，无需重新加密。</p>
                  <textarea
                    className="w-full min-h-[120px] p-3 rounded-md border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={`用户名,密码,昵称,角色...\nadmin,\$2b\$10\$...,管理员,admin...`}
                    value={restoreText}
                    onChange={e => { setRestoreText(e.target.value); parseRestoreCSV(e.target.value); }}
                  />
                  {restorePreview.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-[150px] overflow-y-auto">
                      {restorePreview.map((u, i) => (
                        <div key={i} className={`text-xs flex items-center gap-2 px-2 py-1 rounded ${u.valid ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                          <span className="font-mono">{i + 1}.</span>
                          <span>{u.username}</span>
                          <span className="text-muted-foreground">{u.nickname}</span>
                          {u.isHash && <Badge variant="outline" className="text-[10px] h-4">哈希</Badge>}
                          <span className="ml-auto">{u.role === 'admin' ? '管理员' : '普通用户'}</span>
                          {!u.valid && <span className="text-red-500">(信息不完整)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    onClick={handleRestoreUsers}
                    disabled={restorePreview.filter(u => u.valid).length === 0}
                    className="w-full"
                  >
                    批量还原 {restorePreview.filter(u => u.valid).length > 0 ? `(${restorePreview.filter(u => u.valid).length} 人)` : ''}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">添加用户</Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加用户</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium">用户名</label>
                  <Input
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="至少3个字符"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">密码</label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="至少6个字符"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">昵称</label>
                  <Input
                    value={newUser.nickname}
                    onChange={e => setNewUser({ ...newUser, nickname: e.target.value })}
                    placeholder="显示名称"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">角色</label>
                  <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">普通用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddUser} className="w-full">创建用户</Button>
                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">批量添加</p>
                    <p className="text-xs text-muted-foreground">格式：用户名--密码--昵称--角色（支持 bcrypt 哈希密码直接导入）</p>
                  </div>
                  <textarea
                    className="w-full min-h-[100px] p-3 rounded-md border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={`user1--123456--张三--普通用户\nadmin1--\$2b\$10\$...--李四--管理员`}
                    value={batchText}
                    onChange={e => { setBatchText(e.target.value); parseBatchText(e.target.value); }}
                  />
                  {batchPreview.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                      {batchPreview.map((u, i) => (
                        <div key={i} className={`text-xs flex items-center gap-2 px-2 py-1 rounded ${u.valid ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                          <span className="font-mono">{i + 1}.</span>
                          <span>{u.username}</span>
                          <span className="text-muted-foreground">{u.nickname}</span>
                          {u.isHash && <Badge variant="outline" className="text-[10px] h-4">哈希</Badge>}
                          <span className="ml-auto">{u.role === 'admin' ? '管理员' : '普通用户'}</span>
                          {!u.valid && <span className="text-red-500">(信息不完整)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    onClick={handleBatchAdd}
                    disabled={batchPreview.filter(u => u.valid).length === 0}
                    variant="outline"
                    className="w-full mt-2"
                  >
                    批量创建 {batchPreview.filter(u => u.valid).length > 0 ? `(${batchPreview.filter(u => u.valid).length} 人)` : ''}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">用户</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">邮箱</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">电话</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">角色</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">状态</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">生图</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">作品</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">注册时间</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">暂无用户</td>
                  </tr>
                )}
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs overflow-hidden shrink-0">
                          {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : (user.nickname?.[0] || user.username[0])}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{user.nickname || user.username}</p>
                          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[180px]">{user.email || '-'}</td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{user.phone || '-'}</td>
                    <td className="py-3 px-3 text-center">{getRoleBadge(user.role)}</td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(user.status)}</td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={user.can_generate !== false ? "outline" : "secondary"} className={`text-[10px] h-5 px-1.5 ${user.can_generate !== false ? 'text-green-600 border-green-500/30' : 'text-muted-foreground'}`}>
                        {user.can_generate !== false ? '可' : '禁'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-muted-foreground">{user.work_count || 0}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 items-center justify-end">
                        {user.status === 'pending' && (
                          <>
                            <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700 h-7 px-2.5" onClick={() => handleApprove(user.id, 'approved')}>
                              通过
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7 px-2" onClick={() => handleApprove(user.id, 'rejected')}>
                              拒绝
                            </Button>
                          </>
                        )}
                        {user.status === 'approved' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleApprove(user.id, 'rejected')}>
                            停用
                          </Button>
                        )}
                        {user.status === 'rejected' && (
                          <Button size="sm" variant="ghost" className="text-green-500 hover:text-green-600 hover:bg-green-500/10 h-7 px-2 text-xs" onClick={() => handleApprove(user.id, 'approved')}>
                            启用
                          </Button>
                        )}
                        {user.role !== 'admin' && (
                          <Button size="sm" variant="ghost" className={`h-7 px-2 text-xs ${user.can_generate !== false ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-500/10' : 'text-green-500 hover:text-green-600 hover:bg-green-500/10'}`} onClick={() => handleToggleGenerate(user.id, user.can_generate !== false)}>
                            {user.can_generate !== false ? '禁图' : '开图'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingUser(user); setEditForm({ nickname: user.nickname || '', role: user.role }); }}>
                          编辑
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setResetPwdUser(user); setNewPassword(''); }}>
                          密码
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 h-7 px-2 text-xs" onClick={() => handleDelete(user.id)}>
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">用户名</label>
                <Input value={editingUser.username} disabled />
              </div>
              <div>
                <label className="text-sm font-medium">昵称</label>
                <Input value={editForm.nickname} onChange={e => setEditForm({ ...editForm, nickname: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">角色</label>
                <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleEditUser} className="w-full">保存</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwdUser} onOpenChange={() => setResetPwdUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码 - {resetPwdUser?.nickname}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">新密码</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少6个字符" />
            </div>
            <Button onClick={handleResetPassword} className="w-full">重置密码</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
