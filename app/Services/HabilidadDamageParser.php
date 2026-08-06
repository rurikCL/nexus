<?php

namespace App\Services;

/**
 * Interpreta el campo de texto `rol_habilidades.damage`, que admite varios formatos:
 * - número plano ("30"): daño base fijo.
 * - dados ("1d3", "2d6", ...): tirada de N dados de M caras, sumados, como daño base.
 * - cura explícita ("C10"): cura esa cantidad de vida (self o target según `objetivo`).
 * - bono/penalización al arma ("+5", "-5"): se suma al daño base del arma equipada
 *   (objeto o sable láser) en vez de reemplazarlo.
 * - modificador de fuerza ("+F5", "-F5"): no aplica daño, solo suma/resta esa cantidad
 *   a la fuerza acumulada del objetivo (self o target según `objetivo`).
 */
class HabilidadDamageParser
{
    public static function parse(?string $raw): array
    {
        $raw = trim((string) ($raw ?? '0'));
        if ($raw === '') {
            $raw = '0';
        }

        if (preg_match('/^[Cc](\d+)$/', $raw, $m)) {
            return ['kind' => 'heal', 'value' => (int) $m[1]];
        }

        if (preg_match('/^([+-])[Ff](\d+)$/', $raw, $m)) {
            return ['kind' => 'force', 'value' => ($m[1] === '-' ? -1 : 1) * (int) $m[2]];
        }

        if (preg_match('/^([+-])(\d+)$/', $raw, $m)) {
            return ['kind' => 'weapon', 'value' => ($m[1] === '-' ? -1 : 1) * (int) $m[2]];
        }

        if (preg_match('/^(\d+)[dD](\d+)$/', $raw, $m)) {
            $count = max(1, (int) $m[1]);
            $sides = max(1, (int) $m[2]);

            return ['kind' => 'dice', 'value' => self::roll($count, $sides)];
        }

        if (preg_match('/^\d+$/', $raw)) {
            return ['kind' => 'flat', 'value' => (int) $raw];
        }

        return ['kind' => 'flat', 'value' => 0];
    }

    public static function roll(int $count, int $sides): int
    {
        $total = 0;
        for ($i = 0; $i < $count; $i++) {
            $total += random_int(1, max(1, $sides));
        }

        return $total;
    }
}
