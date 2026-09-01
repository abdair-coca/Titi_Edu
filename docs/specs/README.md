# Docs — Flujo SDD de Titi

> **Specs = cómo se agregan features.** Este doc explica el ciclo de vida de un
> *change* (cambio): qué archivo es qué, cómo se lee y cómo se arma uno nuevo.
> Los archivos están en **español** y pensados para que un **humano los entienda
> rápido**; el detalle fino para LLMs vive en Engram (memoria persistente).

---

## Qué es un change

Un **change** es una feature o corrección con nombre (`kebab-case`, ej.
`centralizador-notas`). Cada change vive en una carpeta y sigue este ciclo:

```
docs/specs/changes/{change-name}/
├── proposal.md       # 1. Qué + por qué + alcance (antes de codear)
├── spec.md           # 2. Requisitos concretos (qué debe cumplir, en español claro)
├── tasks.md          # 3. Checklist de implementación (se tilda al avanzar)
└── verify-report.md  # 4. (al cerrar) cómo se probó y qué quedó verificado
```

Cuando el change **termina y se verifica**, la carpeta completa se mueve a:

```
docs/specs/changes/archive/YYYY-MM-DD-{change-name}/
```

El archive es **historial inmutable** — audit trail del proyecto. Nunca se
borra ni se modifica.

---

## Ciclo de vida

| Fase | Archivo | Qué produce | Quién |
|---|---|---|---|
| 1. Explorar | *(opcional, en Engram)* | Hallazgos: qué existe, huecos, riesgos | Orquestador |
| 2. Proponer | `proposal.md` | Intención, alcance in/out, criterios de éxito | Orquestador |
| 3. Especificar | `spec.md` | Requisitos verificables (qué, no cómo) | Orquestador |
| 4. Diseñar | *(opcional, dentro de spec o Engram)* | Enfoque técnico si es complejo | Orquestador |
| 5. Tasks | `tasks.md` | Checklist de implementación por unidades | Orquestador |
| 6. Implementar | código + `tasks.md` `[x]` | Código que cumple la spec | Apply (subagente) |
| 7. Verificar | `verify-report.md` | Tests/build verdes, evidencia | Verify (subagente) |
| 8. Archivar | `archive/…` | Historial inmutable + merge de specs | Archive |

> **Regla práctica:** si es una feature chica (1–2 archivos), `proposal.md` +
> `spec.md` + `tasks.md` en un solo documento es aceptable. No hay burocracia
> obligatoria — la meta es que cualquier dev (humano o IA) sepa **qué se hizo,
> por qué, y cómo se probó**.

---

## Cómo se lee el estado del proyecto

| Quiero saber… | Voy a… |
|---|---|
| Qué está en curso ahora | `docs/specs/changes/*/` (carpetas activas) |
| Historia de features cerradas | `docs/specs/changes/archive/` |
| Estado de etapas y roadmap | `docs/roadmap.md` |
| Qué cambio está pendiente de implementar | `proposal.md` de cada change activo |
| Cómo se probó algo | `verify-report.md` del change |
| Detalle técnico (dual-DB, auth) | `docs/architecture.md` |

---

## Cómo armar un change nuevo (checklist)

1. Nombrar en `kebab-case` en español conciso (ej. `tienda-gotas`, no `ShopItemsFeature`).
2. Crear `docs/specs/changes/{nombre}/proposal.md` con: **intención**, **alcance in/out**, **criterios de éxito**.
3. Escribir `spec.md` con requisitos en lenguaje claro (funcional, no técnico):
   - "El profesor puede ver notas de todos los inscritos en un curso".
   - Incluir casos borde obvios (sin inscritos, sin permisos, etc.).
4. Desglosar `tasks.md` en unidades commitables (backend → frontend → tests → docs).
5. Implementar, marcando `[x]` en `tasks.md`.
6. Verificar (`npm test`, build) y escribir `verify-report.md`.
7. Archivar moviendo la carpeta a `archive/YYYY-MM-DD-{nombre}/`.

---

## Convenciones de los artifacts

- **Idioma:** español, neutral y directo. Nada de relleno.
- **Naming:** `proposal.md`, `spec.md`, `tasks.md`, `verify-report.md` — fijos.
- **Cambios de spec ya implementados** (como el rediseño Learn) van directo a
  `archive/` con su fecha; no quedan como "specs vivas" sueltas.
- **Decisiones de arquitectura** se reflejan además en Engram (para LLMs) y en
  `docs/architecture.md` (para humanos) cuando cambian el sistema.
- **Root override:** las skills SDD escriben por defecto a `openspec/`. En Titi
  el root es `docs/specs/changes/`. Cualquier subagente delegado debe recibir la
  ruta explícita en el prompt (ver `AGENTS.md` → "Flujo de trabajo — specs").