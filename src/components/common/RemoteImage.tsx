import React, { useState } from 'react';
import { ASSET_FALLBACKS } from '@/lib/assetFallbacks';

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
  const [errored, setErrored] = useState(false);

  const displaySrc = errored || !src ? fallback : src;

  return (
    <img
      src={displaySrc ?? undefined}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}
