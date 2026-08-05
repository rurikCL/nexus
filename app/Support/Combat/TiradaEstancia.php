<?php

declare(strict_types=1);

namespace App\Support\Combat;

use App\Models\Character;

/**
 * Tirada de cambio de estancia/forma, común a los cuatro sistemas de combate.
 *
 * Al cambiar de forma se tira 2d6 y se suma la Iniciativa: si INI + 2d6 >= 10, el cambio NO
 * consume el turno y el jugador puede realizar otra acción. Si falla, la forma igual queda
 * cambiada (es la acción del turno) y el turno termina como siempre.
 *
 * La Iniciativa que entra acá tiene topes propios y FIJOS -no configurables-: 4 por asignación
 * y 5 sumando equipo (ver Character::iniciativaEstancia), más 7 como techo final con buffs, que
 * se aplica en resolver() porque los buffs viven en cada combate y no en el personaje.
 *
 * Los combates cliente-side (NpcCombatScreen/HordaCombatScreen) replican esta misma fórmula en
 * JS (resources/js/utils/estancia.js) — si cambia una, actualizar la otra.
 */
final class TiradaEstancia
{
    /**
     * @param  int  $iniPreBuff  Character::iniciativaEstancia() del actor (ya topada por equipo)
     * @param  int  $deltaBuffs  +1 por buff de iniciativa, -1 por debuff (ver getEffectiveStats)
     * @return array{dado1:int,dado2:int,ini:int,total:int,exito:bool}
     */
    public static function resolver(int $iniPreBuff, int $deltaBuffs = 0): array
    {
        $dado1 = random_int(1, 6);
        $dado2 = random_int(1, 6);
        $ini = max(0, min(Character::INI_ESTANCIA_CAP_BUFF, $iniPreBuff + $deltaBuffs));
        $total = $dado1 + $dado2 + $ini;

        return [
            'dado1' => $dado1,
            'dado2' => $dado2,
            'ini' => $ini,
            'total' => $total,
            'exito' => $total >= Character::INI_ESTANCIA_OBJETIVO,
        ];
    }

    /**
     * Delta de iniciativa que aportan los buffs/debuffs activos, con la convención de
     * getEffectiveStats: cada entrada cuenta 1, sin importar su monto.
     */
    public static function deltaBuffs(?array $buffs, ?array $debuffs): int
    {
        $contar = static fn (?array $efectos) => count(array_filter(
            $efectos ?? [],
            static fn ($e) => ($e['stat'] ?? null) === 'iniciativa'
        ));

        return $contar($buffs) - $contar($debuffs);
    }

    /**
     * Solo se permite UNA tirada por turno: una tirada exitosa deja al jugador actuando de nuevo,
     * y sin este límite podría cambiar de estancia otra vez para re-tirar indefinidamente. El
     * segundo cambio del mismo turno no tira y consume el turno.
     */
    public static function mensajeSinTirada(string $nombre): string
    {
        return "{$nombre} ya cambió de estancia este turno: el cambio consume su turno";
    }

    /** Línea de log de la tirada, con el formato 2d6(a+b)+INI=Total que ya colorea el frontend. */
    public static function mensaje(string $nombre, array $tirada): string
    {
        $objetivo = Character::INI_ESTANCIA_OBJETIVO;
        $cierre = $tirada['exito']
            ? "¡Cambio ágil! {$nombre} conserva su turno"
            : "El cambio consume el turno de {$nombre}";

        return "{$nombre} cambia de estancia: 2d6({$tirada['dado1']}+{$tirada['dado2']})"
            ."+{$tirada['ini']}={$tirada['total']} vs {$objetivo} — {$cierre}";
    }
}
