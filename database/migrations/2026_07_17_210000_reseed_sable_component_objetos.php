<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const REZAS = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'];

    /* Nombres generados por el seeder anterior (2026_07_07_223106_seed_sable_component_objetos.php),
       a reemplazar por el catálogo determinístico de abajo. */
    private const CATEGORIAS_ANTIGUAS = [
        'Núcleo de Energía', 'Lente de Enfoque', 'Emisor', 'Estabilizador',
        'Módulo de Activación', 'Empuñadura', 'Accesorio',
    ];
    private const NUMERALES_ANTIGUOS = ['I', 'II', 'III', 'IV', 'V'];
    private const COLORES_ANTIGUOS   = ['Azul', 'Rojo', 'Verde', 'Púrpura', 'Cian'];

    public function up(): void
    {
        $this->borrarSetAnterior();

        $now  = now();
        $rows = array_map(
            fn (array $def) => $this->fila($def, $now),
            $this->definiciones()
        );

        DB::table('rol_objetos')->insert($rows);
    }

    public function down(): void
    {
        DB::table('rol_objetos')->whereIn('nombre', array_column($this->definiciones(), 'nombre'))->delete();
    }

    private function borrarSetAnterior(): void
    {
        $nombres = [];
        foreach (self::CATEGORIAS_ANTIGUAS as $label) {
            foreach (self::NUMERALES_ANTIGUOS as $numeral) {
                $nombres[] = "{$label} Mk-{$numeral}";
            }
        }
        foreach (self::COLORES_ANTIGUOS as $colorLabel) {
            $nombres[] = "Cristal Kyber {$colorLabel}";
        }

        DB::table('rol_objetos')->whereIn('nombre', $nombres)->delete();
    }

    private function fila(array $def, $now): array
    {
        return array_merge([
            'tipo'        => $def['tipo'],
            'rareza'      => $def['rareza'],
            'descripcion' => $def['descripcion'],
            'efecto'      => null,
            'imagen'      => null,
            'costo'       => (array_search($def['rareza'], self::REZAS, true) + 1) * 150,
            'activo'      => true,
            'color_hoja'  => $def['color_hoja'] ?? null,
            'bono_ataque' => null, 'bono_defensa' => null, 'bono_punteria' => null,
            'bono_movimiento' => null, 'bono_iniciativa' => null, 'bono_vida' => null, 'bono_escudo' => null,
            'bono_dano' => null, 'bono_dano_perforante' => null, 'bono_critico' => null,
            'bono_fuerza' => null, 'bono_generacion_fuerza' => null,
            'consumo_energia' => $def['consumo_energia'],
            'energia_maxima'  => $def['energia_maxima'] ?? null,
            'created_at'  => $now,
            'updated_at'  => $now,
        ], $def['bonos'] ?? [], ['nombre' => $def['nombre']]);
    }

    /**
     * Catálogo determinístico: un objeto por rareza para cada tipo de pieza de sable (5×8 = 40).
     *
     * Reglas aplicadas:
     *  - Ningún objeto supera 4 puntos de bono en total, y ese total es exactamente su consumo_energia.
     *  - Cada tipo se especializa en 1-2 bonos fijos (ver comentario de cada bloque).
     *  - Progresión por rareza (comun→legendario): el bono principal escala 1→2→3, luego épico
     *    reparte 2/2 entre ambos bonos de la especialidad, y legendario concentra los 4 puntos
     *    en el bono secundario (excepto Cristal, cuyo tope de 2 por atributo se lo impide).
     */
    private function definiciones(): array
    {
        $defs = [];

        // Núcleo de Energía: sin bonos de combate, solo energía máxima (8-16). No consume energía (es la fuente).
        $defs = array_merge($defs, $this->serie(
            tipo: 'nucleo_energia',
            descripcion: 'Regula el flujo de energía hacia el cristal y define la capacidad máxima del sable.',
            nombres: [
                'Célula de Energía Estándar', 'Célula de Energía Reforzada', 'Célula Diatium de Precisión',
                'Célula Diatium de Maestro', 'Núcleo Diatium Ancestral',
            ],
            bonosPorTier: [[], [], [], [], []],
            energiaMaximaPorTier: [8, 10, 12, 14, 16],
        ));

        // Emisor: Defensa o Vida.
        $defs = array_merge($defs, $this->serie(
            tipo: 'emisor',
            descripcion: 'Da forma al plasma de contención de la hoja.',
            nombres: [
                'Matriz Emisora Estándar', 'Matriz Emisora Reforzada', 'Emisor de Contención de Precisión',
                'Emisor de Contención de Maestro', 'Emisor Ancestral de Convergencia',
            ],
            bonosPorTier: [
                ['bono_defensa' => 1],
                ['bono_defensa' => 2],
                ['bono_defensa' => 3],
                ['bono_defensa' => 2, 'bono_vida' => 2],
                ['bono_vida' => 4],
            ],
        ));

        // Cristal: color de hoja + Fuerza y Regeneración de Fuerza (máx. 2 por atributo).
        $defs = array_merge($defs, $this->serie(
            tipo: 'cristal',
            descripcion: 'Determina la afinidad y el color de la hoja.',
            nombres: [
                'Cristal Kyber Azul', 'Cristal Kyber Verde', 'Cristal Kyber Cian',
                'Cristal Kyber Púrpura', 'Cristal Kyber Blanco',
            ],
            bonosPorTier: [
                ['bono_fuerza' => 1],
                ['bono_fuerza' => 2],
                ['bono_fuerza' => 2, 'bono_generacion_fuerza' => 1],
                ['bono_fuerza' => 2, 'bono_generacion_fuerza' => 2],
                ['bono_fuerza' => 2, 'bono_generacion_fuerza' => 2],
            ],
            colorPorTier: ['azul', 'verde', 'cian', 'purpura', 'blanco'],
        ));

        // Estabilizador: Escudo (máx. 2) y Vida.
        $defs = array_merge($defs, $this->serie(
            tipo: 'estabilizador',
            descripcion: 'Mantiene constante el flujo de energía en combate.',
            nombres: [
                'Anillo Estabilizador Estándar', 'Anillo Estabilizador Reforzado', 'Anillo Estabilizador de Precisión',
                'Anillo Estabilizador de Maestro', 'Anillo Estabilizador Ancestral',
            ],
            bonosPorTier: [
                ['bono_escudo' => 1],
                ['bono_escudo' => 2],
                ['bono_escudo' => 2, 'bono_vida' => 1],
                ['bono_escudo' => 2, 'bono_vida' => 2],
                ['bono_vida' => 4],
            ],
        ));

        // Módulo de Activación: Agilidad o Iniciativa.
        $defs = array_merge($defs, $this->serie(
            tipo: 'modulo_activacion',
            descripcion: 'Controla el encendido y las funciones especiales del sable.',
            nombres: [
                'Módulo de Activación Estándar', 'Módulo de Activación Reforzado', 'Módulo de Activación de Precisión',
                'Módulo de Activación de Maestro', 'Módulo de Activación Ancestral',
            ],
            bonosPorTier: [
                ['bono_movimiento' => 1],
                ['bono_movimiento' => 2],
                ['bono_movimiento' => 3],
                ['bono_movimiento' => 2, 'bono_iniciativa' => 2],
                ['bono_iniciativa' => 4],
            ],
        ));

        // Empuñadura: Ataque o Puntería.
        $defs = array_merge($defs, $this->serie(
            tipo: 'empunadura',
            descripcion: 'Define el balance y la ergonomía del sable.',
            nombres: [
                'Empuñadura Estándar', 'Empuñadura Reforzada', 'Empuñadura de Precisión',
                'Empuñadura de Maestro', 'Empuñadura Ancestral',
            ],
            bonosPorTier: [
                ['bono_ataque' => 1],
                ['bono_ataque' => 2],
                ['bono_ataque' => 3],
                ['bono_ataque' => 2, 'bono_punteria' => 2],
                ['bono_punteria' => 4],
            ],
        ));

        // Lente de Enfoque: Daño y Daño Perforante.
        $defs = array_merge($defs, $this->serie(
            tipo: 'lente_enfoque',
            descripcion: 'Concentra la energía antes de emitir la hoja.',
            nombres: [
                'Lente de Enfoque Estándar', 'Lente de Enfoque Reforzada', 'Lente de Enfoque de Precisión',
                'Lente de Enfoque de Maestro', 'Lente de Enfoque Ancestral',
            ],
            bonosPorTier: [
                ['bono_dano' => 1],
                ['bono_dano' => 2],
                ['bono_dano' => 3],
                ['bono_dano' => 2, 'bono_dano_perforante' => 2],
                ['bono_dano_perforante' => 4],
            ],
        ));

        // Accesorio: cualquier bono — se especializa en Crítico y Generación de Fuerza,
        // dos atributos que ningún otro tipo de pieza otorga como especialidad principal.
        $defs = array_merge($defs, $this->serie(
            tipo: 'accesorio',
            descripcion: 'Mejora adicional acoplada al cuerpo del sable.',
            nombres: [
                'Accesorio de Sable Estándar', 'Accesorio de Sable Reforzado', 'Accesorio de Sable de Precisión',
                'Accesorio de Sable de Maestro', 'Accesorio de Sable Ancestral',
            ],
            bonosPorTier: [
                ['bono_critico' => 1],
                ['bono_critico' => 2],
                ['bono_critico' => 3],
                ['bono_critico' => 2, 'bono_generacion_fuerza' => 2],
                ['bono_generacion_fuerza' => 4],
            ],
        ));

        return $defs;
    }

    private function serie(
        string $tipo,
        string $descripcion,
        array $nombres,
        array $bonosPorTier,
        ?array $energiaMaximaPorTier = null,
        ?array $colorPorTier = null,
    ): array {
        $out = [];
        foreach (self::REZAS as $i => $rareza) {
            $bonos = $bonosPorTier[$i];
            $out[] = [
                'nombre'          => $nombres[$i],
                'tipo'            => $tipo,
                'rareza'          => $rareza,
                'descripcion'     => $descripcion,
                'bonos'           => $bonos,
                'consumo_energia' => array_sum($bonos),
                'energia_maxima'  => $energiaMaximaPorTier[$i] ?? null,
                'color_hoja'      => $colorPorTier[$i] ?? null,
            ];
        }

        return $out;
    }
};
