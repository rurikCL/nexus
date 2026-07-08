<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const NUMERALES = ['I', 'II', 'III', 'IV', 'V'];
    private const REZAS     = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'];
    private const STATS     = ['bono_ataque', 'bono_defensa', 'bono_punteria', 'bono_movimiento', 'bono_iniciativa', 'bono_vida', 'bono_escudo'];

    private const CATEGORIAS = [
        'nucleo_energia'    => 'Núcleo de Energía',
        'lente_enfoque'     => 'Lente de Enfoque',
        'emisor'            => 'Emisor',
        'estabilizador'     => 'Estabilizador',
        'modulo_activacion' => 'Módulo de Activación',
        'empunadura'        => 'Empuñadura',
        'accesorio'         => 'Accesorio',
    ];

    private const DESCRIPCIONES = [
        'nucleo_energia'    => 'Regula el flujo de energía hacia el cristal.',
        'lente_enfoque'     => 'Concentra la energía antes de emitir la hoja.',
        'emisor'            => 'Da forma al plasma de contención de la hoja.',
        'estabilizador'     => 'Mantiene constante el flujo de energía en combate.',
        'modulo_activacion' => 'Controla el encendido y las funciones especiales del sable.',
        'empunadura'        => 'Define el balance y la ergonomía del sable.',
        'accesorio'         => 'Mejora adicional acoplada al cuerpo del sable.',
    ];

    private const COLORES_CRISTAL = [
        'azul'    => 'Azul',
        'rojo'    => 'Rojo',
        'verde'   => 'Verde',
        'purpura' => 'Púrpura',
        'cian'    => 'Cian',
    ];

    public function up(): void
    {
        $now  = now();
        $rows = [];

        foreach (self::CATEGORIAS as $tipo => $label) {
            foreach (self::NUMERALES as $i => $numeral) {
                $rows[] = $this->fila(
                    nombre: "{$label} Mk-{$numeral}",
                    tipo: $tipo,
                    descripcion: self::DESCRIPCIONES[$tipo],
                    tier: $i,
                    now: $now,
                );
            }
        }

        foreach (array_values(self::COLORES_CRISTAL) as $i => $colorLabel) {
            $colorKey = array_keys(self::COLORES_CRISTAL)[$i];
            $fila = $this->fila(
                nombre: "Cristal Kyber {$colorLabel}",
                tipo: 'cristal',
                descripcion: 'Determina la afinidad y el color de la hoja.',
                tier: $i,
                now: $now,
            );
            $fila['color_hoja'] = $colorKey;
            $rows[] = $fila;
        }

        DB::table('rol_objetos')->insert($rows);
    }

    public function down(): void
    {
        DB::table('rol_objetos')->whereIn('nombre', $this->nombresGenerados())->delete();
    }

    private function fila(string $nombre, string $tipo, string $descripcion, int $tier, $now): array
    {
        [$min, $max] = [1 + $tier, 3 + $tier * 2];
        $bonos = $this->bonosAleatorios($min, $max);

        return array_merge([
            'nombre'      => $nombre,
            'tipo'        => $tipo,
            'rareza'      => self::REZAS[$tier],
            'descripcion' => $descripcion,
            'efecto'      => null,
            'imagen'      => null,
            'costo'       => ($tier + 1) * 150,
            'activo'      => true,
            'color_hoja'  => null,
            'created_at'  => $now,
            'updated_at'  => $now,
        ], $bonos);
    }

    private function bonosAleatorios(int $min, int $max): array
    {
        $keys = self::STATS;
        shuffle($keys);
        $elegidas = array_slice($keys, 0, random_int(2, 3));

        $bonos = array_fill_keys(self::STATS, null);
        foreach ($elegidas as $k) {
            $bonos[$k] = random_int($min, $max);
        }

        return $bonos;
    }

    private function nombresGenerados(): array
    {
        $nombres = [];
        foreach (self::CATEGORIAS as $label) {
            foreach (self::NUMERALES as $numeral) {
                $nombres[] = "{$label} Mk-{$numeral}";
            }
        }
        foreach (self::COLORES_CRISTAL as $colorLabel) {
            $nombres[] = "Cristal Kyber {$colorLabel}";
        }

        return $nombres;
    }
};
