export type ForumCategory = {
  id: number;
  name: string;
  icon: string;
  description: string;
};

export type ForumPost = {
  id: number;
  categoryId: number;
  title: string;
  content: string;
  authorName: string;
  language: string;
  likes: number;
  replyCount: number;
  isPinned: boolean;
  createdAt: Date;
};

export type ForumReply = {
  id: number;
  postId: number;
  content: string;
  authorName: string;
  language: string;
  likes: number;
  createdAt: Date;
};

export const DEFAULT_FORUM_CATEGORIES: ForumCategory[] = [
  { id: 1, name: "綜合討論", icon: "💬", description: "一般話題與交流" },
  { id: 2, name: "角色創作", icon: "🎭", description: "分享角色卡與設定" },
  { id: 3, name: "技術支援", icon: "🔧", description: "安裝、設定與除錯" },
  { id: 4, name: "圖像生成", icon: "🎨", description: "ComfyUI 與提示詞技巧" },
];

const now = Date.now();

export const DEFAULT_FORUM_POSTS: ForumPost[] = [
  {
    id: 1,
    categoryId: 1,
    title: "歡迎來到 Monster AI 社群",
    content:
      "這裡是匿名討論區，歡迎分享角色創作、本地部署心得，或提出任何問題。無需帳號即可發言。",
    authorName: "Monster AI",
    language: "zh",
    likes: 12,
    replyCount: 2,
    isPinned: true,
    createdAt: new Date(now - 86400000 * 3),
  },
  {
    id: 2,
    categoryId: 2,
    title: "如何匯入 SillyTavern 角色卡？",
    content:
      "在角色管理頁面點擊「匯入角色卡」，選擇 .json 檔案即可。系統會自動同步到 Python 角色扮演引擎。",
    authorName: "Creator",
    language: "zh",
    likes: 8,
    replyCount: 1,
    isPinned: false,
    createdAt: new Date(now - 86400000 * 2),
  },
  {
    id: 3,
    categoryId: 3,
    title: "Getting started with guest mode",
    content:
      "You can explore chat and image generation without signing in. Guest data is stored in memory and resets when the server restarts.",
    authorName: "Guest",
    language: "en",
    likes: 5,
    replyCount: 0,
    isPinned: false,
    createdAt: new Date(now - 86400000),
  },
];

export const DEFAULT_FORUM_REPLIES: ForumReply[] = [
  {
    id: 1,
    postId: 1,
    content: "感謝提供本地部署方案，訪客模式很方便！",
    authorName: "匿名",
    language: "zh",
    likes: 3,
    createdAt: new Date(now - 86400000 * 2),
  },
  {
    id: 2,
    postId: 1,
    content: "Looking forward to more character templates.",
    authorName: "Alex",
    language: "en",
    likes: 1,
    createdAt: new Date(now - 86400000),
  },
  {
    id: 3,
    postId: 2,
    content: "PNG 角色卡也可以，把副檔名改成 .json 或直接用匯入功能解析 data 欄位。",
    authorName: "Helper",
    language: "zh",
    likes: 2,
    createdAt: new Date(now - 86400000),
  },
];