import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CharacterAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-lg",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export default function CharacterAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: CharacterAvatarProps) {
  const initials = name.trim().charAt(0).toUpperCase() || "?";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(
          "rounded-full object-cover border border-border/50 flex-shrink-0",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-accent/50 to-accent/30 flex items-center justify-center font-semibold text-accent flex-shrink-0",
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      {initials !== "?" ? (
        initials
      ) : (
        <MessageCircle className={iconSizes[size]} />
      )}
    </div>
  );
}