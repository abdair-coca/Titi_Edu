import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Hero3D from '../components/hero3d/Hero3D.jsx';
import HeroSky from '../components/heroSky/HeroSky.jsx';
import HeroTitle from '../components/heroTitle/HeroTitle.jsx';
import { createHeroBridge } from '../lib/heroBridge.js';
import { HERO_MODELS } from '../components/hero3d/heroModels.js';
import CatalogFilters from '../components/catalog/CatalogFilters.jsx';
import CatalogGrid from '../components/catalog/CatalogGrid.jsx';
import CatalogOutro from '../components/catalog/CatalogOutro.jsx';
import CourseCard from '../components/catalog/CourseCard.jsx';
import CourseQuickView from '../components/catalog/CourseQuickView.jsx';
import CourseRow, { ContinueCard, RowItem } from '../components/catalog/CourseRow.jsx';
import LearningPathMap from '../components/catalog/LearningPathMap.jsx';
import useCatalogFilters from '../components/catalog/useCatalogFilters.js';
import {
  LEARNING_PATHS,
  buildRows,
  categoriaSlug,
  filterCourses,
  friendsByCourse,
  hasActiveSearch,
  lessonCount,
  resolvePaths,
} from '../components/catalog/catalogData.js';

// /courses: hero 3D (sin cambios) + catálogo (rediseno-catalogo-cursos).
// Orden: hero → filas curadas → todos los cursos → rutas → bloque final.

