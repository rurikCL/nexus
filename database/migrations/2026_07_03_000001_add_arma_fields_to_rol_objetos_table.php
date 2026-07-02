<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->string('tipo_ataque')->nullable()->after('tipo');
            $table->unsignedSmallInteger('dano')->nullable()->after('tipo_ataque');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['tipo_ataque', 'dano']);
        });
    }
};
