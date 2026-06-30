<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->string('icono')->nullable()->after('nombre');
            $table->unsignedSmallInteger('cooldown')->default(0)->after('damage');
            $table->enum('objetivo', ['target', 'self'])->default('target')->after('cooldown');
            $table->json('buff')->nullable()->after('objetivo');
            $table->json('debuff')->nullable()->after('buff');
        });
    }

    public function down(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->dropColumn(['icono', 'cooldown', 'objetivo', 'buff', 'debuff']);
        });
    }
};
