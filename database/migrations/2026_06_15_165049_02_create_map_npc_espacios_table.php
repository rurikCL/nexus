<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('map_npcs_espacio', function (Blueprint $table) {
            $table->id();
            $table->foreignId('SistemaID')->constrained('map_sistemas')->onDelete('cascade');
            $table->string('nombre');
            $table->string('tipo')->nullable();
            $table->foreignId('NaveID')->nullable()->constrained('map_naves')->onDelete('set null');
            $table->foreignId('NpcID')->nullable()->constrained('map_npcs')->onDelete('set null');
            $table->text('cargamento')->nullable();
            $table->string('hostilidad')->nullable();
            $table->string('saludo')->nullable();
            $table->text('interaccion')->nullable();
            $table->unsignedBigInteger('MisionID')->nullable();
            $table->string('urlInteraccion')->nullable();
            $table->boolean('visible')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_npcs_espacio');
    }
};