/** GET que devuelve `data.data[key]`, con estados de carga/error y reintento. */
function useList(url, key, { enabled = true } = {}) {
  const [state, setState] = useState({ items: [], loading: enabled, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setState({ items: [], loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    client
      .get(url)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setState({ items: data.data?.[key] || [], loading: false, error: null });
        else setState({ items: [], loading: false, error: data?.message || 'No se pudo cargar' });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ items: [], loading: false, error: err.response?.data?.message || err.message || 'Error de red' });
      });
    return () => {
      cancelled = true;
    };
  }, [url, key, enabled, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export default function Courses() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const categoriasList = useList('/api/categories', 'categorias');
  const catalog = useList('/api/courses', 'cursos');
  const recommendedList = useList('/api/courses/recommended', 'recommended', { enabled: isAuthenticated });
  const enrolledList = useList('/api/courses/my/enrolled', 'inscripciones', { enabled: isAuthenticated });

  const categorias = categoriasList.items;
  const allCursos = catalog.items;
  const recommended = recommendedList.items;
  const enrolled = enrolledList.items;

  const { filters, query, setQuery, setFilter, toggleNivel, clearFilters, openCourseId, openCourse, closeCourse } =
    useCatalogFilters(categorias);

  const cursos = useMemo(() => filterCourses(allCursos, filters), [allCursos, filters]);
  const filtering = hasActiveSearch(filters);
  const rows = useMemo(() => buildRows({ cursos: allCursos, enrolled, recommended }), [allCursos, enrolled, recommended]);
  const friendsMap = useMemo(() => friendsByCourse(recommended), [recommended]);
  const enrollmentMap = useMemo(() => new Map(enrolled.map((i) => [i.curso.id, i])), [enrolled]);
  const progressMap = useMemo(() => new Map(enrolled.map((i) => [i.curso.id, i.avance])), [enrolled]);
  const paths = useMemo(() => resolvePaths(LEARNING_PATHS, allCursos, enrolled), [allCursos, enrolled]);

  // Solo categorías con cursos publicados, las de más cursos primero.
  const countByCat = useMemo(() => {
    const map = {};
    for (const c of allCursos) if (c.categoria?.id) map[c.categoria.id] = (map[c.categoria.id] || 0) + 1;
    return map;
  }, [allCursos]);
  const usedCategorias = useMemo(
    () => categorias.filter((c) => countByCat[c.id]).sort((a, b) => countByCat[b.id] - countByCat[a.id]),
    [categorias, countByCat],
  );

  const stats = useMemo(
    () => ({
      cursos: allCursos.length,
      profes: new Set(allCursos.map((c) => c.creador?.username).filter(Boolean)).size,
      lecciones: allCursos.reduce((n, c) => n + lessonCount(c), 0),
      categorias: usedCategorias.length,
    }),
    [allCursos, usedCategorias],
  );

  // ---- Hero (sin cambios de comportamiento) ----
  const skyRegionRef = useRef(null);
  const skyTextRef = useRef(null);
  const [heroBridge] = useState(createHeroBridge);
  useHeroFillsScreen(skyRegionRef);

  // Objetos del cuarto 3D: categorías con modelo, las de más cursos primero.
  // Espera al catálogo para que el orden no cambie con los objetos en escena.
  const heroItems = useMemo(
    () =>
      catalog.loading
        ? []
        : categorias
            .map((c) => ({ id: c.id, nombre: c.nombre, slug: categoriaSlug(c.nombre), count: countByCat[c.id] || 0 }))
            .filter((c) => HERO_MODELS[c.slug])
            .sort((a, b) => b.count - a.count),
    [catalog.loading, categorias, countByCat],
  );

  const goToCatalog = useCallback(() => {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const selectCategoryId = useCallback(
    (id) => {
      const c = categorias.find((x) => x.id === id);
      setFilter({ cat: c ? categoriaSlug(c.nombre) : '', q: '' });
      goToCatalog();
    },
    [categorias, setFilter, goToCatalog],
  );

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToCatalog();
    }
  }

  // Enlace con filtros (Mis cursos, Feed, Explore, link compartido): baja al
  // catálogo una vez que cargó.
  const arrivedFiltered = useRef(filtering);
  useEffect(() => {
    if (arrivedFiltered.current && !catalog.loading) {
      arrivedFiltered.current = false;
      goToCatalog();
    }
  }, [catalog.loading, goToCatalog]);

  const seeAll = (patch) => () => {
    setFilter(patch);
    goToCatalog();
  };

  const onEnrolled = useCallback(() => {
    enrolledList.reload();
    catalog.reload();
  }, [enrolledList, catalog]);

  const quickPreview = useMemo(
    () => (openCourseId ? allCursos.find((c) => c.id === openCourseId) || { id: openCourseId } : null),
    [openCourseId, allCursos],
  );

  const showRows = !filtering && !catalog.loading && !catalog.error;
  const card = (curso) => (
    <RowItem key={curso.id}>
      <CourseCard
        curso={curso}
        onOpen={() => openCourse(curso.id)}
        friends={friendsMap.get(curso.id)}
        progress={progressMap.get(curso.id)}
      />
    </RowItem>
  );

  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      {/* Hero: título letra a letra + buscador, con el cielo 3D detrás y el
          cuarto a la derecha (changes cielo-hero-cursos y rediseno-hero-cursos).
          En desktop ocupa toda la primera pantalla. */}
      <div
        ref={skyRegionRef}
        className="relative isolate flex flex-col justify-center pt-16 sm:pt-20 lg:pt-14 lg:pb-6 lg:min-h-[calc(100svh-var(--hero-top,96px))]"
      >
        <HeroSky regionRef={skyRegionRef} textRef={skyTextRef} bridge={heroBridge} />

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10 items-center">
          <div ref={skyTextRef} className="[container-type:inline-size]">
            <HeroTitle bridge={heroBridge} />
            <p data-sky="paragraph" className="text-lg sm:text-xl font-semibold text-gray-500 mb-8 max-w-md">
              Cursos cortos de la comunidad, a tu ritmo.
            </p>

            {/* Buscador */}
            <div data-sky="search" className="relative max-w-lg">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => heroBridge.emit('focus', { on: true })}
                onBlur={() => heroBridge.emit('focus', { on: false })}
                placeholder="¿Qué querés aprender hoy?"
                aria-label="Buscar cursos"
                className="w-full bg-white border-2 border-titi-dark rounded-2xl pl-12 pr-12 py-4 sm:py-5 text-base font-semibold text-titi-dark placeholder:text-gray-400 shadow-[0_4px_0px_#1A1A2E] focus:outline-none focus:ring-4 focus:ring-titi-yellow/50 transition-shadow duration-150"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-titi-dark pointer-events-none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
              {query && (
                <button
                  type="button"
                  onClick={() => setFilter({ q: '' })}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-titi-dark hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Visual del hero — escena 3D de las categorías, con imagen de respaldo */}
          <Hero3D
            items={heroItems}
            onSelect={selectCategoryId}
            onHover={(item) => heroBridge.emit('roomHover', item?.nombre ?? null)}
            poster="/hero/hero-3d-poster.webp"
            alt="Habitación de estudio de Titi con los objetos de las categorías: laptop y calculadora en el escritorio, libros, globo y matraz en las repisas, guitarra, paleta y maletín"
            width={1176}
            height={882}
          />
        </section>
      </div>

      {showRows && rows.continua.length > 0 && (
        <CourseRow
          title="Continúa donde"
          accent="quedaste"
          count={rows.continua.length}
          seeAll={{ label: 'Mis cursos', onClick: () => navigate('/my-courses') }}
        >
          {rows.continua.map((i) => (
            <RowItem key={i.curso.id} wide>
              <ContinueCard inscripcion={i} />
            </RowItem>
          ))}
        </CourseRow>
      )}

      {showRows && rows.amigos.length > 0 && (
        <CourseRow
          title="Tus amigos están"
          accent="aprendiendo"
          subtitle="Cursos que toma la gente que sigues."
          count={rows.amigos.length}
        >
          {rows.amigos.map((r) => card(r.curso))}
        </CourseRow>
      )}

      {showRows && rows.empezar.length > 0 && (
        <CourseRow
          title="Para empezar"
          accent="desde cero"
          subtitle="Nivel principiante: no necesitas saber nada antes."
          count={rows.empezar.length}
          seeAll={{ onClick: seeAll({ niveles: ['principiante'], orden: 'populares' }) }}
        >
          {rows.empezar.map(card)}
        </CourseRow>
      )}

      {showRows && rows.nuevos.length > 0 && (
        <CourseRow title="Recién" accent="publicados" count={rows.nuevos.length} seeAll={{ onClick: seeAll({ orden: 'nuevos' }) }}>
          {rows.nuevos.map(card)}
        </CourseRow>
      )}

      {showRows && rows.populares.length > 0 && (
        <CourseRow
          title="Los más"
          accent="populares"
          subtitle="Los que más gente está tomando."
          count={rows.populares.length}
          seeAll={{ onClick: seeAll({ orden: 'populares' }) }}
        >
          {rows.populares.map(card)}
        </CourseRow>
      )}

      <section id="catalogo" aria-label="Todos los cursos" className="flex flex-col gap-3 scroll-mt-16 md:scroll-mt-4">
        <h2 className="text-2xl sm:text-3xl font-black text-titi-dark">
          Todos los <span className="text-titi-streak">cursos</span>
        </h2>
        <CatalogFilters
          categorias={usedCategorias}
          filters={filters}
          onFilter={setFilter}
          onToggleNivel={toggleNivel}
          onClear={(what) => (what === 'q' ? setFilter({ q: '' }) : clearFilters())}
          resultCount={cursos.length}
          stickyTop={isAuthenticated ? 'top-14 md:top-2' : 'top-[72px]'}
        />
        <CatalogGrid
          cursos={cursos}
          totalCount={allCursos.length}
          loading={catalog.loading}
          error={catalog.error}
          onRetry={catalog.reload}
          filtering={filtering}
          query={filters.q}
          onClear={clearFilters}
          onOpen={openCourse}
          friendsMap={friendsMap}
          progressMap={progressMap}
        />
      </section>

      {!catalog.loading && paths.length > 0 && (
        <LearningPathMap paths={paths} onOpen={openCourse} signedIn={isAuthenticated} />
      )}

      {!catalog.loading && <CatalogOutro signedIn={isAuthenticated} stats={stats} />}

      <BackToTop />

      <CourseQuickView
        cursoId={openCourseId}
        preview={quickPreview}
        friends={openCourseId ? friendsMap.get(openCourseId) : undefined}
        enrollment={openCourseId ? enrollmentMap.get(openCourseId) : undefined}
        onClose={closeCourse}
        onEnrolled={onEnrolled}
      />
    </div>
  );
}

// El hero llena la primera pantalla en desktop: guarda en --hero-top cuánto
// hay arriba (navbar y margen, distinto con y sin sesión).
function useHeroFillsScreen(ref) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty('--hero-top', `${Math.round(top)}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref]);
}

// Volver arriba (página larga): aparece tras scrollear.
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={[
        'fixed bottom-24 md:bottom-6 right-4 md:right-6 z-30 w-12 h-12 grid place-items-center',
        'rounded-full bg-titi-dark text-titi-cream border-2 border-titi-dark shadow-[0_4px_0_#E6B800]',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
        'transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none',
        show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95 pointer-events-none',
      ].join(' ')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <line x1="12" y1="19" x2="12" y2="5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
