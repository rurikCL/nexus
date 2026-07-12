<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Emboscadas piratas al viajar entre planetas de un sistema hostil.
     * Se persiste el encuentro (en vez de resolverlo solo en el cliente) para
     * que la recompensa de créditos al ganar se calcule y valide en el servidor.
     */
    public function up(): void
    {
        Schema::create('pirata_encuentros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('nave_id')->constrained('map_naves')->cascadeOnDelete();
            $table->boolean('resuelto')->default(false);
            $table->unsignedInteger('credits_awarded')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pirata_encuentros');
    }
};
