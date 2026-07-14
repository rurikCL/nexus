<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Permite damage negativo: en combate un valor negativo se interpreta como curación.
        DB::statement('ALTER TABLE rol_habilidades MODIFY damage SMALLINT NOT NULL DEFAULT 0');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE rol_habilidades MODIFY damage SMALLINT UNSIGNED NOT NULL DEFAULT 0');
    }
};
