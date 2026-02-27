/**
 * 设置页
 *
 * 包含以下配置区域：
 * 1. Zotero 连接：User ID、API Key、测试连接
 * 2. 翻译引擎管理：卡片式 UI，添加/编辑/删除/测试引擎
 * 3. Prompt 模板编辑器
 * 4. 界面偏好：主题切换
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Server,
  Smartphone,
  Shield,
  Globe,
  Bot,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_TRANSLATE_SYSTEM_PROMPT,
  DEFAULT_TRANSLATE_USER_PROMPT,
  DEFAULT_SETTINGS,
} from "@/types/settings";

// ======= 类型定义 =======

interface EngineConfig {
  id: string;
  name: string;
  type: "deeplx" | "openai";
  enabled: boolean;
  priority: number;
  deeplxToken: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

interface TestResult {
  success: boolean;
  error?: string;
  translation?: string;
  latency: number;
}

// ======= 主组件 =======

export default function SettingsPage() {
  const router = useRouter();

  // Zotero 配置
  const [zoteroUserId, setZoteroUserId] = useState("");
  const [zoteroApiKey, setZoteroApiKey] = useState("");
  const [zoteroKeyVisible, setZoteroKeyVisible] = useState(false);
  const [zoteroTesting, setZoteroTesting] = useState(false);
  const [zoteroTestResult, setZoteroTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 翻译引擎列表
  const [engines, setEngines] = useState<EngineConfig[]>([]);
  const [enginesLoading, setEnginesLoading] = useState(true);

  // 添加/编辑引擎对话框
  const [engineDialogOpen, setEngineDialogOpen] = useState(false);
  const [editingEngine, setEditingEngine] = useState<Partial<EngineConfig> | null>(null);
  const [engineSaving, setEngineSaving] = useState(false);

  // 测试连接
  const [testingEngineId, setTestingEngineId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Prompt 模板
  const [translateSystemPrompt, setTranslateSystemPrompt] = useState("");
  const [translateUserPrompt, setTranslateUserPrompt] = useState("");
  const [chatSystemPrompt, setChatSystemPrompt] = useState("");

  // 界面偏好
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // ======= 数据加载 =======

  useEffect(() => {
    loadSettings();
    loadEngines();
  }, []);

  async function loadSettings() {
    try {
      const keys = [
        "zotero_user_id",
        "zotero_api_key",
        "translate_system_prompt",
        "translate_user_prompt",
        "chat_system_prompt",
        "theme",
      ];

      const results = await Promise.all(
        keys.map((key) =>
          fetch(`/api/settings?key=${key}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );

      if (results[0]) setZoteroUserId(results[0] as string);
      if (results[1]) setZoteroApiKey(results[1] as string);
      if (results[2]) setTranslateSystemPrompt(results[2] as string);
      if (results[3]) setTranslateUserPrompt(results[3] as string);
      if (results[4]) setChatSystemPrompt(results[4] as string);
      if (results[5]) setTheme(results[5] as "light" | "dark");
    } catch {
      // 忽略加载错误，使用默认值
    }
  }

  async function loadEngines() {
    try {
      setEnginesLoading(true);
      const res = await fetch("/api/engines");
      if (res.ok) {
        const data = await res.json();
        setEngines(data.engines || []);
      }
    } catch {
      toast.error("加载引擎列表失败");
    } finally {
      setEnginesLoading(false);
    }
  }

  // ======= Zotero 配置保存 =======

  async function saveZoteroConfig() {
    try {
      await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "zotero_user_id", value: zoteroUserId }),
        }),
        // 只有不是掩码值才保存（避免覆盖真实 key）
        ...(zoteroApiKey && !zoteroApiKey.includes("****")
          ? [
              fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "zotero_api_key", value: zoteroApiKey }),
              }),
            ]
          : []),
      ]);
      toast.success("Zotero 配置已保存");
    } catch {
      toast.error("保存失败");
    }
  }

  async function testZoteroConnection() {
    setZoteroTesting(true);
    setZoteroTestResult(null);
    try {
      const res = await fetch("/api/zotero/collections");
      if (res.ok) {
        setZoteroTestResult({ ok: true, msg: "连接成功" });
      } else {
        const data = await res.json().catch(() => ({}));
        setZoteroTestResult({ ok: false, msg: data.error || `HTTP ${res.status}` });
      }
    } catch {
      setZoteroTestResult({ ok: false, msg: "连接失败" });
    } finally {
      setZoteroTesting(false);
    }
  }

  // ======= 引擎 CRUD =======

  function openAddEngineDialog(type: "deeplx" | "openai") {
    setEditingEngine({
      type,
      name: type === "deeplx" ? "DeepLX" : "OpenAI 兼容",
      enabled: true,
    });
    setEngineDialogOpen(true);
  }

  function openEditEngineDialog(engine: EngineConfig) {
    setEditingEngine({ ...engine });
    setEngineDialogOpen(true);
  }

  async function saveEngine() {
    if (!editingEngine?.name || !editingEngine?.type) return;

    setEngineSaving(true);
    try {
      const isNew = !editingEngine.id;
      const res = await fetch("/api/engines", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEngine),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "操作失败");
      }

      toast.success(isNew ? "引擎已添加" : "引擎已更新");
      setEngineDialogOpen(false);
      setEditingEngine(null);
      await loadEngines();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setEngineSaving(false);
    }
  }

  async function deleteEngine(id: string) {
    try {
      const res = await fetch("/api/engines", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("引擎已删除");
        await loadEngines();
      }
    } catch {
      toast.error("删除失败");
    }
  }

  async function toggleEngine(id: string, enabled: boolean) {
    try {
      await fetch("/api/engines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      setEngines((prev) =>
        prev.map((e) => (e.id === id ? { ...e, enabled } : e))
      );
    } catch {
      toast.error("更新失败");
    }
  }

  async function testEngine(engine: EngineConfig) {
    setTestingEngineId(engine.id);
    try {
      const res = await fetch("/api/engines/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: engine.type,
          deeplxToken: engine.deeplxToken,
          apiBaseUrl: engine.apiBaseUrl,
          apiKey: engine.apiKey,
          model: engine.model,
        }),
      });
      const result: TestResult = await res.json();
      setTestResults((prev) => ({ ...prev, [engine.id]: result }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [engine.id]: { success: false, error: "请求失败", latency: 0 },
      }));
    } finally {
      setTestingEngineId(null);
    }
  }

  // ======= Prompt 模板保存 =======

  async function savePromptTemplates() {
    try {
      await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "translate_system_prompt", value: translateSystemPrompt }),
        }),
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "translate_user_prompt", value: translateUserPrompt }),
        }),
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "chat_system_prompt", value: chatSystemPrompt }),
        }),
      ]);
      toast.success("Prompt 模板已保存");
    } catch {
      toast.error("保存失败");
    }
  }

  // ======= 主题切换 =======

  async function handleThemeChange(newTheme: "light" | "dark") {
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "theme", value: newTheme }),
      });
    } catch {
      // 忽略保存错误
    }
  }

  // ======= 渲染 =======

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6 pb-20">
        {/* ===== 1. Zotero 连接 ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Zotero 连接
            </CardTitle>
            <CardDescription>
              配置 Zotero Web API 凭据，用于浏览文献库和下载 PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zotero-user-id">User ID</Label>
              <Input
                id="zotero-user-id"
                value={zoteroUserId}
                onChange={(e) => setZoteroUserId(e.target.value)}
                placeholder="数字 ID，在 zotero.org/settings/keys 查看"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zotero-api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="zotero-api-key"
                  type={zoteroKeyVisible ? "text" : "password"}
                  value={zoteroApiKey}
                  onChange={(e) => setZoteroApiKey(e.target.value)}
                  placeholder="在 zotero.org/settings/keys 创建"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setZoteroKeyVisible(!zoteroKeyVisible)}
                >
                  {zoteroKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* 请求路径可视化 */}
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Smartphone className="h-3 w-3" />
                <span>浏览器</span>
                <span className="text-muted-foreground/50">&rarr;</span>
                <Shield className="h-3 w-3" />
                <span>Cloudflare</span>
                <span className="text-muted-foreground/50">&rarr;</span>
                <Server className="h-3 w-3" />
                <span>你的服务器</span>
                <span className="text-muted-foreground/50">&rarr;</span>
                <Globe className="h-3 w-3" />
                <span>api.zotero.org</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveZoteroConfig}>
                保存
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={testZoteroConnection}
                disabled={zoteroTesting}
              >
                {zoteroTesting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5 mr-1" />
                )}
                测试连接
              </Button>
              {zoteroTestResult && (
                <div className="flex items-center gap-1 text-xs">
                  {zoteroTestResult.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className={zoteroTestResult.ok ? "text-green-600" : "text-destructive"}>
                    {zoteroTestResult.msg}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== 2. 翻译引擎管理 ===== */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  翻译引擎
                </CardTitle>
                <CardDescription className="mt-1">
                  管理翻译和对话 API，支持 DeepLX 和 OpenAI 兼容接口
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 引擎卡片列表 */}
            {enginesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : engines.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-3">
                  尚未配置翻译引擎，请添加一个
                </p>
              </div>
            ) : (
              engines.map((engine) => (
                <EngineCard
                  key={engine.id}
                  engine={engine}
                  testResult={testResults[engine.id]}
                  isTesting={testingEngineId === engine.id}
                  onEdit={() => openEditEngineDialog(engine)}
                  onDelete={() => deleteEngine(engine.id)}
                  onToggle={(enabled) => toggleEngine(engine.id, enabled)}
                  onTest={() => testEngine(engine)}
                />
              ))
            )}

            {/* 添加引擎按钮 */}
            <Separator />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => openAddEngineDialog("deeplx")}
              >
                <Plus className="h-3.5 w-3.5" />
                DeepLX
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => openAddEngineDialog("openai")}
              >
                <Plus className="h-3.5 w-3.5" />
                OpenAI 兼容
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ===== 3. Prompt 模板 ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prompt 模板</CardTitle>
            <CardDescription>
              自定义翻译和对话的 Prompt。支持变量：{"{title}"}, {"{authors}"}, {"{journal}"}, {"{abstract}"}, {"{paragraphContext}"}, {"{selectedText}"}, {"{targetLang}"}, {"{fulltext}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 翻译 System Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>翻译 System Prompt</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setTranslateSystemPrompt(DEFAULT_TRANSLATE_SYSTEM_PROMPT)}
                >
                  <RotateCcw className="h-3 w-3" />
                  恢复默认
                </Button>
              </div>
              <Textarea
                value={translateSystemPrompt || DEFAULT_TRANSLATE_SYSTEM_PROMPT}
                onChange={(e) => setTranslateSystemPrompt(e.target.value)}
                rows={6}
                className="text-xs font-mono"
              />
            </div>

            {/* 翻译 User Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>翻译 User Prompt</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setTranslateUserPrompt(DEFAULT_TRANSLATE_USER_PROMPT)}
                >
                  <RotateCcw className="h-3 w-3" />
                  恢复默认
                </Button>
              </div>
              <Textarea
                value={translateUserPrompt || DEFAULT_TRANSLATE_USER_PROMPT}
                onChange={(e) => setTranslateUserPrompt(e.target.value)}
                rows={4}
                className="text-xs font-mono"
              />
            </div>

            {/* 对话 System Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>对话 System Prompt</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setChatSystemPrompt(DEFAULT_SETTINGS.chat.systemPrompt)}
                >
                  <RotateCcw className="h-3 w-3" />
                  恢复默认
                </Button>
              </div>
              <Textarea
                value={chatSystemPrompt || DEFAULT_SETTINGS.chat.systemPrompt}
                onChange={(e) => setChatSystemPrompt(e.target.value)}
                rows={8}
                className="text-xs font-mono"
              />
            </div>

            <Button size="sm" onClick={savePromptTemplates}>
              保存 Prompt 模板
            </Button>
          </CardContent>
        </Card>

        {/* ===== 4. 界面偏好 ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">界面偏好</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>主题</Label>
                <p className="text-xs text-muted-foreground mt-0.5">切换浅色/暗色主题</p>
              </div>
              <Select value={theme} onValueChange={(v) => handleThemeChange(v as "light" | "dark")}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">浅色</SelectItem>
                  <SelectItem value="dark">暗色</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== 引擎编辑对话框 ===== */}
      <EngineDialog
        open={engineDialogOpen}
        engine={editingEngine}
        saving={engineSaving}
        onOpenChange={(open) => {
          setEngineDialogOpen(open);
          if (!open) setEditingEngine(null);
        }}
        onChange={setEditingEngine}
        onSave={saveEngine}
      />
    </div>
  );
}

