<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('grado')->nullable()->after('tier'); // 1-5, solo caballeros
            $table->string('clase')->nullable()->after('grado');             // Sentinela | Guardian | Consul
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['grado', 'clase']);
        });
    }
};
