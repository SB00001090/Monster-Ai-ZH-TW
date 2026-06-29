import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onAvatarSelected: (imageUrl: string, imageKey: string) => void;
  size?: "default" | "large";
}

export default function AvatarUpload({
  currentAvatarUrl,
  onAvatarSelected,
  size = "default",
}: AvatarUploadProps) {
  const { t } = useTranslation();
  const isLarge = size === "large";
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    onAvatarSelected(objectUrl, file.name);
  };

  return (
    <div className={`flex flex-col items-center ${isLarge ? "gap-4" : "gap-3"}`}>
      <div
        className={`rounded-full overflow-hidden border bg-muted flex items-center justify-center ${
          isLarge ? "w-36 h-36" : "w-24 h-24"
        }`}
      >
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Avatar preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <Upload className={isLarge ? "w-12 h-12 text-muted-foreground" : "w-8 h-8 text-muted-foreground"} />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={isLarge ? "lg" : "sm"}
        className={isLarge ? "h-11 text-base rounded-xl px-6" : ""}
        onClick={() => inputRef.current?.click()}
      >
        {t("character.uploadAvatar")}
      </Button>
    </div>
  );
}