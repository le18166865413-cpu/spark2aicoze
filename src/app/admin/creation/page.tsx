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
  enabled?: boolean;
}

interface RatioItem {
  value: string;
  label: string;
  desc: string;
}

type TabKey = 'templates' | 'models' | 'ratios' | 'tips' | 'wait' | 'pagesize' | 'imagecount' | 'imagesize' | 'violation' | 'limits';

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
  // Image count
  const [imageCountEnabled, setImageCountEnabled] = useState(true);
  const [imageCountMax, setImageCountMax] = useState('4');
  // Image size
  const [imageSizes, setImageSizes] = useState<{value: string; label: string; desc: string}[]>([]);
  const [defaultImageSize, setDefaultImageSize] = useState('1K');
  const [hdModels, setHdModels] = useState<string[]>([]);
  // Violation messages
  const [violationMessages, setViolationMessages] = useState<Record<string, string>>({});
  // Limits
  const [dailyGenerateLimit, setDailyGenerateLimit] = useState('0');
  const [promptMaxLength, setPromptMaxLength] = useState('2000');

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
      setImageCountEnabled(getSetting('image_count_enabled') !== 'false');
      setImageCountMax(getSetting('image_count_max') || '4');
      try {
        const is = getSetting('available_image_sizes');
        setImageSizes(is ? JSON.parse(is) : []);
      } catch { setImageSizes([]); }
      setDefaultImageSize(getSetting('default_image_size') || '1K');
      try {
        const hd = getSetting('hd_models');
        setHdModels(hd ? JSON.parse(hd) : []);
      } catch { setHdModels([]); }
      try {
        const vm = getSetting('violation_messages');
        setViolationMessages(vm ? JSON.parse(vm) : {});
      } catch { setViolationMessages({}); }
      setDailyGenerateLimit(getSetting('daily_generate_limit') || '0');
      setPromptMaxLength(getSetting('prompt_max_length') || '2000');
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
        { key: 'image_count_enabled', value: String(imageCountEnabled) },
        { key: 'image_count_max', value: imageCountMax },
        { key: 'available_image_sizes', value: JSON.stringify(imageSizes) },
        { key: 'default_image_size', value: defaultImageSize },
        { key: 'hd_models', value: JSON.stringify(hdModels) },
        { key: 'violation_messages', value: JSON.stringify(violationMessages) },
        { key: 'daily_generate_limit', value: dailyGenerateLimit },
        { key: 'prompt_max_length', value: promptMaxLength },
      ]);
      setMessage({ type: 'success', text: '配置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  }, [templates, models, ratios, defaultRatio, tips, waitMessage, waitDuration, pageSize, imageCountEnabled, imageCountMax, imageSizes, defaultImageSize, hdModels, violationMessages, dailyGenerateLimit, promptMaxLength, saveSettings]);

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
  const updateModel = (i: number, field: keyof ModelItem, val: string | boolean) => {
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
    { key: 'imagecount', label: '生图数量' },
    { key: 'imagesize', label: '输出分辨率' },
    { key: 'violation', label: '违规提示' },
    { key: 'limits', label: '生成限制' },
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
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs whitespace-nowrap" title={m.enabled !== false ? "点击停用" : "点击启用"}>
                  <span className={m.enabled !== false ? "text-emerald-500" : "text-muted-foreground"}>{m.enabled !== false ? "已启用" : "已停用"}</span>
                  <div
                    onClick={() => updateModel(i, 'enabled', m.enabled === false ? true : false)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${m.enabled !== false ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${m.enabled !== false ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </label>
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

      {/* Image Count Tab */}
      {activeTab === 'imagecount' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">生图数量</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">启用批量生图</label>
                <p className="text-xs text-muted-foreground">开启后用户可选择一次生成多张图片</p>
              </div>
              <button
                onClick={() => setImageCountEnabled(!imageCountEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${imageCountEnabled ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${imageCountEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          {imageCountEnabled && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">最大生成数量</label>
              <select value={imageCountMax} onChange={(e) => setImageCountMax(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="2">2 张</option>
                <option value="3">3 张</option>
                <option value="4">4 张</option>
                <option value="6">6 张</option>
                <option value="8">8 张</option>
              </select>
              <p className="text-xs text-muted-foreground">数量越多，生成时间越长，建议不超过 4 张</p>
            </div>
          )}
        </div>
      )}

      {/* Image Size Tab */}
      {activeTab === 'imagesize' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">输出分辨率</h3>
          <div className="space-y-3">
            {imageSizes.map((size, i) => (
              <div key={i} className="flex items-center gap-3">
                <input value={size.value} onChange={(e) => {
                  const next = [...imageSizes]; next[i] = { ...next[i], value: e.target.value }; setImageSizes(next);
                }} placeholder="值 (如 1K)" className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input value={size.label} onChange={(e) => {
                  const next = [...imageSizes]; next[i] = { ...next[i], label: e.target.value }; setImageSizes(next);
                }} placeholder="标签" className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input value={size.desc} onChange={(e) => {
                  const next = [...imageSizes]; next[i] = { ...next[i], desc: e.target.value }; setImageSizes(next);
                }} placeholder="描述" className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <button onClick={() => setImageSizes(imageSizes.filter((_, idx) => idx !== i))} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setImageSizes([...imageSizes, { value: '', label: '', desc: '' }])} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="w-4 h-4" /> 添加分辨率</button>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">默认分辨率</label>
            <select value={defaultImageSize} onChange={(e) => setDefaultImageSize(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {imageSizes.map((s) => <option key={s.value} value={s.value}>{s.label} - {s.desc}</option>)}
            </select>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">支持高清的模型 ID</label>
            <p className="text-xs text-muted-foreground">这些模型会显示分辨率选择器，每行一个模型 ID</p>
            <textarea
              value={hdModels.join('\n')}
              onChange={(e) => setHdModels(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
              rows={4}
              placeholder={"image2-vip\nnano-banana-2\nnano-banana-pro-vip"}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      )}

      {/* Violation Messages Tab */}
      {activeTab === 'violation' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">违规提示文案</h3>
          <p className="text-xs text-muted-foreground">自定义各类违规/错误状态的提示文案</p>
          <div className="space-y-3">
            {[
              { key: 'output_moderation', label: '输出违规 (output_moderation)' },
              { key: 'input_moderation', label: '输入违规 (input_moderation)' },
              { key: 'violation', label: '内容违规 (violation)' },
              { key: 'error', label: '其他错误 (error)' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <input
                  value={violationMessages[key] || ''}
                  onChange={(e) => setViolationMessages({ ...violationMessages, [key]: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Limits Tab */}
      {activeTab === 'limits' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">生成限制</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">每日生成上限</label>
              <p className="text-xs text-muted-foreground">每个用户每天最多生成次数，0 表示不限制</p>
              <input
                type="number"
                min="0"
                value={dailyGenerateLimit}
                onChange={(e) => setDailyGenerateLimit(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt 最大长度</label>
              <p className="text-xs text-muted-foreground">提示词最大字符数，超出将截断</p>
              <input
                type="number"
                min="100"
                value={promptMaxLength}
                onChange={(e) => setPromptMaxLength(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
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
