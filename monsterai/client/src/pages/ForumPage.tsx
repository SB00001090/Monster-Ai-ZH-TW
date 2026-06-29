import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const LANGUAGES = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
];

export default function ForumPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);

  const { data: categories } = trpc.forum.getCategories.useQuery();
  const { data: posts, refetch: refetchPosts } = trpc.forum.getPosts.useQuery(
    { categoryId: selectedCategory ?? undefined },
    { enabled: !selectedPost }
  );

  if (selectedPost) {
    return (
      <PostDetail
        postId={selectedPost}
        onBack={() => setSelectedPost(null)}
      />
    );
  }

  if (showNewPost) {
    return (
      <NewPostForm
        categories={categories || []}
        selectedCategory={selectedCategory}
        onBack={() => setShowNewPost(false)}
        onSuccess={() => {
          setShowNewPost(false);
          refetchPosts();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">匿名討論區</h2>
          <p className="text-muted-foreground mt-1">自由交流，支持多國語言，無需帳號即可發言</p>
        </div>
        <Button onClick={() => setShowNewPost(true)}>✏️ 發帖</Button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          全部
        </Button>
        {categories?.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.icon} {cat.name}
          </Button>
        ))}
      </div>

      {/* Posts List */}
      <div className="space-y-3">
        {posts && posts.length > 0 ? (
          posts.map((post) => (
            <Card
              key={post.id}
              className="cursor-pointer hover:border-primary/50 transition-all"
              onClick={() => setSelectedPost(post.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {LANGUAGES.find(l => l.code === post.language)?.label || post.language}
                      </Badge>
                      {post.isPinned && <Badge variant="default" className="text-[10px]">📌 置頂</Badge>}
                    </div>
                    <h3 className="font-medium text-foreground truncate">{post.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>👤 {post.authorName}</span>
                      <span>❤️ {post.likes}</span>
                      <span>💬 {post.replyCount}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-lg mb-2">暫無帖子</p>
              <p className="text-sm">成為第一個發帖的人吧！</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PostDetail({ postId, onBack }: { postId: number; onBack: () => void }) {
  const { data: post } = trpc.forum.getPost.useQuery({ postId });
  const { data: replies, refetch: refetchReplies } = trpc.forum.getReplies.useQuery({ postId });
  const [replyContent, setReplyContent] = useState("");
  const [replyName, setReplyName] = useState("匿名");
  const [replyLang, setReplyLang] = useState("zh");

  const createReply = trpc.forum.createReply.useMutation({
    onSuccess: () => {
      toast.success("回覆已發送");
      setReplyContent("");
      refetchReplies();
    },
    onError: (err) => toast.error(err.message),
  });

  const likePost = trpc.forum.likePost.useMutation({
    onSuccess: () => toast.success("已點讚"),
  });

  const likeReply = trpc.forum.likeReply.useMutation({
    onSuccess: () => {
      toast.success("已點讚");
      refetchReplies();
    },
  });

  if (!post) return <div className="text-center text-muted-foreground py-8">載入中...</div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>← 返回列表</Button>

      {/* Post */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">
              {LANGUAGES.find(l => l.code === post.language)?.label || post.language}
            </Badge>
          </div>
          <CardTitle>{post.title}</CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>👤 {post.authorName}</span>
            <span>{new Date(post.createdAt).toLocaleString()}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-foreground">{post.content}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => likePost.mutate({ postId })}>
              ❤️ {post.likes}
            </Button>
            <Badge variant="outline">💬 {post.replyCount} 回覆</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <div className="space-y-3">
        <h3 className="font-medium text-foreground">回覆 ({replies?.length || 0})</h3>
        {replies?.map((reply) => (
          <Card key={reply.id}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">👤 {reply.authorName}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {LANGUAGES.find(l => l.code === reply.language)?.label || reply.language}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(reply.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => likeReply.mutate({ replyId: reply.id })}
              >
                ❤️ {reply.likes}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reply Form */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <h4 className="font-medium">發表回覆</h4>
          <div className="flex gap-2">
            <Input
              value={replyName}
              onChange={(e) => setReplyName(e.target.value)}
              placeholder="暱稱（可匿名）"
              className="w-32"
            />
            <select
              value={replyLang}
              onChange={(e) => setReplyLang(e.target.value)}
              className="px-2 py-1 rounded border border-border bg-background text-sm"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="輸入回覆內容..."
            className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background text-foreground resize-y"
          />
          <Button
            onClick={() => createReply.mutate({
              postId,
              content: replyContent,
              authorName: replyName || "匿名",
              language: replyLang,
            })}
            disabled={!replyContent.trim() || createReply.isPending}
          >
            {createReply.isPending ? "發送中..." : "發送回覆"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NewPostForm({
  categories,
  selectedCategory,
  onBack,
  onSuccess,
}: {
  categories: any[];
  selectedCategory: number | null;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(selectedCategory || (categories[0]?.id ?? 1));
  const [language, setLanguage] = useState("zh");
  const [authorName, setAuthorName] = useState("匿名");

  const createPost = trpc.forum.createPost.useMutation({
    onSuccess: () => {
      toast.success("帖子已發布");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>← 返回</Button>

      <Card>
        <CardHeader>
          <CardTitle>發表新帖</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">分類</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">語言</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">暱稱</label>
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="匿名"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">標題</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="輸入帖子標題..."
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">內容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="輸入帖子內容... 支持多國語言"
              className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-background text-foreground resize-y"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => createPost.mutate({
                categoryId,
                title,
                content,
                language,
                authorName: authorName || "匿名",
              })}
              disabled={!title.trim() || !content.trim() || createPost.isPending}
            >
              {createPost.isPending ? "發布中..." : "🚀 發布帖子"}
            </Button>
            <Button variant="outline" onClick={onBack}>取消</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
