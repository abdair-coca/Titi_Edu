import {
  Navigate,
  Outlet,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Feed from './pages/Feed.jsx';
import Explore from './pages/Explore.jsx';
import Profile from './pages/Profile.jsx';
import HashtagFeed from './pages/HashtagFeed.jsx';
import Notifications from './pages/Notifications.jsx';
import Navbar from './components/Navbar.jsx';
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import MyCourses from './pages/MyCourses.jsx'

// ---- Layouts ----

// Wrapper para rutas privadas: sidebar + contenido principal con padding-left
function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="min-h-screen bg-neo-bg">
      <Navbar />
      {/* En móvil: deja espacio para el top bar (h-14) y el bottom nav (h-16 + safe area iOS). */}
      {/* En desktop (md+): solo padding-left para el sidebar (w-64). */}
      <main className="min-h-screen pt-14 md:pt-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-64">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Si ya hay sesión, /login y /register redirigen al feed
function PublicOnlyLayout() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/feed" replace />;
  return <Outlet />;
}

// ---- Páginas temporales (se irán reemplazando) ----

function Home() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/feed" replace />;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl sm:text-6xl font-extrabold mb-4">
        Neo<span className="text-neo-accent">Social</span>
      </h1>
      <p className="text-neo-muted mb-8 max-w-md">
        Red social basada en grafos · Neo4j + React
      </p>
      <div className="flex gap-3 justify-center">
        <Link to="/login" className="neo-btn-primary">Iniciar sesión</Link>
        <Link to="/register" className="neo-btn-ghost">Crear cuenta</Link>
      </div>
    </div>
  );
}

function Placeholder({ title, description }) {
  return (
    <div className="neo-card p-8 text-center">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-neo-muted">
        {description || 'Pendiente de implementar.'}
      </p>
    </div>
  );
}

// ---- App ----

export default function App() {
  return (
    <Routes>
      {/* Landing pública */}
      <Route path="/" element={<Home />} />

      {/* Rutas solo para no autenticados */}
      <Route element={<PublicOnlyLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Rutas protegidas con sidebar */}
      <Route element={<ProtectedLayout />}>
        <Route path="/feed" element={<Feed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/search" element={<Navigate to="/explore" replace />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/hashtag/:tag" element={<HashtagFeed />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/my-courses" element={<MyCourses />} />
      </Route>

      
      <Route path="/courses" element={<Courses />} />

      {/* 404 */}
      <Route path="*" element={<Placeholder title="404 — Ruta no encontrada" />} />
    </Routes>
  );
}
