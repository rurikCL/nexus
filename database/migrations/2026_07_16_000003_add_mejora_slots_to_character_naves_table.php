<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 4 slots de mejora por nave poseída (rol_objetos tipo "mejora_nave"),
 * análogos a los 8 slots de componentes de un sable — cualquier slot
 * acepta cualquier mejora, sin restricción de tipo por posición.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('character_naves', function (Blueprint $table) {
            $table->foreignId('mejora_1_id')->nullable()->after('escudo_actual')->constrained('rol_objetos')->nullOnDelete();
            $table->foreignId('mejora_2_id')->nullable()->after('mejora_1_id')->constrained('rol_objetos')->nullOnDelete();
            $table->foreignId('mejora_3_id')->nullable()->after('mejora_2_id')->constrained('rol_objetos')->nullOnDelete();
            $table->foreignId('mejora_4_id')->nullable()->after('mejora_3_id')->constrained('rol_objetos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('character_naves', function (Blueprint $table) {
            $table->dropConstrainedForeignId('mejora_1_id');
            $table->dropConstrainedForeignId('mejora_2_id');
            $table->dropConstrainedForeignId('mejora_3_id');
            $table->dropConstrainedForeignId('mejora_4_id');
        });
    }
};
