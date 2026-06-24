// Clasificación de dificultad de un curso como ETIQUETA DE TEXTO con color de
// marca por nivel (sin forma/píldora) — fiel al estilo plano de Titi.
//   PRINCIPIANTE → verde · INTERMEDIO → ámbar · AVANZADO → naranja · resto → gris
// Compartido entre CourseCard (Courses.jsx) y RecommendedCourseCard.
export function nivelTextClass(nivel) {
  switch ((nivel || '').toLowerCase()) {
    case 'principiante':
      return 'text-green-600';
    case 'intermedio':
      return 'text-amber-500';
    case 'avanzado':
      return 'text-titi-streak';
    default:
      return 'text-gray-400';
  }
}
