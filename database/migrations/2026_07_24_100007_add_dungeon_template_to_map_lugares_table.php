<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un map_lugares con tipo='portal_dungeon' y dungeon_template_id seteado
 * actúa como entrada de dungeon: DungeonController::unirse lo usa para saber
 * qué template instanciar (ver 'tipo', ya string libre desde
 * 2026_07_12_000001_add_tipo_and_pase_to_map_lugares_table, sin necesidad de
 * migrar un enum para agregar este nuevo valor).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_lugares', function (Blueprint $table) {
            $table->foreignId('dungeon_template_id')->nullable()->after('pase')
                ->constrained('dungeon_templates')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('map_lugares', function (Blueprint $table) {
            $table->dropForeign(['dungeon_template_id']);
            $table->dropColumn('dungeon_template_id');
        });
    }
};
