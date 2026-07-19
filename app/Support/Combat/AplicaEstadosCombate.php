<?php

declare(strict_types=1);

namespace App\Support\Combat;

/**
 * Estados de combate compartidos entre PvpCombatController y RaidCombatController
 * (y espejados en JS por NpcCombatScreen.jsx). Un estado es
 * {"tipo": <clave>, "turns": int|null, "valor"?: int}, guardado en un array JSON
 * separado de los buffs/debuffs de stat (esos son modificadores planos; los
 * estados afectan el flujo de turno, las tiradas, o aplican daño/curación directa).
 *
 * turns=null → persiste hasta consumirse (solo marcado/protegido). Los demás
 * decrementan 1 en el tick de fin de ronda (mismo punto donde hoy se tiquean
 * buffs/debuffs) y se remueven al llegar a 0.
 *
 * Los tipos de estado (paralizado, aturdido, marcado, protegido, sangrado,
 * envenenado, debilitado, confundido, regeneracion) son nombres reservados:
 * un buff/debuff de habilidad cuyo string coincide con uno de estos se aplica
 * como estado en vez de como modificador de stat — ver uso en los controllers.
 */
trait AplicaEstadosCombate
{
    private const TIPOS_ESTADO = [
        'paralizado', 'inmune_paralisis', 'aturdido', 'marcado', 'protegido',
        'sangrado', 'envenenado', 'debilitado', 'confundido', 'regeneracion',
    ];

    /** Duración/valor por defecto de cada estado cuando se aplica desde una habilidad. */
    private const DEFAULTS_ESTADO = [
        'paralizado' => ['turns' => 1, 'valor' => 0],
        'aturdido' => ['turns' => 1, 'valor' => 0],
        'marcado' => ['turns' => null, 'valor' => 0],
        'protegido' => ['turns' => null, 'valor' => 0],
        'sangrado' => ['turns' => 2, 'valor' => 1],
        'envenenado' => ['turns' => 3, 'valor' => 2],
        'debilitado' => ['turns' => 2, 'valor' => 0],
        'confundido' => ['turns' => 1, 'valor' => 0],
        'regeneracion' => ['turns' => 2, 'valor' => 2],
    ];

    private const ESTADOS_DOT = ['sangrado' => true, 'envenenado' => true];

    private const ESTADOS_HOT = ['regeneracion' => true];

    /** ¿El string corresponde a un tipo de estado reservado (en vez de un nombre de stat)? */
    private static function esTipoEstado(string $stat): bool
    {
        return in_array($stat, self::TIPOS_ESTADO, true);
    }

    private static function tieneEstado(array $estados, string $tipo): bool
    {
        foreach ($estados as $e) {
            if (($e['tipo'] ?? null) === $tipo) {
                return true;
            }
        }

        return false;
    }

    /** Agrega un estado usando sus valores por defecto (o refresca turns al máximo si ya estaba activo). */
    private static function agregarEstadoPorTipo(array $estados, string $tipo): array
    {
        $def = self::DEFAULTS_ESTADO[$tipo] ?? ['turns' => 1, 'valor' => 0];

        return self::agregarEstado($estados, $tipo, $def['turns'], $def['valor']);
    }

    /**
     * Aplica un estado proveniente del buff/debuff de una habilidad (`$tipo` ya
     * verificado como estado reservado vía `esTipoEstado`). `paralizado` respeta
     * la inmunidad post-parálisis; el resto usa sus valores por defecto.
     */
    private static function aplicarEstadoDeHabilidad(array $estados, string $tipo): array
    {
        if ($tipo === 'paralizado') {
            return self::intentarParalizar($estados)['estados'];
        }

        return self::agregarEstadoPorTipo($estados, $tipo);
    }

    private static function agregarEstado(array $estados, string $tipo, ?int $turns, int $valor = 0): array
    {
        foreach ($estados as $i => $e) {
            if (($e['tipo'] ?? null) === $tipo) {
                $estados[$i]['turns'] = ($turns === null || ($e['turns'] ?? null) === null)
                    ? null
                    : max((int) $e['turns'], $turns);
                if ($valor > 0) {
                    $estados[$i]['valor'] = $valor;
                }

                return $estados;
            }
        }
        $estados[] = ['tipo' => $tipo, 'turns' => $turns, 'valor' => $valor];

        return $estados;
    }

    private static function quitarEstado(array $estados, string $tipo): array
    {
        return array_values(array_filter($estados, fn ($e) => ($e['tipo'] ?? null) !== $tipo));
    }

