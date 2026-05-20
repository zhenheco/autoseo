import { createAdminClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

async function getAIModels() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ai_models")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch AI models:", error);
    return [];
  }

  return data || [];
}

async function getAgentConfigs() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("agent_configs")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("Failed to fetch Agent config:", error);
    return null;
  }

  return data;
}

export default async function AIModelsPage() {
  // 認證檢查
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("settings.aiModelsPage");
  const models = await getAIModels();
  const config = await getAgentConfigs();

  const textModels = models.filter((m) => m.model_type === "text");
  const imageModels = models.filter((m) => m.model_type === "image");

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("researchAgent.title")}</CardTitle>
            <CardDescription>{t("researchAgent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("currentModel")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.research_model || "perplexity-sonar"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.research_temperature || 0.3}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.research_max_tokens || 2000}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("strategyAgent.title")}</CardTitle>
            <CardDescription>{t("strategyAgent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("currentModel")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.strategy_model || "gpt-4"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.strategy_temperature || 0.7}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.strategy_max_tokens || 3000}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("writingAgent.title")}</CardTitle>
            <CardDescription>{t("writingAgent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("currentModel")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.writing_model || "gpt-4"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.writing_temperature || 0.7}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.writing_max_tokens || 4000}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("metaAgent.title")}</CardTitle>
            <CardDescription>{t("metaAgent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("currentModel")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.meta_model || "deepseek-chat"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Temperature</span>
                <span className="text-sm text-muted-foreground">
                  {config?.meta_temperature || 0.5}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tokens</span>
                <span className="text-sm text-muted-foreground">
                  {config?.meta_max_tokens || 500}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("imageAgent.title")}</CardTitle>
            <CardDescription>{t("imageAgent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("currentModel")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_model || "dall-e-3"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("imageAgent.quality")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_quality || "standard"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("imageAgent.size")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_size || "1024x1024"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("imageAgent.count")}</span>
                <span className="text-sm text-muted-foreground">
                  {config?.image_count || 3}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("availableModels.title")}</CardTitle>
            <CardDescription>{t("availableModels.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">{t("availableModels.textModels")}</h3>
                <div className="space-y-2">
                  {textModels.map((model) => (
                    <div
                      key={model.id}
                      className="flex justify-between items-center p-2 border rounded"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {model.model_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {model.model_id}
                        </div>
                      </div>
                      {model.is_featured && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {t("availableModels.featured")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {imageModels.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">{t("availableModels.imageModels")}</h3>
                  <div className="space-y-2">
                    {imageModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {model.model_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {model.model_id}
                          </div>
                        </div>
                        {model.is_featured && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {t("availableModels.featured")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800">
              {t("notice")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
