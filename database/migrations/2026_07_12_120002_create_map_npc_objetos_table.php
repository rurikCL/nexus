<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Objetos que un NPC "vendedor" tiene a la venta, con el interés (%) que
     * aplica sobre el costo base de cada objeto para llegar al precio final.
     */
    public function up(): void
    {
        Schema::create('map_npc_objetos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('npc_id')->constrained('map_npcs')->cascadeOnDelete();
            $table->foreignId('rol_objeto_id')->constrained('rol_objetos')->cascadeOnDelete();
            $table->unsignedInteger('interes')->default(0);
            $table->timestamps();
            $table->unique(['npc_id', 'rol_objeto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_npc_objetos');
    }
};
