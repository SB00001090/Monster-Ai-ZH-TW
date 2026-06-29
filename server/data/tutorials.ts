export const DEFAULT_TUTORIALS = [
  {
    id: 1,
    title: "Getting Started with Monster AI",
    description: "Learn the basics of creating and using AI characters",
    category: "basics",
    order: 1,
    content:
      "<h2>Welcome</h2><p>Monster AI lets you chat with characters, generate images, and run everything locally.</p><ol><li>Start Python backend with <code>run.bat</code></li><li>Run <code>pnpm dev</code> for the React UI</li><li>Use guest mode or sign in</li></ol>",
    videoUrl: null as string | null,
    estimatedTime: 5,
    isActive: 1,
  },
  {
    id: 2,
    title: "Creating Your First Character",
    description: "Step-by-step guide to creating a custom AI character",
    category: "character",
    order: 2,
    content:
      "<h2>Create a character</h2><p>Open Characters, fill in name, description, worldview, and opening line. Characters sync to the Python roleplay engine.</p>",
    videoUrl: null,
    estimatedTime: 8,
    isActive: 1,
  },
  {
    id: 3,
    title: "Having Conversations",
    description: "Learn how to interact with your AI characters",
    category: "chat",
    order: 3,
    content:
      "<h2>Chat</h2><p>Pick a character in Character Chat, send a message, and the Python LLM stack replies using your local models.</p>",
    videoUrl: null,
    estimatedTime: 6,
    isActive: 1,
  },
  {
    id: 4,
    title: "Generating Images",
    description: "Create images with your local ComfyUI stack",
    category: "image",
    order: 4,
    content:
      "<h2>Image generation</h2><p>Use Text to Image with a prompt. Ensure ComfyUI is running if image generation is enabled in config.</p>",
    videoUrl: null,
    estimatedTime: 7,
    isActive: 1,
  },
] as const;