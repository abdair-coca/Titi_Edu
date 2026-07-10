import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Al cambiar de sección (pathname), React Router no resetea el scroll como
// haría una navegación real de browser — sin esto, entrar a una página nueva
// arranca en el punto de scroll que había quedado en la anterior.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