// ======= 引擎卡片子组件 =======

function EngineCard({
  engine,
  testResult,
  isTesting,
  onEdit,
  onDelete,
  onToggle,
  onTest,
}: {
  engine: EngineConfig;
  testResult?: TestResult;
  isTesting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onTest: () => void;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2.5">
      {/* 第一行：名称 + 类型 + 开关 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{engine.name}</span>
          <Badge variant="secondary" className="text-[10px]">
            {engine.type === "deeplx" ? "DeepLX" : "OpenAI"}
          </Badge>
        </div>
        <Switch
          checked={engine.enabled}
          onCheckedChange={onToggle}
          size="sm"
        />
      </div>

      {/* 配置预览 */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        {engine.type === "deeplx" ? (
          <p>Token: {engine.deeplxToken || "未配置"}</p>
        ) : (
          <>
            <p>API: {engine.apiBaseUrl || "未配置"}</p>
            <p>Key: {engine.apiKey || "未配置"}</p>
            <p>模型: {engine.model || "未配置"}</p>
          </>
        )}
      </div>

      {/* 转发路径 */}
      <div className="rounded bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1 flex-wrap">
          <Smartphone className="h-2.5 w-2.5" />
          <span>浏览器</span>
          <span className="opacity-50">&rarr;</span>
          <Shield className="h-2.5 w-2.5" />
          <span>Cloudflare</span>
          <span className="opacity-50">&rarr;</span>
          <Server className="h-2.5 w-2.5" />
          <span>你的服务器</span>
          <span className="opacity-50">&rarr;</span>
          <Globe className="h-2.5 w-2.5" />
          <span>
            {engine.type === "deeplx"
              ? "api.deeplx.org"
              : engine.apiBaseUrl
                ? new URL(engine.apiBaseUrl).hostname
                : "API 地址"}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEdit}>
          编辑
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onTest}
          disabled={isTesting}
        >
          {isTesting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
          测试
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>

        {/* 测试结果 */}
        {testResult && (
          <div className="flex items-center gap-1 ml-auto text-xs">
            {testResult.success ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="text-green-600">{testResult.latency}ms</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 text-destructive" />
                <span className="text-destructive">{testResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ======= 引擎编辑对话框 =======

function EngineDialog({
  open,
  engine,
  saving,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  engine: Partial<EngineConfig> | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (engine: Partial<EngineConfig> | null) => void;
  onSave: () => void;
}) {
  if (!engine) return null;

  const isNew = !engine.id;
  const isDeepLX = engine.type === "deeplx";

  function updateField(field: string, value: string | boolean) {
    onChange({ ...engine, [field]: value });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "添加" : "编辑"}{isDeepLX ? " DeepLX" : " OpenAI 兼容"}引擎
          </DialogTitle>
          <DialogDescription>
            {isDeepLX
              ? "配置 DeepLX 托管 API 的访问 Token"
              : "配置 OpenAI 兼容 API（支持 one-api、new-api 等中转服务）"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>名称</Label>
            <Input
              value={engine.name || ""}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="引擎显示名称"
            />
          </div>

          {isDeepLX ? (
            <div className="space-y-2">
              <Label>DeepLX Token</Label>
              <Input
                value={engine.deeplxToken || ""}
                onChange={(e) => updateField("deeplxToken", e.target.value)}
                placeholder="填入 Token，自动拼接为 api.deeplx.org/{token}/translate"
              />
              <p className="text-[11px] text-muted-foreground">
                请求地址: https://api.deeplx.org/{engine.deeplxToken || "{token}"}/translate
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input
                  value={engine.apiBaseUrl || ""}
                  onChange={(e) => updateField("apiBaseUrl", e.target.value)}
                  placeholder="https://your-api.com（不含 /v1/chat/completions）"
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={engine.apiKey || ""}
                  onChange={(e) => updateField("apiKey", e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div className="space-y-2">
                <Label>模型名称</Label>
                <Input
                  value={engine.model || ""}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder="gpt-4o-mini / claude-3-haiku 等"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {isNew ? "添加" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
