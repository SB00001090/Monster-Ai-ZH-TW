import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Star, X } from "lucide-react";
import { toast } from "sonner";

interface MobileFeedbackPanelProps {
  messageId: number;
  onSubmit: (rating: number, comment?: string, tags?: string) => Promise<void>;
  onClose: () => void;
}

export default function MobileFeedbackPanel({
  messageId,
  onSubmit,
  onClose,
}: MobileFeedbackPanelProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment || undefined, tags || undefined);
      toast.success("Feedback submitted!");
      onClose();
    } catch (error) {
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sentimentLabels = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

  return (
    <Card className="p-4 bg-card border-border space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Rate this response</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="hover:bg-background/20 h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Star Rating */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform active:scale-90"
            >
              <Star
                className={`w-5 h-5 ${
                  star <= (hoverRating || rating)
                    ? "fill-accent text-accent"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <span className="text-xs text-muted-foreground">
            {sentimentLabels[rating as keyof typeof sentimentLabels]}
          </span>
        )}
      </div>

      {/* Comment */}
      <div>
        <label className="text-xs font-medium mb-1 block">Comment</label>
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could improve?"
          className="bg-background text-foreground border-border text-xs"
          disabled={isSubmitting}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium mb-1 block">Tags</label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="accurate,helpful,clear"
          className="bg-background text-foreground border-border text-xs"
          disabled={isSubmitting}
        />
      </div>

      {/* Submit Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 h-8 text-xs"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
        <Button
          onClick={onClose}
          variant="outline"
          disabled={isSubmitting}
          className="h-8 text-xs"
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}
