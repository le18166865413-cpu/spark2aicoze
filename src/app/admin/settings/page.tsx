'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Globe, ToggleLeft, ToggleRight, Upload, X, Mail } from 'lucide-react';

export default function AdminSettingsPage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [siteName, setSiteName] = useState('');
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [siteEnabled, setSiteEnabled] = useState(true);
  const [registerEnabled, setRegisterEnabled] = useState(true);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [gallerySubtitle, setGallerySubtitle] = useState('');

  const [groupQrImage, setGroupQrImage] = useState('');
  const [groupQrPreview, setGroupQrPreview] = useState('');
  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [smtpHost, setSmtpHost] = useState('smtp.qq.com');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('SparkAI');
  const [smtp2Host, setSmtp2Host] = useState('smtp.163.com');
  const [smtp2Port, setSmtp2Port] = useState('465');
  const [smtp2User, setSmtp2User] = useState('');
  const [smtp2Pass, setSmtp2Pass] = useState('');
  const [smtp2FromName, setSmtp2FromName] = useState('SparkAI');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string; channels?: { label: string; success: boolean; message: string }[] } | null>(null);

  useEffect(() => {
    if (!loading && !initialized) {
      setSiteName(getSetting('site_name') || 'SparkAI');
      setSiteTitle(getSetting('site_title') || 'SparkAI - 智能海报生成器');
      setSiteDescription(getSetting('site_description') || 'AI 驱动的海报生成与展示平台');
      setSiteEnabled(getSetting('site_enabled') !== 'false');
      setRegisterEnabled(getSetting('register_enabled') !== 'false');
      setGalleryTitle(getSetting('gallery_title') || '海报生成记录');
      setGallerySubtitle(getSetting('gallery_subtitle') || '查看通过 SparkAI 生成的所有海报作品');

      const qr = getSetting('group_qr_image') || '';
      setGroupQrImage(qr);
      // SMTP settings
      setSmtpHost(getSetting('smtp_host') || 'smtp.qq.com');
      setSmtpPort(getSetting('smtp_port') || '465');
      setSmtpUser(getSetting('smtp_user') || '');
      setSmtpPass(getSetting('smtp_pass') || '');
      setSmtpFromName(getSetting('smtp_from_name') || 'SparkAI');
      setSmtp2Host(getSetting('smtp2_host') || 'smtp.163.com');
      setSmtp2Port(getSetting('smtp2_port') || '465');
      setSmtp2User(getSetting('smtp2_user') || '');
      setSmtp2Pass(getSetting('smtp2_pass') || '');
      setSmtp2FromName(getSetting('smtp2_from_name') || 'SparkAI');
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('forGrsai', 'true');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if (data.key) {
        setGroupQrImage(data.key);
      }
    } catch (err) {
      console.error('QR upload error:', err);
    } finally {
      setUploadingQr(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleQrRemove = () => {
    setGroupQrImage('');
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings([
        { key: 'site_name', value: siteName },
        { key: 'site_title', value: siteTitle },
        { key: 'site_description', value: siteDescription },
        { key: 'site_enabled', value: siteEnabled ? 'true' : 'false' },
        { key: 'register_enabled', value: registerEnabled ? 'true' : 'false' },
        { key: 'gallery_title', value: galleryTitle },
        { key: 'gallery_subtitle', value: gallerySubtitle },

        { key: 'group_qr_image', value: groupQrImage },
        { key: 'smtp_host', value: smtpHost },
        { key: 'smtp_port', value: smtpPort },
        { key: 'smtp_user', value: smtpUser },
        { key: 'smtp_pass', value: smtpPass },
        { key: 'smtp_from_name', value: smtpFromName },
        { key: 'smtp2_host', value: smtp2Host },
        { key: 'smtp2_port', value: smtp2Port },
        { key: 'smtp2_user', value: smtp2User },
        { key: 'smtp2_pass', value: smtp2Pass },
        { key: 'smtp2_from_name', value: smtp2FromName },
      ]);
      setMessage({ type: 'success', text: '设置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Save className="w-5 h-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">站点信息</h3>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">站点名称</label>
          <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="SparkAI" />
          <p className="text-xs text-muted-foreground">显示在导航栏和侧边栏</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">网站标题</label>
          <input type="text" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="SparkAI - 智能海报生成器" />
          <p className="text-xs text-muted-foreground">显示在浏览器标签页上</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">站点描述</label>
          <textarea value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" placeholder="AI 驱动的海报生成与展示平台" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">广场标题</label>
          <input type="text" value={galleryTitle} onChange={(e) => setGalleryTitle(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="海报生成记录" />
          <p className="text-xs text-muted-foreground">显示在海报广场首页顶部</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">广场副标题</label>
          <input type="text" value={gallerySubtitle} onChange={(e) => setGallerySubtitle(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="查看通过 SparkAI 生成的所有海报作品" />
          <p className="text-xs text-muted-foreground">显示在海报广场首页标题下方</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">功能开关</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">站点开放</p>
            <p className="text-xs text-muted-foreground">关闭后用户将无法访问前台页面</p>
          </div>
          <button onClick={() => setSiteEnabled(!siteEnabled)} className="text-primary">
            {siteEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">允许注册</p>
            <p className="text-xs text-muted-foreground">控制新用户是否可以注册账号</p>
          </div>
          <button onClick={() => setRegisterEnabled(!registerEnabled)} className="text-primary">
            {registerEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">创作中心配置</h3>
        <div className="space-y-3">
          <label className="text-sm text-muted-foreground">生图交流反馈群二维码</label>
          <p className="text-xs text-muted-foreground">显示在创作中心小贴士区域，建议上传正方形二维码图片</p>
          <div className="flex items-center gap-3">
            {groupQrImage ? (
              <div className="relative w-24 h-24 border border-border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center">
                <img
                  src={`/api/qr-image?key=${encodeURIComponent(groupQrImage)}`}
                  alt="群二维码"
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                />
                <button
                  onClick={handleQrRemove}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
                <Upload className="w-6 h-6" />
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleQrUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingQr}
                className="px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {uploadingQr ? '上传中...' : groupQrImage ? '更换图片' : '上传图片'}
              </button>
            </div>
          </div>
        </div>
      </div>


      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">邮件服务配置</h3>
        </div>
        <p className="text-xs text-muted-foreground">用于发送邮箱验证码。主通道优先，失败自动切换备用通道（建议 QQ + 163 双通道）</p>

        {/* 主通道 */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">主通道</span>
            <span className="text-xs text-muted-foreground">优先使用</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">SMTP 服务器</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.qq.com"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">端口</label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="465"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">邮箱账号</label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="your@qq.com"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">授权码</label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="SMTP 授权码（非登录密码）"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">发件人名称</label>
              <input
                type="text"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
                placeholder="SparkAI"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* 备用通道 */}
        <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">备用通道</span>
            <span className="text-xs text-muted-foreground">主通道失败时自动切换</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">SMTP 服务器</label>
              <input
                type="text"
                value={smtp2Host}
                onChange={(e) => setSmtp2Host(e.target.value)}
                placeholder="smtp.163.com"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">端口</label>
              <input
                type="text"
                value={smtp2Port}
                onChange={(e) => setSmtp2Port(e.target.value)}
                placeholder="465"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">邮箱账号</label>
              <input
                type="text"
                value={smtp2User}
                onChange={(e) => setSmtp2User(e.target.value)}
                placeholder="your@163.com"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">授权码</label>
              <input
                type="password"
                value={smtp2Pass}
                onChange={(e) => setSmtp2Pass(e.target.value)}
                placeholder="SMTP 授权码（非登录密码）"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">发件人名称</label>
              <input
                type="text"
                value={smtp2FromName}
                onChange={(e) => setSmtp2FromName(e.target.value)}
                placeholder="SparkAI"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setSmtpTesting(true);
              setSmtpTestResult(null);
              try {
                const res = await fetch('/api/admin/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ settings: [
                    { key: 'smtp_host', value: smtpHost },
                    { key: 'smtp_port', value: smtpPort },
                    { key: 'smtp_user', value: smtpUser },
                    { key: 'smtp_pass', value: smtpPass },
                    { key: 'smtp_from_name', value: smtpFromName },
                    { key: 'smtp2_host', value: smtp2Host },
                    { key: 'smtp2_port', value: smtp2Port },
                    { key: 'smtp2_user', value: smtp2User },
                    { key: 'smtp2_pass', value: smtp2Pass },
                    { key: 'smtp2_from_name', value: smtp2FromName },
                  ]}),
                });
                if (!res.ok) throw new Error('保存失败');
                const testRes = await fetch('/api/admin/test-smtp');
                const testData = await testRes.json();
                setSmtpTestResult(testData);
              } catch {
                setSmtpTestResult({ success: false, message: '测试失败' });
              } finally {
                setSmtpTesting(false);
              }
            }}
            disabled={smtpTesting || (!smtpUser && !smtp2User)}
            className="px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {smtpTesting ? '测试中...' : '测试连接'}
          </button>
          {smtpTestResult && !smtpTestResult.channels && (
            <span className={`text-xs ${smtpTestResult.success ? 'text-green-500' : 'text-red-500'}`}>
              {smtpTestResult.message}
            </span>
          )}
          {smtpTestResult?.channels?.map((ch, i) => (
            <span key={i} className={`text-xs ${ch.success ? 'text-green-500' : 'text-red-500'}`}>
              {ch.label}: {ch.message}
            </span>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  );
}