    /**
     * Intenta paralizar; si el objetivo tiene `inmune_paralisis` activa, falla en silencio.
     * Devuelve ['estados' => array, 'aplicado' => bool].
     */
    private static function intentarParalizar(array $estados): array
    {
        if (self::tieneEstado($estados, 'inmune_paralisis')) {
            return ['estados' => $estados, 'aplicado' => false];
        }

        return ['estados' => self::agregarEstadoPorTipo($estados, 'paralizado'), 'aplicado' => true];
    }

    /**
     * Al inicio del turno de un actor: si está paralizado, pierde el turno, se le
     * quita el estado y gana inmunidad para el próximo intento de paralizarlo.
     * Devuelve ['estados' => array, 'paralizado' => bool].
     */
    private static function resolverParalisisAlEmpezarTurno(array $estados): array
    {
        if (! self::tieneEstado($estados, 'paralizado')) {
            return ['estados' => $estados, 'paralizado' => false];
        }

        $estados = self::quitarEstado($estados, 'paralizado');
        $estados = self::agregarEstadoPorTipo($estados, 'inmune_paralisis');

        return ['estados' => $estados, 'paralizado' => true];
    }

    /** Divide a la mitad (floor) una tirada si el actor de esos estados está aturdido. */
    private static function mitigarTiradaAturdido(array $estados, int $roll): int
    {
        return self::tieneEstado($estados, 'aturdido') ? intdiv($roll, 2) : $roll;
    }

    /** Reduce a la mitad (floor) el daño infligido si el atacante está debilitado. */
    private static function mitigarDanoDebilitado(array $estadosAtacante, int $dmg): int
    {
        return self::tieneEstado($estadosAtacante, 'debilitado') ? intdiv($dmg, 2) : $dmg;
    }

    /** 50% de probabilidad de que el actor confundido ataque hacia sí mismo. */
    private static function resolverConfundido(array $estados): bool
    {
        return self::tieneEstado($estados, 'confundido') && random_int(1, 100) <= 50;
    }

    /**
     * Consume `protegido` del objetivo al recibir un ataque: si está activo, el
     * ataque falla automáticamente. Devuelve ['estados' => array, 'activo' => bool].
     */
    private static function consumirProtegido(array $estadosObjetivo): array
    {
        if (! self::tieneEstado($estadosObjetivo, 'protegido')) {
            return ['estados' => $estadosObjetivo, 'activo' => false];
        }

        return ['estados' => self::quitarEstado($estadosObjetivo, 'protegido'), 'activo' => true];
    }

    /**
     * Consume `marcado` del objetivo al recibir un ataque: si está activo, el
     * ataque es exitoso salvo que el atacante saque natural 1. Devuelve
     * ['estados' => array, 'activo' => bool, 'forzar_exito' => bool].
     */
    private static function consumirMarcado(array $estadosObjetivo, int $atkDadoNatural): array
    {
        if (! self::tieneEstado($estadosObjetivo, 'marcado')) {
            return ['estados' => $estadosObjetivo, 'activo' => false, 'forzar_exito' => false];
        }

        return [
            'estados' => self::quitarEstado($estadosObjetivo, 'marcado'),
            'activo' => true,
            'forzar_exito' => $atkDadoNatural !== 1,
        ];
    }

    /**
     * Tick de fin de ronda: aplica sangrado/envenenado/regeneración sobre `$hp`
     * (tope `$maxHp` solo para regeneración) y descuenta turns a cada estado con
     * duración numérica (marcado/protegido con turns=null no decrementan, solo
     * se consumen). Devuelve ['estados' => array, 'hp' => int, 'mensajes' => string[]].
     */
    private static function tickEstadosRonda(array $estados, int $hp, int $maxHp, string $nombreActor): array
    {
        $mensajes = [];
        $restantes = [];

        foreach ($estados as $e) {
            $tipo = $e['tipo'] ?? '';
            $turns = $e['turns'] ?? null;
            $valor = (int) ($e['valor'] ?? 0);

            if (isset(self::ESTADOS_DOT[$tipo]) && $valor > 0) {
                $hp = max(0, $hp - $valor);
                $mensajes[] = "{$nombreActor} sufre {$tipo}: −{$valor} vida";
            } elseif (isset(self::ESTADOS_HOT[$tipo]) && $valor > 0) {
                $hp = min($maxHp, $hp + $valor);
                $mensajes[] = "{$nombreActor} se regenera: +{$valor} vida";
            }

            if ($turns === null) {
                $restantes[] = $e;

                continue;
            }
            $turns -= 1;
            if ($turns > 0) {
                $restantes[] = array_merge($e, ['turns' => $turns]);
            }
        }

        return ['estados' => $restantes, 'hp' => $hp, 'mensajes' => $mensajes];
    }
}
