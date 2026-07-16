<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Una sesión de entrenamiento ocurre en un lugar físico concreto — se asocia a la
 * sede de quien la crea por defecto (nullable para no romper sesiones existentes
 * ni bloquear a un encargado sin sede asignada).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            $table->foreignId('sede_id')->nullable()->after('created_by')->constrained('sedes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sede_id');
        });
    }
};
