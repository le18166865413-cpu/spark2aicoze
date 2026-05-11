import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { content, mode = "ppt" } = await request.json();

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const modeLabels: Record<string, string> = {
      ppt: "PPT演示文稿",
      comic: "漫画/故事板",
      infographic: "信息图/数据可视化",
      architecture: "架构图/系统图",
    };
    const modeLabel = modeLabels[mode] || "多页海报";

    const systemPrompt = `你是一个专业的内容结构分析师和视觉设计规划师。你的任务是将用户提供的内容分析并整理为结构化的多页大纲。

分析原则：
1. 深入理解内容的逻辑结构、语义层次和关键信息
2. 根据内容主题、信息密度和视觉呈现需求，自动决定合理的页数（通常3-10页）
3. 每页包含：一个吸睛的标题 + 该页核心内容的详细描述（用于AI生成图片）
4. 内容分配要均衡，重要信息单独成页，次要信息可合并
5. 确保页与页之间有逻辑递进关系
6. 每页的内容描述要足够详细（80-150字），包含具体的视觉元素建议，帮助AI理解要生成的画面

请严格返回JSON格式，不要包含任何其他文字：`;

    const userPrompt = `请将以下内容整理为"${modeLabel}"的多页大纲结构。

用户原始内容：
${content.trim()}

要求：
- 根据内容语义自动分页，不是机械切割
- 分析内容的核心主题、逻辑层次、重点信息
- 每页标题要简洁有力，内容描述要详细具体
- 如果内容较少（少于200字），可以只做1-3页
- 如果内容较多且层次丰富，可以做5-8页
- 每页内容描述中应包含：画面主体、配色倾向、排版建议、关键文字元素

返回JSON格式：
{
  "title": "整体主题",
  "pages": [
    {"title": "页面标题", "content": "该页的详细内容描述..."}
  ]
}`;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.5,
      thinking: "enabled",
    });

    // Parse JSON from response
    let result: { title: string; pages: { title: string; content: string }[] };
    try {
      const text = response.content.trim();
      // Try to extract JSON if wrapped in markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      result = JSON.parse(jsonStr);

      if (!result.title || !Array.isArray(result.pages)) {
        throw new Error("Invalid structure");
      }

      // Validate and clean pages
      result.pages = result.pages
        .filter((p) => p.title && p.content)
        .map((p, i) => ({
          title: p.title.trim(),
          content: p.content.trim(),
        }));

      if (result.pages.length === 0) {
        throw new Error("No valid pages");
      }
    } catch {
      // Fallback: simple structure
      const lines = content.split("\n").filter((l) => l.trim());
      result = {
        title: modeLabel,
        pages: lines.map((line, i) => ({
          title: `第${i + 1}页`,
          content: line.trim(),
        })),
      };
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
