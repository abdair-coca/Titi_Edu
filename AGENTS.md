# AGENTS.md — Titi Platform

Lee este archivo completo antes de tocar cualquier código.
Este es el documento de referencia absoluta del proyecto.

---

## Visión del proyecto

**Titi** es una plataforma educativa social universitaria que combina:
- Una **red social** (estilo TikTok/Instagram) para conectar estudiantes
- Una **plataforma de cursos** (estilo Duolingo/Udemy) para aprender

La diferencia con otras plataformas: el aprendizaje es social.
Ves qué cursos toman tus amigos, comentas lecciones con compañeros,
y recibes recomendaciones basadas en tu red de contactos.

**Mascota:** Titi — un mono titi boliviano con bigote, estilo Duolingo.
**Paleta:** Amarillo vibrante (#FFD93D), fondo cálido (#FFFBF0), sidebar oscuro (#1A1A2E).
**Tipografía:** Nunito (redondeada, amigable).

---

## Stack tecnológico

```
Frontend   → React 18 + Vite + Tailwind CSS 3 + React Router v6 + Axios
Backend    → Node.js 20 + Express 5 + JWT + bcrypt
Neo4j      → Red social, relaciones, recomendaciones (Neo4j Aura cloud)
PostgreSQL → Cursos, lecciones, evaluaciones, progreso, inscripciones
ORM        → Prisma (PostgreSQL)
Storage    → Cloudinary (imágenes de portada, materiales) — Etapa 2+
Deploy     → Railway (backend) + Vercel (frontend)
```

---

## Arquitectura del sistema

```
Frontend (React + Vite)
         ↓
API REST (Express)
    ↙           ↘
Neo4j          PostgreSQL
(social)       (educativo)

Neo4j maneja:
- Usuarios, follows, posts, comentarios sociales
- Hashtags, sonidos, ubicaciones, notificaciones
- Relaciones: INSCRITO_EN, COMPLETO_CURSO (para recomendaciones)

PostgreSQL maneja:
- Cursos, módulos, lecciones, materiales
- Evaluaciones, preguntas, respuestas, intentos
- Inscripciones, progreso por lección
- Roles (estudiante, profesor, admin)
- Logros, certificados, rachas
- Categorías de cursos
```

---

## Estructura de carpetas

```
titi/
├── AGENTS.md
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma        ← modelo PostgreSQL completo
│   │   └── migrations/          ← historial de migraciones
│   └── src/
│       ├── index.js
│       ├── db.js                ← conexión Neo4j singleton
│       ├── prisma.js            ← instancia Prisma singleton
│       ├── middleware/
│       │   └── auth.js
│       ├── routes/
│       │   ├── auth.js          ← /api/auth/*
│       │   ├── users.js         ← /api/users/*
│       │   ├── posts.js         ← /api/posts/*
│       │   ├── search.js        ← /api/search/*
│       │   ├── courses.js       ← /api/courses/*
│       │   ├── lessons.js       ← /api/lessons/*
│       │   ├── evaluations.js   ← /api/evaluations/*
│       │   ├── progress.js      ← /api/progress/*
│       │   └── admin.js         ← /api/admin/*
│       └── services/
│           ├── neo4j.service.js    ← queries Neo4j reutilizables
│           ├── course.service.js   ← lógica de cursos
│           ├── progress.service.js ← lógica de progreso y rachas
│           └── achievement.service.js ← logros y certificados
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        │   └── client.js
        ├── context/
        │   ├── AuthContext.jsx
        │   └── ProgressContext.jsx  ← racha, logros, notif. Titi
        ├── components/
        │   ├── TitiMascot.jsx       ← mascota con moods
        │   ├── PostCard.jsx
        │   ├── CourseCard.jsx
        │   ├── LessonPlayer.jsx     ← video YouTube + contenido
        │   ├── EvaluationQuiz.jsx   ← componente de quiz
        │   ├── ProgressBar.jsx
        │   ├── StreakBadge.jsx      ← racha de días
        │   ├── AchievementToast.jsx ← logro desbloqueado
        │   └── Navbar.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Feed.jsx
            ├── Explore.jsx
            ├── Profile.jsx
            ├── Notifications.jsx
            ├── HashtagFeed.jsx
            ├── Courses.jsx          ← catálogo de cursos
            ├── CourseDetail.jsx     ← detalle + inscripción
            ├── LearnCourse.jsx      ← lección en curso
            ├── MyCourses.jsx        ← mis cursos inscritos
            └── admin/
                ├── AdminDashboard.jsx
                ├── AdminUsers.jsx
                └── AdminCourses.jsx
```

---

## Variables de entorno

### backend/.env
```
# Neo4j
NEO4J_URI=neo4j+s://XXXX.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=XXXXXXXXXX

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/titi

# Auth
JWT_SECRET=titi_secret_2026

# App
PORT=3001
FRONTEND_URL=https://titi.vercel.app

# Cloudinary (Etapa 2+)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## Modelo de datos Neo4j (red social)

### Nodos
```
(:Usuario {id, username, email, password, bio, avatarUrl, rol, racha, createdAt})
(:Post {id, content, imageUrl, createdAt})
(:Comentario {id, text, createdAt})
(:Hashtag {name})
(:Notificacion {id, tipo, leida, createdAt})
(:Sonido {id, nombre, artista})
(:Ubicacion {id, ciudad, pais})
```

### Relaciones
```
(:Usuario)-[:SIGUIO]->(:Usuario)
(:Usuario)-[:PUBLICO]->(:Post)
(:Usuario)-[:ESCRIBIO]->(:Comentario)-[:EN]->(:Post)
(:Comentario)-[:RESPONDE_A]->(:Comentario)
(:Usuario)-[:LE_GUSTO]->(:Post)
(:Post)-[:TIENE_HASHTAG]->(:Hashtag)
(:Post)-[:USA_SONIDO]->(:Sonido)
(:Usuario)-[:RECIBIO]->(:Notificacion)-[:SOBRE]->(:Post|:Usuario)
(:Usuario)-[:VIVE_EN]->(:Ubicacion)
(:Post)-[:ETIQUETADO_EN]->(:Ubicacion)

// Para recomendaciones de cursos (referencia al ID de PostgreSQL)
(:Usuario)-[:INSCRITO_EN {fechaInscripcion}]->(cursoId: string)
(:Usuario)-[:COMPLETO_CURSO {fechaCompletado}]->(cursoId: string)
```

---

## Modelo de datos PostgreSQL (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Rol {
  ESTUDIANTE
  PROFESOR
  ADMIN
}

enum TipoPregunta {
  OPCION_MULTIPLE
  VERDADERO_FALSO
  RESPUESTA_CORTA
}

model Usuario {
  id          String   @id @default(uuid())
  neoId       String   @unique  // ID en Neo4j para sincronización
  username    String   @unique
  email       String   @unique
  rol         Rol      @default(ESTUDIANTE)
  verificado  Boolean  @default(false)  // para profesores
  racha       Int      @default(0)
  ultimaActividad DateTime?
  createdAt   DateTime @default(now())

  // Relaciones
  cursosCreados    Curso[]        @relation("CursosCreados")
  inscripciones    Inscripcion[]
  progresos        Progreso[]
  intentos         Intento[]
  logros           LogroUsuario[]
  certificados     Certificado[]
}

model Categoria {
  id       String  @id @default(uuid())
  nombre   String  @unique
  icono    String
  cursos   Curso[]
}

model Curso {
  id          String   @id @default(uuid())
  titulo      String
  descripcion String
  portadaUrl  String?
  nivel       String   // 'principiante' | 'intermedio' | 'avanzado'
  publicado   Boolean  @default(false)
  createdAt   DateTime @default(now())

  // Relaciones
  categoriaId  String
  categoria    Categoria     @relation(fields: [categoriaId], references: [id])
  profesores   CursoProfesor[]
  modulos      Modulo[]
  inscripciones Inscripcion[]
  certificados Certificado[]
}

model CursoProfesor {
  cursoId    String
  profesorId String
  curso      Curso    @relation(fields: [cursoId], references: [id])
  profesor   Usuario  @relation(fields: [profesorId], references: [id])
  @@id([cursoId, profesorId])
}

model Modulo {
  id          String   @id @default(uuid())
  titulo      String
  descripcion String?
  orden       Int
  cursoId     String
  curso       Curso    @relation(fields: [cursoId], references: [id])
  lecciones   Leccion[]
  evaluacion  Evaluacion?
}

model Leccion {
  id          String   @id @default(uuid())
  titulo      String
  contenido   String   // texto/descripción
  videoUrl    String?  // YouTube embed URL
  orden       Int
  moduloId    String
  modulo      Modulo   @relation(fields: [moduloId], references: [id])
  materiales  Material[]
  progresos   Progreso[]
  comentarios ComentarioLeccion[]
}

model Material {
  id        String  @id @default(uuid())
  nombre    String
  url       String
  tipo      String  // 'pdf' | 'word' | 'imagen' | 'codigo' | 'otro'
  leccionId String
  leccion   Leccion @relation(fields: [leccionId], references: [id])
}

model Evaluacion {
  id         String     @id @default(uuid())
  titulo     String
  moduloId   String?    @unique
  modulo     Modulo?    @relation(fields: [moduloId], references: [id])
  cursoId    String?    // null si es de módulo, presente si es final
  esFinal    Boolean    @default(false)
  intentosMax Int       @default(3)
  notaMinima  Float     @default(70)
  preguntas   Pregunta[]
  intentos    Intento[]
}

model Pregunta {
  id           String       @id @default(uuid())
  texto        String
  tipo         TipoPregunta
  orden        Int
  evaluacionId String
  evaluacion   Evaluacion   @relation(fields: [evaluacionId], references: [id])
  opciones     Opcion[]
}

model Opcion {
  id         String   @id @default(uuid())
  texto      String
  esCorrecta Boolean  @default(false)
  preguntaId String
  pregunta   Pregunta @relation(fields: [preguntaId], references: [id])
}

model Inscripcion {
  id          String   @id @default(uuid())
  usuarioId   String
  cursoId     String
  fechaInscripcion DateTime @default(now())
  completado  Boolean  @default(false)
  fechaCompletado DateTime?
  usuario     Usuario  @relation(fields: [usuarioId], references: [id])
  curso       Curso    @relation(fields: [cursoId], references: [id])
  @@unique([usuarioId, cursoId])
}

model Progreso {
  id          String   @id @default(uuid())
  usuarioId   String
  leccionId   String
  completada  Boolean  @default(false)
  fechaCompletado DateTime?
  usuario     Usuario  @relation(fields: [usuarioId], references: [id])
  leccion     Leccion  @relation(fields: [leccionId], references: [id])
  @@unique([usuarioId, leccionId])
}

model Intento {
  id           String     @id @default(uuid())
  usuarioId    String
  evaluacionId String
  numero       Int        // 1, 2 o 3
  nota         Float
  aprobado     Boolean
  fechaIntento DateTime   @default(now())
  usuario      Usuario    @relation(fields: [usuarioId], references: [id])
  evaluacion   Evaluacion @relation(fields: [evaluacionId], references: [id])
}

model ComentarioLeccion {
  id        String   @id @default(uuid())
  texto     String
  usuarioId String
  leccionId String
  createdAt DateTime @default(now())
  leccion   Leccion  @relation(fields: [leccionId], references: [id])
}

model Logro {
  id          String         @id @default(uuid())
  nombre      String         @unique
  descripcion String
  icono       String         // emoji o URL
  tipo        String         // 'curso' | 'racha' | 'social' | 'evaluacion'
  condicion   String         // descripción de cómo se desbloquea
  usuarios    LogroUsuario[]
}

model LogroUsuario {
  usuarioId String
  logroId   String
  fechaObtenido DateTime @default(now())
  usuario   Usuario @relation(fields: [usuarioId], references: [id])
  logro     Logro   @relation(fields: [logroId], references: [id])
  @@id([usuarioId, logroId])
}

model Certificado {
  id          String   @id @default(uuid())
  usuarioId   String
  cursoId     String
  codigoVerif String   @unique @default(uuid())
  fechaEmision DateTime @default(now())
  usuario     Usuario  @relation(fields: [usuarioId], references: [id])
  curso       Curso    @relation(fields: [cursoId], references: [id])
}
```

---

## API REST — endpoints

### Auth `/api/auth`
```
POST /register
POST /login
GET  /me
```

### Social (Neo4j) — existentes
```
GET/POST /api/users/*
GET/POST /api/posts/*
GET      /api/search/*
GET/POST /api/notifications/*
```

### Cursos `/api/courses`
```
GET  /                    → catálogo público (con filtros: categoría, nivel, búsqueda)
GET  /:id                 → detalle del curso
POST /                    → crear curso (solo PROFESOR)
PUT  /:id                 → editar curso (solo autor)
POST /:id/publish         → publicar curso (solo autor)
POST /:id/enroll          → inscribirse (solo ESTUDIANTE)
GET  /:id/progress        → mi progreso en el curso (requiere auth)
GET  /my/enrolled         → mis cursos inscritos
GET  /my/teaching         → mis cursos como profesor
```

### Módulos y Lecciones
```
POST /api/courses/:id/modules          → crear módulo
GET  /api/modules/:id/lessons          → lecciones del módulo
POST /api/modules/:id/lessons          → crear lección
PUT  /api/lessons/:id                  → editar lección
POST /api/lessons/:id/complete         → marcar lección completa
GET  /api/lessons/:id/comments         → comentarios de lección
POST /api/lessons/:id/comments         → comentar lección
```

### Evaluaciones
```
POST /api/modules/:id/evaluation       → crear evaluación del módulo
POST /api/courses/:id/final-evaluation → crear evaluación final
POST /api/evaluations/:id/attempt      → iniciar/responder intento
GET  /api/evaluations/:id/my-attempts  → mis intentos
```

### Progreso y logros
```
GET  /api/progress/streak              → mi racha actual
GET  /api/progress/achievements        → mis logros
GET  /api/progress/certificate/:courseId → mi certificado
```

### Admin `/api/admin`
```
GET  /users                  → lista de usuarios
PUT  /users/:id/verify       → verificar profesor
PUT  /users/:id/role         → cambiar rol
GET  /courses                → todos los cursos
PUT  /courses/:id/approve    → aprobar curso
GET  /stats                  → estadísticas generales
GET  /categories             → listar categorías
POST /categories             → crear categoría
```

---

## Lógica de racha (streak)

```javascript
// progress.service.js
async function actualizarRacha(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)

  const ultimaActividad = usuario.ultimaActividad

  if (!ultimaActividad) {
    // Primera actividad
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { racha: 1, ultimaActividad: hoy }
    })
    return 1
  }

  const mismodia = ultimaActividad.toDateString() === hoy.toDateString()
  const diaAnterior = ultimaActividad.toDateString() === ayer.toDateString()

  if (mismodia) return usuario.racha  // ya estudió hoy
  if (diaAnterior) {
    // Continúa la racha
    const nuevaRacha = usuario.racha + 1
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { racha: nuevaRacha, ultimaActividad: hoy }
    })
    return nuevaRacha
  }

  // Racha rota
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { racha: 1, ultimaActividad: hoy }
  })
  return 1
}
```

---

## Lógica de logros

```javascript
// achievement.service.js
const LOGROS = [
  { nombre: 'Primera lección', tipo: 'curso', condicion: 'Completar primera lección', icono: '📚' },
  { nombre: 'Primer curso', tipo: 'curso', condicion: 'Completar primer curso', icono: '🎓' },
  { nombre: 'Racha de 7 días', tipo: 'racha', condicion: '7 días consecutivos', icono: '🔥' },
  { nombre: 'Racha de 30 días', tipo: 'racha', condicion: '30 días consecutivos', icono: '⚡' },
  { nombre: 'Primera evaluación', tipo: 'evaluacion', condicion: 'Aprobar primera evaluación', icono: '✅' },
  { nombre: 'Perfecto', tipo: 'evaluacion', condicion: '100% en una evaluación', icono: '💯' },
  { nombre: 'Social', tipo: 'social', condicion: 'Seguir a 10 personas', icono: '🤝' },
]
```

---

## Mensajes de Titi por momento

```javascript
const MENSAJES_TITI = {
  leccionCompletada: ['¡Excelente trabajo! 🎉', '¡Sigue así, campeón! 💪', '¡Un paso más hacia tu meta! 🚀'],
  evaluacionAprobada: ['¡Lo lograste! 🏆', '¡Sabía que podías! ⭐', '¡Eres increíble! 🎯'],
  evaluacionFallida: ['No te rindas, tienes más intentos 💙', '¡Revisa el material y vuelve a intentar! 📚'],
  rachaRota: ['Tu racha se rompió 😔 ¡Pero puedes empezar una nueva hoy!'],
  rachaActiva: (dias) => `¡${dias} días seguidos! ¡Imparable! 🔥`,
  logroDesbloqueado: (logro) => `¡Nuevo logro: ${logro}! 🏅`,
  feedVacio: ['¡Sigue a alguien para ver su actividad! 👀'],
  sinNotificaciones: ['Todo tranquilo por aquí 🐒'],
  cursoCompletado: ['¡Curso completado! Tu certificado está listo 🎓'],
}
```

---

## Integración Neo4j + PostgreSQL

Cuando un estudiante se inscribe a un curso:
```javascript
// 1. Guardar en PostgreSQL (fuente de verdad)
await prisma.inscripcion.create({ data: { usuarioId, cursoId } })

// 2. Crear relación en Neo4j (para recomendaciones sociales)
await runQuery(
  `MATCH (u:Usuario {id: $neoId})
   MERGE (u)-[:INSCRITO_EN {fechaInscripcion: datetime()}]->(c {cursoId: $cursoId})`,
  { neoId: usuario.neoId, cursoId }
)

// 3. Crear notificación para amigos (Neo4j)
await runQuery(
  `MATCH (u:Usuario {id: $neoId})<-[:SIGUIO]-(follower:Usuario)
   CREATE (follower)-[:RECIBIO]->(:Notificacion {
     id: $notifId, tipo: 'inscripcion_amigo',
     mensaje: $mensaje, leida: false, createdAt: datetime()
   })`,
  { neoId, notifId: randomUUID(), mensaje: `${username} se inscribió en un curso` }
)
```

Query de recomendación:
```cypher
// Cursos que toman tus amigos y tú no
MATCH (yo:Usuario {id: $userId})-[:SIGUIO]->(amigo:Usuario)-[:INSCRITO_EN]->(cursoId)
WHERE NOT (yo)-[:INSCRITO_EN]->(cursoId)
RETURN cursoId, count(amigo) as amigosInscritos
ORDER BY amigosInscritos DESC
LIMIT 5
```

---

## Etapas del proyecto

### ✅ Etapa 1 — Titi Social (COMPLETADA)
Red social completa con identidad visual Titi.
7 nodos Neo4j, feed, posts, comentarios, hashtags, búsqueda, notificaciones.

### 🔄 Etapa 2 — Módulo Educativo Base
- Instalar y configurar PostgreSQL + Prisma
- Modelo de datos completo (schema.prisma)
- CRUD de cursos, módulos y lecciones
- Sistema de inscripciones
- UI: catálogo, detalle de curso, reproductor de lección
- Comentarios en lecciones

### 📋 Etapa 3 — Evaluaciones y Progreso
- Evaluaciones por módulo y evaluación final
- Sistema de intentos (máx 3, nota mínima 70%)
- Progreso por lección
- Racha de días (streak)
- Logros y certificados
- Titi con mensajes motivadores

### 📋 Etapa 4 — Integración Social + Admin
- Feed muestra actividad académica mezclada con posts
- Recomendaciones de cursos basadas en amigos (Neo4j)
- Panel de administración separado
- Verificación de profesores
- Estadísticas generales

### 📋 Etapa 5 — Pulido y Deploy
- Optimización de queries
- Tests básicos
- Deploy final Railway + Vercel
- Documentación

---

## Patrones obligatorios de código

### prisma.js — singleton
```javascript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
export default prisma
```

### Respuesta API estándar
```javascript
// Éxito
res.json({ success: true, data: { ... } })
// Error
res.status(400).json({ success: false, message: 'Descripción' })
```

### Middleware de rol
```javascript
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ success: false, message: 'Sin permisos' })
    }
    next()
  }
}
```

---

## Convenciones

- IDs: UUID via `crypto.randomUUID()` en Neo4j, `@default(uuid())` en Prisma
- Fechas: ISO 8601, parsear con `new Date(str).toLocaleDateString('es-ES')`
- Nombres en español: nodos Neo4j, relaciones, campos de UI
- Código en inglés: variables, funciones, archivos
- Commits: `feat:`, `fix:`, `refactor:`, `docs:` en español
  - Ejemplo: `feat: agregar sistema de inscripciones`
