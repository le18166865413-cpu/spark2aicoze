'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Plus, Trash2, GripVertical, Sparkles, Settings2 } from 'lucide-react';

interface TemplateItem {
  label: string;
  prompt: string;
}

interface ModelItem {
  value: string;
  label: string;
  desc: string;
}

interface RatioItem {
  value: string;
  label: string;
  desc: string;
}

type TabKey = 'templates' | 'models' | 'ratios' | 'tips' | 'wait' | 'pagesize';

export default function CreationConfigPage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('templates');

  // Templates
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  // Models
  const [models, setModels] = useState<ModelItem[]>([]);
  // Ratios
  const [ratios, setRatios] = useState<RatioItem[]>([]);
  // Default ratio
  const [defaultRatio, setDefaultRatio] = useState('auto');
  // Tips
  const [tips, setTips] = useState<string[]>([]);
  // Wait message
  const [waitMessage, setWaitMessage] = useState('');
  const [waitDuration, setWaitDuration] = useState('5000');
  // Page size
  const [pageSize, setPageSize] = useState('50');

  useEffect(() => {
    if (!loading && !initialized) {
      try {
        const t = getSetting('prompt_templates');
        setTemplates(t ? JSON.parse(t) : []);
      } catch { setTemplates([]); }
      try {
        const m = getSetting('available_models');
        setModels(m ? JSON.parse(m) : []);
      } catch { setModels([]); }
      try {
        const r = getSetting('available_ratios');
        setRatios(r ? JSON.parse(r) : []);
      } catch { setRatios([]); }
      setDefaultRatio(getSetting('default_ratio') || 'auto');
      try {
        const tp = getSetting('tips_content');
        setTips(tp ? JSON.parse(tp) : []);
      } catch { setTips([]); }
      setWaitMessage(getSetting('wait_message') || '请等待30-120秒，不要切换页面');
      setWaitDuration(getSetting('wait_duration') || '5000');
      setPageSize(getSetting('gallery_page_size') || '50');
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings([
        { key: 'prompt_templates', value: JSON.stringify(templates) },
        { key: 'available_models', value: JSON.stringify(models) },
        { key: 'available_ratios', value: JSON.stringify(ratios) },
        { key: 'default_ratio', value: defaultRatio },
        { key: 'tips_content', value: JSON.stringify(tips) },
        { key: 'wait_message', value: waitMessage },
        { key: 'wait_duration', value: waitDuration },
        { key: 'gallery_page_size', value: pageSize },
      ]);
      setMessage({ type: 'success', text: '配置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  }, [templates, models, ratios, defaultRatio, tips, waitMessage, waitDuration, pageSize, saveSettings]);

  // Template helpers
  const addTemplate = () => setTemplates([...templates, { label: '', prompt: '' }]);
  const removeTemplate = (i: number) => setTemplates(templates.filter((_, idx) => idx !== i));
  const updateTemplate = (i: number, field: keyof TemplateItem, val: string) => {
    const next = [...templates];
    next[i] = { ...next[i], [field]: val };
    setTemplates(next);
  };

  // Model helpers
  const addModel = () => setModels([...models, { value: '', label: '', desc: '' }]);
  const removeModel = (i: number) => setModels(models.filter((_, idx) => idx !== i));
  const updateModel = (i: number, field: keyof ModelItem, val: string) => {
    const next = [...models];
    next[i] = { ...next[i], [field]: val };
    setModels(next);
  };

  // Ratio helpers
  const addRatio = () => setRatios([...ratios, { value: '', label: '', desc: '' }]);
  const removeRatio = (i: number) => setRatios(ratios.filter((_, idx) => idx !== i));
  const updateRatio = (i: number, field: keyof RatioItem, val: string) => {
    const next = [...ratios];
    next[i] = { ...next[i], [field]: val };
    setRatios(next);
  };

  // Tips helpers
  const addTip = () => setTips([...tips, '']);
  const removeTip = (i: number) => setTips(tips.filter((_, idx) => idx !== i));
  const updateTip = (i: number, val: string) => {
    const next = [...tips];
    next[i] = val;
    setTips(next);
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'templates', label: '快捷模板' },
    { key: 'models', label: '可用模型' },
    { key: 'ratios', label: '可用比例' },
    { key: 'tips', label: '创作小贴士' },
    { key: 'wait', label: '等待提示' },
    { key: 'pagesize', label: '广场数量' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Settings2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
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

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">快捷模板</h3>
            </div>
            <button onClick={addTemplate} className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> 添加模板
            </button>
          </div>
          <div className="space-y-3">
            {templates.map((t, i) => (
              <div key={i} className="flex gap-2 items-start p-3 bg-background rounded-lg border border-border">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                <div className="flex-1 space-y-2">
                  <input type="text" value={t.label} onChange={(e) => updateTemplate(i, 'label', e.target.value)} placeholder="模板名称" className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <textarea value={t.prompt} onChange={(e) => updateTemplate(i, 'prompt', e.target.value)} placeholder="提示词内容" rows={2} className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                </div>
                <button onClick={() => removeTemplate(i)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无模板，点击上方添加</p>}
          </div>
        </div>
      )}

      {/* Models Tab */}
      {activeTab === 'models' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">可用模型</h3>
            <button onClick={addModel} className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> 添加模型
            </button>
          </div>
          <div className="space-y-3">
            {models.map((m, i) => (
              <div key={i} className="flex gap-2 items-start p-3 bg-background rounded-lg border border-border">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input type="text" value={m.value} onChange={(e) => updateModel(i, 'value', e.target.value)} placeholder="模型ID (如 image2-vip)" className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <input type="text" value={m.label} onChange={(e) => updateModel(i, 'label', e.target.value)} placeholder="显示名称" className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <input type="text" value={m.desc} onChange={(e) => updateModel(i, 'desc', e.target.value)} placeholder="描述" className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <button onClick={() => removeModel(i)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {models.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无模型，点击上方添加</p>}
          </div>
        </div>
      )}

      {/* Ratios Tab */}
      {activeTab === 'ratios' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">可用比例</h3>
              <button onClick={addRatio} className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
                <Plus className="w-3.5 h-3.5" /> 添加比例
              </button>
            </div>
            <div className="space-y-3">
              {ratios.map((r, i) => (
                <div key={i} className="flex gap-2 items-center p-3 bg-background rounded-lg border border-border">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input type="text" value={r.value} onChange={(e) => updateRatio(i, 'value', e.target.value)} placeholder="比例值 (如 9:16)" className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <input type="text" value={r.label} onChange={(e) => updateRatio(i, 'label', e.target.value)} placeholder="显示标签" className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <input type="text" value={r.desc} onChange={(e) => updateRatio(i, 'desc', e.target.value)} placeholder="描述" className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <button onClick={() => removeRatio(i)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {ratios.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无比例，点击上方添加</p>}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold">默认比例</h3>
            <select value={defaultRatio} onChange={(e) => setDefaultRatio(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {ratios.map((r) => (
                <option key={r.value} value={r.value}>{r.label} ({r.value})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tips Tab */}
      {activeTab === 'tips' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">创作小贴士</h3>
            <button onClick={addTip} className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> 添加条目
            </button>
          </div>
          <div className="space-y-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-2 items-center p-3 bg-background rounded-lg border border-border">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <input type="text" value={tip} onChange={(e) => updateTip(i, e.target.value)} placeholder="小贴士内容" className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <button onClick={() => removeTip(i)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {tips.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无条目，点击上方添加</p>}
          </div>
        </div>
      )}

      {/* Wait Message Tab */}
      {activeTab === 'wait' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">生成等待提示</h3>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">提示文案</label>
            <input type="text" value={waitMessage} onChange={(e) => setWaitMessage(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">显示时长（毫秒）</label>
            <input type="number" value={waitDuration} onChange={(e) => setWaitDuration(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <p className="text-xs text-muted-foreground">1000毫秒 = 1秒，建议 3000-8000</p>
          </div>
        </div>
      )}

      {/* Page Size Tab */}
      {activeTab === 'pagesize' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">广场列表数量</h3>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">每页加载数量</label>
            <input type="number" value={pageSize} onChange={(e) => setPageSize(e.target.value)} min="10" max="200" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <p className="text-xs text-muted-foreground">建议 20-100，数量过多会影响加载速度</p>
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存配置'}
      </button>
    </div>
  );
}
