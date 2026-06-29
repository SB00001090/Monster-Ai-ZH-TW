import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Star, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CharacterTemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getTemplates = trpc.characters.getTemplates.useQuery();
  const createFromTemplate = trpc.characters.createFromTemplate.useMutation();

  useEffect(() => {
    if (getTemplates.data) {
      setTemplates(getTemplates.data);
      setLoading(false);
    }
  }, [getTemplates.data]);

  const handleCreateFromTemplate = async (templateId: number, templateName: string) => {
    try {
      await createFromTemplate.mutateAsync({ templateId });
      const message = t('templates.createdFromTemplate', `Created character from "${templateName}" template!`).replace('{name}', templateName);
      toast.success(message);
      // Redirect to character management
      window.location.href = "/characters";
    } catch (error) {
      toast.error(t('templates.failedToCreateFromTemplate', 'Failed to create character from template'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('templates.templates', 'Character Templates')}</h1>
          <p className="text-muted-foreground">
            {t('templates.templatesDescription', 'Choose from our curated collection of character templates to get started quickly')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: any) => (
            <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <h3 className="text-xl font-bold mb-2">{template.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{template.category}</p>
                <p className="text-sm mb-4">{template.description}</p>
              </div>

              <div className="space-y-3 mb-4 text-sm">
                <div>
                  <p className="font-semibold text-xs text-muted-foreground mb-1">{t('character.worldview', 'Worldview')}</p>
                  <p className="italic">{template.worldview}</p>
                </div>
                <div>
                  <p className="font-semibold text-xs text-muted-foreground mb-1">{t('character.openingLine', 'Opening Line')}</p>
                  <p className="italic">"{template.openingLine}"</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 pt-4 border-t border-border">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{template.averageRating || 0}</span>
                </div>
                <span className="text-xs text-muted-foreground">{template.usageCount} {t('templates.usageCount', 'uses')}</span>
              </div>

              <Button
                onClick={() => handleCreateFromTemplate(template.id, template.name)}
                className="w-full"
                disabled={createFromTemplate.isPending}
              >
                <Copy className="w-4 h-4 mr-2" />
                {t('character.useThisTemplate', 'Use This Template')}
              </Button>
            </Card>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('templates.noTemplates', 'No templates available yet')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
