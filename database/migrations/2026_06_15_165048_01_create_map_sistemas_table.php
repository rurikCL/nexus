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
        Schema::create('map_sistemas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('rareza')->nullable();
            $table->string('hostilidad')->nullable();
            $table->string('faccion')->nullable();
            $table->string('color')->nullable();
            $table->string('imagen')->nullable();
            $table->text('historia')->nullable();
            $table->integer('costo_viaje')->default(0);
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
        Schema::dropIfExists('map_sistemas');
    }
};
