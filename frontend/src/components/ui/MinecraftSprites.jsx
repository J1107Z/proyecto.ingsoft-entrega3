import { useState } from 'react';

/**
 * Pixelated Minecraft player head avatar with primary/fallback skin URL and inline SVG fallback.
 */
export function McPlayerFace({ username = 'Steve', size = 28 }) {
  const cleanName = encodeURIComponent((username || 'Steve').trim());
  const primaryUrl = `https://mc-heads.net/avatar/${cleanName}/${size}`;
  const fallbackUrl = `https://minotar.net/helm/${cleanName}/${size}.png`;
  const [src, setSrc] = useState(primaryUrl);
  const [broken, setBroken] = useState(false);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '4px',
        border: '1px solid #334155',
        backgroundColor: '#1e293b',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={username}
    >
      {broken ? (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#34d399' }}>
          {(username || 'MC').slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <img
          src={src}
          alt={username}
          loading="lazy"
          onError={() => {
            if (src !== fallbackUrl) {
              setSrc(fallbackUrl);
            } else {
              setBroken(true);
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}
