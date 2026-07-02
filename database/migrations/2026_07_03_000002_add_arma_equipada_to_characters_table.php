<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->foreignId('arma_equipada_id')->nullable()
                  ->constrained('rol_objetos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropForeign(['arma_equipada_id']);
            $table->dropColumn('arma_equipada_id');
        });
    }
};
