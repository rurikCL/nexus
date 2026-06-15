<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('misiones', function (Blueprint $table) {
            $table->foreign('recompensa_id')->references('id')->on('recompensas')->nullOnDelete();
            $table->foreign('objetivo_id')->references('id')->on('objetivos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('misiones', function (Blueprint $table) {
            $table->dropForeign(['recompensa_id']);
            $table->dropForeign(['objetivo_id']);
        });
    }
};
