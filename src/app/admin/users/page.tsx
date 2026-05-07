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

interface User {
  id: string;
  username: string;
  nickname: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
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
  }, [fetchUsers]);

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

      {/* Pending Approval Section */}
      {pendingUsers.length > 0 && (
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
                      {user.nickname[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{user.nickname}</p>
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
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {user.nickname[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{user.nickname}</p>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">@{user.username} · 注册于 {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {user.status === 'pending' && (
                    <>
                      <Button size="sm" variant="ghost" className="text-green-500 hover:text-green-600 hover:bg-green-500/10 h-8 px-2" onClick={() => handleApprove(user.id, 'approved')}>
                        通过
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 px-2" onClick={() => handleApprove(user.id, 'rejected')}>
                        拒绝
                      </Button>
                    </>
                  )}
                  {user.status === 'approved' && (
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleApprove(user.id, 'rejected')}>
                      停用
                    </Button>
                  )}
                  {user.status === 'rejected' && (
                    <Button size="sm" variant="ghost" className="text-green-500 hover:text-green-600 hover:bg-green-500/10 h-8 px-2" onClick={() => handleApprove(user.id, 'approved')}>
                      启用
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setEditingUser(user); setEditForm({ nickname: user.nickname, role: user.role }); }}>
                    编辑
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setResetPwdUser(user); setNewPassword(''); }}>
                    重置密码
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 h-8 px-2" onClick={() => handleDelete(user.id)}>
                    删除
                  </Button>
                </div>
              </div>
            ))}
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
