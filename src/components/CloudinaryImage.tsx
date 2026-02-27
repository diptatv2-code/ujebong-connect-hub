import { useState } from "react";
import { getOptimizedUrl, getPlaceholderUrl } from "@/lib/cloudinary";
import { Skeleton } from "@/components/ui/skeleton";

interface CloudinaryImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  width?: number;
  onClick?: () => void;
}

const CloudinaryImage = ({ src, alt = "", className = "", width, onClick }: CloudinaryImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return <Skeleton className={className} style={{ minHeight: 100 }} />;
  }

  const optimizedSrc = getOptimizedUrl(src, { width });
  const placeholderSrc = getPlaceholderUrl(src);

  return (
    <div className="relative overflow-hidden" onClick={onClick}>
      {!loaded && (
        <>
          {placeholderSrc ? (
            <img
              src={placeholderSrc}
              alt=""
              className={`${className} absolute inset-0 scale-110 blur-lg`}
              aria-hidden
            />
          ) : (
            <Skeleton className={`${className} absolute inset-0`} style={{ minHeight: 100 }} />
          )}
        </>
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
};

export default CloudinaryImage;
