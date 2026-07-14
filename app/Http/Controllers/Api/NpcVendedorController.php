<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CharacterNave;
use App\Models\MapNpc;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Tiendas de NPCs vendedores: cada nave/objeto que el NPC tiene a la venta
 * lleva un "interés" (%) propio que se aplica sobre el costo base para llegar
 * al precio final de compra.
 */
class NpcVendedorController extends Controller
{
    private function precioFinal(int $costo, int $interes): int
    {
        return (int) round($costo * (1 + $interes / 100));
    }

    /** GET /npcs/{npc}/tienda-naves */
    public function tiendaNaves(int $npcId): JsonResponse
    {
        $npc = MapNpc::with('naves.habilidad1', 'naves.habilidad2', 'naves.habilidad3', 'naves.habilidad4')
            ->findOrFail($npcId);

        $naves = $npc->naves->map(fn($n) => [
            'id'               => $n->id,
            'nombre'           => $n->nombre,
            'tipo'             => $n->tipo,
            'imagen'           => $n->imagen,
            'descripcion'      => $n->descripcion,
            'rareza'           => $n->rareza,
            'vida'             => $n->vida,
            'escudo'           => $n->escudo,
            'ataque'           => $n->ataque,
            'velocidad'        => $n->velocidad,
            'maniobrabilidad'  => $n->maniobrabilidad,
            'capacidad_carga'  => $n->capacidad_carga,
            'capacidad_salto'  => $n->capacidad_salto,
            'costo_base'       => $n->costo,
            'interes'          => $n->pivot->interes,
            'precio_final'     => $this->precioFinal((int) $n->costo, (int) $n->pivot->interes),
            'habilidades'      => collect([$n->habilidad1, $n->habilidad2, $n->habilidad3, $n->habilidad4])
                ->filter()
                ->map(fn($h) => ['id' => $h->id, 'nombre' => $h->nombre, 'tipo' => $h->tipo])
                ->values(),
        ])->values();

        return response()->json(['naves' => $naves]);
    }

    /** POST /npcs/{npc}/naves/{nave}/comprar */
    public function comprarNave(Request $request, int $npcId, int $naveId): JsonResponse
    {
        $npc  = MapNpc::with('naves')->findOrFail($npcId);
        $nave = $npc->naves->firstWhere('id', $naveId);

        if (!$nave) {
            return response()->json(['message' => 'Este vendedor no tiene esa nave a la venta.'], 404);
        }

        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['message' => 'No tienes un personaje.'], 422);
        }

        $precio = $this->precioFinal((int) $nave->costo, (int) $nave->pivot->interes);

        if ($character->credits < $precio) {
            return response()->json(['message' => 'No tienes créditos suficientes.'], 422);
        }

        $character->decrement('credits', $precio);

        $owned = CharacterNave::create([
            'character_id'       => $character->id,
            'nave_id'            => $nave->id,
            'combustible_actual' => $nave->capacidad_salto,
            'vida_actual'        => $nave->vida,
            'escudo_actual'      => $nave->escudo,
        ]);

        return response()->json([
            'nave_comprada'   => $owned->load('nave'),
            'precio_pagado'   => $precio,
            'credits'         => $character->credits,
        ], 201);
    }

    /** GET /npcs/{npc}/tienda-objetos */
    public function tiendaObjetos(Request $request, int $npcId): JsonResponse
    {
        $npc = MapNpc::with('objetos')->findOrFail($npcId);

        $objetos = $npc->objetos->map(fn($o) => [
            'id'           => $o->id,
            'nombre'       => $o->nombre,
            'tipo'         => $o->tipo,
            'rareza'       => $o->rareza,
            'imagen'       => $o->imagen,
            'descripcion'  => $o->descripcion,
            'costo_base'   => $o->costo,
            'interes'      => $o->pivot->interes,
            'precio_final' => $this->precioFinal((int) ($o->costo ?? 0), (int) $o->pivot->interes),
        ])->values();

        $character  = $request->user()->character;
        $inventario = $character ? [
            'ocupado'   => $character->inventarioOcupado(),
            'capacidad' => $character->capacidadCarga(),
        ] : null;

        return response()->json(['objetos' => $objetos, 'inventario' => $inventario]);
    }

    /** POST /npcs/{npc}/objetos/{objeto}/comprar */
    public function comprarObjeto(Request $request, int $npcId, int $objetoId): JsonResponse
    {
        $npc    = MapNpc::with('objetos')->findOrFail($npcId);
        $objeto = $npc->objetos->firstWhere('id', $objetoId);

        if (!$objeto) {
            return response()->json(['message' => 'Este vendedor no tiene ese objeto a la venta.'], 404);
        }

        $data     = $request->validate(['cantidad' => 'nullable|integer|min:1|max:99']);
        $cantidad = $data['cantidad'] ?? 1;

        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['message' => 'No tienes un personaje.'], 422);
        }

        $espacioDisponible = $character->capacidadCarga() - $character->inventarioOcupado();
        if ($cantidad > $espacioDisponible) {
            return response()->json([
                'message' => $espacioDisponible > 0
                    ? "No tienes espacio suficiente: solo te quedan {$espacioDisponible} espacio(s) de inventario."
                    : 'Tu inventario está lleno, no tienes espacio para más objetos.',
            ], 422);
        }

        $precioUnitario = $this->precioFinal((int) ($objeto->costo ?? 0), (int) $objeto->pivot->interes);
        $total          = $precioUnitario * $cantidad;

        if ($character->credits < $total) {
            return response()->json(['message' => 'No tienes créditos suficientes.'], 422);
        }

        $character->decrement('credits', $total);

        $owned = $character->rolObjetos()->where('rol_objetos.id', $objeto->id)->first();
        if ($owned) {
            $character->rolObjetos()->updateExistingPivot($objeto->id, [
                'cantidad' => $owned->pivot->cantidad + $cantidad,
            ]);
        } else {
            $character->rolObjetos()->attach($objeto->id, ['cantidad' => $cantidad]);
        }

        return response()->json([
            'objeto'          => $objeto,
            'cantidad'        => $cantidad,
            'precio_unitario' => $precioUnitario,
            'precio_pagado'   => $total,
            'credits'         => $character->credits,
        ], 201);
    }
}
