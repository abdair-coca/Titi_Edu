// Materiales de Titi: sombreado "toon" estilizado y contorno de dibujo animado.
//
// - Toon: parte de MeshToonMaterial (usa las mismas luces y sombras que el
//   cuarto) pero no suma luz física: arma un "factor de luz" 0..1 con la rampa
//   de cada luz y su sombra proyectada, y pinta albedo × mezcla(color de
//   sombra, 1, factor). Así los colores de marca salen exactos en la luz, la
//   sombra es un tono cálido diseñado (no marrón sucio) y Titi igual se
//   oscurece bajo un mueble. Encima: brillo suave y luz de contorno (rim).
//   El factor se normaliza con la suma de las luces, así que si cambia la
//   intensidad de las luces del cuarto, Titi no se quema ni se apaga.
// - Contorno: casco invertido (caras traseras infladas) con grosor fijo en
//   píxeles de pantalla, así se lee igual de cerca y en el cuarto chiquito.
//   Soporta mallas con esqueleto (la cola).
import * as THREE from 'three';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const TOON_PARS = /* glsl */ `
uniform vec3 uShadow;
uniform float uRim;
uniform float uSpec;
uniform float uBand;

float titiLight = 0.0;
float titiTotal = 0.0;
float titiSpec = 0.0;
float titiShadowNow = 1.0;

// Rampa: terminador suave y un segundo escalón de luz plena.
float titiRamp( float d ) {
  float w = uBand + fwidth( d ) * 0.75;
  return smoothstep( -w, w, d ) * 0.8 + smoothstep( 0.38 - w, 0.38 + w, d ) * 0.2;
}

// Sombra proyectada estilo toon: borde nítido y se desvanece cerca del
// terminador (ahí la rampa ya oscurece; evita el granulado del mapa de sombras).
float titiShadow( float shadow, vec3 normal, vec3 lightDirection ) {
  float d = dot( normal, lightDirection );
  return mix( 1.0, smoothstep( 0.12, 0.8, shadow ), smoothstep( 0.12, 0.35, d ) );
}
`;

const TOON_LIGHTS = /* glsl */ `
varying vec3 vViewPosition;

struct ToonMaterial {
  vec3 diffuseColor;
};

void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  float lum = dot( directLight.color, vec3( 0.2126, 0.7152, 0.0722 ) );
  float lit = titiRamp( dot( geometryNormal, directLight.direction ) ) * titiShadowNow;
  titiLight += lit * lum;
  titiTotal += lum;
  vec3 h = normalize( directLight.direction + geometryViewDir );
  float nh = dot( geometryNormal, h );
  float aa = fwidth( nh );
  titiSpec += smoothstep( 0.9 - aa, 0.97 + aa, nh ) * lit * lum;
  titiShadowNow = 1.0;
}

void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {}

#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;

// Color final: albedo entre su tono de sombra y su color pleno, más el brillo.
const TOON_OUTGOING = 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';
const TOON_COMPOSE = /* glsl */ `
float titiF = titiTotal > 0.0 ? clamp( titiLight / ( titiTotal * 0.86 ), 0.0, 1.0 ) : 0.0;
vec3 outgoingLight = diffuseColor.rgb * mix( uShadow, vec3( 1.0 ), titiF )
  + ( titiTotal > 0.0 ? titiSpec / titiTotal : 0.0 ) * uSpec
  + totalEmissiveRadiance;
