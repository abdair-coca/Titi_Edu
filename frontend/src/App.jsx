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
import PageTransition from './components/PageTransition.jsx';
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import MyCourses from './pages/MyCourses.jsx'
import LearnCourse from './pages/LearnCourse.jsx'
import MyTeaching from './pages/teacher/MyTeaching.jsx'
import CourseEditor from './pages/teacher/CourseEditor.jsx'
import ModulesEditor from './pages/teacher/ModulesEditor.jsx'
import EvaluationEditor from './pages/teacher/EvaluationEditor.jsx'
import Certificates, { VerifyCertificate } from './pages/Certificates.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminCourses from './pages/admin/AdminCourses.jsx'
import AdminCategories from './pages/admin/AdminCategories.jsx'

// ---- Layouts ----

// Wrapper para rutas privadas: sidebar + contenido principal con padding-left
function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // La pantalla de aprendizaje es un "player" full-bleed: sin el max-w-7xl
  // centrado ni el padding grande del resto de páginas, para pegar las
  // columnas a los bordes.
  const isLearn = /\/courses\/[^/]+\/learn$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-neo-bg">
      <Navbar />
      {/* En móvil: deja espacio para el top bar (h-14) y el bottom nav (h-16 + safe area iOS). */}
      {/* En desktop (md+): solo padding-left para el sidebar (w-64). */}
      <main className="min-h-screen pt-14 md:pt-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-20">
        <div
          className={
            isLearn
              ? 'p-2 sm:p-3'
              : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8'
          }
        >
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>
    </div>
  );
}

// Si ya hay sesión, /login y /register redirigen al feed
function PublicOnlyLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (isAuthenticated) return <Navigate to="/feed" replace />;
  return (
    <PageTransition key={location.pathname}>
      <Outlet />
    </PageTransition>
  );
}

// Sub-rutas de creación/edición de cursos exigen rol PROFESOR/ADMIN.
// /teacher (MyTeaching) queda fuera del guard porque ya muestra el flujo
// "become-teacher" para usuarios que aún no son profesores.
function TeacherOnly() {
  const { user } = useAuth();
  if (user?.rol !== 'PROFESOR' && user?.rol !== 'ADMIN') {
    return <Navigate to="/courses" replace />;
  }
  return <Outlet />;
}

// Sub-rutas del panel admin. Solo rol ADMIN; el resto vuelve al feed.
function AdminOnly() {
  const { user } = useAuth();
  if (user?.rol !== 'ADMIN') {
    return <Navigate to="/feed" replace />;
  }
  return <Outlet />;
}

// ---- Páginas temporales (se irán reemplazando) ----

function Home() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/feed" replace />;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl sm:text-6xl font-extrabold mb-4">
        Titi<span className="text-neo-accent"> Edu</span>
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

      {/* Verificación pública de certificados (sin login) */}
      <Route path="/verify/:codigo" element={<VerifyCertificate />} />

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
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/my-courses" element={<MyCourses />} />
        <Route path="/courses/:id/learn" element={<LearnCourse />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/teacher" element={<MyTeaching />} />
        <Route element={<TeacherOnly />}>
          <Route path="/teacher/courses/new" element={<CourseEditor />} />
          <Route path="/teacher/courses/:id/edit" element={<CourseEditor />} />
          <Route path="/teacher/courses/:id/modules" element={<ModulesEditor />} />
          <Route path="/teacher/modules/:moduleId/evaluation" element={<EvaluationEditor mode="module" />} />
          <Route path="/teacher/courses/:id/final-evaluation" element={<EvaluationEditor mode="final" />} />
        </Route>
        <Route element={<AdminOnly />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<Placeholder title="404 — Ruta no encontrada" />} />
    </Routes>
  );
}
