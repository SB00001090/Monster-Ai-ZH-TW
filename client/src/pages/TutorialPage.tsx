import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Circle, Play, Clock, ArrowLeft } from "lucide-react";

export default function TutorialPage() {
  const { t } = useTranslation();
  const [selectedTutorial, setSelectedTutorial] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const tutorialsQuery = trpc.tutorials.getTutorials.useQuery();
  const userProgressQuery = trpc.tutorials.getUserProgress.useQuery();
  const updateProgressMutation = trpc.tutorials.updateProgress.useMutation();

  const categories = ["chat", "image", "character", "advanced"];
  
  const filteredTutorials = selectedCategory === "all" 
    ? tutorialsQuery.data || []
    : (tutorialsQuery.data || []).filter(t => t.category === selectedCategory);

  const getProgressStatus = (tutorialId: number) => {
    const progress = userProgressQuery.data?.find(p => p.tutorialId === tutorialId);
    return progress?.status || "not_started";
  };

  const handleStartTutorial = (tutorialId: number) => {
    setSelectedTutorial(tutorialId);
    updateProgressMutation.mutate({
      tutorialId,
      status: "in_progress",
    });
  };

  const handleCompleteTutorial = (tutorialId: number) => {
    updateProgressMutation.mutate({
      tutorialId,
      status: "completed",
    });
  };

  if (tutorialsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">{t("tutorials.welcome", "Welcome to Guardian Ai")}</h1>
            <p className="text-muted-foreground">{t("tutorials.getStarted", "Get started with our interactive tutorials")}</p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t("common.back", "Back")}
            </Button>
          </Link>
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
            className="rounded-full"
          >
            {t("tutorials.allCategories", "All")}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="rounded-full capitalize"
            >
              {t(`tutorials.category.${cat}`, cat)}
            </Button>
          ))}
        </div>

        {selectedTutorial ? (
          // Tutorial Detail View
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-6 bg-card border-border">
                {filteredTutorials
                  .filter(t => t.id === selectedTutorial)
                  .map((tutorial) => (
                    <div key={tutorial.id}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="text-2xl font-bold text-foreground mb-2">{tutorial.title}</h2>
                          <p className="text-muted-foreground">{tutorial.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedTutorial(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ✕
                        </Button>
                      </div>

                      {tutorial.videoUrl && (
                        <div className="mb-6 bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                          <a
                            href={tutorial.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-accent hover:text-accent/80"
                          >
                            <Play className="w-8 h-8" />
                            <span>{t("tutorials.watchVideo", "Watch Video")}</span>
                          </a>
                        </div>
                      )}

                      <div
                        className="prose prose-invert max-w-none mb-6 text-foreground"
                        dangerouslySetInnerHTML={{ __html: tutorial.content }}
                      />

                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleCompleteTutorial(tutorial.id)}
                          className="bg-accent text-accent-foreground hover:bg-accent/90"
                          disabled={updateProgressMutation.isPending}
                        >
                          {t("tutorials.markComplete", "Mark as Complete")}
                        </Button>
                      </div>
                    </div>
                  ))}
              </Card>
            </div>

            {/* Sidebar Progress */}
            <div>
              <Card className="p-4 bg-card border-border sticky top-6">
                <h3 className="font-bold text-foreground mb-4">{t("tutorials.progress", "Your Progress")}</h3>
                <div className="space-y-2">
                  {filteredTutorials.map((tutorial) => {
                    const status = getProgressStatus(tutorial.id);
                    return (
                      <div
                        key={tutorial.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          status === "completed"
                            ? "bg-green-500/10 border border-green-500/30"
                            : status === "in_progress"
                            ? "bg-blue-500/10 border border-blue-500/30"
                            : "bg-muted border border-border"
                        }`}
                        onClick={() => setSelectedTutorial(tutorial.id)}
                      >
                        <div className="flex items-center gap-2">
                          {status === "completed" ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium text-foreground">{tutorial.title}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          // Tutorial List View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTutorials.map((tutorial) => {
              const status = getProgressStatus(tutorial.id);
              return (
                <Card
                  key={tutorial.id}
                  className="p-6 bg-card border-border hover:border-accent transition-colors cursor-pointer"
                  onClick={() => handleStartTutorial(tutorial.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-foreground flex-1">{tutorial.title}</h3>
                    {status === "completed" && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">{tutorial.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{tutorial.estimatedTime} {t("tutorials.minutes", "min")}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={status === "completed" ? "outline" : "default"}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {status === "completed"
                        ? t("tutorials.completed", "Completed")
                        : status === "in_progress"
                        ? t("tutorials.continue", "Continue")
                        : t("tutorials.start", "Start")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