`;

// Luz de contorno: más fuerte arriba y a los costados que abajo.
const TOON_RIM = /* glsl */ `
{
  vec3 rimView = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
  float ndv = 1.0 - saturate( dot( normal, rimView ) );
  float rim = smoothstep( 0.58, 0.86, ndv ) * ( 0.45 + 0.55 * saturate( normal.y + 0.5 ) );
  outgoingLight += rim * uRim * mix( diffuseColor.rgb, vec3( 1.0, 0.97, 0.9 ), 0.55 );
}
#include <opaque_fragment>
`;

// La sombra de cada luz direccional se guarda en titiShadowNow (la usa la rampa).
const SHADOW_CALL = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const LIGHTS_BEGIN = THREE.ShaderChunk.lights_fragment_begin.replace(
  SHADOW_CALL,
  'titiShadowNow = ( directLight.visible && receiveShadow ) ? titiShadow( getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ), geometryNormal, directLight.direction ) : 1.0;',
);
// Piezas chicas y curvas: el desvío normal del cuarto no alcanza y el mapa de
// sombras "granula" la piel de Titi. Solo para él, casi se duplica (más
// borraría la sombra del bigote sobre el pecho).
const SHADOW_VERTEX = THREE.ShaderChunk.shadowmap_vertex.replace(
  'shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias',
  'shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias * 1.8',
);
if (import.meta.env?.DEV && (LIGHTS_BEGIN === THREE.ShaderChunk.lights_fragment_begin || SHADOW_VERTEX === THREE.ShaderChunk.shadowmap_vertex)) {
  console.warn('[titi] cambió el shader de sombras de three: Titi queda sin sombras estilo toon');
}

/**
 * Material toon de Titi (colores exactos: sin tone mapping).
 * @param {string} color  Albedo (sRGB).
 * @param {{ shadow?: number[], rim?: number, spec?: number, band?: number }} opts
 *   shadow: multiplicador lineal del albedo en la sombra (define el tono);
 *   rim: luz de contorno; spec: brillo; band: suavidad del terminador.
 */
export function makeToonMaterial(color, { shadow = [0.8, 0.55, 0.5], rim = 0.3, spec = 0.07, band = 0.05 } = {}) {
  const material = new THREE.MeshToonMaterial({ color, toneMapped: false });
  const uniforms = {
    uShadow: { value: new THREE.Vector3(...shadow) },
    uRim: { value: rim },
    uSpec: { value: spec },
    uBand: { value: band },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <gradientmap_pars_fragment>', TOON_PARS)
      .replace('#include <lights_toon_pars_fragment>', TOON_LIGHTS)
      .replace('#include <lights_fragment_begin>', LIGHTS_BEGIN)
      .replace(TOON_OUTGOING, TOON_COMPOSE)
      .replace('#include <opaque_fragment>', TOON_RIM);
    shader.vertexShader = shader.vertexShader.replace('#include <shadowmap_vertex>', SHADOW_VERTEX);
  };
  material.customProgramCacheKey = () => 'titi-toon-v4';
  material.userData.toon = uniforms;
  return material;
}

// Grosor del contorno en píxeles (compartido por todos los contornos).
export function makeOutlineUniforms() {
  return {
    uWidth: { value: 1.5 },
    uRes: { value: new THREE.Vector2(800, 600) },
  };
}

/**
 * Actualiza el grosor del contorno según cuánto ocupa Titi en pantalla: fino en
 * el cuarto (1 px), algo más grueso de cerca (hasta ~2,6 px).
 */
export function updateOutline(uniforms, camera, size, dpr) {
  const pxPerUnit = camera.isOrthographicCamera ? camera.zoom : size.height / 4;
  uniforms.uWidth.value = clamp(pxPerUnit * 0.0062, 0.9, 2.6) * dpr;
  uniforms.uRes.value.set(size.width * dpr, size.height * dpr);
}

const OUTLINE_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform float uWidth;
uniform vec2 uRes;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4( transformed, 1.0 );
  vec3 n = normalize( normalMatrix * objectNormal );
  vec4 clip = projectionMatrix * mv;
  vec2 dir = ( projectionMatrix * vec4( n, 0.0 ) ).xy;
  float len = length( dir );
  dir = len > 1e-5 ? dir / len : vec2( 0.0 );
  clip.xy += dir * uWidth * 2.0 / uRes * clip.w;
  // Apenas detrás, para que no asome en los cruces entre piezas.
  clip.z += 0.0004 * clip.w;
  gl_Position = clip;
}
`;

const OUTLINE_FRAG = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4( uColor, 1.0 );
  #include <colorspace_fragment>
}
`;

/** Contorno de un color (en sRGB) que comparte el grosor de `uniforms`. */
export function makeOutlineMaterial(color, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uColor: { value: new THREE.Color(color) } },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
  });
}
