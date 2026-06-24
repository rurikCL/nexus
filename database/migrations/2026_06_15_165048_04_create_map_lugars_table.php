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
        if (!Schema::hasTable('map_lugares')) {
            Schema::create('map_lugares', function (Blueprint $table) {
                $table->id();
                $table->foreignId('ZonaID')->constrained('map_zonas')->onDelete('cascade');
                $table->string('nombre');
                $table->string('rareza')->nullable();
                $table->string('tipo')->default('exterior');
                $table->foreignId('pase')->nullable()->constrained('rol_objetos')->nullOnDelete();
                $table->foreignId('lugarNorteID')->nullable()->constrained('map_lugares')->onDelete('set null');
                $table->foreignId('lugarSurID')->nullable()->constrained('map_lugares')->onDelete('set null');
                $table->foreignId('lugarEsteID')->nullable()->constrained('map_lugares')->onDelete('set null');
                $table->foreignId('lugarOesteID')->nullable()->constrained('map_lugares')->onDelete('set null');
                $table->string('imagen')->nullable();
                $table->text('historia')->nullable();
                $table->boolean('visible')->default(true);
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            // Recuperación de producción: la tabla existía sin el FK de 'pase'
            // porque rol_objetos no existía aún cuando se ejecutó la migración original.
            Schema::table('map_lugares', function (Blueprint $table) {
                $table->foreign('pase')->references('id')->on('rol_objetos')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_lugares');
    }
};
