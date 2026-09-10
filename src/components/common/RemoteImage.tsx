import React, { useState } from 'react';
import { ASSET_FALLBACKS } from '@/lib/assetFallbacks';
import { resolveFileUrl } from '@/lib/utils';

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

  const resolved = src ? resolveFileUrl(src) : null;
  const displaySrc = errored || !resolved ? fallback : resolved;

  return (
    <img
      src={displaySrc ?? undefined}
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
