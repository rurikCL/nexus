<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 4 slots de habilidad para NPCs tipo "jefe" (combate RAID) — análogo a los
 * habilidad_1..4 de map_naves. Sin efecto para el resto de tipos de NPC.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->foreignId('habilidad_1')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_2')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_3')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_4')->nullable()->constrained('rol_habilidades')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('habilidad_1');
            $table->dropConstrainedForeignId('habilidad_2');
            $table->dropConstrainedForeignId('habilidad_3');
            $table->dropConstrainedForeignId('habilidad_4');
        });
    }
};
