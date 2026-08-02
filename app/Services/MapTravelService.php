<?php

namespace App\Services;

use App\Models\Character;
use App\Models\MapSistema;

class MapTravelService
{
    /**
     * Cobra el salto de sistema (combustible de la nave equipada, o créditos de transbordador
     * si no hay nave o se fuerza el pago) cuando el destino cambia de sistema respecto al
     * actual. Moverse dentro del mismo sistema (planeta/zona/lugar) no tiene costo. Devuelve
     * un mensaje de error si no se pudo cobrar, o null si el salto quedó pagado (o no aplicaba).
     */
    public function cobrarSalto(Character $character, ?int $sistemaDestinoId, bool $forzarTransbordador): ?string
    {
        $esSalto = $sistemaDestinoId && (int) $sistemaDestinoId !== (int) $character->map_sistema_id;
        if (! $esSalto) {
            return null;
        }

        $naveEquipada = $forzarTransbordador ? null : $character->naveEquipada()->with('nave')->first();

        if ($naveEquipada) {
            if ($naveEquipada->combustible_actual <= 0) {
                return 'Tu nave no tiene combustible suficiente para saltar. Debes reabastecerla.';
            }

            $naveEquipada->decrement('combustible_actual');

            return null;
        }

        $costoViaje = MapSistema::find($sistemaDestinoId)?->costo_viaje ?? 0;

        if ($costoViaje > 0) {
            if ($character->credits < $costoViaje) {
                return 'Créditos insuficientes para pagar el transporte a este sistema.';
            }

            $character->decrement('credits', $costoViaje);
        }

        return null;
    }
}
