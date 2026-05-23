import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  variant?: "icon" | "button";
}

export function ShareButton({ title, text = "", url, className, variant = "button" }: ShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareUrl = url ?? window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({ title: "링크가 복사되었습니다" });
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // 사용자가 취소하거나 미지원 환경
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
          className
        )}
        title="공유하기"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={cn(
        "flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground hover:text-primary transition-colors",
        className
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
      {copied ? "복사됨" : "공유"}
    </button>
  );
}
