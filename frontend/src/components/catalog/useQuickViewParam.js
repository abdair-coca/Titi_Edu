import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Vista rápida de un curso guardada en la URL (`?curso=<id>`). La comparten el
 * catálogo, Inicio y Explorar: abrirla suma una entrada al historial, así
 * "atrás" la cierra; si llegó por enlace, cerrarla solo quita el parámetro.
 */
export default function useQuickViewParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openCourseId = searchParams.get('curso');

  const openCourse = useCallback(
    (id) => {
      const next = new URLSearchParams(searchParams);
      next.set('curso', id);
      navigate({ search: next.toString() }, { state: { quickView: true }, preventScrollReset: true });
    },
    [navigate, searchParams],
  );

  const closeCourse = useCallback(() => {
    if (location.state?.quickView) {
      navigate(-1);
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('curso');
        return next;
      },
      { replace: true },
    );
  }, [location.state, navigate, setSearchParams]);

  return { openCourseId, openCourse, closeCourse };
}
