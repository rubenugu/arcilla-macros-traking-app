// Vercel Serverless Function — Proxy para Claude Haiku
// Mantiene la API key segura en variables de entorno del servidor

const USDA_DB = `
BASE DE DATOS USDA (por 100g salvo indicación):
1. Pechuga de pollo cocida: 165kcal Prot:31g Carb:0g Gras:3.6g
2. Huevo entero (1 unidad=50g): 77kcal Prot:6g Carb:0.6g Gras:5.3g
3. Atún en agua escurrido: 108kcal Prot:25g Carb:0g Gras:0.5g
4. Arroz blanco cocido: 130kcal Prot:2.7g Carb:28g Gras:0.3g
5. Avena seca: 389kcal Prot:17g Carb:66g Gras:7g
6. Pan integral (1 rebanada=30g): 80kcal Prot:3.5g Carb:15g Gras:1g
7. Pan blanco (1 rebanada=25g): 67kcal Prot:2.3g Carb:12.7g Gras:0.9g
8. Plátano/Banana (1 mediano=118g): 105kcal Prot:1.3g Carb:27g Gras:0.4g
9. Manzana (1 mediana=182g): 95kcal Prot:0.5g Carb:25g Gras:0.3g
10. Naranja (1 mediana=131g): 62kcal Prot:1.2g Carb:15g Gras:0.2g
11. Leche entera (240ml): 149kcal Prot:8g Carb:12g Gras:8g
12. Leche descremada (240ml): 83kcal Prot:8g Carb:12g Gras:0.2g
13. Yogur griego natural (170g): 100kcal Prot:17g Carb:6g Gras:0.7g
14. Queso fresco (30g): 80kcal Prot:5g Carb:0.5g Gras:6g
15. Carne molida 90% magra: 176kcal Prot:26g Carb:0g Gras:8g
16. Salmón cocido: 208kcal Prot:20g Carb:0g Gras:13g
17. Frijoles negros cocidos: 132kcal Prot:8.9g Carb:24g Gras:0.5g
18. Lentejas cocidas: 116kcal Prot:9g Carb:20g Gras:0.4g
19. Papa cocida: 87kcal Prot:1.9g Carb:20g Gras:0.1g
20. Camote/Batata cocida: 86kcal Prot:1.6g Carb:20g Gras:0.1g
21. Brócoli cocido: 34kcal Prot:2.8g Carb:7g Gras:0.4g
22. Espinaca cocida: 23kcal Prot:2.9g Carb:3.6g Gras:0.4g
23. Aguacate/Palta: 160kcal Prot:2g Carb:9g Gras:15g
24. Aceite de oliva (15ml=1 cda): 119kcal Prot:0g Carb:0g Gras:14g
25. Mantequilla de maní (32g=2 cdas): 188kcal Prot:8g Carb:7g Gras:16g
26. Almendras (28g=1 oz): 164kcal Prot:6g Carb:6g Gras:14g
27. Tortilla de maíz (1 pieza=30g): 70kcal Prot:1.5g Carb:14g Gras:1g
28. Proteína whey (1 scoop=30g): 120kcal Prot:24g Carb:3g Gras:2g
29. Tomate: 18kcal Prot:0.9g Carb:3.9g Gras:0.2g
30. Pepino: 16kcal Prot:0.7g Carb:3.6g Gras:0.1g
`;

function buildAnalyzePrompt() {
  return `Eres una calculadora de macronutrientes. Tu única función es devolver JSON válido, sin explicaciones ni texto adicional.

REGLAS:
- Si el alimento aparece en la base de datos USDA, usa esos valores escalados a la cantidad descrita.
- Si el alimento NO aparece en la base de datos, estima los macros con tu conocimiento nutricional.
- Siempre escala las cantidades correctamente (ej: "100g de avena" = los valores USDA directos; "50g de avena" = la mitad).
- Para artículos como huevos o plátanos indicados en unidades, usa el peso unitario de la base de datos.
- Los valores deben ser números (sin unidades), redondeados a 1 decimal.
- El campo "fuente" debe ser "USDA" si el dato proviene de la base de datos, o "IA" si fue estimado.
- NUNCA crear un ítem para la preparación completa (licuado, smoothie, ensalada, guisado, etc.). Solo listar los ingredientes individuales como ítems separados.
- Los "totales" deben ser la suma exacta de los ítems individuales, sin contar nada más.
- Conversiones de medidas domésticas para ingredientes SECOS: 1 taza de avena/cereal en hojuelas ≈ 80g; 1 taza de arroz crudo ≈ 185g; 1 taza de harina ≈ 120g. NO usar 240g para ingredientes secos — 240ml es solo para líquidos.

${USDA_DB}

FORMATO DE RESPUESTA (solo JSON, sin markdown, sin texto extra):
{"items":[{"nombre":"nombre del alimento","gramos":0,"calorias":0,"proteina":0,"carbos":0,"grasa":0,"fuente":"USDA"}],"totales":{"calorias":0,"proteina":0,"carbos":0,"grasa":0}}`;
}

function buildParsePrompt() {
  return `Eres un parser de ingredientes en español. Extrae la lista de ingredientes con sus cantidades del texto que te dé el usuario. Responde SOLO con JSON válido, sin markdown ni texto extra:
{"ingredientes":["cantidad nombre","cantidad nombre",...]}

REGLAS:
- Un elemento por ingrediente, sin combinar varios en uno
- Incluye todos los ingredientes mencionados, incluso agua u otros líquidos
- Usa unidades en español (taza, cucharada, gramo, pieza, etc.)
- Formato preferido: "X taza(s) de avena cruda", "2 plátanos", "1 cucharada de crema de cacahuate"
- Si no se especifica cantidad, usa "1"
- Si el texto menciona una preparación (licuado, caldo, etc.), extrae sus componentes por separado`;
}

function buildSuggestPrompt(remaining) {
  return `Eres un asistente de nutrición en español. El usuario necesita completar sus macros del día antes de dormir.

Le faltan aproximadamente:
- Calorías: ${remaining.calories} kcal
- Proteína: ${remaining.protein}g
- Carbohidratos: ${remaining.carbs}g
- Grasa: ${remaining.fat}g

Sugiere 3 alimentos o comidas rápidas de preparar, priorizando proteína. Responde SOLO en español y SOLO con JSON válido, sin markdown ni texto extra:
{"sugerencias":[{"alimento":"...","porcion":"...","calorias":0,"proteina":0,"porque":"razón breve en español"}]}`;
}

function stripMarkdownFences(text) {
  // Remove ```json ... ``` or ``` ... ``` wrappers if model adds them
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_KEY_NOT_CONFIGURED' });
  }

  const { mode, userMessage, remaining } = req.body || {};

  if (!mode || !['analyze', 'suggest', 'parse'].includes(mode)) {
    return res.status(400).json({ error: 'Modo inválido' });
  }

  const systemPrompt = mode === 'analyze'
    ? buildAnalyzePrompt()
    : mode === 'parse'
    ? buildParsePrompt()
    : buildSuggestPrompt(remaining || { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const messageContent = mode === 'analyze' || mode === 'parse'
    ? (userMessage || '')
    : 'Dame las sugerencias de alimentos para completar mis macros de hoy.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: messageContent }]
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: 'API_ERROR', status: response.status });
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text || '';
    const cleaned = stripMarkdownFences(rawText);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error. Raw text:', rawText);
      return res.status(200).json({ error: 'PARSE_ERROR', raw: rawText });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'TIMEOUT' });
    }
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
};
