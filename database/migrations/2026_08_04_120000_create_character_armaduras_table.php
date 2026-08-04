<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Armadura poseída por un personaje: instancia de un rol_objeto tipo "armadura"
 * con 4 slots de mejora (rol_objetos tipo "mejora_armadura"), análogos a los 4
 * slots de una nave — cualquier slot acepta cualquier mejora, sin restricción
 * de tipo por posición. Los slots viven en la instancia (no en el personaje)
 * para que cada armadura conserve sus mejoras al cambiar entre ellas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('character_armaduras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained('characters')->cascadeOnDelete();
            $table->foreignId('objeto_id')->constrained('rol_objetos')->cascadeOnDelete();
            $table->boolean('activo')->default(false);

            foreach ([1, 2, 3, 4] as $i) {
                $table->foreignId("mejora_{$i}_id")->nullable()->constrained('rol_objetos')->nullOnDelete();
            }

            $table->timestamps();

            // Una sola instancia por modelo de armadura poseído: si el personaje tiene 2
            // unidades de la misma armadura, comparten slots (igual que el inventario, que
            // lleva `cantidad` en vez de filas separadas).
            $table->unique(['character_id', 'objeto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_armaduras');
    }
};
