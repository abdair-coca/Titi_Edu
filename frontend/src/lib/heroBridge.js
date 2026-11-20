// Puente entre el título del hero de /courses (letras HTML) y el cielo 3D
// (change rediseno-hero-cursos). Vive en el chunk principal y NO importa three.
//
// Es un pub/sub mínimo: los eventos son frecuentes (viento en cada letra) y
// no deben causar renders de React.
//   'hit'       cielo → título   { index, kind: 'wind'|'bounce'|'crash', dir, strength }
//   'letterTap' título → cielo   { index }
//   'relayout'  título → cielo   (cambió la palabra destacada: volver a medir)
//   'focus'     buscador → cielo  { on }
//   'roomHover' cuarto → título   nombre de la categoría bajo el mouse, o null
export function createHeroBridge() {
  const listeners = new Map();
  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    emit(type, payload) {
      listeners.get(type)?.forEach((fn) => fn(payload));
    },
  };
}
