<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Balizas de ayuda activas — se crean al usar un objeto tipo `utilizable_mundo` desde el
 * Mapa (ver BalizaController::store). Son visibles globalmente (widget "Alertas de Ayuda"
 * en Comando) y en el lugar donde se desplegaron, hasta que expiran (12h) o su creador
 * las elimina.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('balizas_ayuda', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rol_objeto_id')->nullable()->constrained('rol_objetos')->nullOnDelete();
            $table->string('nombre');
            $table->foreignId('map_sistema_id')->nullable()->constrained('map_sistemas')->nullOnDelete();
            $table->foreignId('map_planeta_id')->nullable()->constrained('map_planetas')->nullOnDelete();
            $table->foreignId('map_zona_id')->nullable()->constrained('map_zonas')->nullOnDelete();
            $table->foreignId('map_lugar_id')->nullable()->constrained('map_lugares')->nullOnDelete();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('balizas_ayuda');
    }
};
