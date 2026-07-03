import { Link, Outlet, useLocation } from 'react-router-dom';
import PageTransition from './PageTransition.jsx';

// Header simple para visitantes no logueados (catálogo público). Mismo
// contenedor/fondo que AppShell para que pasar a logueado no salte de layout.
export default function GuestShell() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-titi-cream">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <img
              src="/Titi.png"
              alt=""
              className="w-8 h-8 object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <span className="text-xl font-extrabold lowercase tracking-tight text-titi-dark">
              titi
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" state={{ from: location.pathname }} className="titi-btn-ghost">
              Iniciar sesión
            </Link>
            <Link to="/register" state={{ from: location.pathname }} className="titi-btn-primary">
              Registrate
            </Link>
          </div>
        </div>
      </header>
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
