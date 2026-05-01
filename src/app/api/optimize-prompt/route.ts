import { NextRequest } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";

const SYSTEM_PROMPT = `你是一个专业的海报提示词优化师。你的任务是优化用户输入的海报生成提示词，使其更适合 AI 图像生成模型理解。

优化原则：
1. 将任何可能触发平台审核的风险词汇替换为安全等价词（如"暴力"→"力量感"、"爆炸"→"绽放"、"杀"→"击败"、"血"→"红色液体"、"枪"→"器械"等）
2. 补充专业设计术语（构图方式、色彩理论、排版风格等）
3. 增强画面描述的细节和层次感
4. 添加适合海报设计的风格关键词（如排版、字体效果、视觉层次等）
5. 保持用户原始意图不变

输出要求：
- 只输出优化后的提示词，不要任何解释、前缀或后缀
- 保持中英文与用户原文一致
- 优化后的提示词应该比原文更具体、更具画面感`;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return Response.json({ error: "请输入提示词" }, { status: 400 });
    }

    const config = new Config();
    const client = new LLMClient(config);

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: prompt },
    ];

    const result = await client.invoke(messages, {
      model: "doubao-seed-2-0-mini-260215",
      temperature: 0.7,
    });

    const optimized = result.content?.trim() || prompt;

    return Response.json({ optimized });
  } catch (error) {
    console.error("Optimize prompt error:", error);
    return Response.json({ error: "优化失败，请重试" }, { status: 500 });
  }
}
