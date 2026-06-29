import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/_core/hooks/useAuth";
import { useGuest } from "@/contexts/GuestContext";

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const canPost = Boolean(user) || isGuest;

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);

  const { data: categories } = trpc.forum.getCategories.useQuery();
  const { data: posts, refetch: refetchPosts } = trpc.forum.getPosts.useQuery(
    { categoryId: selectedCategory ?? undefined },
    { enabled: !selectedPost }
  );

  const handleNewPostClick = () => {
    if (!canPost) {
      toast.error(t("forum.signInRequired"));
      return;
    }
    setShowNewPost(true);
  };

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
          <h2 className="text-2xl font-bold text-foreground">{t("forum.title")}</h2>
          <p className="text-muted-foreground mt-1">{t("forum.subtitle")}</p>
        </div>
        <Button onClick={handleNewPostClick}>{t("forum.newPost")}</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          {t("forum.allCategories")}
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
                        {LANGUAGES.find((l) => l.code === post.language)?.label || post.language}
                      </Badge>
                      {post.isPinned && (
                        <Badge variant="default" className="text-[10px]">
                          {t("forum.pinned")}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-foreground truncate">{post.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{post.authorName}</span>
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
              <p className="text-lg mb-2">{t("forum.noPosts")}</p>
              <p className="text-sm">{t("forum.beFirst")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PostDetail({ postId, onBack }: { postId: number; onBack: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const canPost = Boolean(user) || isGuest;
  const utils = trpc.useUtils();

  const { data: post } = trpc.forum.getPost.useQuery({ postId });
  const { data: replies, refetch: refetchReplies } = trpc.forum.getReplies.useQuery({ postId });
  const [replyContent, setReplyContent] = useState("");
  const [replyName, setReplyName] = useState(t("forum.anonymous"));
  const [replyLang, setReplyLang] = useState("zh");

  const createReply = trpc.forum.createReply.useMutation({
    onSuccess: () => {
      toast.success(t("forum.replySent"));
      setReplyContent("");
      refetchReplies();
      utils.forum.getPost.invalidate({ postId });
    },
    onError: (err) => toast.error(err.message),
  });

  const likePost = trpc.forum.likePost.useMutation({
    onSuccess: () => {
      toast.success(t("forum.liked"));
      utils.forum.getPost.invalidate({ postId });
    },
  });

  const likeReply = trpc.forum.likeReply.useMutation({
    onSuccess: () => {
      toast.success(t("forum.liked"));
      refetchReplies();
    },
  });

  if (!post) {
    return <div className="text-center text-muted-foreground py-8">{t("forum.loading")}</div>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        ← {t("forum.backToList")}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">
              {LANGUAGES.find((l) => l.code === post.language)?.label || post.language}
            </Badge>
          </div>
          <CardTitle>{post.title}</CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{post.authorName}</span>
            <span>{new Date(post.createdAt).toLocaleString()}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-foreground">{post.content}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => likePost.mutate({ postId })}>
              ❤️ {post.likes}
            </Button>
            <Badge variant="outline">
              {t("forum.replyCount", { count: post.replyCount })}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-medium text-foreground">
          {t("forum.replies")} ({replies?.length || 0})
        </h3>
        {replies?.map((reply) => (
          <Card key={reply.id}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{reply.authorName}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {LANGUAGES.find((l) => l.code === reply.language)?.label || reply.language}
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

      <Card>
        <CardContent className="py-4 space-y-3">
          <h4 className="font-medium">{t("forum.writeReply")}</h4>
          {!canPost ? (
            <p className="text-sm text-muted-foreground">{t("forum.signInRequired")}</p>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={replyName}
                  onChange={(e) => setReplyName(e.target.value)}
                  placeholder={t("forum.nickname")}
                  className="w-32"
                />
                <select
                  value={replyLang}
                  onChange={(e) => setReplyLang(e.target.value)}
                  className="px-2 py-1 rounded border border-border bg-background text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={t("forum.replyPlaceholder")}
                className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background text-foreground resize-y"
              />
              <Button
                onClick={() =>
                  createReply.mutate({
                    postId,
                    content: replyContent,
                    authorName: replyName || t("forum.anonymous"),
                    language: replyLang,
                  })
                }
                disabled={!replyContent.trim() || createReply.isPending}
              >
                {createReply.isPending ? t("forum.sending") : t("forum.sendReply")}
              </Button>
            </>
          )}
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
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(selectedCategory || (categories[0]?.id ?? 1));
  const [language, setLanguage] = useState("zh");
  const [authorName, setAuthorName] = useState(t("forum.anonymous"));

  const createPost = trpc.forum.createPost.useMutation({
    onSuccess: () => {
      toast.success(t("forum.published"));
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        ← {t("forum.back")}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("forum.newPostTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("forum.category")}</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("forum.language")}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("forum.nickname")}</label>
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={t("forum.anonymous")}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("forum.postTitle")}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("forum.postTitlePlaceholder")}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("forum.postContent")}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("forum.postContentPlaceholder")}
              className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-background text-foreground resize-y"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() =>
                createPost.mutate({
                  categoryId,
                  title,
                  content,
                  language,
                  authorName: authorName || t("forum.anonymous"),
                })
              }
              disabled={!title.trim() || !content.trim() || createPost.isPending}
            >
              {createPost.isPending ? t("forum.publishing") : t("forum.publish")}
            </Button>
            <Button variant="outline" onClick={onBack}>
              {t("forum.cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}