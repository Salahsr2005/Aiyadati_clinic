import React, { useState, useEffect } from 'react';
import { ASSET_FALLBACKS } from '@/lib/assetFallbacks';
import { getCachedBlobUrl, loadBlobImage } from '@/lib/blobImageCache';

interface RemoteImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallback?: string;
  alt: string;
  className?: string;
}

export function RemoteImage({
  src,
  fallback = ASSET_FALLBACKS.clinicLogo,
  alt,
  className,
  ...props
}: RemoteImageProps) {
  const cached = getCachedBlobUrl(src);
  const [displaySrc, setDisplaySrc] = useState<string>(cached || fallback);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let active = true;

    if (!src) {
      setDisplaySrc(fallback);
      return;
    }

    const initial = getCachedBlobUrl(src);
    if (initial) {
      setDisplaySrc(initial);
      return;
    }

    // Set fallback while loading remote blob
    setDisplaySrc(fallback);
    setErrored(false);

    loadBlobImage(src).then((blobUrl) => {
      if (!active) return;
      if (blobUrl) {
        setDisplaySrc(blobUrl);
        setErrored(false);
      } else {
        setDisplaySrc(fallback);
        setErrored(true);
      }
    });

    return () => {
      active = false;
    };
  }, [src, fallback]);

  return (
    <img
      src={displaySrc}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!errored) {
          setErrored(true);
          setDisplaySrc(fallback);
        }
      }}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}
