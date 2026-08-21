import {
  Navigate,
  Outlet,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import GuestShell from './components/GuestShell.jsx';
import PageTransition from './components/PageTransition.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import GotaToast from './components/GotaToast.jsx';
import WeeklyPrizeCelebration from './components/WeeklyPrizeCelebration.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Feed = lazy(() => import('./pages/Feed.jsx'));
const Explore = lazy(() => import('./pages/Explore.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const HashtagFeed = lazy(() => import('./pages/HashtagFeed.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Shop = lazy(() => import('./pages/Shop.jsx'));
const Courses = lazy(() => import('./pages/Courses.jsx'));
const CourseDetail = lazy(() => import('./pages/CourseDetail.jsx'));
const MyCourses = lazy(() => import('./pages/MyCourses.jsx'));
const LearnCourse = lazy(() => import('./pages/LearnCourse.jsx'));
const MyTeaching = lazy(() => import('./pages/teacher/MyTeaching.jsx'));
const CourseGrades = lazy(() => import('./pages/teacher/CourseGrades.jsx'));
const CourseEditor = lazy(() => import('./pages/teacher/CourseEditor.jsx'));
const ModulesEditor = lazy(() => import('./pages/teacher/ModulesEditor.jsx'));
const EvaluationEditor = lazy(() => import('./pages/teacher/EvaluationEditor.jsx'));
const Integrations = lazy(() => import('./pages/teacher/Integrations.jsx'));
const Certificates = lazy(() => import('./pages/Certificates.jsx').then(m => ({ default: m.Certificates })));
const VerifyCertificate = lazy(() => import('./pages/Certificates.jsx').then(m => ({ default: m.VerifyCertificate })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminCourses = lazy(() => import('./pages/admin/AdminCourses.jsx'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories.jsx'));

// ---- Layouts ----

// Shell de sesión iniciada: sidebar + contenido principal con padding-left.
// Usado por ProtectedLayout y por CatalogLayout cuando hay sesión.
function AppShell() {
  const location = useLocation();

  // La pantalla de aprendizaje es un "player" full-bleed: sin el max-w-7xl
  // centrado ni el padding grande del resto de páginas, para pegar las
  // columnas a los bordes.
  const isLearn = /\/courses\/[^/]+\/learn$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-titi-cream">
      <Navbar />
      {/* Toasts/overlays globales de gamificación (fixed, no afectan el layout). */}
      <GotaToast />
      <WeeklyPrizeCelebration />
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

// Wrapper para rutas privadas: exige sesión o redirige a /login guardando la
// ruta de origen. `initializing`: mientras se valida un token guardado contra
// el server, no renderiza nada (evita el flash de UI con sesión vencida).
function ProtectedLayout() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <AppShell />;
}

// Rutas públicas para guest Y logueado (catálogo): shell completo si hay
// sesión, header simple con login/registro si no.
function CatalogLayout() {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return null;
  return isAuthenticated ? <AppShell /> : <GuestShell />;
}

// Si ya hay sesión, /login y /register redirigen a la ruta de origen (o /feed)
function PublicOnlyLayout() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return null;
  if (isAuthenticated) {
    return <Navigate to={location.state?.from || '/feed'} replace />;
  }
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

// La landing real es el catálogo: "/" solo reparte según sesión (logueado →
// feed, guest → catálogo de cursos con el header simple de GuestShell).
function Home() {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return null;
  return <Navigate to={isAuthenticated ? '/feed' : '/courses'} replace />;
}

function Placeholder({ title, description }) {
  return (
    <div className="titi-card p-8 text-center">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-gray-500">
        {description || 'Pendiente de implementar.'}
      </p>
    </div>
  );
}

// ---- App ----

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<FullScreenLoader />}>
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

        {/* Catálogo: público para guest (header simple), shell completo si hay sesión */}
        <Route element={<CatalogLayout />}>
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
        </Route>

        {/* Rutas protegidas con sidebar */}
        <Route element={<ProtectedLayout />}>
          <Route path="/feed" element={<Feed />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/search" element={<Navigate to="/explore" replace />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/hashtag/:tag" element={<HashtagFeed />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/my-courses" element={<MyCourses />} />
          <Route path="/courses/:id/learn" element={<LearnCourse />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/teacher" element={<MyTeaching />} />
          <Route element={<TeacherOnly />}>
            <Route path="/teacher/integrations" element={<Integrations />} />
            <Route path="/teacher/courses/new" element={<CourseEditor />} />
            <Route path="/teacher/courses/:id/edit" element={<CourseEditor />} />
            <Route path="/teacher/courses/:id/modules" element={<ModulesEditor />} />
            <Route path="/teacher/modules/:moduleId/evaluation" element={<EvaluationEditor mode="module" />} />
            <Route path="/teacher/courses/:id/final-evaluation" element={<EvaluationEditor mode="final" />} />
            <Route path="/teacher/courses/:id/grades" element={<CourseGrades />} />
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
      </Suspense>
    </>
  );
}

function FullScreenLoader() {
  return (
    <div className="bg-titi-cream min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/Titi.png" alt="Titi" className="w-24 h-24 object-contain" />
        <div className="w-12 h-12 border-4 border-titi-yellow-light border-t-titi-yellow rounded-full animate-spin" />
      </div>
    </div>
  );
}
