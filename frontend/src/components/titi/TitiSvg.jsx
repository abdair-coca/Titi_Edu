// TitiSvg — la mascota Titi como SVG vectorial, separada por capas (orejas,
// cabeza, cara, ojos, hocico, cuerpo, panza, brazos, patas, cola). Cada parte
// es un <g> con id, listo para animarse. Es puro SVG (sin animación): la
// animación por estado la maneja TitiMascot con Framer Motion.
//
// Paleta on-brand (cálida/dorada, va con el amarillo Titi). No usa el PNG.

const C = {
  fur: '#C68A4E',
  furDark: '#A9703B',
  cream: '#F5E0C3',
  dark: '#2B2235',
  nose: '#6B4A2F',
  cheek: '#F6A98C',
  white: '#FFFFFF',
};

export default function TitiSvg({ className = '', title = 'Titi', ...props }) {
  return (
    <svg
      viewBox="0 0 200 210"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>{title}</title>

      {/* Cola */}
      <g id="titi-tail">
        <path
          d="M132 168 q44 6 40 -34 q-3 -22 -22 -20 q-14 2 -10 16 q3 9 11 6"
          fill="none"
          stroke={C.furDark}
          strokeWidth="11"
          strokeLinecap="round"
        />
      </g>

      {/* Cuerpo */}
      <g id="titi-body">
        <ellipse cx="100" cy="150" rx="42" ry="40" fill={C.fur} />
        <ellipse cx="100" cy="156" rx="25" ry="27" fill={C.cream} />
      </g>

      {/* Brazos */}
      <g id="titi-arms">
        <ellipse cx="61" cy="146" rx="11" ry="21" fill={C.fur} transform="rotate(12 61 146)" />
        <ellipse cx="139" cy="146" rx="11" ry="21" fill={C.fur} transform="rotate(-12 139 146)" />
      </g>

      {/* Patas */}
      <g id="titi-feet">
        <ellipse cx="84" cy="188" rx="13" ry="9" fill={C.furDark} />
        <ellipse cx="116" cy="188" rx="13" ry="9" fill={C.furDark} />
      </g>

      {/* Cabeza */}
      <g id="titi-head">
        {/* Orejas */}
        <g id="titi-ears">
          <circle cx="58" cy="58" r="18" fill={C.fur} />
          <circle cx="58" cy="58" r="9" fill={C.cream} />
          <circle cx="142" cy="58" r="18" fill={C.fur} />
          <circle cx="142" cy="58" r="9" fill={C.cream} />
        </g>

        {/* Cráneo */}
        <circle cx="100" cy="80" r="47" fill={C.fur} />
        {/* Cara */}
        <ellipse cx="100" cy="90" rx="35" ry="31" fill={C.cream} />

        {/* Cachetes */}
        <circle cx="74" cy="96" r="8" fill={C.cheek} opacity="0.7" />
        <circle cx="126" cy="96" r="8" fill={C.cheek} opacity="0.7" />

        {/* Ojos */}
        <g id="titi-eyes">
          <circle cx="86" cy="82" r="8.5" fill={C.dark} />
          <circle cx="114" cy="82" r="8.5" fill={C.dark} />
          <circle cx="89" cy="79" r="2.8" fill={C.white} />
          <circle cx="117" cy="79" r="2.8" fill={C.white} />
        </g>

        {/* Hocico */}
        <g id="titi-muzzle">
          <ellipse cx="100" cy="102" rx="15" ry="11" fill={C.cream} />
          <ellipse cx="100" cy="98" rx="4.5" ry="3.2" fill={C.nose} />
          <path
            d="M91 104 q9 8 18 0"
            fill="none"
            stroke={C.nose}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
