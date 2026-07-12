<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Agrega 'nave' al enum de tipo, para habilidades de combate espacial. */
    public function up(): void
    {
        DB::statement("ALTER TABLE rol_habilidades MODIFY COLUMN tipo ENUM('melee', 'distancia', 'nave') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE rol_habilidades MODIFY COLUMN tipo ENUM('melee', 'distancia') NOT NULL");
    }
};
