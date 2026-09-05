import { describe, expect, it } from 'vitest';
import { extractLessonHtmlContent } from '../../src/services/html-extractor.service.js';

describe('extractLessonHtmlContent', () => {
  it('extracts visible DOM text from headings, paragraphs, and lists', () => {
    const html = `
      <!doctype html>
      <html>
      <head><title>Introducción a Redes</title></head>
      <body>
        <h1>Modelo OSI</h1>
        <p>El modelo OSI define siete capas de comunicación.</p>
        <ul>
          <li>Capa Física</li>
          <li>Capa de Enlace</li>
        </ul>
      </body>
      </html>
    `;
    const result = extractLessonHtmlContent(html);
    expect(result).toContain('Modelo OSI');
    expect(result).toContain('El modelo OSI define siete capas de comunicación.');
    expect(result).toContain('Capa Física');
    expect(result).toContain('Capa de Enlace');
  });

  it('extracts educational questions and answers defined in a JavaScript array', () => {
    const html = `
      <!doctype html>
      <html>
      <body>
        <div id="game-root"></div>
        <script>
          const triviaQuestions = [
            {
              pregunta: "¿Cuál es la función principal de la mitocondria?",
              opciones: ["Respiración celular y ATP", "Fotosíntesis", "Digestión"],
              correcta: "Respiración celular y ATP",
              explicacion: "Genera la mayor parte del suministro de ATP de la célula."
            },
            {
              question: "What organelle contains genetic material?",
              options: ["Nucleus", "Ribosome", "Golgi"],
              answer: "Nucleus"
            }
          ];
        </script>
      </body>
      </html>
    `;
    const result = extractLessonHtmlContent(html);
    expect(result).toContain('Pregunta: ¿Cuál es la función principal de la mitocondria?');
    expect(result).toContain('Opciones: Respiración celular y ATP, Fotosíntesis, Digestión');
    expect(result).toContain('Respuesta correcta: Respiración celular y ATP');
    expect(result).toContain('Explicación: Genera la mayor parte del suministro de ATP de la célula.');
    expect(result).toContain('Pregunta: What organelle contains genetic material?');
    expect(result).toContain('Opciones: Nucleus, Ribosome, Golgi');
    expect(result).toContain('Respuesta correcta: Nucleus');
  });

  it('extracts concept and definition pairs (flashcards/memory cards)', () => {
    const html = `
      <html>
      <body>
        <div class="cards-grid"></div>
        <script>
          const flashcards = [
            { concepto: "Polimorfismo", definicion: "Capacidad de un objeto de tomar diferentes formas en POO." },
            { term: "Encapsulamiento", definition: "Ocultamiento del estado interno de un objeto." }
          ];
        </script>
      </body>
      </html>
    `;
    const result = extractLessonHtmlContent(html);
    expect(result).toContain('Concepto: Polimorfismo | Definición: Capacidad de un objeto de tomar diferentes formas en POO.');
    expect(result).toContain('Concepto: Encapsulamiento | Definición: Ocultamiento del estado interno de un objeto.');
  });

  it('extracts slides or screen titles and content from interactive presentations', () => {
    const html = `
      <html>
      <body>
        <script>
          const slides = [
            { titulo: "Paso 1: Planteamiento", contenido: "Identificar las variables de entrada y salida." },
            { title: "Step 2: Analysis", content: "Determine algorithmic complexity." }
          ];
        </script>
      </body>
      </html>
    `;
    const result = extractLessonHtmlContent(html);
    expect(result).toContain('Paso 1: Planteamiento: Identificar las variables de entrada y salida.');
    expect(result).toContain('Step 2: Analysis: Determine algorithmic complexity.');
  });

  it('extracts data from script type="application/json"', () => {
    const html = `
      <html>
      <body>
        <script type="application/json">
          {
            "quiz": [
              {
                "pregunta": "¿Qué estructura de datos opera en modo LIFO?",
                "opciones": ["Pila", "Cola"],
                "correcta": "Pila"
              }
            ]
          }
        </script>
      </body>
      </html>
    `;
    const result = extractLessonHtmlContent(html);
    expect(result).toContain('Pregunta: ¿Qué estructura de datos opera en modo LIFO?');
    expect(result).toContain('Respuesta correcta: Pila');
  });

  it('extracts educational text from data-* and accessibility attributes', () => {
    const html = `
      <html>
      <body>
        <div data-question="¿Cuál es la aceleración de la gravedad?" data-answer="Aproximadamente 9.8 m/s²"></div>
        <img src="data:image/png;base64,iVBOR" alt="Diagrama de cuerpo libre mostrando las fuerzas">
        <button aria-label="Seleccionar respuesta correcta"></button>
      </body>
      </html>
    `;
    const result = extractLessonHtmlContent(html);
    expect(result).toContain('¿Cuál es la aceleración de la gravedad?');
    expect(result).toContain('Aproximadamente 9.8 m/s²');
    expect(result).toContain('Diagrama de cuerpo libre mostrando las fuerzas');
  });

  it('extracts free dialogue strings while filtering code boilerplate and DOM methods', () => {
    const html = `
      <html>
      <body>
        <div id="canvas-container"></div>
        <script>
          const intro = "Bienvenido a la simulación interactiva de cinemática.";
          const hint = "Recuerda que la velocidad inicial es cero.";
          const scoreMsg = "Excelente trabajo resolviendo el desafío.";

          // Código que NO debe filtrarse al RAG:
          document.addEventListener('click', function(e) {
            const btn = document.getElementById('btn');
            btn.style.display = 'none';
            window.postMessage({ source: 'titi-html', type: 'TITI_SCORE', score: 100 }, '*');
          });
        </script>
      </body>
      </html>
    `;
    const result = extractLessonHtmlContent(html);
    expect(result).toContain('Bienvenido a la simulación interactiva de cinemática.');
    expect(result).toContain('Recuerda que la velocidad inicial es cero.');
    expect(result).toContain('Excelente trabajo resolviendo el desafío.');

    // Verificamos que no filtre código o tokens de control
    expect(result).not.toContain('addEventListener');
    expect(result).not.toContain('getElementById');
    expect(result).not.toContain('titi-html');
    expect(result).not.toContain('TITI_SCORE');
  });

  it('returns empty string for null, undefined, or empty HTML', () => {
    expect(extractLessonHtmlContent('')).toBe('');
    expect(extractLessonHtmlContent(null)).toBe('');
    expect(extractLessonHtmlContent(undefined)).toBe('');
    expect(extractLessonHtmlContent('   ')).toBe('');
  });
});
