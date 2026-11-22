import { useState } from 'react';
import { resolveMediaUrl } from '../../lib/format.js';

// Avatar v3 (rediseno-inicio-explorar R1): foto con borde oscuro o, sin foto
// (o si no carga), la inicial sobre amarillo.

const SIZES = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-16 h-16 text-2xl',
};

export default function Avatar({ username, src, size = 'md', className = '' }) {
  const [broken, setBroken] = useState(false);
  const url = !broken && src ? resolveMediaUrl(src) : null;
  const box = `${SIZES[size] || SIZES.md} rounded-full border-2 border-titi-dark shrink-0 ${className}`;

  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setBroken(true)}
        className={`${box} object-cover bg-titi-cream select-none`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${box} grid place-items-center bg-titi-yellow text-titi-dark font-black uppercase select-none`}>
      {username?.[0] ?? '?'}
    </span>
  );
}
