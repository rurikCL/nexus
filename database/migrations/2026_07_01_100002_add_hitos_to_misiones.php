<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('misiones', function (Blueprint $table) {
            $table->text('hito_requerimiento')->nullable();
            $table->text('entregar_hito')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('misiones', function (Blueprint $table) {
            $table->dropColumn(['hito_requerimiento', 'entregar_hito']);
        });
    }
};
