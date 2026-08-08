<?php

declare(strict_types=1);

namespace App\Services;

use App\Jobs\GenerarInteraccionNpcJob;
use App\Models\Configuracion;
use App\Models\MapNpc;
use App\Models\RolHabilidad;
use Illuminate\Support\Facades\Cache;
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
     * Si el NPC está en modo `interaccion_ia` y su `interaccion` está vencida o nunca se
     * generó, despacha un job que la regenera vía IA en segundo plano. No bloquea al
     * llamador (la llamada a Mistral puede tardar segundos); mientras tanto se sigue
     * sirviendo la `interaccion` existente.
     */
    public function ensureFresh(MapNpc $npc): void
    {
        if ($npc->tipo_interaccion !== 'interaccion_ia' || ! $npc->prompt_respuestas) {
            return;
        }

        $minutos = (int) Configuracion::valor('tiempo_npc_interaccion', 120);

        $vencida = ! $npc->interaccion_generada_at
            || $npc->interaccion_generada_at->lt(now()->subMinutes($minutos));

        if (! $vencida) {
            return;
        }

        // Evita despachar el job en cada request mientras uno ya está en curso (o acaba de fallar).
        if (! Cache::lock("npc-interaccion-generando:{$npc->id}", 120)->get()) {
            return;
        }

        GenerarInteraccionNpcJob::dispatch($npc->id);
    }

    /** Genera la interacción vía IA y la persiste. Si la IA falla, deja la existente intacta. */
    public function regenerar(MapNpc $npc): void
    {
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
                'response_format' => ['type' => 'json_object'],
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
                    'response_format' => ['type' => 'json_object'],
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

        $texto = $this->parsearRespuesta($contenido);

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
            'Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto antes o después), '
                .'con EXACTAMENTE este formato:'
                ."\n".'{"interacciones": [{"pregunta": "...", "respuesta": "..."}, ...]}'
                ."\n".'El array "interacciones" debe tener entre '.self::MIN_LINEAS.' y '.self::MAX_LINEAS
                .' elementos — nunca menos de '.self::MIN_LINEAS.'. Cada "pregunta" es la frase completa '
                .'que el jugador elegiría decirle al NPC (puede tener varias palabras y signos de interrogación, '
                .'como si fuera la opción de un menú de diálogo, nunca una sola palabra clave). Cada "respuesta" '
                .'es lo que contesta el NPC, en un solo párrafo corto.'
                ."\n\n".'Ejemplo de JSON válido para un NPC distinto (solo de referencia, no lo copies):'
                ."\n".'{"interacciones": ['
                .'{"pregunta": "¿Puedes entrenarme?", "respuesta": "Si buscas mejorar tu forma de combate, puedo ayudarte con eso."}, '
                .'{"pregunta": "¿Has escuchado algún rumor por aquí?", "respuesta": "Dicen que hay actividad sospechosa cerca del sector norte."}, '
                .'{"pregunta": "¿Tienes algo para vender?", "respuesta": "Tengo algunas piezas de repuesto si te interesan."}'
                .']}',
        ])));
    }

    /** Extrae "interacciones" del JSON devuelto por la IA y las serializa a líneas "- pregunta: respuesta". */
    private function parsearRespuesta(string $contenido): ?string
    {
        $json = trim($contenido);
        // Por si el modelo igual envuelve el JSON en un bloque ```json ... ``` pese a lo pedido.
        $json = preg_replace('/^```(?:json)?\s*|\s*```$/', '', $json) ?? $json;

        $data = json_decode($json, true);

        $items = is_array($data) ? ($data['interacciones'] ?? null) : null;

        if (! is_array($items)) {
            return null;
        }

        $lineas = collect($items)
            ->map(fn ($item) => [
                'pregunta' => trim((string) ($item['pregunta'] ?? '')),
                'respuesta' => trim((string) ($item['respuesta'] ?? '')),
            ])
            ->filter(fn ($item) => $item['pregunta'] !== '' && $item['respuesta'] !== '')
            ->map(fn ($item) => "- {$item['pregunta']}: {$item['respuesta']}")
            ->slice(0, self::MAX_LINEAS)
            ->values();

        if ($lineas->count() < self::MIN_LINEAS) {
            return null;
        }

        return $lineas->implode("\n");
    }
}
