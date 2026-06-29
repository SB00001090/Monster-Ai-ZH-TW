import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader, Download, Share2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface VideoGenerationParams {
  prompt: string;
  negativePrompt: string;
  duration: number;
  fps: number;
  resolution: string;
  style: string;
}

export function VideoGenerationPage() {
  const [conversationId] = useState(1);
  const [params, setParams] = useState<VideoGenerationParams>({
    prompt: '',
    negativePrompt: '',
    duration: 10,
    fps: 24,
    resolution: '1280x720',
    style: 'cinematic',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState(0);

  // Placeholder for video generation mutation
  // This will be implemented when video generation API is ready
  const generateVideo = {
    mutateAsync: async (input: any) => {
      // Mock implementation
      console.log('Video generation requested:', input);
      return { success: false, error: 'Video generation not yet implemented' };
    },
  };

  const handleGenerate = async () => {
    if (!params.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();
    try {
      const result = await generateVideo.mutateAsync({
        conversationId,
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        duration: params.duration,
        fps: params.fps,
        resolution: params.resolution,
        style: params.style,
      }) as any;

      if (result.success && result.videoUrl) {
        setGeneratedVideo(result.videoUrl);
        setGenerationTime(Date.now() - startTime);
      } else {
        alert('Failed to generate video');
      }
    } catch (error) {
      alert('Error generating video');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedVideo) return;
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `generated-video-${Date.now()}.mp4`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Text to Video</CardTitle>
              <CardDescription>Generate videos from text prompts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prompt Input */}
              <div>
                <label className="text-sm font-medium">Prompt</label>
                <Textarea
                  value={params.prompt}
                  onChange={(e) => setParams({ ...params, prompt: e.target.value })}
                  placeholder="Describe the video you want to generate..."
                  className="mt-2 min-h-24"
                />
              </div>

              {/* Negative Prompt Input */}
              <div>
                <label className="text-sm font-medium">Negative Prompt</label>
                <Textarea
                  value={params.negativePrompt}
                  onChange={(e) => setParams({ ...params, negativePrompt: e.target.value })}
                  placeholder="Describe what you don't want in the video..."
                  className="mt-2 min-h-20"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="text-sm font-medium">
                  Duration: <span className="text-muted-foreground">{params.duration}s</span>
                </label>
                <Slider
                  value={[params.duration]}
                  onValueChange={(value) => setParams({ ...params, duration: value[0] })}
                  min={10}
                  max={60}
                  step={1}
                  className="mt-2"
                />
              </div>

              {/* FPS */}
              <div>
                <label className="text-sm font-medium">
                  FPS: <span className="text-muted-foreground">{params.fps}</span>
                </label>
                <Slider
                  value={[params.fps]}
                  onValueChange={(value) => setParams({ ...params, fps: value[0] })}
                  min={12}
                  max={60}
                  step={1}
                  className="mt-2"
                />
              </div>

              {/* Resolution */}
              <div>
                <label className="text-sm font-medium">Resolution</label>
                <select
                  value={params.resolution}
                  onChange={(e) => setParams({ ...params, resolution: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                >
                  <option value="1024x576">1024x576 (16:9)</option>
                  <option value="1280x720">1280x720 (16:9 HD)</option>
                  <option value="1920x1080">1920x1080 (16:9 Full HD)</option>
                </select>
              </div>

              {/* Style */}
              <div>
                <label className="text-sm font-medium">Style</label>
                <select
                  value={params.style}
                  onChange={(e) => setParams({ ...params, style: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                >
                  <option value="cinematic">Cinematic</option>
                  <option value="anime">Anime</option>
                  <option value="realistic">Realistic</option>
                  <option value="abstract">Abstract</option>
                </select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Video'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Generated Video</CardTitle>
            </CardHeader>
            <CardContent>
              {generatedVideo ? (
                <div className="space-y-4">
                  <div className="relative w-full bg-muted rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                    <video
                      src={generatedVideo}
                      controls
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleDownload} variant="outline" className="flex-1">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </div>
                  {generationTime > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Generation time: {(generationTime / 1000).toFixed(2)}s
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-2">No video generated yet</p>
                      <p className="text-sm text-muted-foreground">Enter a prompt and click "Generate Video" to create a video</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
