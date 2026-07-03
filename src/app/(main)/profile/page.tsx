'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, User, Mail, Phone, MessageCircle, Camera } from 'lucide-react';
import { authFetch } from '@/utils/auth-fetch';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [wechat, setWechat] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    setNickname(user.nickname || '');
    setPhone(user.phone || '');
    setWechat(user.wechat || '');
    setEmail(user.email || '');
    setAvatar(user.avatar || '');
  }, [user, router]);

  const handleSave = async () => {
    if (!nickname.trim()) {
      setMessage({ type: 'error', text: '昵称不能为空' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          phone: phone.trim(),
          wechat: wechat.trim(),
          avatar: avatar.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '保存失败' });
        return;
      }

      if (data.user) {
        await refresh();
      }
      setMessage({ type: 'success', text: '保存成功' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authFetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.key) {
        setAvatar(data.url || data.key);
      }
    } catch {
      setMessage({ type: 'error', text: '头像上传失败' });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">个人资料</h1>
        </div>

        {/* Avatar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt="头像" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="w-4 h-4 text-primary-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>
              <div>
                <p className="font-medium text-lg">{nickname || user.username}</p>
                <p className="text-sm text-muted-foreground">{email || user.username}</p>
                {user.status === 'pending' && (
                  <p className="text-xs text-amber-500 mt-1">账号待审核，暂无法使用生图功能</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>修改你的个人资料信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Nickname */}
            <div className="space-y-2">
              <Label htmlFor="nickname" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                昵称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入你的昵称"
                maxLength={20}
              />
            </div>

            {/* Email (readonly) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                邮箱
              </Label>
              <Input
                id="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">邮箱不可修改</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                手机号
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="输入手机号（选填）"
                maxLength={15}
              />
            </div>

            {/* WeChat */}
            <div className="space-y-2">
              <Label htmlFor="wechat" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                微信号
              </Label>
              <Input
                id="wechat"
                value={wechat}
                onChange={(e) => setWechat(e.target.value)}
                placeholder="输入微信号（选填）"
                maxLength={30}
              />
            </div>

            {/* Message */}
            {message && (
              <div className={`text-sm px-3 py-2 rounded-md ${
                message.type === 'success' 
                  ? 'bg-green-500/10 text-green-600' 
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {message.text}
              </div>
            )}

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? '保存中...' : '保存修改'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
