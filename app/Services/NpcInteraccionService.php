<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Configuracion;
use App\Models\MapNpc;
use App\Models\RolHabilidad;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Genera el diálogo estático (`interaccion`) de un NPC a partir de su `prompt_respuestas`,
 * usando IA. El resultado se cachea en el propio NPC y se regenera solo cuando vence
 * la ventana configurada en `configuraciones.tiempo_npc_interaccion` (minutos).
 */
class NpcInteraccionService
{
    private const MODEL = 'open-mistral-nemo';

    private const MIN_LINEAS = 3;

    private const MAX_LINEAS = 5;

    /**
     * Si el NPC tiene `prompt_respuestas` y su `interaccion` está vencida o nunca se
     * generó, la regenera vía IA y la persiste. Si la IA falla, deja la `interaccion`
     * existente intacta (no interrumpe al llamador) y registra el error.
     */
    public function ensureFresh(MapNpc $npc): void
    {
        if (! $npc->prompt_respuestas) {
            return;
        }

        $minutos = (int) Configuracion::valor('tiempo_npc_interaccion', 120);

        $vencida = ! $npc->interaccion_generada_at
            || $npc->interaccion_generada_at->lt(now()->subMinutes($minutos));

        if (! $vencida) {
            return;
        }

        $texto = $this->generar($npc);

        if ($texto === null) {
            return;
        }

        $npc->forceFill([
            'interaccion' => $texto,
            'interaccion_generada_at' => now(),
        ])->save();
    }

    private function generar(MapNpc $npc): ?string
    {
        $messages = [
            ['role' => 'system', 'content' => $this->buildSystemPrompt($npc)],
            ['role' => 'user', 'content' => 'Genera ahora las interacciones según el formato indicado.'],
        ];

        $response = Http::withToken(config('services.mistral.api_key'))
            ->timeout(30)
            ->post('https://api.mistral.ai/v1/chat/completions', [
                'model' => self::MODEL,
                'messages' => $messages,
                'tools' => NpcAiTools::definitions(),
                'tool_choice' => 'auto',
                'max_tokens' => 500,
                'temperature' => 0.8,
            ]);

        if ($response->failed()) {
            Log::error('NpcInteraccionService: error al generar interacción', [
                'npc_id' => $npc->id,
                'status' => $response->status(),
                'body' => $response->json('message') ?? $response->body(),
            ]);

            return null;
        }

        $choice = $response->json('choices.0');

        if (($choice['finish_reason'] ?? '') === 'tool_calls') {
            $toolCalls = $choice['message']['tool_calls'] ?? [];
            $messages[] = $choice['message'];

            foreach ($toolCalls as $call) {
                $toolName = $call['function']['name'];
                $args = json_decode($call['function']['arguments'], true) ?? [];
                $result = NpcAiTools::execute($toolName, $args);

                $messages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $call['id'],
                    'name' => $toolName,
                    'content' => json_encode($result, JSON_UNESCAPED_UNICODE),
                ];
            }

            $response = Http::withToken(config('services.mistral.api_key'))
                ->timeout(30)
                ->post('https://api.mistral.ai/v1/chat/completions', [
                    'model' => self::MODEL,
                    'messages' => $messages,
                    'max_tokens' => 500,
                    'temperature' => 0.8,
                ]);

            if ($response->failed()) {
                Log::error('NpcInteraccionService: error en segunda llamada', [
                    'npc_id' => $npc->id,
                    'status' => $response->status(),
                ]);

                return null;
            }
        }

        $contenido = (string) $response->json('choices.0.message.content', '');

        $texto = $this->sanitizar($contenido);

        if ($texto === null) {
            Log::warning('NpcInteraccionService: respuesta de IA no tenía el formato esperado', [
                'npc_id' => $npc->id,
                'crudo' => $contenido,
            ]);
        }

        return $texto;
    }

    private function buildSystemPrompt(MapNpc $npc): string
    {
        $habilidades = RolHabilidad::whereIn('id', $npc->habilidadIds())->get()
            ->map(fn (RolHabilidad $h) => trim("{$h->nombre}: {$h->efecto}"))
            ->filter()
            ->implode('; ');

        return trim(implode("\n\n", array_filter([
            'Estás redactando diálogo estático para un NPC de un juego de rol. No estás conversando: '
                .'debes generar de una sola vez un guion con varias preguntas/interacciones posibles y su respuesta.',
            $npc->prompt_respuestas,
            $habilidades ? "Habilidades de este NPC (menciónalas solo si son relevantes para alguna pregunta): {$habilidades}." : null,
            'Puedes usar las herramientas disponibles para consultar datos reales del juego '
                .'(personajes, ubicaciones, eventos) si eso hace más precisas las respuestas.',
            'Responde con EXACTAMENTE entre '.self::MIN_LINEAS.' y '.self::MAX_LINEAS.' líneas — nunca menos de '
                .self::MIN_LINEAS.'. Cada línea es una interacción distinta, con este formato EXACTO '
                .'(sin numerar, sin markdown, sin saludos ni texto antes o después):'
                ."\n".'- pregunta o frase que el jugador elegiría decirle al NPC: respuesta del NPC'
                ."\n".'La parte antes de los dos puntos NO debe ser una sola palabra clave: escribe la pregunta '
                .'o frase completa tal como la diría el jugador (puede tener varias palabras y signos de '
                .'interrogación), como si fuera la opción de un menú de diálogo.'
                ."\n\n".'Ejemplo con '.self::MIN_LINEAS.' líneas para un NPC distinto (solo de referencia, no la copies):'
                ."\n".'- ¿Puedes entrenarme?: Si buscas mejorar tu forma de combate, puedo ayudarte con eso.'
                ."\n".'- ¿Has escuchado algún rumor por aquí?: Dicen que hay actividad sospechosa cerca del sector norte.'
                ."\n".'- ¿Tienes algo para vender?: Tengo algunas piezas de repuesto si te interesan.',
        ])));
    }

    /** Conserva solo líneas "- palabra_clave: respuesta" válidas; exige al menos MIN_LINEAS. */
    private function sanitizar(string $texto): ?string
    {
        $lineas = collect(explode("\n", $texto))
            ->map(fn ($l) => trim($l))
            ->filter(fn ($l) => (bool) preg_match('/^-\s*[^:]+:\s*.+$/', $l))
            ->map(fn ($l) => '- '.ltrim($l, "- \t"))
            ->slice(0, self::MAX_LINEAS)
            ->values();

        if ($lineas->count() < self::MIN_LINEAS) {
            return null;
        }

        return $lineas->implode("\n");
    }
}
