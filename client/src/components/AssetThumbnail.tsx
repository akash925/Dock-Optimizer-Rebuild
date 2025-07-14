import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface Props {
  /** asset id, used to hit /api/company-assets/:id/image */
  id: number;
  /** original filename, used for alt text */
  filename: string;
  /** optional class for the thumbnail */
  className?: string;
}

/**
 * Renders a 96 × 96 px thumbnail that, when clicked, opens
 * the image in a responsive light-box (ESC to close, click-backdrop, etc.).
 *
 * - Uses Radix UI <Dialog> for a11y (focus-trap, ARIA, keyboard shortcuts).
 * - Uses lucide-react <X> icon for the close button.
 * - Works in dev (Vite) and prod (Express) because it fetches from the same origin.
 */
export default function AssetThumbnail({ id, filename, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const src = `/api/company-assets/${id}/image`;

  return (
    <>
      {/* lazy-loaded thumbnail */}
      <img
        src={src}
        alt={filename}
        width={96}
        height={96}
        loading="lazy"
        decoding="async"
        className={`h-24 w-24 rounded-lg object-cover shadow cursor-pointer ${className}`}
        onClick={() => setOpen(true)}
      />

      {/* full-screen viewer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0">
          <div className="relative w-full h-full flex items-center justify-center min-h-[50vh]">
            {/* close btn */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 z-50 text-white/80 hover:text-white focus:outline-none p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
              aria-label="Close image viewer"
            >
              <X size={32} strokeWidth={2.2} />
            </button>

            <img
              src={src}
              alt={filename}
              className="max-h-[90%] max-w-[90%] rounded-xl shadow-2xl object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 