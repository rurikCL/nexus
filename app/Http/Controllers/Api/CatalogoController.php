<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapEnemigo;
use App\Models\MapNpc;
use App\Models\RolObjeto;
use Illuminate\Http\JsonResponse;

/**
 * Endpoints de solo lectura para la página Catálogo (cualquier combatiente autenticado):
 * listan objetos, NPCs (incluye jefes vía tipo=jefe) y enemigos. Los habilidades ya
 * cuentan con su propio listado público en RolHabilidadController::index.
 *
 * Los campos de MapNpc/MapEnemigo se seleccionan explícitamente para no filtrar `prompt`
 * (el system prompt de IA del chat de NPCs, ver NpcChatController) ni otros campos de
 * control interno (interaccion, urlInteraccion, hito_requerimiento, fechas, MisionID).
 */
class CatalogoController extends Controller
{
    private const NPC_CAMPOS = [
        'id', 'nombre', 'tipo', 'profesion', 'faccion', 'imagen_mini', 'imagen', 'saludo',
        'vida', 'escudo', 'defensa', 'ataque', 'movimiento', 'iniciativa', 'punteria',
        'forma', 'nivel', 'raid_slots', 'habilidad_1', 'habilidad_2', 'habilidad_3', 'habilidad_4',
    ];

    public function objetos(): JsonResponse
    {
        $objetos = RolObjeto::where('activo', true)
            ->orderBy('tipo')->orderBy('nombre')
            ->get();

        return response()->json(['objetos' => $objetos]);
    }

    public function npcs(): JsonResponse
    {
        $npcs = MapNpc::where('visible', true)
            ->select(self::NPC_CAMPOS)
            ->with(['habilidad1:id,nombre', 'habilidad2:id,nombre', 'habilidad3:id,nombre', 'habilidad4:id,nombre'])
            ->orderBy('tipo')->orderBy('nombre')
            ->get();

        return response()->json(['npcs' => $npcs]);
    }

    public function enemigos(): JsonResponse
    {
        $enemigos = MapEnemigo::where('visible', true)
            ->select(self::NPC_CAMPOS)
            ->with(['habilidad1:id,nombre', 'habilidad2:id,nombre', 'habilidad3:id,nombre', 'habilidad4:id,nombre'])
            ->orderBy('tipo')->orderBy('nombre')
            ->get();

        return response()->json(['enemigos' => $enemigos]);
    }
}
