<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Permite poseer varias unidades del mismo objeto (p.ej. comprado varias
     * veces a un vendedor) sin romper la unicidad (character_id, rol_objeto_id).
     */
    public function up(): void
    {
        Schema::table('rol_character_objeto', function (Blueprint $table) {
            $table->unsignedInteger('cantidad')->default(1)->after('rol_objeto_id');
        });
    }

    public function down(): void
    {
        Schema::table('rol_character_objeto', function (Blueprint $table) {
            $table->dropColumn('cantidad');
        });
    }
};
