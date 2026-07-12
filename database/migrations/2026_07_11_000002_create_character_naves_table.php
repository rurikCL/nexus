<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Naves poseídas por un personaje. combustible/vida/escudo_actual persisten
     * el desgaste entre viajes y combates (requieren reabastecer/reparar).
     */
    public function up(): void
    {
        Schema::create('character_naves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('nave_id')->constrained('map_naves')->cascadeOnDelete();
            $table->integer('combustible_actual')->default(0);
            $table->integer('vida_actual')->default(0);
            $table->integer('escudo_actual')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_naves');
    }
};
